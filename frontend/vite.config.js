import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so one build works both at a user.github.io/<repo>/ subpath
  // and at the root of a custom domain.
  base: './',
})
