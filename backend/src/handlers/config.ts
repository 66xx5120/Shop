import { Context } from 'hono';
import { Env } from '../types';
import { authenticate } from '../auth';

// 获取注册开关状态（公开，用于前端显示）
export async function getRegistrationStatus(c: Context<{ Bindings: Env }>) {
  const result = await c.env.DB.prepare(
    "SELECT value FROM t_system_config WHERE key = 'allow_registration'"
  ).first();
  const allow = result?.value === 'true';
  return c.json({ success: true, data: { allowRegistration: allow } });
}

// 更新注册开关状态（需要登录）
export async function updateRegistrationStatus(c: Context<{ Bindings: Env }>) {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);

  const { allowRegistration } = await c.req.json();
  const value = allowRegistration ? 'true' : 'false';
  await c.env.DB.prepare(
    "UPDATE t_system_config SET value = ? WHERE key = 'allow_registration'"
  ).bind(value).run();
  return c.json({ success: true, message: '设置已更新' });
}
