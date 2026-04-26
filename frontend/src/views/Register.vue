<template>
  <div class="register-container">
    <div class="register-card">
      <div class="register-header">
        <h1>注册店长账号</h1>
        <p>快速开始管理您的店铺</p>
      </div>
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <input type="text" v-model="username" placeholder="用户名" required />
        </div>
        <div class="form-group">
          <input type="password" v-model="password" placeholder="密码" required />
        </div>
        <div class="form-group">
          <input type="password" v-model="confirmPassword" placeholder="确认密码" required />
        </div>
        <button type="submit" class="primary-btn register-btn" :disabled="loading">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>
      <div class="register-footer">
        <router-link to="/login">已有账号？去登录</router-link>
      </div>
      <div v-if="errorMsg" class="error-toast">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleRegister() {
  if (password.value !== confirmPassword.value) {
    errorMsg.value = '两次输入的密码不一致'
    setTimeout(() => { errorMsg.value = '' }, 3000)
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await axios.post('/api/auth/register', {
      username: username.value,
      password: password.value
    })
    if (res.data.success) {
      router.push('/login')
    } else {
      errorMsg.value = res.data.message || '注册失败'
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
.register-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.register-card {
  width: 380px;
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
}
.register-header {
  text-align: center;
  margin-bottom: 2rem;
}
.register-header h1 {
  font-size: 1.5rem;
  color: #4f46e5;
}
.register-header p {
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
.register-btn {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
}
.register-footer {
  text-align: center;
  margin-top: 1rem;
  font-size: 0.875rem;
}
.register-footer a {
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
