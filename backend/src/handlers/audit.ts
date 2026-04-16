import { Context } from 'hono';
import { Env } from '../types';
import { authenticate } from '../auth';

export async function getAuditLogs(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const url = new URL(c.req.url);
  const keyword = url.searchParams.get('keyword') || '';
  let query = `
    SELECT * FROM t_audit_log 
    WHERE detail LIKE ? OR action LIKE ? OR entity_type LIKE ?
    ORDER BY created_at DESC
  `;
  const likePattern = `%${keyword}%`;
  const logs = await c.env.DB.prepare(query).bind(likePattern, likePattern, likePattern).all();
  return c.json({ success: true, data: logs.results });
}
