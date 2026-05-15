import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// macOS FSEvents fires on file READS (Spotlight, VS Code, Time Machine), not just writes.
// Vite watches .env and vite.config.js and treats any FSEvent as a content change → restart loop.
// server.watcher.unwatch() is unreliable here because Vite re-adds these files after configureServer.
// Fix: intercept the watcher's EventEmitter.emit() directly and drop change events for protected
// files before they reach Vite's restart handler.
const stableDevServer = {
  name: 'stable-dev-server',
  configureServer(server) {
    const noWatch = new Set([
      path.resolve(__dirname, '.env'),
      path.resolve(__dirname, '.env.local'),
      path.resolve(__dirname, '.env.production'),
      path.resolve(__dirname, 'vite.config.js'),
      path.resolve(__dirname, 'package.json'),
    ])

    const _emit = server.watcher.emit.bind(server.watcher)
    server.watcher.emit = function (event, filePath, ...args) {
      if (
        (event === 'change' || event === 'add' || event === 'unlink') &&
        typeof filePath === 'string' &&
        noWatch.has(path.resolve(filePath))
      ) {
        return false
      }
      return _emit(event, filePath, ...args)
    }
  },
}

export default defineConfig({
  plugins: [react(), stableDevServer],
  resolve: {
    alias: {
      'framer-motion': path.resolve(__dirname, 'src/lib/framer-motion-shim.jsx'),
      'lucide-react': path.resolve(__dirname, 'src/lib/lucide-react-shim.jsx'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/.env', '**/vite.config.js', '**/package.json', '**/.git/**', '**/node_modules/**'],
    },
  },
})
