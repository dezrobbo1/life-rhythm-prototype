import { test, expect } from '@playwright/test';
test('existing same-origin admission cookie lets the bearer request reach the API; cookies cannot authorize an account', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5192/evidence/gate8a7c1/fixture.html');
  await page.getByLabel('Email').fill('synthetic@example.test');
  await page.getByLabel('Password').fill('synthetic-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByTestId('ordinary')).toBeVisible();
  const counts = await page.evaluate(async () => (await fetch('/synthetic-counts')).json());
  expect(counts).toEqual({ deniedBeforeHandler: 0, handlerInvocations: 1, bearerPresent: true });
  const controls = await page.evaluate(async () => {
    const url = '/api/account/boundary?protocolVersion=1&schemaVersion=1';
    const omitted = await fetch(url, { credentials: 'omit', headers: { Authorization: 'Bearer local.synthetic.only' } });
    const cookieOnly = await fetch(url, { credentials: 'same-origin' });
    return { omittedStatus: omitted.status, omittedType: omitted.headers.get('content-type'), cookieOnlyStatus: cookieOnly.status };
  });
  expect(controls).toEqual({ omittedStatus: 401, omittedType: 'text/html', cookieOnlyStatus: 401 });
  expect(errors).toEqual([]);
});
