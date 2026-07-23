import {expect,test} from "@playwright/test";

test("public home and localization are reachable",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{level:1})).toContainText("Reliable home repairs");
  await expect(page.locator("html")).toHaveAttribute("dir","ltr");
  await page.goto("/ur");
  await expect(page.locator("html")).toHaveAttribute("dir","rtl");
  await page.goto("/ur-Latn");
  await expect(page.locator("html")).toHaveAttribute("dir","ltr");
});

test("public service API exposes the six launch categories",async({request})=>{
  const response=await request.get("/api/v1/public/service-categories");
  expect(response.ok()).toBeTruthy();
  const body=await response.json();
  expect(body.success).toBe(true);
  expect(body.data.categories).toHaveLength(6);
});

test("protected pages and APIs deny anonymous access",async({page,request})=>{
  await page.goto("/customer");
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  expect((await request.get("/api/v1/admin/applications")).status()).toBe(403);
  expect((await request.get("/api/v1/auth/session")).status()).toBe(401);
});

test("production security headers and PWA assets are present",async({request})=>{
  const home=await request.get("/");
  expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(home.headers()["strict-transport-security"]).toContain("includeSubDomains");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
  expect((await request.get("/manifest.webmanifest")).ok()).toBeTruthy();
  const worker=await request.get("/firebase-messaging-sw.js");
  expect(worker.ok()).toBeTruthy();
  expect(worker.headers()["service-worker-allowed"]).toBe("/");
});
