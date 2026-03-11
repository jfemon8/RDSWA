import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000/api';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // ramp up to 20 VUs
    { duration: '1m', target: 20 },   // hold at 20 VUs
    { duration: '10s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2 s
    http_req_failed: ['rate<0.05'],    // fewer than 5% failures
  },
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const authDuration = new Trend('auth_duration');
const publicDuration = new Trend('public_duration');
const errorRate = new Rate('custom_error_rate');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headers(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function uniqueEmail() {
  return `k6user_${__VU}_${__ITER}_${Date.now()}@loadtest.io`;
}

// ---------------------------------------------------------------------------
// Main test function — executed once per VU iteration
// ---------------------------------------------------------------------------

export default function () {
  let token = null;

  // ---- 1. Health check (smoke) -------------------------------------------
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health: status 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  sleep(0.5);

  // ---- 2. Auth flow — register then login --------------------------------
  group('Auth Flow', () => {
    const email = uniqueEmail();
    const password = 'LoadTest1';

    // Register
    const registerPayload = JSON.stringify({
      name: `K6 User ${__VU}-${__ITER}`,
      email: email,
      password: password,
    });

    const regRes = http.post(`${BASE_URL}/auth/register`, registerPayload, {
      headers: headers(),
    });
    authDuration.add(regRes.timings.duration);

    check(regRes, {
      'register: status 2xx': (r) => r.status >= 200 && r.status < 300,
    });
    errorRate.add(regRes.status >= 400);

    sleep(0.3);

    // Login
    const loginPayload = JSON.stringify({
      email: email,
      password: password,
    });

    const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
      headers: headers(),
    });
    authDuration.add(loginRes.timings.duration);

    const loginOk = check(loginRes, {
      'login: status 200': (r) => r.status === 200,
      'login: has token': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(body.data && body.data.accessToken) || !!(body.accessToken);
        } catch (_) {
          return false;
        }
      },
    });
    errorRate.add(!loginOk);

    if (loginRes.status === 200) {
      try {
        const body = JSON.parse(loginRes.body);
        token = (body.data && body.data.accessToken) || body.accessToken || null;
      } catch (_) {
        // ignore parse errors
      }
    }
  });

  sleep(0.5);

  // ---- 3. Authenticated endpoints ---------------------------------------
  if (token) {
    group('Authenticated Requests', () => {
      // GET /users/me
      const meRes = http.get(`${BASE_URL}/users/me`, {
        headers: headers(token),
      });
      check(meRes, {
        'GET /users/me: status 200': (r) => r.status === 200,
      });
      errorRate.add(meRes.status !== 200);

      sleep(0.3);

      // GET /committees
      const committeesRes = http.get(`${BASE_URL}/committees`, {
        headers: headers(token),
      });
      check(committeesRes, {
        'GET /committees: status 2xx': (r) => r.status >= 200 && r.status < 300,
      });
      errorRate.add(committeesRes.status >= 400);

      sleep(0.3);

      // GET /notices
      const noticesRes = http.get(`${BASE_URL}/notices`, {
        headers: headers(token),
      });
      check(noticesRes, {
        'GET /notices: status 2xx': (r) => r.status >= 200 && r.status < 300,
      });
      errorRate.add(noticesRes.status >= 400);

      sleep(0.3);

      // GET /events
      const eventsRes = http.get(`${BASE_URL}/events`, {
        headers: headers(token),
      });
      check(eventsRes, {
        'GET /events: status 2xx': (r) => r.status >= 200 && r.status < 300,
      });
      errorRate.add(eventsRes.status >= 400);
    });
  }

  sleep(0.5);

  // ---- 4. Public endpoints -----------------------------------------------
  group('Public Endpoints', () => {
    // GET /settings/public-stats
    const settingsRes = http.get(`${BASE_URL}/settings/public-stats`);
    publicDuration.add(settingsRes.timings.duration);
    check(settingsRes, {
      'GET /settings/public-stats: status 2xx': (r) => r.status >= 200 && r.status < 300,
    });
    errorRate.add(settingsRes.status >= 400);

    sleep(0.3);

    // GET /bus/schedules
    const busRes = http.get(`${BASE_URL}/bus/schedules`);
    publicDuration.add(busRes.timings.duration);
    check(busRes, {
      'GET /bus/schedules: status 2xx': (r) => r.status >= 200 && r.status < 300,
    });
    errorRate.add(busRes.status >= 400);

    sleep(0.3);

    // GET /bus/operators
    const opsRes = http.get(`${BASE_URL}/bus/operators`);
    publicDuration.add(opsRes.timings.duration);
    check(opsRes, {
      'GET /bus/operators: status 2xx': (r) => r.status >= 200 && r.status < 300,
    });
    errorRate.add(opsRes.status >= 400);
  });

  sleep(1);
}
