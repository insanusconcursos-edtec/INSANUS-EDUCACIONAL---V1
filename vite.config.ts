
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  // Define 'process.env' como um objeto vazio para evitar erro "process is not defined" no navegador
  define: {
    'process.env': {}
  },
  build: {
    chunkSizeWarningLimit: 1600,
  }
})
