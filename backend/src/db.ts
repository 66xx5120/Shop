import { Env } from './types';

export async function initDatabase(env: Env) {
  // 所有建表语句（单行格式，避免 D1 解析错误）
  const tables = [
    "CREATE TABLE IF NOT EXISTS t_manager (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS t_customer (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL, verify_code TEXT NOT NULL, balance REAL DEFAULT 0, status TEXT DEFAULT 'active', remark TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS t_employee (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS t_service_type (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, price REAL NOT NULL, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS t_recharge_record (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, amount REAL NOT NULL, remark TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES t_customer(id))",
    "CREATE TABLE IF NOT EXISTS t_consume_record (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, employee_id INTEGER, service_type_id INTEGER, amount REAL NOT NULL, verify_code TEXT NOT NULL, remark TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES t_customer(id), FOREIGN KEY (employee_id) REFERENCES t_employee(id), FOREIGN KEY (service_type_id) REFERENCES t_service_type(id))",
    "CREATE TABLE IF NOT EXISTS t_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, entity_type TEXT, detail TEXT, manager_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS t_system_config (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
  ];

  for (const sql of tables) {
    try {
      await env.DB.exec(sql);
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        console.error('DB init error:', e.message);
      }
    }
  }

  // 初始化系统配置：注册开关默认为开启（true）
  await env.DB.prepare(
    "INSERT OR IGNORE INTO t_system_config (key, value) VALUES ('allow_registration', 'true')"
  ).run();

  // 初始化默认服务类型
  const defaultServices = [
    "INSERT OR IGNORE INTO t_service_type (name, price) VALUES ('生日花束', 188)",
    "INSERT OR IGNORE INTO t_service_type (name, price) VALUES ('慰问花束', 168)",
    "INSERT OR IGNORE INTO t_service_type (name, price) VALUES ('开业花篮', 160)"
  ];
  for (const sql of defaultServices) {
    try {
      await env.DB.exec(sql);
    } catch (e: any) {
      console.error('Insert default service error:', e.message);
    }
  }
}
