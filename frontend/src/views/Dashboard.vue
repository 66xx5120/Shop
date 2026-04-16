<template>
  <div class="dashboard">
    <!-- 可选：窗口控制按钮（桌面版使用） -->
    <!-- <WindowControls /> -->

     <!-- 汉堡菜单按钮（移动端显示） -->
    <button class="menu-toggle" @click="toggleSidebar" v-show="!sidebarOpen">☰</button>
     <!-- 遮罩层 -->
    <div v-if="sidebarOpen" class="sidebar-mask" @click="closeSidebar"></div>
    
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <!-- 品牌 Logo -->
        <img src="/logo.png" alt="品牌Logo" class="sidebar-logo" />
        <h2>Flower</h2>
        <div class="slogan">以花为伴，传递美好</div>
        <p>商店会员系统</p>
      </div>
      <nav class="nav">
        <a v-for="item in navItems" :key="item.key" @click="activeNav = item.key" :class="{ active: activeNav === item.key }">
          <span>{{ item.label }}</span>
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <span>{{ username }}</span>
          <button @click="handleLogout" class="logout-btn">退出</button>
        </div>
      </div>
    </aside>
    
    <main class="main-content">
      <header class="main-header">
        <h1>{{ currentTitle }}</h1>
        <div class="header-actions">
          <button class="secondary-btn" @click="refreshAll" :disabled="loading">刷新</button>
          <button class="secondary-btn" @click="openSystemDialog">系统设置</button>
        </div>
      </header>

      <!-- 经营总览 -->
      <div v-if="activeNav === 'dashboard'" class="dashboard-view">
        <!-- 统计卡片（保留原有） -->
        <div class="stats-grid">
          <div class="stat-card"><div class="stat-value">{{ summary.activeCustomers || 0 }}</div><div class="stat-label">活跃会员</div></div>
          <div class="stat-card"><div class="stat-value">{{ money(summary.totalBalance) }}</div><div class="stat-label">账户总余额</div></div>
          <div class="stat-card"><div class="stat-value">{{ money(summary.todayRecharge) }}</div><div class="stat-label">今日充值</div></div>
          <div class="stat-card"><div class="stat-value">{{ money(summary.todayConsume) }}</div><div class="stat-label">今日消费</div></div>
         </div>

         <!-- 经营状态卡片（丰富内容） -->
         <div class="card dashboard-card">
           <h3 class="card-title">经营状态</h3>
           <p>欢迎使用，祝生意兴隆！</p>
           <div class="overview-grid">
             <!-- 今日语录 -->
             <div class="overview-panel quote-panel">
               <div class="overview-kicker">今日语录</div>
               <p class="quote-text">{{ currentQuote }}</p>
             </div>
             <!-- 今日目标 -->
             <div class="overview-panel">
               <div class="overview-kicker">今日目标</div>
               <div class="target-header">
                 <span>{{ money(todayFlow) }} / {{ money(dailyTarget) }}</span>
                 <span>{{ targetProgress }}%</span>
               </div>
               <div class="target-track">
                 <div class="target-bar" :style="{ width: `${targetProgress}%` }"></div>
               </div>
               <p class="muted">{{ targetGap <= 0 ? '今日目标已达成，继续冲刺！' : `还差 ${money(targetGap)} 达成今日目标` }}</p>
               <div class="target-actions">
                 <button class="secondary-btn" @click="dailyTarget = Math.max(500, dailyTarget - 500)">目标 -500</button>
                 <button class="secondary-btn" @click="dailyTarget += 500">目标 +500</button>
               </div>
              </div>
              <!-- 发财签 -->
              <div class="overview-panel lucky-panel" :class="{ animating: luckyAnimating }">
                <div class="overview-kicker">发财签</div>
                <p class="lucky-text">{{ luckyMessage }}</p>
                <div class="lucky-sparkles" aria-hidden="true">
                  <span class="spark spark-1"></span>
                  <span class="spark spark-2"></span>
                  <span class="spark spark-3"></span>
                </div>
                <button class="primary-btn lucky-draw-btn" :disabled="luckyAnimating" @click="drawLucky">
                  {{ luckyAnimating ? '开运中...' : '抽一签' }}
                </button>
               </div>
               <!-- 今日建议 -->
               <div class="overview-panel tips-panel">
                 <div class="overview-kicker">今日建议</div>
                 <p v-for="tip in operationTips" :key="tip" class="tips-item">{{ tip }}</p>
               </div>
            </div>
          </div>
       </div>
   
      <!-- 会员管理 -->
      <div v-if="activeNav === 'customers'" class="customers-view">
        <div class="card">
          <h3>{{ customerForm.id ? '编辑会员' : '新增会员' }}</h3>
          <div class="form-row">
            <input v-model="customerForm.name" placeholder="姓名" />
            <input v-model="customerForm.phone" placeholder="手机号" @input="syncVerifyCode($event)" />
            <input v-model="customerForm.verifyCode" placeholder="校验码(4位)" maxlength="4" @focus="markVerifyCodeManually" @input="markVerifyCodeManually" />
            <input v-model.number="customerForm.initialRechargeAmount" type="number" placeholder="初次充值金额(仅新增)" :disabled="!!customerForm.id" />
            <textarea v-model="customerForm.remark" placeholder="备注"></textarea>
          </div>
          <div class="btn-group">
            <button class="primary-btn" @click="saveCustomer" :disabled="loading">{{ customerForm.id ? '保存' : '新增' }}</button>
            <button class="secondary-btn" @click="resetCustomerForm">清空</button>
            <button class="secondary-btn" @click="exportCustomers">导出会员CSV</button>
            <button class="secondary-btn" @click="openImportDialog">批量导入会员</button>
          </div>
        </div>
        <div class="card">
          <h3>会员列表</h3>
          <input v-model="customerKeyword" placeholder="搜索姓名/手机号" class="search-input" />
          <div class="table-wrap">
            <table>
              <thead><tr><th>姓名</th><th>手机号</th><th>校验码</th><th>状态</th><th>余额</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="c in customers" :key="c.id">
                  <td>{{ c.name }}</td>
                  <td>{{ c.phone }}</td>
                  <td><button class="text-btn" @click="toggleVerifyCode(c.id)">{{ customerVerifyVisible[c.id] ? c.verify_code : '****' }}</button></td>
                  <td>{{ c.status === 'active' ? '正常' : '停用' }}</td>
                  <td>{{ money(balanceMap[c.id]) }}</td>
                  <td><button class="text-btn" @click="editCustomer(c)">编辑</button><button class="text-btn danger" @click="toggleCustomer(c.id)">停用/恢复</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="pagination">
            <button :disabled="customerPage<=1" @click="changePage('customer',-1)">上一页</button>
            <span>第{{customerPage}}/{{customerTotalPages}}页</span>
            <button :disabled="customerPage>=customerTotalPages" @click="changePage('customer',1)">下一页</button>
          </div>
        </div>
      </div>

      <!-- 员工管理 -->
      <div v-if="activeNav === 'employees'" class="employees-view">
        <div class="card">
          <h3>{{ employeeForm.id ? '编辑员工' : '新增员工' }}</h3>
          <div class="form-row"><input v-model="employeeForm.name" placeholder="员工姓名" /></div>
          <div class="btn-group">
            <button class="primary-btn" @click="saveEmployee" :disabled="loading">{{ employeeForm.id ? '保存' : '新增' }}</button>
            <button class="secondary-btn" @click="resetEmployeeForm">清空</button>
          </div>
        </div>
        <div class="card">
          <h3>员工列表</h3>
          <table><thead><tr><th>姓名</th><th>状态</th><th>操作</th></tr></thead>
          <tbody><tr v-for="e in employees" :key="e.id"><td>{{ e.name }}</td><td>{{ e.status === 'active' ? '在岗' : '停用' }}</td><td><button class="text-btn" @click="editEmployee(e)">编辑</button><button class="text-btn danger" @click="toggleEmployee(e.id)">停用/恢复</button></td></tr></tbody></table>
          <div class="pagination"><button :disabled="employeePage<=1" @click="changePage('employee',-1)">上一页</button><span>第{{employeePage}}/{{employeeTotalPages}}页</span><button :disabled="employeePage>=employeeTotalPages" @click="changePage('employee',1)">下一页</button></div>
        </div>
      </div>

      <!-- 服务类型 -->
      <div v-if="activeNav === 'services'" class="services-view">
        <div class="card">
          <h3>{{ serviceForm.id ? '编辑服务' : '新增服务' }}</h3>
          <div class="form-row"><input v-model="serviceForm.name" placeholder="服务名称" /><input v-model.number="serviceForm.price" type="number" placeholder="价格" /></div>
          <div class="btn-group"><button class="primary-btn" @click="saveService" :disabled="loading">{{ serviceForm.id ? '保存' : '新增' }}</button><button class="secondary-btn" @click="resetServiceForm">清空</button></div>
        </div>
        <div class="card">
          <h3>服务列表</h3>
          <table><thead><tr><th>名称</th><th>价格</th><th>状态</th><th>操作</th></tr></thead>
          <tbody><tr v-for="s in services" :key="s.id"><td>{{ s.name }}</td><td>{{ money(s.price) }}</td><td>{{ s.status === 'active' ? '启用' : '停用' }}</td><td><button class="text-btn" @click="editService(s)">编辑</button><button class="text-btn danger" @click="toggleService(s.id)">停用/恢复</button></td></tr></tbody></table>
          <div class="pagination"><button :disabled="servicePage<=1" @click="changePage('service',-1)">上一页</button><span>第{{servicePage}}/{{serviceTotalPages}}页</span><button :disabled="servicePage>=serviceTotalPages" @click="changePage('service',1)">下一页</button></div>
        </div>
      </div>

      <!-- 充值消费 -->
      <div v-if="activeNav === 'transactions'" class="transactions-view">
        <div class="card">
  <h3>会员充值</h3>
  <div class="form-row">
    <div class="combo">
      <input 
        v-model="rechargeKeyword" 
        placeholder="会员姓名/手机号" 
        @focus="openRechargeCustomerMenu"
        @input="filterRechargeCustomerOptions"
        @blur="closeRechargeCustomerMenu"
      />
      <div v-if="showRechargeMenu && filteredRechargeOptions.length" class="combo-menu">
        <div v-for="c in filteredRechargeOptions" :key="c.id" @mousedown.prevent="selectRechargeCustomer(c)">
          {{ c.name }} / {{ c.phone }}
        </div>
      </div>
    </div>
    <input v-model.number="rechargeAmount" type="number" placeholder="充值金额" />
    <input v-model="rechargeRemark" placeholder="备注" />
  </div>
  <button class="primary-btn" @click="doRecharge" :disabled="loading">确认充值</button>
