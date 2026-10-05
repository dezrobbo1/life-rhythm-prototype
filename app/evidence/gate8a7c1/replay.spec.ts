import { test, expect } from '@playwright/test';
const ready = {
  kind: 'ready',
  protocolVersion: 1,
  schemaVersion: 1,
  buildId: 'synthetic',
  head: null,
};
const denied = {
  kind: 'error',
  category: 'forbidden',
  requestId: '11111111-1111-4111-8111-111111111111',
};
const url = 'http://127.0.0.1:5179/evidence/gate8a7c1/fixture.html';
for (const width of [390, 1280]) {
  test.describe(`viewport ${width}`, () => {
    test.use({ viewport: { width, height: 844 } });
    test('required missing config and signed-out surface block content', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(url + '?mode=missing');
      await expect(page.getByRole('alert')).toContainText('Access is unavailable');
      await expect(page.getByTestId('ordinary')).toHaveCount(0);
      await page.goto(url);
      await expect(page.getByRole('heading', { name: 'Life Rhythm trial access' })).toBeVisible();
      await expect(page.getByTestId('ordinary')).toHaveCount(0);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
    });
    test('authorized metadata shows device-only status and sign-out clears it', async ({
      page,
    }) => {
      const requests: { method: string; body: string | null; url: string }[] = [];
      await page.route('**/api/account/boundary?**', async (route) => {
        requests.push({
          method: route.request().method(),
          body: route.request().postData(),
          url: route.request().url(),
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ready),
        });
      });
      await page.goto(url);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByTestId('ordinary')).toBeVisible();
      await expect(page.getByText(/Device-only data/)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(requests.length).toBe(1);
      expect(requests[0].method).toBe('GET');
      expect(requests[0].body).toBeNull();
      await page.getByRole('button', { name: 'Sign out' }).click();
      await expect(page.getByTestId('ordinary')).toHaveCount(0);
      await expect(page.getByText(/Device-only data/)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    });
    for (const status of [401, 403, 426, 503])
      test(`API ${status} blocks ordinary data and offers keyboard retry`, async ({ page }) => {
        await page.route('**/api/account/boundary?**', (route) =>
          route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify({
              ...denied,
              category:
                status === 401
                  ? 'unauthorized'
                  : status === 426
                    ? 'upgrade-required'
                    : status === 503
                      ? 'unavailable'
                      : 'forbidden',
            }),
          }),
        );
        await page.goto(url);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('alert')).toContainText('Account access is unavailable');
        await expect(page.getByTestId('ordinary')).toHaveCount(0);
        await page.getByRole('button', { name: 'Try again' }).focus();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('alert')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      });
    test('late A request is discarded during B switch', async ({ page }) => {
      let release!: () => void;
      let requests = 0;
      await page.route('**/api/account/boundary?**', async (route) => {
        requests++;
        if (requests === 1) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
          await route
            .fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ready) })
            .catch(() => {});
        } else
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify(denied),
          });
      });
      await page.goto(url);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByRole('heading', { name: 'Checking account access' })).toBeVisible();
      await expect.poll(() => requests).toBe(1);
      await page.evaluate(() =>
        (window as unknown as { setFixtureAuth: (a: unknown) => void }).setFixtureAuth({
          userId: 'user_B',
          sessionId: 'sess_B',
        }),
      );
      release();
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByTestId('ordinary')).toHaveCount(0);
      await expect(page.getByText(/Device-only data/)).toHaveCount(0);
    });
  });
}
