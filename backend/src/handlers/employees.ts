import { Context } from 'hono';
import { Env } from '../types';
import { authenticate } from '../auth';

export async function getEmployees(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const size = parseInt(url.searchParams.get('size') || '10');
  const keyword = url.searchParams.get('keyword') || '';
  
  const offset = (page - 1) * size;
  let query = 'SELECT * FROM t_employee WHERE 1=1';
  const params: any[] = [];
  if (keyword) {
    query += ' AND name LIKE ?';
    params.push(`%${keyword}%`);
  }
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const totalResult = await c.env.DB.prepare(countQuery).bind(...params).first();
  const total = (totalResult as any)?.total || 0;
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(size, offset);
  const employees = await c.env.DB.prepare(query).bind(...params).all();
  
  return c.json({
    success: true,
    data: {
      items: employees.results,
      page,
      size,
      total,
      totalPages: Math.ceil(total / size)
    }
  });
}

export async function createEmployee(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const { name } = await c.req.json();
  if (!name) return c.json({ success: false, message: '员工姓名不能为空' }, 400);
  await c.env.DB.prepare('INSERT INTO t_employee (name) VALUES (?)').bind(name).run();
  await c.env.DB.prepare(
    'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
  ).bind('CREATE', 'Employee', `创建员工 ${name}`, user.managerId).run();
  return c.json({ success: true, message: '员工创建成功' });
}

export async function updateEmployee(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const idStr = c.req.param('id');
  if (!idStr) return c.json({ success: false, message: '缺少ID' }, 400);
  const id = parseInt(idStr);
  const { name } = await c.req.json();
  await c.env.DB.prepare('UPDATE t_employee SET name = ? WHERE id = ?').bind(name, id).run();
  await c.env.DB.prepare(
    'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
  ).bind('UPDATE', 'Employee', `更新员工 ID:${id}`, user.managerId).run();
  return c.json({ success: true, message: '员工更新成功' });
}

export async function toggleEmployeeStatus(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const idStr = c.req.param('id');
  if (!idStr) return c.json({ success: false, message: '缺少ID' }, 400);
  const id = parseInt(idStr);
  const emp = await c.env.DB.prepare('SELECT status FROM t_employee WHERE id = ?').bind(id).first();
  const newStatus = (emp as any)?.status === 'active' ? 'inactive' : 'active';
  await c.env.DB.prepare('UPDATE t_employee SET status = ? WHERE id = ?').bind(newStatus, id).run();
  await c.env.DB.prepare(
    'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
  ).bind('TOGGLE', 'Employee', `切换员工状态为 ${newStatus}`, user.managerId).run();
  return c.json({ success: true, message: '状态已更新' });
}
