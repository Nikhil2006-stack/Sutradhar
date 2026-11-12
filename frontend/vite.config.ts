import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn, type ChildProcess } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function checkPortListening(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(600);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function sutradharAutoBackendPlugin(): Plugin {
  let backendProc: ChildProcess | null = null;

  return {
    name: 'sutradhar-auto-backend',
    configureServer(server) {
      checkPortListening(8000, '127.0.0.1').then((isListening) => {
        if (isListening) {
          console.log('✓ [Sutradhar] FastAPI backend already active on http://127.0.0.1:8000');
          return;
        }
        const backendDir = path.resolve(__dirname, '../backend');
        const winPython = path.resolve(__dirname, '../.venv/Scripts/python.exe');
        const nixPython = path.resolve(__dirname, '../.venv/bin/python');
        const pythonCmd = fs.existsSync(winPython)
          ? winPython
          : fs.existsSync(nixPython)
          ? nixPython
          : 'python';

        console.log('➜ [Sutradhar] Auto-starting FastAPI backend on http://127.0.0.1:8000 ...');
        backendProc = spawn(
          pythonCmd,
          ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'],
          {
            cwd: backendDir,
            stdio: 'inherit',
            windowsHide: true,
          }
        );
      });

      server.httpServer?.once('close', () => {
        if (backendProc && !backendProc.killed) {
          backendProc.kill();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), sutradharAutoBackendPlugin()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
          'vendor-charts': ['recharts'],
          'vendor-ui': ['lucide-react', 'axios', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
