import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3011',
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 3011 --host 127.0.0.1',
    url: 'http://127.0.0.1:3011',
    env: {
      VITE_SUPABASE_URL: 'https://benbi-test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'public-test-key-longer-than-20-characters',
    },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
