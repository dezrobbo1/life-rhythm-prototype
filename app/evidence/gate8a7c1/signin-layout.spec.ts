import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

for (const width of [390, 1280]) {
  test(`sign-in layout, keyboard, busy and error at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    await page.route('https://synthetic.supabase.co/**', async route => {
      await pending;
      await route.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'PRIVATE PROVIDER DETAIL' }) });
    });
    await page.goto('http://127.0.0.1:5180/evidence/gate8a7c1/fixture.html');
    const email = page.getByLabel('Email'), password = page.getByLabel('Password');
    const button = page.getByRole('button', { name: 'Sign in', exact: true });
    await expect(email).toBeVisible();
    mkdirSync('/tmp/life-rhythm-c1-signin-screenshots', { recursive: true });
    await page.screenshot({ path: `/tmp/life-rhythm-c1-signin-screenshots/signin-${width}.png`, fullPage: true });
    for (const control of [email, password, button]) {
      const box = (await control.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    for (const field of [email, password]) {
      expect(await field.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
      const input = (await field.boundingBox())!;
      const label = (await page.locator(`label[for="${await field.getAttribute('id')}"]`).boundingBox())!;
      expect(label.y + label.height).toBeLessThanOrEqual(input.y);
    }
    const emailBox = (await email.boundingBox())!, passwordBox = (await password.boundingBox())!;
    expect(passwordBox.x).toBe(emailBox.x);
    expect(passwordBox.width).toBe(emailBox.width);
    expect((await button.boundingBox())!.width).toBe(emailBox.width);
    const heading = page.getByRole('heading', { name: 'Sign in', level: 1 });
    await expect(heading).toBeVisible();
    expect(await heading.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(36);
    const checkOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await checkOverflow();
    for (const control of [email, password, button]) {
      await page.keyboard.press('Tab');
      await expect(control).toBeFocused();
      expect(await control.evaluate(el => {
        const s = getComputedStyle(el);
        return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
      })).toBe(true);
    }
    await page.screenshot({ path: `/tmp/life-rhythm-c1-signin-screenshots/focus-${width}.png`, fullPage: true });
    await email.fill('synthetic@example.test');
    await password.fill('synthetic-password');
    await button.click();
    await expect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    await expect(password).toHaveValue('');
    await expect(page.getByTestId('ordinary')).toHaveCount(0);
    await page.screenshot({ path: `/tmp/life-rhythm-c1-signin-screenshots/busy-${width}.png`, fullPage: true });
    finish();
    await expect(page.getByRole('alert')).toContainText('Sign-in could not be completed');
    await expect(button).toBeEnabled();
    await expect(page.getByText('PRIVATE PROVIDER DETAIL')).toHaveCount(0);
    await expect(page.getByTestId('ordinary')).toHaveCount(0);
    await expect(page.getByText(/Reloading requires sign-in again/)).toBeVisible();
    await expect(page.getByText(/Password recovery is not configured/)).toBeVisible();
    await checkOverflow();
    expect(errors).toEqual([]);
    await page.screenshot({ path: `/tmp/life-rhythm-c1-signin-screenshots/error-${width}.png`, fullPage: true });
  });
}
