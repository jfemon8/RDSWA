import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // ramp up to 50 VUs
    { duration: '2m', target: 50 },   // hold at 50 VUs
    { duration: '1m', target: 100 },  // ramp up to 100 VUs
    { duration: '1m', target: 100 },  // hold at 100 VUs
    { duration: '30s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests under 5 s
    http_req_failed: ['rate<0.1'],     // fewer than 10% failures
  },
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const readLatency = new Trend('read_endpoint_duration');
const errorRate = new Rate('custom_error_rate');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkAndTrack(res, name, expectedStatus) {
  const ok = check(res, {
    [`${name}: status ${expectedStatus || '2xx'}`]: (r) =>
      expectedStatus ? r.status === expectedStatus : r.status >= 200 && r.status < 300,
  });
  readLatency.add(res.timings.duration);
  errorRate.add(!ok);
}

function uniqueEmail() {
  return `k6stress_${__VU}_${__ITER}_${Date.now()}@loadtest.io`;
}

function authHeaders(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// ---------------------------------------------------------------------------
// Setup — register + login once per VU to obtain a token
// ---------------------------------------------------------------------------

// Because k6 does not share state across VUs in setup(), each VU registers
// and logs in during its first iteration, then reuses the token.  We store
// the token in a module-level variable (scoped to the VU).

let vuToken = null;

function ensureAuth() {
  if (vuToken) return vuToken;

  const email = uniqueEmail();
  const password = 'StressT1';

  http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ name: `Stress VU ${__VU}`, email, password }),
    { headers: authHeaders() }
  );

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: authHeaders() }
  );

  if (loginRes.status === 200) {
    try {
      const body = JSON.parse(loginRes.body);
      vuToken = (body.data && body.data.accessToken) || body.accessToken || null;
    } catch (_) {
      // ignore
    }
  }

  return vuToken;
}

// ---------------------------------------------------------------------------
// Main — read-heavy mix
// ---------------------------------------------------------------------------

export default function () {
  const token = ensureAuth();

  // ---- Public endpoints (no auth required) --------------------------------
  group('Public Reads', () => {
    checkAndTrack(http.get(`${BASE_URL}/health`), 'GET /health', 200);
    sleep(0.2);

    checkAndTrack(http.get(`${BASE_URL}/settings/public-stats`), 'GET /settings/public-stats');
    sleep(0.2);

    checkAndTrack(http.get(`${BASE_URL}/bus/schedules`), 'GET /bus/schedules');
    sleep(0.2);

    checkAndTrack(http.get(`${BASE_URL}/bus/operators`), 'GET /bus/operators');
    sleep(0.2);

    checkAndTrack(http.get(`${BASE_URL}/bus/routes`), 'GET /bus/routes');
    sleep(0.2);

    checkAndTrack(http.get(`${BASE_URL}/bus/counters`), 'GET /bus/counters');
    sleep(0.2);
  });

  // ---- Authenticated reads -----------------------------------------------
  if (token) {
    group('Authenticated Reads', () => {
      const h = { headers: authHeaders(token) };

      checkAndTrack(http.get(`${BASE_URL}/users/me`, h), 'GET /users/me', 200);
      sleep(0.2);

      checkAndTrack(http.get(`${BASE_URL}/committees`, h), 'GET /committees');
      sleep(0.2);

      checkAndTrack(http.get(`${BASE_URL}/notices`, h), 'GET /notices');
      sleep(0.2);

      checkAndTrack(http.get(`${BASE_URL}/events`, h), 'GET /events');
      sleep(0.2);

      checkAndTrack(http.get(`${BASE_URL}/gallery`, h), 'GET /gallery');
      sleep(0.2);

      checkAndTrack(http.get(`${BASE_URL}/donations`, h), 'GET /donations');
      sleep(0.2);

      checkAndTrack(http.get(`${BASE_URL}/votes`, h), 'GET /votes');
      sleep(0.2);

      checkAndTrack(http.get(`${BASE_URL}/documents`, h), 'GET /documents');
      sleep(0.2);
    });
  }

  sleep(1);
}
