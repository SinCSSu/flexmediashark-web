import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// 后端地址：默认 8080，可用 FMS_BACKEND 环境变量覆盖
const backend = process.env.FMS_BACKEND ?? 'http://localhost:8080'

// 后端是独立服务，开发期把这些前缀代理过去，页面里直接用同源的相对路径调用
const API_PREFIXES = ['/scrape', '/scan', '/review', '/config', '/actuator']

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: Object.fromEntries(API_PREFIXES.map((prefix) => [prefix, backend])),
  },
})
