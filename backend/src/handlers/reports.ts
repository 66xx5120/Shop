import { Context } from 'hono';
import { Env } from '../types';
import { authenticate } from '../auth';

export async function getDashboard(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  // 活跃会员（近期有消费，简单按状态active）
  const activeCustomers = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM t_customer WHERE status = 'active'"
  ).first();
  const totalBalance = await c.env.DB.prepare(
    "SELECT SUM(balance) as sum FROM t_customer WHERE status = 'active'"
  ).first();
  // 今日充值
  const todayRecharge = await c.env.DB.prepare(
    "SELECT SUM(amount) as sum FROM t_recharge_record WHERE DATE(created_at) = DATE('now')"
  ).first();
  // 今日消费
  const todayConsume = await c.env.DB.prepare(
    "SELECT SUM(amount) as sum FROM t_consume_record WHERE DATE(created_at) = DATE('now')"
  ).first();
  
  return c.json({
    success: true,
    data: {
      activeCustomers: (activeCustomers as any)?.count || 0,
      totalBalance: (totalBalance as any)?.sum || 0,
      todayRecharge: (todayRecharge as any)?.sum || 0,
      todayConsume: (todayConsume as any)?.sum || 0
    }
  });
}

export async function getSummary(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const url = new URL(c.req.url);
  const startDate = url.searchParams.get('startDate') || '1970-01-01';
  const endDate = url.searchParams.get('endDate') || '2099-12-31';
  
  const totalRecharge = await c.env.DB.prepare(
    "SELECT SUM(amount) as sum FROM t_recharge_record WHERE DATE(created_at) BETWEEN ? AND ?"
  ).bind(startDate, endDate).first();
  const totalConsume = await c.env.DB.prepare(
    "SELECT SUM(amount) as sum FROM t_consume_record WHERE DATE(created_at) BETWEEN ? AND ?"
  ).bind(startDate, endDate).first();
  const totalCustomers = await c.env.DB.prepare("SELECT COUNT(*) as count FROM t_customer").first();
  const newCustomers = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM t_customer WHERE DATE(created_at) BETWEEN ? AND ?"
  ).bind(startDate, endDate).first();
  const activeCustomers = await c.env.DB.prepare(
    "SELECT COUNT(DISTINCT customer_id) as count FROM t_consume_record WHERE DATE(created_at) BETWEEN ? AND ?"
  ).bind(startDate, endDate).first();
  
  // 新增：所有会员当前余额总和
  const totalBalanceRes = await c.env.DB.prepare("SELECT SUM(balance) as sum FROM t_customer").first();
  const totalBalance = (totalBalanceRes as any)?.sum || 0;
  
  return c.json({
    success: true,
    data: {
      total_recharge: (totalRecharge as any)?.sum || 0,
      total_consume: (totalConsume as any)?.sum || 0,
      total_customers: (totalCustomers as any)?.count || 0,
      new_customers: (newCustomers as any)?.count || 0,
      active_customers: (activeCustomers as any)?.count || 0,
      total_balance: totalBalance
    }
  });
}

export async function getEmployeePerformance(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const url = new URL(c.req.url);
  const startDate = url.searchParams.get('startDate') || '1970-01-01';
  const endDate = url.searchParams.get('endDate') || '2099-12-31';
  
  const sql = `
    SELECT e.id as employeeId, e.name as employeeName,
           COUNT(c.id) as total_count,
           COALESCE(SUM(c.amount), 0) as total_amount,
           COALESCE(AVG(c.amount), 0) as avg_amount
    FROM t_employee e
    LEFT JOIN t_consume_record c ON e.id = c.employee_id AND DATE(c.created_at) BETWEEN ? AND ?
    GROUP BY e.id
    ORDER BY total_amount DESC
  `;
  const result = await c.env.DB.prepare(sql).bind(startDate, endDate).all();
  return c.json({ success: true, data: result.results });
}

