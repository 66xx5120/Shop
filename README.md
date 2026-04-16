# Shop management system 商店会员管理系统(以花店为例，部分代码元素与花店相关)
面向中小商店、社区店、夫妻店的一体化轻量客户管理工具。

## 目录结构

```
shop-management-system/
├── backend/                 # Cloudflare Workers 后端
│   ├── src/
│   │   ├── index.ts         # 主入口，路由
│   │   ├── auth.ts          # JWT 认证
│   │   ├── db.ts            # D1 数据库操作
│   │   ├── types.ts         # 类型定义
│   │   ├── handlers/
│   │   │   ├── auth.ts      # 注册/登录/修改密码
│   │   │   ├── customers.ts # 会员管理
│   │   │   ├── employees.ts # 员工管理
│   │   │   ├── services.ts  # 服务类型
│   │   │   ├── transactions.ts # 充值消费流水
│   │   │   ├── reports.ts   # 报表
│   │   │   ├── audit.ts     # 审计日志
│   │   │   └── config.ts
│   ├── wrangler.toml        # Cloudflare 配置
│   ├── package.json
│   ├── tsconfig.json
│   └── .gitignore
├── frontend/                # Vue 3 前端（Vue 3 + TypeScript + Pinia + Vue Router部署到 Pages）
│   ├── dist/
│   │   └── _redirects
│   ├── public/
│   │   ├── logo.png
│   │   └── favicon.ico
│   ├── src/
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── vite-env.d.ts
│   │   ├── router/
│   │   │   └── index.ts
│   │   ├── stores/
│   │   │   └── auth.ts
│   │   ├── views/
│   │   │   ├── Login.vue
│   │   │   ├── Register.vue
│   │   │   └── Dashboard.vue
│   │   ├── components/
│   │   │   └── WindowControls.vue
│   │   └── styles/
│   │       └── main.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.node.json
├── functions/
│   ├── api/
│   │   └── [[path]].ts
├── .github/
│   ├── workflows/
│   │   └── deploy.yml
└── README.md                # 部署说明
```

## 特点

- 部署到Cloudflare Workers and Pages，D1 数据库。
- 登录、注册、JWT 鉴权、租户隔离完整闭环，避免“裸奔接口”。
- 聚焦商店高频场景：会员、充值、消费、员工、服务、业绩、审计。
- UI 统一为简洁时尚风格，减少培训成本，新员工也能快速上手。

## 主要功能

- 账号体系
  - 店长账号注册与登录
  - 注册开关
  - 修改密码
  - 所有业务接口默认鉴权（除登录/注册）
- 会员管理
  - 新增/编辑会员、状态切换、分页查询
  - 支持设置 4 位校验码（默认手机号后四位）
  - 新增会员可直接录入初次充值金额
  - 会员导出、批量导入会员功能（提供模板下载和说明）
- 充值与消费
  - 会员下拉支持模糊检索（姓名/手机号）
  - 消费时强校验会员校验码（与后端存储值比对）
  - 交易流水分页查询与导出
- 员工与服务
  - 员工管理、服务类型管理（均支持分页）
  - 注册后自动初始化默认服务类型（按租户）
- 统计与审计
  - 经营概览、会员消费查询与导出、员工业绩查询与导出（分页）
  - 审计日志分页，关键操作可追溯

## 后端部署到Cloudflare Workers，D1 数据库
在Cloudflare创建一个名为 shop-db 的 D1 数据库，复制你的 database_id（格式类似 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）。然后打开 Shop/backend/wrangler.toml 文件，把它粘贴到对应的位置：

```toml
[[d1_databases]]
binding = "DB"
database_name = "shop-db"
database_id = "你的-database_id"
```

### 推荐方案：使用 Wrangler CLI（最简单、最可靠）

这是官方推荐的方式，只需在终端执行几行命令。您不需要深入理解，照做即可。

1. 安装 Node.js（如果还没装）
   
访问 https://nodejs.org  下载 LTS 版本并安装。

