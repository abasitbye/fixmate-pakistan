import {defineConfig} from "@playwright/test";

export default defineConfig({
  testDir:"./tests/e2e",
  fullyParallel:true,
  retries:1,
  workers:3,
  reporter:[["list"]],
  use:{
    baseURL:process.env.E2E_BASE_URL??"https://fixmate-pakistan.vercel.app",
    channel:"chrome",
    headless:true,
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
    video:"off",
    locale:"en-PK",
    timezoneId:"Asia/Karachi",
  },
});
