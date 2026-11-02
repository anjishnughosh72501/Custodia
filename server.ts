/**
 * Custodia Full-Stack Server
 * Single-origin deployment architecture on port 3000:
 * - Express mounts Vite dev server middleware
 * - Spawns and supervises Rust Secure Document Gateway on 127.0.0.1:8002 (private loopback)
 * - Spawns and supervises Python FastAPI backend on 127.0.0.1:8001
 * - Proxies /api/* directly to FastAPI, preserving Same-Origin session cookies
 */
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const FASTAPI_PORT = parseInt(process.env.FASTAPI_PORT || '8001', 10);
const GATEWAY_PORT = parseInt(process.env.GATEWAY_PORT || '8002', 10);
const IS_PROD = process.env.NODE_ENV === 'production';

let pythonProc: ChildProcess | null = null;
let gatewayProc: ChildProcess | null = null;

function startRustGateway(): Promise<void> {
  return new Promise((resolve) => {
    const binPath = path.join(__dirname, 'gateway', 'target', 'release', 'custodia-secure-gateway');
    const debugBinPath = path.join(__dirname, 'gateway', 'target', 'debug', 'custodia-secure-gateway');
    const executable = fs.existsSync(binPath) ? binPath : fs.existsSync(debugBinPath) ? debugBinPath : null;

    if (!executable) {
      console.log('[Custodia] Rust gateway binary not found; Python fallback will handle pre-parser checks.');
      return resolve();
    }

    console.log(`[Custodia] Spawning Rust Secure Document Gateway (${executable}) on 127.0.0.1:${GATEWAY_PORT}...`);
    const env = {
      ...process.env,
      GATEWAY_HOST: '127.0.0.1',
      GATEWAY_PORT: String(GATEWAY_PORT),
    };

    gatewayProc = spawn(executable, [], {
      cwd: path.join(__dirname, 'gateway'),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    gatewayProc.stdout?.on('data', (d) => process.stdout.write(`[Gateway] ${d}`));
    gatewayProc.stderr?.on('data', (d) => process.stderr.write(`[Gateway err] ${d}`));
    gatewayProc.on('exit', (code, sig) => console.warn(`[Custodia] Gateway exited with code ${code}, signal ${sig}`));

    setTimeout(() => resolve(), 800);
  });
}

function startFastApiBackend(): Promise<void> {
  return new Promise((resolve) => {
    console.log(`[Custodia] Spawning Python FastAPI backend on port ${FASTAPI_PORT}...`);
    
    // Ensure development secret is set
    const env = {
      ...process.env,
      CUSTODIA_SECRET: process.env.CUSTODIA_SECRET || 'custodia-dev-secret-key-32-bytes-minimum-seed!',
      FASTAPI_PORT: String(FASTAPI_PORT),
      CUSTODIA_GATEWAY_URL: `http://127.0.0.1:${GATEWAY_PORT}`,
    };

    pythonProc = spawn(
      'python3',
      ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(FASTAPI_PORT)],
      {
        cwd: __dirname,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    pythonProc.stdout?.on('data', (data) => {
      const msg = data.toString();
      process.stdout.write(`[FastAPI] ${msg}`);
      if (msg.includes('Application startup complete') || msg.includes('Uvicorn running')) {
        resolve();
      }
    });

    pythonProc.stderr?.on('data', (data) => {
      const msg = data.toString();
      process.stderr.write(`[FastAPI err] ${msg}`);
      if (msg.includes('Application startup complete') || msg.includes('Uvicorn running')) {
        resolve();
      }
    });

    pythonProc.on('exit', (code, signal) => {
      console.warn(`[Custodia] FastAPI process exited with code ${code}, signal ${signal}`);
    });

    // Fallback resolve after 3 seconds in case logs are buffered
    setTimeout(() => resolve(), 3000);
  });
}

function cleanup() {
  if (gatewayProc && !gatewayProc.killed) {
    console.log('[Custodia] Terminating Rust Gateway process...');
    gatewayProc.kill('SIGTERM');
    gatewayProc = null;
  }
  if (pythonProc && !pythonProc.killed) {
    console.log('[Custodia] Terminating FastAPI backend child process...');
    pythonProc.kill('SIGTERM');
    pythonProc = null;
  }
}

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('exit', () => { cleanup(); });

async function startServer() {
  await startRustGateway();
  await startFastApiBackend();

  const app = express();

  // Reverse proxy /api requests to Python FastAPI on 127.0.0.1:8001
  const apiProxy = createProxyMiddleware({
    target: `http://127.0.0.1:${FASTAPI_PORT}`,
    changeOrigin: true,
    ws: false,
    xfwd: true,
    cookieDomainRewrite: {
      '*': '',
    },
    on: {
      error: (err, _req, res) => {
        console.error('[Custodia Proxy Error]', err);
        if (res && 'headersSent' in res && !(res as any).headersSent && 'writeHead' in res) {
          (res as express.Response).status(502).json({
            detail: 'Backend verification service is starting or temporarily unavailable.',
          });
        }
      },
    },
  });

  app.use('/api', apiProxy);

  if (IS_PROD) {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn('[Custodia] Production dist folder not found; running Vite middleware.');
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }
  } else {
    // Development mode: mount Vite middleware into Express
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Custodia] Full-Stack server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Custodia] Failed to start server:', err);
  process.exit(1);
});