安装完成后，打开 命令提示符（cmd），输入 node -v 和 npm -v，看到版本号即成功。

2. 安装 Wrangler 并登录

在 Shop/backend 目录下打开命令提示符（在文件夹地址栏输入 cmd 回车），依次执行：

```bash
npm install -g wrangler
npx wrangler login
```

执行 wrangler login 会自动打开浏览器，点击 Allow 授权。

3. 创建 D1 数据库(如果之前在Cloudflare中没有创建一个名为 shop-db 的 D1 数据库，则运行D1数据库创建命令)

在你的 Shop/backend 目录下，运行命令创建一个名为 shop-db 的 D1 数据库：

```bash
npx wrangler d1 create shop-db
```

命令执行成功后，在输出的结果中复制你的 database_id（格式类似 xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）。然后打开 Shop/backend/wrangler.toml 文件，把它粘贴到对应的位置：

```toml
[[d1_databases]]
binding = "DB"
database_name = "shop-db"
database_id = "你的-database_id"
```

4. 安装依赖并部署 Worker

确保在 Shop/backend 目录下，执行：

```bash
npm install
npx wrangler deploy
```

它会自动上传、构建并部署。部署成功后，会显示一个 .workers.dev 域名，请记下来，稍后会用到。

### 备选方案：在 GitHub 上配置自动部署（无需本地操作）

如果您完全不想使用命令行，可以配置 GitHub Actions 自动部署。在仓库中创建 .github/workflows/deploy.yml

然后需要在 Cloudflare 上创建 API 令牌（编辑 Cloudflare Workers 权限），最后添加到 GitHub 仓库的 Secrets 中（变量名 CF_API_TOKEN）。

这样每次推送代码到 main 分支，GitHub Actions 会自动部署。

## 部署好Workers后，再设置 JWT 密钥环境变量（JWT_SECRET）：

你的后端代码用到了 JWT_SECRET 环境变量。你需要在 Cloudflare 控制台的 Workers 和 Pages > 你 Worker 项目的名称 > 设置 > 变量 > 环境变量 页面，

添加一个名为 JWT_SECRET 的变量，并填入一个足够复杂的随机字符串（例如 u2k3j9p0xq7r8t5w1z4...），你可以使用在线密码生成器生成。

加密：如果希望这个值不可见，可以勾选 “加密”。

点击 “保存并部署”。

## 部署好Workers后，设置注册开关环境变量（ALLOW_REGISTRATION）：

进入 Worker 控制台 → 设置 → 环境变量 → 添加：

变量名：ALLOW_REGISTRATION

值：true（开启）或 false（关闭）；默认值：true

保存并部署

## 直接在 D1 控制台手动建表SQL

登录 Cloudflare 控制台 → Workers 和 Pages → D1 → 选择 shop-db。

点击 “控制台” 标签页，依次复制并执行以下每条 SQL 语句（一次一条，不要批量粘贴）：

```sql
CREATE TABLE IF NOT EXISTS t_manager (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
```

```sql
CREATE TABLE IF NOT EXISTS t_customer (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL, verify_code TEXT NOT NULL, balance REAL DEFAULT 0, status TEXT DEFAULT 'active', remark TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
```

```sql
CREATE TABLE IF NOT EXISTS t_employee (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
```

```sql
CREATE TABLE IF NOT EXISTS t_service_type (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, price REAL NOT NULL, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
```

```sql
CREATE TABLE IF NOT EXISTS t_recharge_record (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, amount REAL NOT NULL, remark TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES t_customer(id));
```

```sql
CREATE TABLE IF NOT EXISTS t_consume_record (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, employee_id INTEGER, service_type_id INTEGER, amount REAL NOT NULL, verify_code TEXT NOT NULL, remark TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES t_customer(id), FOREIGN KEY (employee_id) REFERENCES t_employee(id), FOREIGN KEY (service_type_id) REFERENCES t_service_type(id));
```

```sql
CREATE TABLE IF NOT EXISTS t_audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, entity_type TEXT, detail TEXT, manager_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
```

