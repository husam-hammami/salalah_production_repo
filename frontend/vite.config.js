import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080, // ✅ your dev server port
    proxy: {
      '/orders': {
        target: 'http://localhost:5000', // ✅ Flask backend
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5000', // ✅ Flask-SocketIO backend
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxy
      },
    },
  },
})
