import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';

function syncApiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'sync-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/sync')) {
          return next();
        }

        if (env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_READ_WRITE_TOKEN) {
          process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN;
        }

        try {
          const { default: handler } = await import('./api/sync.ts');
          const parsedUrl = new URL(req.url, 'http://localhost:3000');
          (req as any).query = Object.fromEntries(parsedUrl.searchParams.entries());

          const originalRes = res as any;
          originalRes.status = (code: number) => {
            originalRes.statusCode = code;
            return originalRes;
          };
          originalRes.json = (data: any) => {
            originalRes.setHeader('Content-Type', 'application/json');
            originalRes.end(JSON.stringify(data));
            return originalRes;
          };

          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', (chunk) => {
              bodyStr += chunk;
            });
            req.on('end', async () => {
              try {
                (req as any).body = bodyStr ? JSON.parse(bodyStr) : {};
              } catch {
                (req as any).body = {};
              }
              await handler(req as any, originalRes);
            });
          } else {
            await handler(req as any, originalRes);
          }
        } catch (e: any) {
          console.error('Dev sync error:', e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e?.message || 'Server error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), syncApiDevPlugin(env)],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
