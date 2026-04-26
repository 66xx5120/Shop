import { Context } from 'hono';
import { Env } from '../types';
import { authenticate } from '../auth';

export async function recharge(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const { customerId, amount, remark } = await c.req.json();
  if (!customerId || !amount || amount <= 0) {
    return c.json({ success: false, message: '请填写有效的会员ID和金额' }, 400);
  }
  // 更新余额
  await c.env.DB.prepare('UPDATE t_customer SET balance = balance + ? WHERE id = ?')
    .bind(amount, customerId).run();
  // 记录充值流水
  await c.env.DB.prepare(
    'INSERT INTO t_recharge_record (customer_id, amount, remark) VALUES (?, ?, ?)'
  ).bind(customerId, amount, remark || '').run();
  // 审计
  await c.env.DB.prepare(
    'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
  ).bind('RECHARGE', 'Transaction', `会员 ${customerId} 充值 ${amount}`, user.managerId).run();
  return c.json({ success: true, message: '充值成功' });
}

export async function consume(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const { customerId, employeeId, serviceTypeId, amount, verifyCode, remark } = await c.req.json();
  if (!customerId || !amount || amount <= 0 || !verifyCode) {
    return c.json({ success: false, message: '请填写完整信息' }, 400);
  }
  // 验证校验码
  const customer = await c.env.DB.prepare(
    'SELECT verify_code, balance FROM t_customer WHERE id = ?'
  ).bind(customerId).first();
  if (!customer || (customer as any).verify_code !== verifyCode) {
    return c.json({ success: false, message: '校验码错误' }, 400);
  }
  const currentBalance = (customer as any).balance;
  if (currentBalance < amount) {
    return c.json({ success: false, message: '余额不足' }, 400);
  }
  // 扣款
  await c.env.DB.prepare('UPDATE t_customer SET balance = balance - ? WHERE id = ?')
    .bind(amount, customerId).run();
  // 记录消费流水
  await c.env.DB.prepare(
    `INSERT INTO t_consume_record 
     (customer_id, employee_id, service_type_id, amount, verify_code, remark) 
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(customerId, employeeId || null, serviceTypeId || null, amount, verifyCode, remark || '').run();
  // 审计
  await c.env.DB.prepare(
    'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
  ).bind('CONSUME', 'Transaction', `会员 ${customerId} 消费 ${amount}`, user.managerId).run();
  return c.json({ success: true, message: '消费成功' });
}

export async function getTransactions(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const size = parseInt(url.searchParams.get('size') || '10');
  const keyword = url.searchParams.get('keyword') || '';
  const offset = (page - 1) * size;
  
  // 联合查询：充值记录 + 消费记录（关联服务名称）
  // 注意：为了获取服务名称，消费记录需要 LEFT JOIN t_service_type
  const rechargeQuery = `
    SELECT 
      r.id, 
      'recharge' as type, 
      r.customer_id, 
      r.amount, 
      r.remark, 
      r.created_at,
      NULL as employee_id, 
      NULL as service_type_id,
      NULL as service_name
    FROM t_recharge_record r
    WHERE (? = '' OR CAST(r.customer_id AS TEXT) LIKE ? OR r.remark LIKE ?)
  `;
  
  const consumeQuery = `
    SELECT 
      c.id, 
      'consume' as type, 
      c.customer_id, 
      c.amount, 
      c.remark, 
      c.created_at,
      c.employee_id, 
      c.service_type_id,
      s.name as service_name
    FROM t_consume_record c
    LEFT JOIN t_service_type s ON c.service_type_id = s.id
    WHERE (? = '' OR CAST(c.customer_id AS TEXT) LIKE ? OR c.remark LIKE ?)
  `;
  
  const unionSql = `${rechargeQuery} UNION ALL ${consumeQuery} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const likePattern = `%${keyword}%`;
  const items = await c.env.DB.prepare(unionSql)
    .bind(keyword, likePattern, likePattern, keyword, likePattern, likePattern, size, offset)
    .all();
  
  // 获取总数
  const countSql = `
    SELECT 
      (SELECT COUNT(*) FROM t_recharge_record WHERE ? = '' OR CAST(customer_id AS TEXT) LIKE ? OR remark LIKE ?) +
      (SELECT COUNT(*) FROM t_consume_record WHERE ? = '' OR CAST(customer_id AS TEXT) LIKE ? OR remark LIKE ?) as total
  `;
  const totalRes = await c.env.DB.prepare(countSql)
    .bind(keyword, likePattern, likePattern, keyword, likePattern, likePattern).first();
  const total = (totalRes as any)?.total || 0;
  
  // 补充会员姓名并构造 detail 字段
  const results = [];
  for (const item of items.results) {
    const cust = await c.env.DB.prepare('SELECT name FROM t_customer WHERE id = ?').bind(item.customer_id).first();
    const customerName = (cust as any)?.name || '未知';
    
    let detail = '';
    if (item.type === 'recharge') {
      // 充值详情：充值 或 充值-备注
      detail = item.remark ? `充值-${item.remark}` : '充值';
    } else {
      // 消费详情：消费-服务名称 或 消费-服务名称-备注
      const serviceName = item.service_name || '';
      const remark = item.remark || '';
      if (serviceName && remark) {
        detail = `消费-${serviceName}-${remark}`;
      } else if (serviceName) {
        detail = `消费-${serviceName}`;
      } else if (remark) {
        detail = `消费-${remark}`;
      } else {
        detail = '消费';
      }
    }
    
    results.push({
      id: item.id,
      type: item.type,
      customerId: item.customer_id,
      customerName: customerName,
      amount: item.amount,
      createdAt: item.created_at,
      detail: detail,
      remark: item.remark,
      employeeId: item.employee_id,
      serviceTypeId: item.service_type_id
    });
  }
  
  return c.json({
    success: true,
    data: {
      items: results,
      page,
      size,
      total,
      totalPages: Math.ceil(total / size)
    }
  });
}
