import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { initDatabase } from './db';
import * as configHandlers from './handlers/config';
import * as authHandlers from './handlers/auth';
import * as customerHandlers from './handlers/customers';
import * as employeeHandlers from './handlers/employees';
import * as serviceHandlers from './handlers/services';
import * as transactionHandlers from './handlers/transactions';
import * as reportHandlers from './handlers/reports';
import * as auditHandlers from './handlers/audit';
import { authenticate } from './auth';
import { hashPassword, verifyPassword, signToken, authenticate } from './auth';

const app = new Hono<{ Bindings: Env }>();

// CORS 配置（显式允许）
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}));

// 请求日志
app.use('*', async (c, next) => {
  console.log(`${c.req.method} ${c.req.url}`);
  await next();
});

// 健康检查（会初始化数据库）
app.get('/api/health', async (c) => {
  await initDatabase(c.env);
  return c.json({ status: 'ok' });
});

// 注册开关配置
app.get('/api/config/registration-status', configHandlers.getRegistrationStatus);
app.post('/api/config/registration-status', configHandlers.updateRegistrationStatus);

// 认证接口
app.post('/api/auth/register', authHandlers.register);
app.post('/api/auth/login', authHandlers.login);
app.post('/api/auth/change-password', authHandlers.changePassword);

// 会员
app.get('/api/customers', customerHandlers.getCustomers);
app.post('/api/customers', customerHandlers.createCustomer);
app.put('/api/customers/:id', customerHandlers.updateCustomer);
app.patch('/api/customers/:id/toggle-status', customerHandlers.toggleCustomerStatus);
app.get('/api/accounts/:id/balance', customerHandlers.getBalance);

// 员工
app.get('/api/employees', employeeHandlers.getEmployees);
app.post('/api/employees', employeeHandlers.createEmployee);
app.put('/api/employees/:id', employeeHandlers.updateEmployee);
app.patch('/api/employees/:id/toggle-status', employeeHandlers.toggleEmployeeStatus);

// 服务类型
app.get('/api/config/services', serviceHandlers.getServices);
app.post('/api/config/services', serviceHandlers.createService);
app.put('/api/config/services/:id', serviceHandlers.updateService);
app.patch('/api/config/services/:id/toggle-status', serviceHandlers.toggleServiceStatus);

// 交易
app.post('/api/transactions/recharge', transactionHandlers.recharge);
app.post('/api/transactions/consume', transactionHandlers.consume);
app.get('/api/transactions', transactionHandlers.getTransactions);

// 报表
app.get('/api/reports/dashboard', reportHandlers.getDashboard);
app.get('/api/reports/summary', reportHandlers.getSummary);
app.get('/api/reports/employee-performance', reportHandlers.getEmployeePerformance);
app.get('/api/reports/service-breakdown', reportHandlers.getServiceBreakdown);
app.get('/api/reports/customer-consume-details', reportHandlers.getCustomerConsumeDetails);
app.get('/api/reports/service-remark-consume', reportHandlers.getServiceRemarkConsume);

// 审计
app.get('/api/audit/logs', auditHandlers.getAuditLogs);

// 导出会员 CSV
app.get('/api/export/customers', async (c) => {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);

  const customers = await c.env.DB.prepare(
    'SELECT id, name, phone, verify_code, status, balance, remark, created_at FROM t_customer ORDER BY id'
  ).all();
  const rows = customers.results;

  if (!rows.length) {
    return new Response('暂无会员数据', { 
      status: 200, 
      headers: { 'Content-Type': 'text/csv;charset=utf-8' } 
    });
  }

  const headers = ['姓名', '手机号', '校验码', '状态', '余额', '备注', '注册时间'];
  const csvRows = [headers];
  for (const row of rows) {
    csvRows.push([
      row.name,
      row.phone,
      row.verify_code,
      row.status === 'active' ? '正常' : '停用',
      row.balance,
      row.remark || '',
      row.created_at
    ]);
  }

  const csvContent = csvRows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const bom = "\uFEFF";  // UTF-8 BOM
  const csvWithBom = bom + csvContent;
  
  return new Response(csvWithBom, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': 'attachment; filename=customers.csv'
    }
  });
});

// 导出员工业绩 CSV
app.get('/api/export/employee-performance', async (c) => {
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
  const rows = result.results;

  const headers = ['员工姓名', '订单数', '总金额', '客单价'];
  const csvRows = [headers];
  for (const row of rows) {
    csvRows.push([
      row.employeeName,
      row.total_count,
      row.total_amount,
      row.avg_amount
    ]);
  }

  const csvContent = csvRows.map(row => 
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const bom = "\uFEFF";
  const csvWithBom = bom + csvContent;
  return new Response(csvWithBom, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': 'attachment; filename=employee-performance.csv'
    }
  });
});

