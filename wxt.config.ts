import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'PlanFlow',
    description: 'Pixel-art planning buddy in your browser',
    permissions: ['storage', 'tabs', 'alarms', 'idle', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    action: {
      default_title: 'PlanFlow',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
    web_accessible_resources: [
      {
        resources: ['avatar/*.png'],
        matches: ['<all_urls>'],
      },
    ],
  },
  vite: () => ({
    css: {
      postcss: './postcss.config.cjs',
    },
  }),
});