export async function getServiceBreakdown(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const url = new URL(c.req.url);
  const startDate = url.searchParams.get('startDate') || '1970-01-01';
  const endDate = url.searchParams.get('endDate') || '2099-12-31';
  
  const sql = `
    SELECT s.id as serviceTypeId, s.name as serviceName,
           COUNT(c.id) as total_count,
           COALESCE(SUM(c.amount), 0) as total_amount
    FROM t_service_type s
    LEFT JOIN t_consume_record c ON s.id = c.service_type_id AND DATE(c.created_at) BETWEEN ? AND ?
    GROUP BY s.id
    ORDER BY total_amount DESC
  `;
  const result = await c.env.DB.prepare(sql).bind(startDate, endDate).all();
  return c.json({ success: true, data: result.results });
}

// 会员消费明细查询
export async function getCustomerConsumeDetails(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const url = new URL(c.req.url);
  const startDate = url.searchParams.get('startDate') || '1970-01-01';
  const endDate = url.searchParams.get('endDate') || '2099-12-31';
  const customerName = url.searchParams.get('customerName') || '';
  
  // 查找会员（支持模糊匹配，取第一个）
  let customerId = null;
  let customerInfo = null;
  if (customerName) {
    const customerRes = await c.env.DB.prepare(
      "SELECT id, name FROM t_customer WHERE name LIKE ? LIMIT 1"
    ).bind(`%${customerName}%`).first();
    if (customerRes) {
      customerId = (customerRes as any).id;
      customerInfo = customerRes;
    }
  }
  
  if (!customerId) {
    return c.json({ success: true, data: { customer: null, summary: { totalAmount: 0, totalCount: 0 }, items: [] } });
  }
  
  // 查询该会员在日期范围内的消费记录，关联服务名称
  const items = await c.env.DB.prepare(
    `SELECT 
       c.id, c.amount, c.remark, c.created_at,
       s.name as service_name
     FROM t_consume_record c
     LEFT JOIN t_service_type s ON c.service_type_id = s.id
     WHERE c.customer_id = ? AND DATE(c.created_at) BETWEEN ? AND ?
     ORDER BY c.created_at DESC`
  ).bind(customerId, startDate, endDate).all();
  
  const records = items.results;
  const totalAmount = records.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
  const totalCount = records.length;
  
  // 构建明细列表
  const details = records.map((r: any) => ({
    id: r.id,
    amount: r.amount,
    remark: r.remark,
    createdAt: r.created_at,
    serviceName: r.service_name || '',
    detail: r.remark ? `${r.service_name || '消费'}-${r.remark}` : (r.service_name || '消费')
  }));
  
  return c.json({
    success: true,
    data: {
      customer: customerInfo,
      summary: {
        totalAmount,
        totalCount
      },
      items: details
    }
  });
}

// 服务/备注消费查询
export async function getServiceRemarkConsume(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);

  const url = new URL(c.req.url);
  const startDate = url.searchParams.get('startDate') || '1970-01-01';
  const endDate = url.searchParams.get('endDate') || '2099-12-31';
  const serviceTypeId = url.searchParams.get('serviceTypeId') || '';
  const remarkKeyword = url.searchParams.get('remarkKeyword') || '';

  let sql = `
    SELECT 
      c.id,
      c.amount,
      c.remark as consume_remark,
      c.created_at,
      c.customer_id,
      s.name as service_name,
      cust.name as customer_name,
      cust.phone as customer_phone
    FROM t_consume_record c
    LEFT JOIN t_service_type s ON c.service_type_id = s.id
    LEFT JOIN t_customer cust ON c.customer_id = cust.id
    WHERE DATE(c.created_at) BETWEEN ? AND ?
  `;
  const params: any[] = [startDate, endDate];

  if (serviceTypeId) {
    sql += ` AND c.service_type_id = ?`;
    params.push(serviceTypeId);
  }
  if (remarkKeyword) {
    sql += ` AND c.remark LIKE ?`;
    params.push(`%${remarkKeyword}%`);
  }

  sql += ` ORDER BY c.created_at DESC`;

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  const records = result.results || [];

  // 构造返回数据
  const items = records.map((r: any) => ({
    id: r.id,
    amount: r.amount,
    remark: r.consume_remark,
    createdAt: r.created_at,
    serviceName: r.service_name || '(未选择服务)',
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    detail: r.consume_remark 
      ? `${r.service_name || '消费'}-${r.consume_remark}` 
      : (r.service_name || '消费')
  }));

  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalCount = items.length;

  return c.json({
    success: true,
    data: {
      items,
      summary: { totalAmount, totalCount }
    }
  });
}
