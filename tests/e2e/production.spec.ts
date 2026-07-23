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

test("Phase 2 release flags and readiness are healthy", async ({ request }) => {
  const flagsResponse = await request.get(
    `/api/v1/public/marketplace-flags?check=${Date.now()}`,
  );
  expect(flagsResponse.ok()).toBeTruthy();
  const flags = (await flagsResponse.json()).data.flags as Record<
    string,
    boolean
  >;
  expect(Object.keys(flags)).toHaveLength(6);
  expect(Object.values(flags).every(Boolean)).toBe(true);

  const readiness = await request.get(`/api/readiness?check=${Date.now()}`);
  expect(readiness.ok()).toBeTruthy();
  expect((await readiness.json()).status).toBe("ready");
});

test("marketplace legal content is versioned in every locale", async ({
  page,
}) => {
  for (const locale of ["en", "ur", "ur-Latn"]) {
    await page.goto(`/${locale}/privacy`);
    await expect(page.getByText(/2\.0/).first()).toBeVisible();
    await page.goto(`/${locale}/terms`);
    await expect(page.getByText(/2\.0/).first()).toBeVisible();
  }
  await page.goto("/ur/privacy");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("critical internal and staff operations remain protected", async ({
  request,
}) => {
  expect((await request.get("/api/internal/cron/marketplace")).status()).toBe(
    401,
  );
  expect((await request.get("/api/v1/support/operations")).status()).toBe(403);
  expect((await request.get("/api/v1/disputes")).status()).toBe(401);
  expect((await request.get("/api/v1/warranties")).status()).toBe(401);
});

test("public shell is keyboard and mobile usable without console failures", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(message.text());
  });

  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/en");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeVisible();
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflows).toBe(false);
  expect(failures).toEqual([]);
});
