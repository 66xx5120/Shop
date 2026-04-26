import { Context } from 'hono';
import { Env } from '../types';
import { authenticate } from '../auth';

export async function getServices(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const size = parseInt(url.searchParams.get('size') || '10');
  const offset = (page - 1) * size;
  
  const totalResult = await c.env.DB.prepare('SELECT COUNT(*) as total FROM t_service_type').first();
  const total = (totalResult as any)?.total || 0;
  const services = await c.env.DB.prepare(
    'SELECT * FROM t_service_type ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(size, offset).all();
  
  return c.json({
    success: true,
    data: {
      items: services.results,
      page,
      size,
      total,
      totalPages: Math.ceil(total / size)
    }
  });
}

export async function createService(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const { name, price } = await c.req.json();
  if (!name || price === undefined) return c.json({ success: false, message: '服务名称和价格不能为空' }, 400);
  await c.env.DB.prepare('INSERT INTO t_service_type (name, price) VALUES (?, ?)').bind(name, price).run();
  await c.env.DB.prepare(
    'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
  ).bind('CREATE', 'Service', `创建服务 ${name}`, user.managerId).run();
  return c.json({ success: true, message: '服务创建成功' });
}

export async function updateService(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const idStr = c.req.param('id');
  if (!idStr) return c.json({ success: false, message: '缺少ID' }, 400);
  const id = parseInt(idStr);
  const { name, price } = await c.req.json();
  await c.env.DB.prepare('UPDATE t_service_type SET name = ?, price = ? WHERE id = ?').bind(name, price, id).run();
  await c.env.DB.prepare(
    'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
  ).bind('UPDATE', 'Service', `更新服务 ID:${id}`, user.managerId).run();
  return c.json({ success: true, message: '服务更新成功' });
}

export async function toggleServiceStatus(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const idStr = c.req.param('id');
  if (!idStr) return c.json({ success: false, message: '缺少ID' }, 400);
  const id = parseInt(idStr);
  const svc = await c.env.DB.prepare('SELECT status FROM t_service_type WHERE id = ?').bind(id).first();
  const newStatus = (svc as any)?.status === 'active' ? 'inactive' : 'active';
  await c.env.DB.prepare('UPDATE t_service_type SET status = ? WHERE id = ?').bind(newStatus, id).run();
  await c.env.DB.prepare(
    'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
  ).bind('TOGGLE', 'Service', `切换服务状态为 ${newStatus}`, user.managerId).run();
  return c.json({ success: true, message: '状态已更新' });
}
