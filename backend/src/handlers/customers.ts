import { Context } from 'hono';
import { Env } from '../types';
import { authenticate } from '../auth';

export async function getCustomers(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const size = parseInt(url.searchParams.get('size') || '10');
  const keyword = url.searchParams.get('keyword') || '';
  
  const offset = (page - 1) * size;
  let query = 'SELECT * FROM t_customer WHERE 1=1';
  const params: any[] = [];
  if (keyword) {
    query += ' AND (name LIKE ? OR phone LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const totalResult = await c.env.DB.prepare(countQuery).bind(...params).first();
  const total = (totalResult as any)?.total || 0;
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(size, offset);
  const customers = await c.env.DB.prepare(query).bind(...params).all();
  
  return c.json({
    success: true,
    data: {
      items: customers.results,
      page,
      size,
      total,
      totalPages: Math.ceil(total / size)
    }
  });
}

export async function createCustomer(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const { name, phone, verifyCode, remark, initialRechargeAmount } = await c.req.json();
  if (!name || !phone) {
    return c.json({ success: false, message: '姓名和手机号不能为空' }, 400);
  }

  // 检查手机号是否已存在
  const existing = await c.env.DB.prepare(
    'SELECT id FROM t_customer WHERE phone = ?'
  ).bind(phone).first();
  if (existing) {
    return c.json({ success: false, message: `手机号 ${phone} 已存在，请勿重复添加` }, 400);
  }

  const finalVerifyCode = verifyCode || phone.slice(-4);
  let balance = 0;
  
  const result = await c.env.DB.prepare(
    'INSERT INTO t_customer (name, phone, verify_code, remark, balance) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, phone, finalVerifyCode, remark || '', balance).run();
  const customerId = result.meta.last_row_id;
  
  if (initialRechargeAmount && initialRechargeAmount > 0) {
    await c.env.DB.prepare(
      'UPDATE t_customer SET balance = balance + ? WHERE id = ?'
    ).bind(initialRechargeAmount, customerId).run();
    await c.env.DB.prepare(
      'INSERT INTO t_recharge_record (customer_id, amount, remark) VALUES (?, ?, ?)'
    ).bind(customerId, initialRechargeAmount, '首次充值').run();
    await c.env.DB.prepare(
      'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
    ).bind('CREATE', 'Customer', `创建会员 ${name} 并充值 ${initialRechargeAmount}`, user.managerId).run();
  } else {
    await c.env.DB.prepare(
      'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
    ).bind('CREATE', 'Customer', `创建会员 ${name}`, user.managerId).run();
  }
  
  return c.json({ success: true, message: '会员创建成功', data: { id: customerId } });
}

export async function updateCustomer(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const idStr = c.req.param('id');
  if (!idStr) return c.json({ success: false, message: '缺少ID' }, 400);
  const id = parseInt(idStr);
  const { name, phone, verifyCode, remark } = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE t_customer SET name = ?, phone = ?, verify_code = ?, remark = ? WHERE id = ?'
  ).bind(name, phone, verifyCode, remark || '', id).run();
  await c.env.DB.prepare(
    'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
  ).bind('UPDATE', 'Customer', `更新会员 ID:${id}`, user.managerId).run();
  return c.json({ success: true, message: '会员更新成功' });
}

export async function toggleCustomerStatus(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const idStr = c.req.param('id');
  if (!idStr) return c.json({ success: false, message: '缺少ID' }, 400);
  const id = parseInt(idStr);
  const customer = await c.env.DB.prepare('SELECT status FROM t_customer WHERE id = ?').bind(id).first();
  const newStatus = (customer as any)?.status === 'active' ? 'inactive' : 'active';
  await c.env.DB.prepare('UPDATE t_customer SET status = ? WHERE id = ?').bind(newStatus, id).run();
  await c.env.DB.prepare(
    'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
  ).bind('TOGGLE', 'Customer', `切换会员状态为 ${newStatus}`, user.managerId).run();
  return c.json({ success: true, message: '状态已更新' });
}

export async function getBalance(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const idStr = c.req.param('id');
  if (!idStr) return c.json({ success: false, message: '缺少ID' }, 400);
  const id = parseInt(idStr);
  const customer = await c.env.DB.prepare('SELECT balance FROM t_customer WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: { balance: (customer as any)?.balance || 0 } });
}