// 导出会员消费 CSV
app.get('/api/export/customer-consume', async (c) => {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);
  
  const url = new URL(c.req.url);
  const startDate = url.searchParams.get('startDate') || '';
  const endDate = url.searchParams.get('endDate') || '';
  const customerName = url.searchParams.get('customerName') || '';
  
  // 先获取会员
  const customerRes = await c.env.DB.prepare(
    "SELECT id, name FROM t_customer WHERE name LIKE ? LIMIT 1"
  ).bind(`%${customerName}%`).first();
  if (!customerRes) {
    return new Response('未找到会员', { status: 404 });
  }
  const customerId = (customerRes as any).id;
  
  const items = await c.env.DB.prepare(
    `SELECT c.amount, c.remark, c.created_at, s.name as service_name
     FROM t_consume_record c
     LEFT JOIN t_service_type s ON c.service_type_id = s.id
     WHERE c.customer_id = ? AND DATE(c.created_at) BETWEEN ? AND ?
     ORDER BY c.created_at DESC`
  ).bind(customerId, startDate, endDate).all();
  
  const rows = items.results;
  const csvRows = [['时间', '金额', '服务', '备注', '详情']];
  for (const row of rows) {
    const detail = row.remark ? `${row.service_name || '消费'}-${row.remark}` : (row.service_name || '消费');
    csvRows.push([
      row.created_at,
      row.amount,
      row.service_name || '',
      row.remark || '',
      detail
    ]);
  }
  const csvContent = csvRows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const bom = "\uFEFF";
  const csvWithBom = bom + csvContent;
  return new Response(csvWithBom, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename=customer_consume_${customerName}.csv`
    }
  });
});

// 导出交易流水 CSV
app.get('/api/export/transactions', async (c) => {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);

  const url = new URL(c.req.url);
  const startDate = url.searchParams.get('startDate') || '';
  const endDate = url.searchParams.get('endDate') || '';

  // 查询充值记录
  let rechargeSql = `SELECT id, 'recharge' as type, customer_id, amount, remark, created_at FROM t_recharge_record`;
  const params: any[] = [];
  if (startDate && endDate) {
    rechargeSql += ` WHERE DATE(created_at) BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }
  const rechargeRecords = await c.env.DB.prepare(rechargeSql).bind(...params).all();

  // 查询消费记录（关联服务名称）
  let consumeSql = `
    SELECT c.id, 'consume' as type, c.customer_id, c.amount, c.remark, c.created_at, s.name as service_name
    FROM t_consume_record c
    LEFT JOIN t_service_type s ON c.service_type_id = s.id
  `;
  if (startDate && endDate) {
    consumeSql += ` WHERE DATE(c.created_at) BETWEEN ? AND ?`;
  }
  const consumeRecords = await c.env.DB.prepare(consumeSql).bind(...params).all();

  // 合并记录
  const allRecords = [...(rechargeRecords.results || []), ...(consumeRecords.results || [])];
  // 按时间排序
  allRecords.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // 补充会员姓名
  const enrichedRecords = [];
  for (const rec of allRecords) {
    const cust = await c.env.DB.prepare('SELECT name FROM t_customer WHERE id = ?').bind(rec.customer_id).first();
    const customerName = (cust as any)?.name || '未知';
    let detail = '';
    if (rec.type === 'recharge') {
      detail = rec.remark ? `充值-${rec.remark}` : '充值';
    } else {
      const serviceName = rec.service_name || '';
      const remark = rec.remark || '';
      if (serviceName && remark) detail = `消费-${serviceName}-${remark}`;
      else if (serviceName) detail = `消费-${serviceName}`;
      else if (remark) detail = `消费-${remark}`;
      else detail = '消费';
    }
    enrichedRecords.push({
      时间: rec.created_at,
      类型: rec.type === 'recharge' ? '充值' : '消费',
      会员: customerName,
      金额: rec.amount,
      详情: detail
    });
  }

  // 生成 CSV
  const csvRows = [['时间', '类型', '会员', '金额', '详情']];
  for (const row of enrichedRecords) {
    csvRows.push([
      row.时间,
      row.类型,
      row.会员,
      row.金额,
      row.详情
    ]);
  }
  const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

  const filename = `transactions_${startDate}_to_${endDate}.csv`;
  const bom = "\uFEFF";
  const csvWithBom = bom + csvContent;
  return new Response(csvWithBom, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename=${filename}`
    }
  });
});

// 批量导入会员（CSV）
app.post('/api/import/customers', async (c) => {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);

  const body = await c.req.parseBody();
  const file = body['file'] as File;
  if (!file) return c.json({ success: false, message: '请上传 CSV 文件' }, 400);

  const text = await file.text();
  // 解析 CSV（简单实现，假设第一行为表头，逗号分隔，字段可能带引号）
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return c.json({ success: false, message: 'CSV 文件至少包含一行表头和一行数据' }, 400);

  const headers = lines[0].split(',').map(h => h.replace(/["']/g, '').trim());
  // 期望的列名映射（支持中英文别名）
  const nameIdx = headers.findIndex(h => h.includes('姓名') || h === 'name');
  const phoneIdx = headers.findIndex(h => h.includes('手机号') || h === 'phone');
  const verifyCodeIdx = headers.findIndex(h => h.includes('校验码') || h === 'verifyCode');
  const remarkIdx = headers.findIndex(h => h.includes('备注') || h === 'remark');
  const balanceIdx = headers.findIndex(h => h.includes('初始充值金额') || h === 'initialBalance');

  if (nameIdx === -1 || phoneIdx === -1) {
    return c.json({ success: false, message: 'CSV 必须包含“姓名”和“手机号”列' }, 400);
  }

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // 简单按逗号分割，不处理引号内逗号（实际业务中极少见）
    const values = line.split(',').map(v => v.replace(/^["']|["']$/g, '').trim());
    const name = values[nameIdx];
    const phone = values[phoneIdx];
    if (!name || !phone) {
      failCount++;
      errors.push(`第 ${i + 1} 行：姓名或手机号为空`);
      continue;
    }

    // 检查手机号是否已存在
    const exist = await c.env.DB.prepare('SELECT id FROM t_customer WHERE phone = ?').bind(phone).first();
    if (exist) {
      failCount++;
      errors.push(`第 ${i + 1} 行：手机号 ${phone} 已存在`);
      continue;
    }

    const verifyCode = values[verifyCodeIdx] || phone.slice(-4);
    const remark = values[remarkIdx] || '';
    let initialBalance = 0;
    if (balanceIdx !== -1 && values[balanceIdx]) {
      initialBalance = parseFloat(values[balanceIdx]);
      if (isNaN(initialBalance)) initialBalance = 0;
    }

    try {
      const result = await c.env.DB.prepare(
        'INSERT INTO t_customer (name, phone, verify_code, remark, balance) VALUES (?, ?, ?, ?, ?)'
      ).bind(name, phone, verifyCode, remark, initialBalance).run();
      const newId = result.meta.last_row_id;
      // 如果有初始充值，记录充值流水
      if (initialBalance > 0) {
        await c.env.DB.prepare(
          'INSERT INTO t_recharge_record (customer_id, amount, remark) VALUES (?, ?, ?)'
        ).bind(newId, initialBalance, '批量导入初始充值').run();
      }
      // 审计日志
      await c.env.DB.prepare(
        'INSERT INTO t_audit_log (action, entity_type, detail, manager_id) VALUES (?, ?, ?, ?)'
      ).bind('IMPORT', 'Customer', `批量导入会员 ${name} (${phone})`, user.managerId).run();
      successCount++;
    } catch (e: any) {
      failCount++;
      errors.push(`第 ${i + 1} 行：${e.message}`);
    }
  }

  return c.json({
    success: true,
    data: {
      total: lines.length - 1,
      successCount,
      failCount,
      errors: errors.slice(0, 20) // 最多返回20条错误
    }
  });
});

// 导出服务/备注消费查询 CSV
app.get('/api/export/service-remark-consume', async (c) => {
  const user = await authenticate(c.req.raw, c.env);
  if (!user) return c.json({ success: false, message: '未授权' }, 401);

  const url = new URL(c.req.url);
  const startDate = url.searchParams.get('startDate') || '';
  const endDate = url.searchParams.get('endDate') || '';
  const serviceTypeId = url.searchParams.get('serviceTypeId') || '';
  const remarkKeyword = url.searchParams.get('remarkKeyword') || '';

  let sql = `
    SELECT 
      c.amount, c.remark as consume_remark, c.created_at,
      s.name as service_name,
      cust.name as customer_name, cust.phone as customer_phone
    FROM t_consume_record c
    LEFT JOIN t_service_type s ON c.service_type_id = s.id
    LEFT JOIN t_customer cust ON c.customer_id = cust.id
    WHERE DATE(c.created_at) BETWEEN ? AND ?
  `;
  const params: any[] = [startDate, endDate];
  if (serviceTypeId) { sql += ` AND c.service_type_id = ?`; params.push(serviceTypeId); }
  if (remarkKeyword) { sql += ` AND c.remark LIKE ?`; params.push(`%${remarkKeyword}%`); }
  sql += ` ORDER BY c.created_at DESC`;

  const result = await c.env.DB.prepare(sql).bind(...params).all();
  const rows = result.results || [];

  const csvRows = [['时间', '会员姓名', '会员手机号', '服务名称', '消费金额', '备注']];
  for (const row of rows) {
    csvRows.push([
      row.created_at,
      row.customer_name || '',
      row.customer_phone || '',
      row.service_name || '',
      row.amount,
      row.consume_remark || ''
    ]);
  }
  const csvContent = csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const bom = "\uFEFF";
  return new Response(bom + csvContent, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename=service_remark_consume_${startDate}_to_${endDate}.csv`
    }
  });
});
export default app;
