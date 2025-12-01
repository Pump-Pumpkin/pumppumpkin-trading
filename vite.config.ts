import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = path.resolve(__dirname, 'netlify', 'functions');

const netlifyFunctionsDevPlugin = () => {
  const loadFunctionModule = (functionPath: string) => {
    const source = fs.readFileSync(functionPath, 'utf-8');
    const wrapper = `(function (exports, require, module, __filename, __dirname) { ${source}\n});`;
    const script = new vm.Script(wrapper, { filename: functionPath });
    const compiled = script.runInThisContext();
    const moduleInstance = { exports: {} as any };
    const localRequire = createRequire(functionPath);
    compiled(
      moduleInstance.exports,
      localRequire,
      moduleInstance,
      functionPath,
      path.dirname(functionPath)
    );
    return moduleInstance.exports;
  };

  return {
    name: 'netlify-functions-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/.netlify/functions/')) {
          return next();
        }

        const requestUrl = new URL(req.url, 'http://localhost');
        const functionName = requestUrl.pathname.replace(
          '/.netlify/functions/',
          ''
        );

        if (!functionName) {
          res.statusCode = 404;
          res.end('Missing Netlify function name.');
          return;
        }

        const functionPath = path.join(FUNCTIONS_DIR, `${functionName}.js`);

        if (!fs.existsSync(functionPath)) {
          res.statusCode = 404;
          res.end(`Netlify function "${functionName}" was not found.`);
          return;
        }

        const bodyChunks: Buffer[] = [];
        req.on('data', (chunk) => {
          bodyChunks.push(
            typeof chunk === 'string' ? Buffer.from(chunk) : chunk
          );
        });

        req.on('error', (error) => {
          console.error(
            '[netlify-functions-dev] Failed to read request body:',
            error
          );
          res.statusCode = 500;
          res.end('Failed to read request body.');
        });

        req.on('end', async () => {
          const bodyBuffer = Buffer.concat(bodyChunks);
          const bodyString = bodyBuffer.length ? bodyBuffer.toString() : undefined;

          try {
            const loadedModule = loadFunctionModule(functionPath);
            const handler =
              typeof loadedModule === 'function'
                ? loadedModule
                : loadedModule?.handler ?? loadedModule?.default;

            if (typeof handler !== 'function') {
              res.statusCode = 500;
              res.end(`Netlify function "${functionName}" has no handler export.`);
              return;
            }

            const event = {
              path: requestUrl.pathname,
              rawUrl: requestUrl.href,
              httpMethod: req.method || 'GET',
              headers: req.headers,
              queryStringParameters: Object.fromEntries(
                requestUrl.searchParams.entries()
              ),
              body: bodyString,
              isBase64Encoded: false,
            };

            const result = await handler(event, {});
            const statusCode = result?.statusCode ?? 200;
            res.statusCode = statusCode;

            if (result?.headers) {
              Object.entries(result.headers).forEach(([key, value]) => {
                if (typeof value !== 'undefined') {
                  res.setHeader(key, value as string);
                }
              });
            }

            if (result?.multiValueHeaders) {
              Object.entries(result.multiValueHeaders).forEach(
                ([key, values]) => {
                  if (Array.isArray(values)) {
                    res.setHeader(key, values);
                  }
                }
              );
            }

            const responseBody = result?.body ?? '';

            if (result?.isBase64Encoded) {
              res.end(Buffer.from(responseBody, 'base64'));
            } else {
              res.end(responseBody);
            }
          } catch (error: any) {
            console.error(
              `[netlify-functions-dev] "${functionName}" execution failed:`,
              error
            );
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: 'Local Netlify function error.',
                details: error?.message ?? String(error),
              })
            );
          }
        });
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), netlifyFunctionsDevPlugin()],
  optimizeDeps: {
    include: [
      'eventemitter3', 
      'bn.js', 
      'jayson',
      'jayson/lib/client/browser',
      '@solana/buffer-layout',
      'dayjs',
      'dayjs/plugin/relativeTime',
      'dayjs/plugin/updateLocale',
      'dayjs/locale/en'
    ],
    exclude: [
      'lucide-react'
    ],
    esbuildOptions: {
      mainFields: ['browser', 'module', 'main'],
      conditions: ['browser', 'module', 'import', 'default'],
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/jayson/, /buffer-layout/, /bs58/, /wallet-adapter/, /solana-mobile/, /node_modules/],
    },
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      'dayjs/locale/en.js': 'dayjs/locale/en',
      'dayjs/plugin/relativeTime.js': 'dayjs/plugin/relativeTime',
      'dayjs/plugin/updateLocale.js': 'dayjs/plugin/updateLocale',
    },
  },
});