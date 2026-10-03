import path from 'path';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import Pages from 'vite-plugin-pages';
import MetaLayouts from 'vite-plugin-vue-meta-layouts';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { DirResolverHelper } from 'vite-auto-import-resolvers';
import { VitePWA } from 'vite-plugin-pwa';

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
);
const releaseConfig = JSON.parse(
  readFileSync(new URL('./release.config.json', import.meta.url), 'utf8')
);
const appVersion = packageJson.version;
const minimumVersion = releaseConfig.minimumVersion;
const versionPattern = /^\d+\.\d+\.\d+$/;
const compareBuildVersions = (left, right) => {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
};

if (!versionPattern.test(appVersion) || !versionPattern.test(minimumVersion)) {
  throw new Error(
    'App version and minimum version must use major.minor.patch.'
  );
}
if (compareBuildVersions(appVersion, minimumVersion) < 0) {
  throw new Error('App version cannot be lower than the minimum version.');
}

const releaseManifestPlugin = () => ({
  name: 'guidebook-release-manifest',
  configureServer(server) {
    server.middlewares.use('/version.json', (_request, response) => {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify({ version: appVersion, minimumVersion }));
    });
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: `${JSON.stringify({ version: appVersion, minimumVersion }, null, 2)}\n`,
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  plugins: [
    vue(),
    MetaLayouts(),
    DirResolverHelper(),
    Pages(),
    Components({
      dirs: ['src/components'],
      extensions: ['vue'],
      dts: 'src/components.d.ts',
      resolvers: [ElementPlusResolver()],
    }),
    releaseManifestPlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'firebase-messaging-sw.ts',
      registerType: 'prompt',
      injectRegister: null,
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: 'Guidebook',
        short_name: 'Guidebook',
        description: '旅程手冊',
        start_url: '/settings',
        scope: '/',
        display: 'standalone',
        theme_color: '#136A70',
        background_color: '#136A70', // 加到主畫面啟動時的背景色
        icons: [
          {
            src: '/192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 4000000,
        globIgnores: ['**/version.json'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