</div>
        <div class="card">
          <h3>会员消费</h3>
          <div class="form-row">
            <div class="combo">
              <input 
        v-model="consumeKeyword" 
        placeholder="会员姓名/手机号" 
        @focus="openConsumeCustomerMenu"
        @input="filterConsumeCustomerOptions"
        @blur="closeConsumeCustomerMenu"
      />
      <div v-if="showConsumeMenu && filteredConsumeOptions.length" class="combo-menu">
        <div v-for="c in filteredConsumeOptions" :key="c.id" @mousedown.prevent="selectConsumeCustomer(c)">
          {{ c.name }} / {{ c.phone }} (余额{{ money(balanceMap[c.id]) }})
        </div>
              </div>
            </div>
            <select v-model="consumeEmployeeId"><option value="">选择员工</option><option v-for="e in activeEmployees" :key="e.id" :value="e.id">{{ e.name }}</option></select>
            <select v-model="consumeServiceId" @change="fillPrice"><option value="">选择服务</option><option v-for="s in activeServices" :key="s.id" :value="s.id">{{ s.name }} / {{ money(s.price) }}</option></select>
            <input v-model.number="consumeAmount" type="number" placeholder="消费金额" />
            <input v-model="consumeVerifyCode" placeholder="校验码(4位)" maxlength="4" />
            <input v-model="consumeRemark" placeholder="备注" />
          </div>
          <button class="primary-btn" @click="doConsume" :disabled="loading">确认扣款</button>
        </div>
        <div class="card">
          <h3>交易流水</h3>
          <div class="btn-group" style="margin-bottom: 10px;">
    <button class="secondary-btn" @click="openExportDialog">导出交易CSV</button>
  </div>
          <table><thead><tr><th>时间</th><th>类型</th><th>会员</th><th>金额</th><th>详情</th></tr></thead>
          <tbody><tr v-for="t in transactions" :key="t.id"><td>{{ formatDate(t.createdAt || t.created_at) }}</td><td>{{ t.type === 'recharge' ? '充值' : '消费' }}</td><td>{{ t.customerName }}</td><td>{{ money(t.amount) }}</td><td>{{ t.detail || t.remark }}</td></tr></tbody></table>
          <div class="pagination"><button :disabled="txPage<=1" @click="changePage('tx',-1)">上一页</button><span>第{{txPage}}/{{txTotalPages}}页</span><button :disabled="txPage>=txTotalPages" @click="changePage('tx',1)">下一页</button></div>
        </div>
      </div>

      <!-- 报表分析 -->
      <div v-if="activeNav === 'reports'" class="reports-view">
        <div class="card"><h3>报表筛选</h3><div class="form-row"><input type="date" v-model="reportStart" /><input type="date" v-model="reportEnd" /><button class="secondary-btn" @click="loadReports">查询</button><button class="secondary-btn" @click="exportPerformance">导出员工业绩CSV</button></div></div>
        <div class="card"><h3>汇总</h3><div class="summary-grid"><div><div>充值总额</div><strong>{{ money(reportSummary.total_recharge) }}</strong></div><div><div>消费总额</div><strong>{{ money(reportSummary.total_consume) }}</strong></div><div><div>充值总余额</div><strong>{{ money(reportSummary.total_balance) }}</strong></div><div><div>总会员</div><strong>{{ reportSummary.total_customers }}</strong></div><div><div>新增会员</div><strong>{{ reportSummary.new_customers }}</strong></div><div><div>活跃会员</div><strong>{{ reportSummary.active_customers }}</strong></div></div></div>
        <div class="card"><h3>员工业绩</h3><table><thead><tr><th>员工</th><th>订单数</th><th>总金额</th><th>客单价</th></tr></thead><tbody><tr v-for="p in performance" :key="p.employeeId"><td>{{ p.employeeName }}</td><td>{{ p.total_count }}</td><td>{{ money(p.total_amount) }}</td><td>{{ money(p.avg_amount) }}</td></tr></tbody></table></div>
        <!-- 会员消费查询 -->
