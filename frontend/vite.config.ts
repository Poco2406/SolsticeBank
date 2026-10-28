import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // En développement, /api est redirigé vers le backend : pas de souci de CORS
    proxy: { '/api': 'http://localhost:3000' },
  },
})
