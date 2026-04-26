<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <!-- 品牌 Logo -->
        <img src="/logo.png" alt="品牌Logo" class="login-logo" />
        <h1>Flower</h1>
        <p>商店会员管理系统</p>
      </div>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <input type="text" v-model="username" placeholder="用户名" required />
        </div>
        <div class="form-group">
          <input type="password" v-model="password" placeholder="密码" required />
        </div>
        <button type="submit" class="primary-btn login-btn" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
      <div class="login-footer">
        <router-link to="/register">还没有账号？立即注册</router-link>
      </div>
      <div v-if="errorMsg" class="error-toast">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'

const router = useRouter()
const authStore = useAuthStore()
const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await axios.post('/api/auth/login', {
      username: username.value,
      password: password.value
    })
    if (res.data.success) {
      authStore.setToken(res.data.data.token, res.data.data.username)
      router.push('/')
    } else {
      errorMsg.value = res.data.message || '登录失败'
    }
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || '网络错误'
  } finally {
    loading.value = false
    setTimeout(() => { errorMsg.value = '' }, 3000)
  }
}
</script>

<style scoped>
.login-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-card {
  width: 380px;
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
}
.login-header {
  text-align: center;
  margin-bottom: 2rem;
}
.login-logo {
  width: 80px;
  height: 80px;
  object-fit: contain;
  margin-bottom: 15px;
  animation: gentleBounce 2s ease-in-out infinite;
}

@keyframes gentleBounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}
.login-header h1 {
  font-size: 2rem;
  color: #4f46e5;
}
.login-header p {
  color: #6b7280;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}
.form-group {
  margin-bottom: 1rem;
}
.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
}
.login-btn {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
}
.login-footer {
  text-align: center;
  margin-top: 1rem;
  font-size: 0.875rem;
}
.login-footer a {
  color: #4f46e5;
  text-decoration: none;
}
.error-toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #ef4444;
  color: white;
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 0.875rem;
}
</style>