<div class="card">
  <h3>会员消费查询</h3>
  <div class="form-row">
    <input type="date" v-model="consumeQuery.startDate" />
    <input type="date" v-model="consumeQuery.endDate" />
    <div class="combo">
  <input 
    v-model="consumeQuery.customerName" 
    placeholder="会员姓名（支持模糊）" 
    @focus="openCustomerQueryMenu"
    @input="filterCustomerQueryOptions"
    @blur="closeCustomerQueryMenu"
  />
  <div v-if="showCustomerQueryMenu && filteredCustomerOptions.length" class="combo-menu">
    <div v-for="c in filteredCustomerOptions" :key="c.id" @mousedown.prevent="selectCustomerQuery(c)">
      {{ c.name }} / {{ c.phone }}
    </div>
  </div>
</div>
    <button class="primary-btn" @click="searchCustomerConsume">查询</button>
    <button class="secondary-btn" @click="exportCustomerConsume">导出会员消费CSV</button>
  </div>
  <div v-if="customerConsume.customer">
    <p>会员：{{ customerConsume.customer.name }} | 消费总额：{{ money(customerConsume.summary.totalAmount) }} | 订单数：{{ customerConsume.summary.totalCount }}</p>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>时间</th><th>金额</th><th>详情</th> </tr>
        </thead>
        <tbody>
          <tr v-for="item in customerConsume.items" :key="item.id">
            <td>{{ formatDate(item.createdAt) }}</td>
            <td>{{ money(item.amount) }}</td>
            <td>{{ item.detail }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div v-else-if="searched && !customerConsume.customer" class="muted">未找到该会员或该时段无消费记录</div>
</div>
      </div>

      <!-- 审计日志 -->
      <div v-if="activeNav === 'audit'" class="audit-view"><div class="card"><h3>审计日志</h3><table><thead><tr><th>时间</th><th>动作</th><th>实体</th><th>详情</th></tr></thead><tbody><tr v-for="log in auditLogs" :key="log.id"><td>{{ formatDate(log.createdAt || log.created_at) }}</td><td>{{ log.action }}</td><td>{{ log.entity_type }}</td><td>{{ log.detail }}</td></tr></tbody></table></div></div>

      <!-- 使用帮助 -->
<div v-if="activeNav === 'help'" class="help-section">
  <div class="card help-card">
    <h3>使用帮助</h3>
    <div class="help-wrap">
      <div class="help-item">
        <h4>1. 添加客户（会员）</h4>
        <p>进入“会员管理”，填写姓名、手机号后点击“新增”。校验码可手动填写；如不填写，系统默认使用手机号后四位。</p>
      </div>
      <div class="help-item">
        <h4>2. 添加员工</h4>
        <p>进入“员工管理”，输入员工姓名并保存。停用员工不会删除历史数据，恢复后可继续使用。</p>
      </div>
      <div class="help-item">
        <h4>3. 会员充值</h4>
        <p>进入“充值消费”中的“会员充值”，在下拉框输入姓名或手机号选择会员，填写金额后确认充值。</p>
      </div>
      <div class="help-item">
        <h4>4. 会员扣费（消费）</h4>
        <p>在“会员消费”中选择会员、员工和服务，输入消费金额与校验码后确认。校验码需与会员档案一致才可扣费。</p>
      </div>
      <div class="help-item">
        <h4>5. 修改密码</h4>
        <p>点击右上角“系统设置”，在弹窗中输入旧密码和新密码完成修改。修改成功后需重新登录。</p>
      </div>
      <div class="help-item">
        <h4>6. 导出数据</h4>
        <p>在会员、交易、报表页可导出 CSV。桌面版会弹出保存窗口，网页版会直接下载文件。</p>
      </div>
      <div class="help-item">
        <h4>7. 批量导入会员</h4>
        <p>点击“会员管理”中的“批量导入会员”按钮，下载CSV模板。按模板格式填写会员信息（姓名、手机号为必填，校验码不填则默认手机号后4位，初始充值金额可选）。上传后系统会自动导入并提示成功/失败数量。注意：手机号重复的会员会被跳过，请确保数据正确后再导入。</p>
        <p><strong>模板说明：</strong>第一行为表头，依次为：<code>姓名,手机号,校验码,备注,初始充值金额</code>。示例：<code>张三,13812345678,5678,老客户,100</code>。</p>
        <p><strong>注意事项：</strong>CSV文件请使用UTF-8编码（模板已带BOM，Excel打开正常）；一次导入建议不超过500条，可分批多次导入；导入失败时会在弹窗中显示具体错误原因。</p>
      </div>
      <!-- 新增第8项：项目说明文档 -->
      <div class="help-item">
        <h4>8. 项目说明文档（README）</h4>
        <p>您可以点击下方链接，查看或下载本项目的完整说明文档：</p>
        <p><a href="https://raw.githubusercontent.com/six686/Shop/refs/heads/main/README.md" target="_blank" rel="noopener noreferrer">GitHub 原始链接（推荐）</a></p>
        <p><a href="https://raw.gh.registry.cyou/six686/Shop/refs/heads/main/README.md" target="_blank" rel="noopener noreferrer">备用链接（国内加速）</a></p>
        <p>文档内容涵盖：系统架构、功能列表、部署指南、数据库结构、常见问题等。</p>
      </div>
    </div>
  </div>
</div>
    </main>

<!-- 批量导入会员弹窗 -->
<div v-if="importDialogVisible" class="modal-mask" @click.self="closeImportDialog">
  <div class="modal-card" style="width: 500px;">
    <h3>批量导入会员</h3>
    <div class="form-row">
      <a href="#" @click.prevent="downloadTemplate" class="template-link">下载导入模板 (CSV)</a>
    </div>
    <div class="form-row">
      <input type="file" ref="fileInput" accept=".csv" @change="handleFileSelect" />
    </div>
    <div class="form-row">
      <button class="primary-btn" @click="uploadImportFile" :disabled="!selectedFile || uploading">确认导入</button>
      <button class="secondary-btn" @click="closeImportDialog">取消</button>
    </div>
    <div v-if="importResult" class="import-result">
      <p>成功：{{ importResult.successCount }} 条</p>
      <p>失败：{{ importResult.failCount }} 条</p>
      <div v-if="importResult.errors.length" class="error-list">
        <p>错误详情：</p>
        <ul><li v-for="err in importResult.errors" :key="err">{{ err }}</li></ul>
      </div>
    </div>
  </div>
</div>
    
<!-- 导出交易流水日期选择弹窗 -->
<div v-if="exportDialogVisible" class="modal-mask" @click.self="closeExportDialog">
  <div class="modal-card">
    <h3>导出交易流水</h3>
    <div class="form-row">
      <input type="date" v-model="exportStartDate" />
      <span>至</span>
      <input type="date" v-model="exportEndDate" />
    </div>
    <div class="btn-group">
      <button class="primary-btn" @click="exportTransactions">确认导出</button>
      <button class="secondary-btn" @click="closeExportDialog">取消</button>
    </div>
  </div>
</div>

<!-- 系统设置弹窗 -->
<div v-if="systemDialogVisible" class="modal-mask" @click.self="closeSystemDialog">
  <div class="modal-card">
    <h3>系统设置</h3>
    <!-- 注册开关 -->
    <div class="form-row" style="align-items: center;">
      <label style="display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" v-model="allowRegistration" />
        <span>允许新用户注册</span>
      </label>
    </div>
    <!-- 修改密码 -->
    <div class="form-row">
      <input type="password" v-model="oldPassword" placeholder="旧密码" />
      <input type="password" v-model="newPassword" placeholder="新密码" />
      <input type="password" v-model="confirmNewPassword" placeholder="确认新密码" />
    </div>
    <div class="btn-group">
      <button class="primary-btn" @click="saveSystemSettings">保存</button>
      <button class="secondary-btn" @click="closeSystemDialog">取消</button>
    </div>
  </div>
</div>

    <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'

const router = useRouter()
const authStore = useAuthStore()
const username = authStore.username

const navItems = [
  { key: 'dashboard', label: '经营总览' },
  { key: 'customers', label: '会员管理' },
  { key: 'employees', label: '员工管理' },
  { key: 'services', label: '服务类型' },
  { key: 'transactions', label: '充值消费' },
  { key: 'reports', label: '报表分析' },
  { key: 'audit', label: '审计日志' },
  { key: 'help', label: '使用帮助' }
]

// 新增：侧边栏响应式状态
const sidebarOpen = ref(false);
function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}
// 点击页面其他地方可以关闭侧边栏（可选）
function closeSidebar() {
  sidebarOpen.value = false;
}