-- 预设服务
```sql
INSERT OR IGNORE INTO t_service_type (name, price) VALUES ('生日花束', 188);
```

```sql
INSERT OR IGNORE INTO t_service_type (name, price) VALUES ('慰问花束', 168);
```

```sql
INSERT OR IGNORE INTO t_service_type (name, price) VALUES ('开业花篮', 160);
```
    
-- 初始化开关为开启（true）存储动态注册开关
```sql
CREATE TABLE IF NOT EXISTS t_system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

-- 初始化开关为开启（true）
```sql
INSERT OR IGNORE INTO t_system_config (key, value) VALUES ('allow_registration', 'true');
```

执行完毕后，再次访问 https://你的-worker-name.你的子域名.workers.dev/api/health 应该会返回 {"status":"ok"}。

## 前端部署到Cloudflare Pages
第一步：配置前端代理 (Pages Functions)

这一步至关重要，它能让前端在 Pages 上运行时，把 /api 的请求正确地转发到我们刚部署的 Worker 后端。

1. 创建 Functions 文件
   
在 Shop/frontend 目录下，创建一个新的 functions 文件夹，在里面新建一个名为 api 的文件夹，最后在 api 文件夹中创建一个 [[path]].ts 文件。完整的路径是：Shop/frontend/functions/api/[[path]].ts。

2. 编写代理代码
   
将以下代码复制到 [[path]].ts 文件中：

```typescript
// Shop/functions/api/[[path]].ts
// functions/api/[[path]].ts Move functions to root for Pages
export async function onRequest(context: any) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 从环境变量获取后端地址，如果未设置则返回错误
  const BACKEND_URL = env.BACKEND_URL;
  if (!BACKEND_URL) {
    return new Response(
      JSON.stringify({ error: 'BACKEND_URL environment variable not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 直接转发完整路径（包括 /api 前缀）
  const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

  // 复制原始请求，保留所有头部和方法
  const newRequest = new Request(backendUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,          // 重要：转发 POST 请求体
  });

  try {
    const response = await fetch(newRequest);
    return response;
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Proxy error', details: String(error) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

请务必将代码中的 BACKEND_URL 替换成你自己的 Worker 域名或者部署完绑定环境变量BACKEND_URL为你自己的 Worker 域名。

🚀 第二步：部署前端 (Pages)

最后，我们把 Vue 项目部署到 Pages。

1. 进入创建页面

在 Cloudflare 控制台左侧菜单，点击 Workers 和 Pages > Pages > 创建项目 > 连接到 Git。

2. 连接并配置仓库

选中你的 GitHub 账号，并选择 six686/Shop 仓库。在 构建设置 部分，按如下方式填写：

生产分支：main

构建命令：cd frontend && npm install && npm run build

构建输出目录：frontend/dist

配置好后，点击 保存并部署。

✨ 第三步：测试与验证

等待几分钟，部署完成后，Cloudflare 会给你一个 *.pages.dev 的域名。点开它，你应该就能看到理发店会员管理系统的登录界面了！

📌 重要补充与问题排查

修复页面刷新 404：Pages 默认只处理根路由，直接访问 /login 等页面会出现 404。解决方法是在构建输出的 frontend/dist 文件夹中，新建一个 _redirects 文件（无后缀），并在文件内写入一行规则：

```text
/*  /index.html  200
```

关于 WindowControls.vue：你之前问过这个组件，它已经包含在你仓库的 components 目录下了，其代码是正确的，部署后就能正常工作。

## 批量导入会员功能（提供模板下载和说明）
### 模板文件说明
模板 CSV 格式如下（第一行为表头，后续每行一个会员）：

| 姓名 | 手机号 | 校验码 | 备注 | 初始充值金额 |
| :--- | :--- | :--- | :--- | :---: |
| 张三 | 13812345678 | 5678 | 老客户 | 100 |
| 李四 | 13987654321 | 4321 |   | 0 |

- 姓名、手机号为必填。
- 校验码可选，不填则默认使用手机号后4位。
- 备注可选。
- 初始充值金额可选，填入数字（如 100），表示首次充值金额，会自动增加余额并记录充值流水。

用户点击“下载导入模板”即可获取该模板。

### 注意事项
- CSV 文件编码建议为 UTF-8（模板下载已带 BOM，Excel 打开不乱码）。
- 手机号重复的会员会被跳过（不会更新原有信息）。
- 初始充值金额不会导致重复充值（仅新会员生效）。
- 一次导入建议不超过 500 条，避免 Worker 执行超时（D1 单次请求时间限制 10 秒，500 条通常足够）。
- 如果导入数据量大，可以分批上传。这个功能已经能满足日常批量导入需求。

## 注册开关：

### 两个注册开关功能：

-- 环境变量总开关：ALLOW_REGISTRATION（默认 true），设置为 false 可彻底关闭注册，无需修改代码。

-- 数据库动态开关：管理员登录后在“系统设置”中切换，仅当环境变量为 true 时生效。

这样环境变量作为总闸，动态开关作为子开关，既安全又灵活。

-- 环境变量：ALLOW_REGISTRATION 作为总闸，可永久关闭注册。

-- 动态开关：管理员登录后随时切换，方便临时维护。

-- 密码恢复：通过 D1 直接修改哈希，无需额外功能。

应急方案：店长忘记密码且关闭注册时在 D1 直接修改密码

当店长忘记密码且无法注册时，可以通过 D1 控制台手动更新密码哈希。

步骤：

1.生成新密码的 bcrypt 哈希：

访问 [bcrypt在线生成器](https://bcrypt-generator.com/)，选择 成本 (Cost) = 10，输入新密码（例如 new123），点击生成，得到类似 $2b$10$... 的哈希字符串。

2.登录 D1 控制台：

Cloudflare 控制台 → Workers 和 Pages → D1 → 选择您的数据库 → 控制台。

3.执行 SQL 查询 SELECT * FROM t_manager; 查看现有账号。使用在线工具生成新密码的 bcrypt 哈希。

-- 查看现有用户名
```sql
SELECT id, username FROM t_manager;
```

-- 更新密码（需要先使用 bcrypt 在线工具生成新密码的 bcrypt 哈希）

4.执行更新 SQL（将 your_username 替换为店长的用户名）：

```sql
UPDATE t_manager SET password_hash = '$2b$10$...你的bcrypt哈希...' WHERE username = 'your_username忘记密码的账号';
```

执行成功后，店长即可用新密码登录。

安全提示：操作前请确认您是数据库拥有者，操作后建议删除浏览器历史中的哈希生成记录。

## 如果要清空数据（会员、员工、充值消费记录、审计日志），同时保留店长账号、服务类型和系统配置，请在 Cloudflare D1 控制台 中按顺序执行以下 SQL 语句（注意外键约束）：

-- 1. 清空消费记录

```sql
DELETE FROM t_consume_record;
```

-- 2. 清空充值记录

```sql
DELETE FROM t_recharge_record;
```

-- 3. 清空审计日志

```sql
DELETE FROM t_audit_log;
```

-- 4. 清空会员（如果希望重置）

```sql
DELETE FROM t_customer;
```

-- 5. 清空员工（如果希望重置）

```sql
DELETE FROM t_employee;
```

说明：

上述操作会删除所有测试会员、员工、充值/消费流水和审计日志，请谨慎操作。

店长账号（t_manager 表）不会被删除，您仍可用原账号登录。

服务类型（t_service_type 表）和系统配置（t_system_config 表）保持不变，无需重新插入默认数据。

执行后，前端页面刷新将显示为空列表。

可选：如果您还想重置会员的余额（已无会员，无需操作）。如果需要保留部分会员，请使用条件 DELETE FROM t_customer WHERE name LIKE '测试%' 等方式选择性删除。

```sql
DELETE FROM t_customer WHERE name LIKE '测试%';
```

## 安全提醒：执行删除操作前建议先备份数据库（D1 控制台可导出）。确认无误后再执行。

