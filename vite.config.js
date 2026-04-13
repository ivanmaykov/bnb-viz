import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : process.env.VITE_BASE_PATH || '/bnb-viz/',
}));