const activeNav = ref('dashboard')
const currentTitle = computed(() => navItems.find(i => i.key === activeNav.value)?.label || '经营总览')

// 注册开关状态
const allowRegistration = ref(true);

// 加载当前注册开关状态
async function loadRegistrationStatus() {
  try {
    const res = await axios.get('/api/config/registration-status');
    if (res.data.success) {
      allowRegistration.value = res.data.data.allowRegistration;
    }
  } catch (err) {
    console.error('加载注册开关失败', err);
  }
}

// 保存系统设置（密码修改 + 注册开关）
async function saveSystemSettings() {
  // 先处理注册开关
  try {
    await axios.post('/api/config/registration-status', {
      allowRegistration: allowRegistration.value
    });
    showToast('注册开关已更新');
  } catch (err) {
    showToast('更新注册开关失败');
    return;
  }

  // 处理密码修改（如果填写了密码）
  if (oldPassword.value && newPassword.value) {
    if (newPassword.value !== confirmNewPassword.value) {
      showToast('新密码不一致');
      return;
    }
    try {
      await axios.post('/api/auth/change-password', {
        oldPassword: oldPassword.value,
        newPassword: newPassword.value
      });
      showToast('密码修改成功，请重新登录');
      setTimeout(() => logout(), 1500);
      return; // 退出登录，不关闭弹窗（已经跳转）
    } catch (err) {
      showToast(err.response?.data?.message || '密码修改失败');
    }
  }
  closeSystemDialog();
}

// 通用
const toastMsg = ref('')
const loading = ref(false)
function showToast(msg: string) { toastMsg.value = msg; setTimeout(() => toastMsg.value = '', 2000) }
function money(val: number) { return `¥${(val || 0).toFixed(2)}` }
function formatDate(d: string) { if (!d) return ''; return new Date(d).toLocaleString() }

// 今日目标、语录、发财签相关
const dailyTarget = ref(1000)
// 开店励志语录数组
const quotes = [
  '把每一次服务做到位，财富会按时来敲门。',
  '花开富贵，客似云来。',
  '今日用心服务，明日口碑自来。',
  '一束花，一份情，留住顾客的心。',
  '细节决定成败，服务创造价值。',
  '生意兴隆通四海，财源茂盛达三江。',
  '微笑迎客，真诚待客，回头客自然多。',
  '每天进步一点点，店铺兴旺一大步。',
  '用心包装每一朵花，用爱服务每一位客。',
  '花香引蝶，服务留人。',
  '今天的努力，明天的收获。',
  '顾客满意是最大的财富。',
  '和气生财，笑脸迎客。',
  '花开时节又逢君，生意兴隆日日新。'
];

const currentQuote = ref(quotes[0]);

// 随机更新今日语录
function updateRandomQuote() {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  currentQuote.value = quotes[randomIndex];
}
const luckyMessage = ref('今日宜稳扎稳打，客单自然上涨。')
const luckyAnimating = ref(false)

// 今日流水总额
const todayFlow = computed(() => Number(summary.todayRecharge || 0) + Number(summary.todayConsume || 0))

// 目标进度百分比
const targetProgress = computed(() => {
  const target = Number(dailyTarget.value || 0)
  if (target <= 0) return 0
  return Math.min(100, Math.round((todayFlow.value / target) * 100))
})

// 还差多少达成目标
const targetGap = computed(() => Math.max(0, Number(dailyTarget.value || 0) - todayFlow.value))

// 今日建议（基于活跃会员、充值、消费等动态生成）
const operationTips = computed(() => {
  const active = Number(summary.activeCustomers || 0)
  const recharge = Number(summary.todayRecharge || 0)
  const consume = Number(summary.todayConsume || 0)
  const balance = Number(summary.totalBalance || 0)
  return [
    `活跃会员 ${active} 位，建议优先回访高频复购客户。`,
    `今日充值 ${money(recharge)}，可主推性价比提升复购。`,
    `今日消费 ${money(consume)}，收银后可顺带做会员转化。`,
    `当前总余额 ${money(balance)}，关注沉睡会员唤醒机会。`
  ]
})

// 发财签随机数组
const luckyNotes = [
  '上上签：今日适合主推高复购服务，财气在线。',
  '中上签：老客回流运不错，主动问候会有惊喜。',
  '平稳签：节奏稳住，细节做好，现金流会更健康。',
  '进取签：适合做会员转化，今天充会员成功率偏高。',
  '丰收签：团队配合顺，连单概率提升。'
]

// 抽签函数
function drawLucky() {
  if (luckyAnimating.value) return
  luckyAnimating.value = true
  setTimeout(() => {
    luckyMessage.value = luckyNotes[Math.floor(Math.random() * luckyNotes.length)]
  }, 220)
  setTimeout(() => {
    luckyAnimating.value = false
  }, 980)
}

// 数据
const summary = reactive({ activeCustomers: 0, totalBalance: 0, todayRecharge: 0, todayConsume: 0 })
async function loadSummary() { try { const res = await axios.get('/api/reports/dashboard'); Object.assign(summary, res.data.data) } catch(e) { showToast('加载失败') } }

// 会员
const customers = ref<any[]>([])
const customerPage = ref(1), customerTotalPages = ref(1), customerKeyword = ref('')
const customerForm = reactive({ id: '', name: '', phone: '', verifyCode: '', initialRechargeAmount: '', remark: '' })
const customerVerifyVisible = reactive<Record<number, boolean>>({})
const balanceMap = reactive<Record<number, number>>({})
async function loadCustomers() {
  try {
    const res = await axios.get(`/api/customers?page=${customerPage.value}&size=10&keyword=${customerKeyword.value}`)
    customers.value = res.data.data.items
    customerTotalPages.value = res.data.data.totalPages
    for (const c of customers.value) {
      if (!balanceMap[c.id]) {
        const bal = await axios.get(`/api/accounts/${c.id}/balance`)
        balanceMap[c.id] = bal.data.data.balance
      }
    }
  } catch(e) { showToast('加载会员失败') }
}
function toggleVerifyCode(id: number) { customerVerifyVisible[id] = !customerVerifyVisible[id] }
// 重置表单时，也要重置自动填充标记
function resetCustomerForm() {
  customerForm.id = '';
  customerForm.name = '';
  customerForm.phone = '';
  customerForm.verifyCode = '';
  customerForm.initialRechargeAmount = '';
  customerForm.remark = '';
  isVerifyCodeManuallySet = false;  // 重置手动修改标志
}

