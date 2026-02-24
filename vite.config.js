import path from 'path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import Layouts from 'vite-plugin-vue-meta-layouts';
import Pages from 'vite-plugin-pages';
import MetaLayouts from 'vite-plugin-vue-meta-layouts';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { DirResolverHelper } from 'vite-auto-import-resolvers';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: '/guidebook/',
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
      VitePWA({
        registerType: 'prompt',
        devOptions: {
          enabled: true,
        },
        manifest: {
          name: '濟州小幫手',
          short_name: '濟州小幫手',
          description: '濟州小幫手',
          theme_color: '#FF8C00',
          background_color: '#FF8C00', // 加到主畫面啟動時的背景色
          icons: [
            {
              src: '192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 4000000,
          clientsClaim: true,
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
    },
  };
});
