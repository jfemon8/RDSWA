import { test, expect } from '@playwright/test';

test.describe('API health check', () => {
  test('/api/health returns 200 with status ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('timestamp');
  });
});
