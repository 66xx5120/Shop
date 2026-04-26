import { Context } from 'hono';
import { Env } from '../types';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../auth';
import { initDatabase } from '../db';

export async function register(c: Context<{ Bindings: Env }>) {
  // 1. 检查环境变量总开关
  const envAllow = c.env.ALLOW_REGISTRATION !== 'false'; // 默认为 true
  if (!envAllow) {
    return c.json({ success: false, message: '注册功能已关闭（环境变量）' }, 403);
  }

  // 2. 检查数据库动态开关
  const config = await c.env.DB.prepare(
    "SELECT value FROM t_system_config WHERE key = 'allow_registration'"
  ).first();
  const dbAllow = config?.value === 'true';
  if (!dbAllow) {
    return c.json({ success: false, message: '注册功能已关闭，请联系管理员' }, 403);
  }
  
  const { username, password } = await c.req.json();
  if (!username || !password) {
    return c.json({ success: false, message: '用户名和密码不能为空' }, 400);
  }
  const hashed = await hashPassword(password);
  try {
    await c.env.DB.prepare(
      'INSERT INTO t_manager (username, password_hash) VALUES (?, ?)'
    ).bind(username, hashed).run();
    await initDatabase(c.env);
    return c.json({ success: true, message: '注册成功' });
  } catch (e) {
    return c.json({ success: false, message: '用户名已存在' }, 400);
  }
}

export async function login(c: Context<{ Bindings: Env }>) {
  const { username, password } = await c.req.json();
  const user = await c.env.DB.prepare(
    'SELECT id, username, password_hash FROM t_manager WHERE username = ?'
  ).bind(username).first();
  if (!user || !(await verifyPassword(password, user.password_hash as string))) {
    return c.json({ success: false, message: '用户名或密码错误' }, 401);
  }
  const token = signToken({ managerId: user.id as number, username: user.username as string }, c.env.JWT_SECRET);
  return c.json({ success: true, data: { token, username: user.username } });
}

export async function changePassword(c: Context<{ Bindings: Env }>) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ success: false, message: '未授权' }, 401);
  const token = authHeader.slice(7);
  const payload = verifyToken(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ success: false, message: '无效令牌' }, 401);
  
  const { oldPassword, newPassword } = await c.req.json();
  const dbUser = await c.env.DB.prepare(
    'SELECT password_hash FROM t_manager WHERE id = ?'
  ).bind(payload.managerId).first();
  if (!dbUser || !(await verifyPassword(oldPassword, dbUser.password_hash as string))) {
    return c.json({ success: false, message: '旧密码错误' }, 400);
  }
  const newHash = await hashPassword(newPassword);
  await c.env.DB.prepare('UPDATE t_manager SET password_hash = ? WHERE id = ?')
    .bind(newHash, payload.managerId).run();
  return c.json({ success: true, message: '密码修改成功' });
}