// 监听会员搜索关键词变化
watch(customerKeyword, () => {
  customerPage.value = 1;  // 重置页码
  loadCustomers();
});

// 记录上一次自动设置的校验码（用于判断用户是否手动修改过）
// 是否手动修改过校验码（新增模式下）
let isVerifyCodeManuallySet = false;

function syncVerifyCode(event) {
  const phone = event.target.value;
  if (customerForm.id) return; // 编辑模式不自动填充
  
  // 如果用户已经手动修改过校验码，则不再自动更新
  if (isVerifyCodeManuallySet) return;
  
  const newLast4 = phone.length >= 4 ? phone.slice(-4) : '';
  customerForm.verifyCode = newLast4;
}

// 标记用户手动修改了校验码
function markVerifyCodeManually() {
  isVerifyCodeManuallySet = true;
}

async function saveCustomer() {
  if (!customerForm.name || !customerForm.phone) return showToast('请填写姓名和手机号')
  loading.value = true
  try {
    const payload = { name: customerForm.name, phone: customerForm.phone, verifyCode: customerForm.verifyCode, remark: customerForm.remark, initialRechargeAmount: customerForm.initialRechargeAmount }
    if (customerForm.id) await axios.put(`/api/customers/${customerForm.id}`, payload)
    else await axios.post('/api/customers', payload)
    showToast('保存成功'); resetCustomerForm(); await loadCustomers()
  } catch(e:any) { showToast(e.response?.data?.message || '保存失败') } finally { loading.value = false }
}
  
