import request from 'supertest';
import { createTestApp } from '../helpers/test-app';

describe('Observability endpoints', () => {
  const app = createTestApp();

  it('returns healthz and readyz', async () => {
    const healthz = await request(app).get('/healthz');
    expect(healthz.status).toBe(200);
    expect(healthz.body.status).toBe('ok');

    const readyz = await request(app).get('/readyz');
    expect(readyz.status).toBe(200);
    expect(readyz.body.status).toBe('ready');
  });

  it('exposes prometheus-style metrics', async () => {
    await request(app).get('/healthz');
    const metrics = await request(app).get('/metrics');

    expect(metrics.status).toBe(200);
    expect(String(metrics.headers['content-type'] || '')).toContain('text/plain');
    expect(metrics.text).toContain('http_requests_total');
    expect(metrics.text).toContain('http_request_duration_seconds');
  });
});
