import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The React Compiler plugin is handled automatically in 2026 by the vite-plugin-react 
// when the babel-plugin-react-compiler is present in devDependencies.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})