// 编辑会员时，需要关闭自动填充（因为编辑模式下不应自动覆盖原有校验码）
function editCustomer(c) {
  customerForm.id = c.id;
  customerForm.name = c.name;
  customerForm.phone = c.phone;
  customerForm.verifyCode = c.verify_code || '';
  customerForm.remark = c.remark || '';
  isVerifyCodeManuallySet = true;  // 编辑模式下视为已手动设置，避免覆盖原有校验码
}
async function toggleCustomer(id: number) { try { await axios.patch(`/api/customers/${id}/toggle-status`); showToast('状态已更新'); await loadCustomers() } catch(e) { showToast('操作失败') } }
async function exportCustomers() {
  try {
    const res = await axios.get('/api/export/customers', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'customers.csv'
    a.click()
    URL.revokeObjectURL(url)
  } catch(e) { showToast('导出失败') }
}

// 批量导入相关
const importDialogVisible = ref(false);
const selectedFile = ref(null);
const uploading = ref(false);
const importResult = ref(null);
const fileInput = ref(null);

function openImportDialog() {
  importDialogVisible.value = true;
  selectedFile.value = null;
  importResult.value = null;
  if (fileInput.value) fileInput.value.value = '';
}

function closeImportDialog() {
  importDialogVisible.value = false;
}

function handleFileSelect(event) {
  selectedFile.value = event.target.files[0];
}

function downloadTemplate() {
  // 模板内容
  const template = '姓名,手机号,校验码,备注,初始充值金额\n张三,13812345678,5678,老客户,100\n李四,13987654321,4321,,0';
  const blob = new Blob(["\uFEFF" + template], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.setAttribute('download', 'member_import_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function uploadImportFile() {
  if (!selectedFile.value) {
    showToast('请先选择 CSV 文件');
    return;
  }
  uploading.value = true;
  const formData = new FormData();
  formData.append('file', selectedFile.value);
  try {
    const res = await axios.post('/api/import/customers', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    if (res.data.success) {
      importResult.value = res.data.data;
      showToast(`导入完成：成功 ${res.data.data.successCount} 条，失败 ${res.data.data.failCount} 条`);
      if (res.data.data.successCount > 0) {
        await loadCustomers(); // 刷新会员列表
      }
    } else {
      showToast(res.data.message || '导入失败');
    }
  } catch (err) {
    showToast(err.response?.data?.message || '导入失败');
  } finally {
    uploading.value = false;
  }
}

// 员工
const employees = ref<any[]>([])
const employeePage = ref(1), employeeTotalPages = ref(1)
const employeeForm = reactive({ id: '', name: '' })
async function loadEmployees() { try { const res = await axios.get(`/api/employees?page=${employeePage.value}&size=10`); employees.value = res.data.data.items; employeeTotalPages.value = res.data.data.totalPages } catch(e) { showToast('加载员工失败') } }
function resetEmployeeForm() { employeeForm.id = ''; employeeForm.name = '' }
async function saveEmployee() { if (!employeeForm.name) return showToast('请填写姓名'); loading.value = true; try { if (employeeForm.id) await axios.put(`/api/employees/${employeeForm.id}`, { name: employeeForm.name }); else await axios.post('/api/employees', { name: employeeForm.name }); showToast('保存成功'); resetEmployeeForm(); await loadEmployees() } catch(e) { showToast('保存失败') } finally { loading.value = false } }
function editEmployee(e: any) { employeeForm.id = e.id; employeeForm.name = e.name }
async function toggleEmployee(id: number) { try { await axios.patch(`/api/employees/${id}/toggle-status`); showToast('状态已更新'); await loadEmployees() } catch(e) { showToast('操作失败') } }
const activeEmployees = computed(() => employees.value.filter(e => e.status === 'active'))

// 服务
const services = ref<any[]>([])
const servicePage = ref(1), serviceTotalPages = ref(1)
const serviceForm = reactive({ id: '', name: '', price: '' })
async function loadServices() { try { const res = await axios.get(`/api/config/services?page=${servicePage.value}&size=10`); services.value = res.data.data.items; serviceTotalPages.value = res.data.data.totalPages } catch(e) { showToast('加载服务失败') } }
function resetServiceForm() { serviceForm.id = ''; serviceForm.name = ''; serviceForm.price = '' }
async function saveService() { if (!serviceForm.name || !serviceForm.price) return showToast('请填写完整'); loading.value = true; try { if (serviceForm.id) await axios.put(`/api/config/services/${serviceForm.id}`, { name: serviceForm.name, price: serviceForm.price }); else await axios.post('/api/config/services', { name: serviceForm.name, price: serviceForm.price }); showToast('保存成功'); resetServiceForm(); await loadServices() } catch(e) { showToast('保存失败') } finally { loading.value = false } }
function editService(s: any) { serviceForm.id = s.id; serviceForm.name = s.name; serviceForm.price = s.price }
async function toggleService(id: number) { try { await axios.patch(`/api/config/services/${id}/toggle-status`); showToast('状态已更新'); await loadServices() } catch(e) { showToast('操作失败') } }
const activeServices = computed(() => services.value.filter(s => s.status === 'active'))

// 充值消费 - 会员下拉
const customerOptions = ref<any[]>([])
const rechargeKeyword = ref(''), rechargeAmount = ref(0), rechargeRemark = ref('')

// ========== 充值会员下拉实时过滤 ==========
const allCustomers = ref([]);                 // 所有会员缓存
const filteredRechargeOptions = ref([]);      // 过滤后的充值候选
const showRechargeMenu = ref(false);
let rechargeSelectedCustomer = null;

async function loadAllCustomers() {
  if (allCustomers.value.length > 0) return;
  try {
    const res = await axios.get('/api/customers?page=1&size=200');
    if (res.data.success) {
      allCustomers.value = res.data.data.items;
    }
  } catch (err) {
    console.error('加载会员列表失败', err);
  }
}

function openRechargeCustomerMenu() {
  if (allCustomers.value.length === 0) {
    loadAllCustomers().then(() => {
      filterRechargeCustomerOptions();
      showRechargeMenu.value = true;
    });
  } else {
    filterRechargeCustomerOptions();
    showRechargeMenu.value = true;
  }
}

function filterRechargeCustomerOptions() {
  const keyword = rechargeKeyword.value?.trim().toLowerCase() || '';
  if (!keyword) {
    filteredRechargeOptions.value = allCustomers.value;
  } else {
    filteredRechargeOptions.value = allCustomers.value.filter(c => 
      c.name.toLowerCase().includes(keyword) || c.phone.includes(keyword)
    );
  }
}

function selectRechargeCustomer(customer) {
  rechargeSelectedCustomer = customer;
  rechargeKeyword.value = customer.name;
  showRechargeMenu.value = false;
  // 同时设置充值表单的 customerId（需要额外变量）
  selectedRechargeCustomerId = customer.id;
}

function closeRechargeCustomerMenu() {
  setTimeout(() => {
    showRechargeMenu.value = false;
  }, 200);
}

// ========== 消费会员下拉实时过滤 ==========
const filteredConsumeOptions = ref([]);
const showConsumeMenu = ref(false);
let consumeSelectedCustomer = null;

function openConsumeCustomerMenu() {
  if (allCustomers.value.length === 0) {
    loadAllCustomers().then(() => {
      filterConsumeCustomerOptions();
      showConsumeMenu.value = true;
    });
  } else {
    filterConsumeCustomerOptions();
    showConsumeMenu.value = true;
  }
}

function filterConsumeCustomerOptions() {
  const keyword = consumeKeyword.value?.trim().toLowerCase() || '';
  if (!keyword) {
    filteredConsumeOptions.value = allCustomers.value;
  } else {
    filteredConsumeOptions.value = allCustomers.value.filter(c => 
      c.name.toLowerCase().includes(keyword) || c.phone.includes(keyword)
    );
  }
}

function selectConsumeCustomer(customer) {
  consumeSelectedCustomer = customer;
  consumeKeyword.value = customer.name;
  showConsumeMenu.value = false;
  selectedConsumeCustomerId = customer.id;
  // 自动填充校验码
  if (customer.phone && customer.phone.length >= 4) {
    consumeVerifyCode.value = customer.phone.slice(-4);
  }
}

function closeConsumeCustomerMenu() {
  setTimeout(() => {
    showConsumeMenu.value = false;
  }, 200);
}

const consumeKeyword = ref(''), consumeEmployeeId = ref(''), consumeServiceId = ref(''), consumeAmount = ref(0), consumeVerifyCode = ref(''), consumeRemark = ref('')
let selectedRechargeCustomerId = 0
let selectedConsumeCustomerId = 0

async function doRecharge() {
  if (!selectedRechargeCustomerId || rechargeAmount.value <= 0) {
    showToast('请选择会员并输入金额');
    return;
  }
  loading.value = true;
  try {
    await axios.post('/api/transactions/recharge', {
      customerId: selectedRechargeCustomerId,
      amount: rechargeAmount.value,
      remark: rechargeRemark.value
    });
    showToast('充值成功');

    // 重置充值表单及下拉菜单状态
    rechargeKeyword.value = '';
    rechargeAmount.value = 0;
    rechargeRemark.value = '';
    selectedRechargeCustomerId = 0;
    rechargeSelectedCustomer = null;
    showRechargeMenu.value = false;
    filteredRechargeOptions.value = [];

    // 更新该会员余额
    const balRes = await axios.get(`/api/accounts/${selectedRechargeCustomerId}/balance`);
    balanceMap[selectedRechargeCustomerId] = balRes.data.data.balance;

    // 刷新数据
    await loadCustomers();
    await loadSummary();
    await loadTransactions();
  } catch (err) {
    showToast(err.response?.data?.message || '充值失败');
  } finally {
    loading.value = false;
  }
}

async function doConsume() {
  if (!selectedConsumeCustomerId || consumeAmount.value <= 0 || !consumeVerifyCode.value) {
    showToast('请填写完整信息');
    return;
  }
  loading.value = true;
  try {
    await axios.post('/api/transactions/consume', {
      customerId: selectedConsumeCustomerId,
      employeeId: consumeEmployeeId.value || null,
      serviceTypeId: consumeServiceId.value || null,
      amount: consumeAmount.value,
      verifyCode: consumeVerifyCode.value,
      remark: consumeRemark.value
    });
    showToast('消费成功');

    // 重置消费表单及下拉菜单状态
    consumeKeyword.value = '';
    consumeEmployeeId.value = '';
    consumeServiceId.value = '';
    consumeAmount.value = 0;
    consumeVerifyCode.value = '';
    consumeRemark.value = '';
    selectedConsumeCustomerId = 0;
    consumeSelectedCustomer = null;
    showConsumeMenu.value = false;
    filteredConsumeOptions.value = [];

    // 更新该会员余额
    const balRes = await axios.get(`/api/accounts/${selectedConsumeCustomerId}/balance`);
    balanceMap[selectedConsumeCustomerId] = balRes.data.data.balance;

    // 刷新数据
    await loadCustomers();
    await loadSummary();
    await loadTransactions();
  } catch (err) {
    showToast(err.response?.data?.message || '消费失败');
  } finally {
    loading.value = false;
  }
}

function fillPrice() { const s = activeServices.value.find(s => s.id === consumeServiceId.value); if (s && !consumeAmount.value) consumeAmount.value = s.price }

// 交易流水
const transactions = ref<any[]>([])
const txPage = ref(1), txTotalPages = ref(1)
async function loadTransactions() { try { const res = await axios.get(`/api/transactions?page=${txPage.value}&size=10`); transactions.value = res.data.data.items; txTotalPages.value = res.data.data.totalPages } catch(e) { showToast('加载流水失败') } }

// 导出交易流水相关
const exportDialogVisible = ref(false);
const exportStartDate = ref(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
const exportEndDate = ref(new Date().toISOString().slice(0, 10));

function openExportDialog() {
  exportDialogVisible.value = true;
}

function closeExportDialog() {
  exportDialogVisible.value = false;
}

async function exportTransactions() {
  if (!exportStartDate.value || !exportEndDate.value) {
    showToast('请选择日期范围');
    return;
  }
  try {
    const res = await axios.get('/api/export/transactions', {
      params: {
        startDate: exportStartDate.value,
        endDate: exportEndDate.value
      },
      responseType: 'blob'
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${exportStartDate.value}_to_${exportEndDate.value}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    closeExportDialog();
  } catch (err) {
    showToast('导出失败');
  }
}
  
// 报表
const reportStart = ref(new Date(Date.now() - 30*86400000).toISOString().slice(0,10))
const reportEnd = ref(new Date().toISOString().slice(0,10))
const reportSummary = reactive({ total_recharge: 0, total_consume: 0, total_customers: 0, new_customers: 0, active_customers: 0 })
const performance = ref<any[]>([])
async function loadReports() {
  const q = `startDate=${reportStart.value}&endDate=${reportEnd.value}`
  try {
    const sumRes = await axios.get(`/api/reports/summary?${q}`); Object.assign(reportSummary, sumRes.data.data)
    const perfRes = await axios.get(`/api/reports/employee-performance?${q}`); performance.value = perfRes.data.data
  } catch(e) { showToast('加载报表失败') }
}
async function exportPerformance() {
  try {
    const res = await axios.get(`/api/export/employee-performance?startDate=${reportStart.value}&endDate=${reportEnd.value}`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'performance.csv'
    a.click()
    URL.revokeObjectURL(url)
  } catch(e) { showToast('导出失败') }
}

// 会员消费查询相关
// 会员消费查询的下拉相关
const allCustomerOptions = ref([]);        // 所有会员列表（缓存）
const filteredCustomerOptions = ref([]);   // 过滤后的会员列表
const showCustomerQueryMenu = ref(false);
const selectedCustomerQuery = ref(null);

// 打开菜单时加载会员列表（仅首次加载）
async function openCustomerQueryMenu() {
  if (allCustomerOptions.value.length === 0) {
    try {
      const res = await axios.get('/api/customers?page=1&size=200');
      if (res.data.success) {
        allCustomerOptions.value = res.data.data.items;
        filterCustomerQueryOptions(); // 初始过滤
      }
    } catch (err) {
      console.error('加载会员列表失败', err);
    }
  }
  showCustomerQueryMenu.value = true;
}

// 根据输入实时过滤
function filterCustomerQueryOptions() {
  const keyword = consumeQuery.customerName?.trim().toLowerCase() || '';
  if (!keyword) {
    filteredCustomerOptions.value = allCustomerOptions.value;
  } else {
    filteredCustomerOptions.value = allCustomerOptions.value.filter(c => 
      c.name.toLowerCase().includes(keyword) || c.phone.includes(keyword)
    );
  }
}

// 选择会员
function selectCustomerQuery(customer) {
  selectedCustomerQuery.value = customer;
  consumeQuery.customerName = customer.name;
  showCustomerQueryMenu.value = false;
}

// 点击输入框外部关闭菜单（可选，在模板中添加 @blur）
function closeCustomerQueryMenu() {
  setTimeout(() => {
    showCustomerQueryMenu.value = false;
  }, 200);
}
  
const consumeQuery = reactive({
  startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  customerName: ''
});
const customerConsume = reactive({
  customer: null,
  summary: { totalAmount: 0, totalCount: 0 },
  items: []
});
const searched = ref(false);

async function searchCustomerConsume() {
  if (!consumeQuery.customerName) {
    showToast('请输入或选择会员姓名');
    return;
  }
  searched.value = true;
  try {
    let customerNameParam = consumeQuery.customerName;
    // 如果有选中的会员，使用其精确姓名（后端模糊查询也能匹配，但更精确）
    if (selectedCustomerQuery.value) {
      customerNameParam = selectedCustomerQuery.value.name;
    }
    const res = await axios.get('/api/reports/customer-consume-details', {
      params: {
        startDate: consumeQuery.startDate,
        endDate: consumeQuery.endDate,
        customerName: customerNameParam
      }
    });
    if (res.data.success) {
      customerConsume.customer = res.data.data.customer;
      customerConsume.summary = res.data.data.summary;
      customerConsume.items = res.data.data.items;
      if (!res.data.data.customer) showToast('未找到会员');
    } else {
      showToast(res.data.message || '查询失败');
    }
  } catch (err) {
    showToast('查询失败');
  }
}

async function exportCustomerConsume() {
  if (!consumeQuery.customerName) {
    showToast('请先查询会员消费');
    return;
  }
  const customerNameParam = selectedCustomerQuery.value ? selectedCustomerQuery.value.name : consumeQuery.customerName;
  try {
    const res = await axios.get('/api/export/customer-consume', {
      params: {
        startDate: consumeQuery.startDate,
        endDate: consumeQuery.endDate,
        customerName: customerNameParam
      },
      responseType: 'blob'
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer_consume_${customerNameParam}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast('导出失败');
  }
}
  
// 审计日志
const auditLogs = ref<any[]>([])
async function loadAudit() { try { const res = await axios.get('/api/audit/logs'); auditLogs.value = res.data.data } catch(e) { showToast('加载审计日志失败') } }

// 分页统一
function changePage(type: string, delta: number) {
  if (type === 'customer') { customerPage.value += delta; loadCustomers() }
  else if (type === 'employee') { employeePage.value += delta; loadEmployees() }
  else if (type === 'service') { servicePage.value += delta; loadServices() }
  else if (type === 'tx') { txPage.value += delta; loadTransactions() }
}

// 系统设置
const systemDialogVisible = ref(false)
const oldPassword = ref(''), newPassword = ref(''), confirmNewPassword = ref('')
function openSystemDialog() {
  systemDialogVisible.value = true;
  loadRegistrationStatus();      // 加载注册开关状态
  // 清空密码输入框
  oldPassword.value = '';
  newPassword.value = '';
  confirmNewPassword.value = '';
}
function closeSystemDialog() { systemDialogVisible.value = false; oldPassword.value = ''; newPassword.value = ''; confirmNewPassword.value = '' }
async function refreshAll() {
  try {
    await Promise.all([loadSummary(), loadCustomers(), loadEmployees(), loadServices(), loadTransactions(), loadReports(), loadAudit()]);
    showToast('已刷新');
    updateRandomQuote();  // 刷新时也随机更换今日语录
  } catch (e) {
    showToast(e.message);
  }
}
function handleLogout() { authStore.logout(); router.push('/login') }

onMounted(async () => { await refreshAll(); updateRandomQuote(); })
</script>

<style scoped>
.dashboard {
  display: flex;
  height: 100vh;
  background: #f3f4f6;
  overflow: hidden;
}

.sidebar {
  width: 200px;  /* 从 260px 减小到 200px */
  background: linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%);
  color: white;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  height: 100vh;
}

.sidebar-header {
  padding: 1.5rem 1rem;
  text-align: center;  /* 标题居中 */
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
  margin-bottom: 10px;
}

.sidebar-header h2 {
  font-size: 1.5rem;
  margin: 0;
}

.sidebar-header .slogan {
  font-size: 0.7rem;
  opacity: 0.8;
  margin: 4px 0;
  letter-spacing: 1px;
}

.sidebar-header p {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: 0.25rem;
}

.nav {
  flex: 1;
  padding: 1rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav a {
  display: flex;
  align-items: center;
  justify-content: center;  /* 文字水平居中 */
  padding: 0.75rem 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  color: #cbd5e1;
  transition: all 0.2s;
  text-align: center;
}

.nav a:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.nav a.active {
  background: #4f46e5;
  color: white;
}

.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.user-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.logout-btn {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  color: white;
  cursor: pointer;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.card {
  background: white;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat-card {
  background: white;
  border-radius: 0.5rem;
  padding: 1rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #4f46e5;
}

.stat-label {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.form-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.form-row input,
.form-row select,
.form-row textarea {
  flex: 1;
  min-width: 150px;
}

.btn-group {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

th,
td {
  padding: 0.5rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.text-btn {
  background: none;
  border: none;
  color: #4f46e5;
  cursor: pointer;
  margin-right: 0.5rem;
}

.text-btn.danger {
  color: #ef4444;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
  align-items: center;
}

.search-input {
  width: 100%;
  margin-bottom: 0.5rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: white;
  border-radius: 0.5rem;
  padding: 1.5rem;
  width: 400px;
}

.toast {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: #1f2937;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 2rem;
  font-size: 0.875rem;
  z-index: 2000;
}

.combo {
  position: relative;
  flex: 1;
}

.combo-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
}

.combo-menu div {
  padding: 0.5rem;
  cursor: pointer;
}

.combo-menu div:hover {
  background: #f0f0f0;
}

.help-section {
  padding: 0;
}

.help-card {
  background: white;
}

.help-wrap {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}

.help-item {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
  background: #f9fafb;
}

.help-item h4 {
  margin-bottom: 0.5rem;
  color: #4f46e5;
}

.help-item p {
  font-size: 0.875rem;
  color: #4b5563;
  line-height: 1.5;
}

/* 汉堡菜单按钮 */
.menu-toggle {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 1001;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* 遮罩层 */
.sidebar-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

/* 平板适配 */
@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .help-wrap {
    grid-template-columns: 1fr;
  }
}

/* 手机端适配（宽度 ≤ 768px） */
@media (max-width: 768px) {
  .dashboard {
    flex-direction: column;
  }
  /* 侧边栏默认隐藏 */
  .sidebar {
    position: fixed;
    left: -200px;  /* 对应宽度 200px */
    top: 0;
    height: 100vh;
    z-index: 1000;
    transition: left 0.3s ease;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  }
  .sidebar.open {
    left: 0;
  }
  /* 主内容区调整 */
  .main-content {
    padding: 0.75rem;
    padding-top: 60px; /* 为汉堡菜单留出空间 */
    width: 100%;
  }
  .main-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .main-header h1 {
    font-size: 1.25rem;
  }
  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
  .card {
    padding: 0.75rem;
  }
  .form-row {
    flex-direction: column;
    gap: 0.5rem;
  }
  .form-row input,
  .form-row select,
  .form-row textarea {
    width: 100%;
  }
  .btn-group {
    flex-wrap: wrap;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    min-width: 600px;
  }
  .stat-value {
    font-size: 1.25rem;
  }
  .stat-label {
    font-size: 0.7rem;
  }
  .pagination {
    flex-wrap: wrap;
    justify-content: center;
  }
  /* 经营状态卡片内网格在手机上变为单列 */
  .overview-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

/* 横屏且高度较小时，确保滚动正常 */
@media (orientation: landscape) and (max-height: 700px) {
  .main-content {
    overflow-y: auto;
  }
  .dashboard {
    overflow: hidden;
  }
}

/* 电脑端隐藏汉堡菜单和遮罩 */
@media (min-width: 769px) {
  .menu-toggle,
  .sidebar-mask {
    display: none;
  }
}

/* 经营状态卡片样式（今日语录、今日目标、发财签、今日建议） */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: 1fr;
  gap: 12px;
  margin-top: 8px;
}

.overview-panel {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #fafbff;
  padding: 12px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.quote-panel {
  position: relative;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.quote-panel .overview-kicker,
.lucky-panel .overview-kicker {
  position: absolute;
  top: 12px;
  left: 12px;
  margin: 0;
}

.lucky-panel {
  position: relative;
  justify-content: center;
  align-items: center;
  text-align: center;
  overflow: hidden;
}

.lucky-panel.animating {
  animation: luckyPulse 0.95s ease;
}

.lucky-draw-btn {
  position: relative;
  z-index: 2;
  margin-top: 12px;
}

.lucky-sparkles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.spark {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  opacity: 0;
  background: radial-gradient(circle at 30% 30%, #fff 0%, #c7d2fe 40%, #6366f1 100%);
  box-shadow: 0 0 10px rgba(99, 102, 241, 0.45);
}

.spark-1 {
  left: 30%;
  top: 62%;
}
.spark-2 {
  left: 52%;
  top: 58%;
}
.spark-3 {
  left: 72%;
  top: 64%;
}

.lucky-panel.animating .spark-1 {
  animation: luckySpark 0.9s ease-out 0.08s;
}
.lucky-panel.animating .spark-2 {
  animation: luckySpark 0.9s ease-out 0.16s;
}
.lucky-panel.animating .spark-3 {
  animation: luckySpark 0.9s ease-out 0.24s;
}
.lucky-panel.animating .lucky-text {
  animation: luckyFlip 0.9s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.overview-kicker {
  font-size: 0.75rem;
  color: #4f46e5;
  font-weight: 600;
  margin-bottom: 6px;
}

.quote-text,
.lucky-text {
  margin: 0 0 10px;
  line-height: 1.5;
  font-size: 0.875rem;
  color: #1f2937;
}

.quote-panel .quote-text {
  margin: 4px 0 0;
}

.tips-item {
  margin: 0;
  line-height: 1.45;
  font-size: 0.875rem;
  color: #6b7280;
}

.target-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  margin-bottom: 8px;
}

.target-track {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: #e8ebff;
  border: 1px solid #d6dcff;
  overflow: hidden;
}

.target-bar {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #4f46e5);
  border-radius: 999px;
  transition: width 0.25s ease;
}

.target-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

/* 动画 */
@keyframes luckyPulse {
  0% { box-shadow: 0 0 0 rgba(79, 70, 229, 0); transform: translateY(0); }
  35% { box-shadow: 0 0 0 10px rgba(79, 70, 229, 0.08), 0 10px 22px rgba(79, 70, 229, 0.22); transform: translateY(-1px); }
  100% { box-shadow: 0 0 0 rgba(79, 70, 229, 0); transform: translateY(0); }
}

@keyframes luckyFlip {
  0% { opacity: 0.25; transform: rotateX(70deg) scale(0.96); filter: blur(0.5px); }
  45% { opacity: 1; transform: rotateX(-10deg) scale(1.02); filter: blur(0); }
  100% { opacity: 1; transform: rotateX(0) scale(1); }
}

@keyframes luckySpark {
  0% { opacity: 0; transform: translateY(0) scale(0.5); }
  20% { opacity: 1; transform: translateY(-10px) scale(1.1); }
  100% { opacity: 0; transform: translateY(-30px) scale(0.7); }
}

.template-link {
  color: #4f46e5;
  text-decoration: none;
  font-size: 0.875rem;
}
.template-link:hover {
  text-decoration: underline;
}
.import-result {
  margin-top: 12px;
  font-size: 0.875rem;
}
.error-list {
  max-height: 150px;
  overflow-y: auto;
  background: #fef2f2;
  padding: 8px;
  border-radius: 4px;
  margin-top: 8px;
}
.error-list ul {
  margin: 0;
  padding-left: 20px;
}
</style>
