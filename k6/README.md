# k6 Load Testing — RDSWA API

## Prerequisites

Install k6 on your machine:

- **Windows (Chocolatey):** `choco install k6`
- **Windows (winget):** `winget install k6 --source winget`
- **macOS:** `brew install k6`
- **Linux (Debian/Ubuntu):**
  ```bash
  sudo gpg -k
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
    --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
    | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update && sudo apt-get install k6
  ```
- **Docker:** `docker run --rm -i grafana/k6 run - <k6/load-test.js`

Verify the installation: `k6 version`

## Running the Tests

Make sure the RDSWA backend is running before you start.

### Load test (moderate — 20 VUs)

```bash
k6 run k6/load-test.js
```

### Stress test (heavy — up to 100 VUs)

```bash
k6 run k6/stress-test.js
```

### Targeting a remote API

Override the base URL with the `--env` flag:

```bash
k6 run --env BASE_URL=https://your-api.onrender.com/api k6/load-test.js
k6 run --env BASE_URL=https://your-api.onrender.com/api k6/stress-test.js
```

## Interpreting Results

After a run completes k6 prints a summary table. Key metrics to watch:

| Metric | Meaning |
|---|---|
| `http_req_duration` | Response time distribution. Look at **p(95)** — this is the value 95% of requests finished under. |
| `http_req_failed` | Percentage of requests that returned a non-2xx status. |
| `http_reqs` | Total number of HTTP requests made during the test. |
| `vus` | Number of concurrent virtual users at any point. |
| `iterations` | How many times the full test function executed. |
| `checks` | Pass/fail counts for all `check()` assertions. |

### Thresholds

Each script defines pass/fail thresholds:

- **load-test.js** — `p(95) < 2000 ms`, failure rate < 5%
- **stress-test.js** — `p(95) < 5000 ms`, failure rate < 10%

If any threshold is breached k6 exits with a non-zero code, making it easy to integrate into CI pipelines.

### Custom metrics

- `auth_duration` (load-test) — tracks latency of register/login calls specifically.
- `public_duration` (load-test) — tracks latency of public (unauthenticated) endpoints.
- `read_endpoint_duration` (stress-test) — tracks latency across all read endpoints.
- `custom_error_rate` — application-level error rate based on check failures.

## Tips

- Run the load test first to establish a baseline before running the stress test.
- If you hit rate-limiter responses (HTTP 429), reduce VU count or increase rate-limit thresholds on the server for testing.
- Export results to JSON for further analysis: `k6 run --out json=results.json k6/load-test.js`
- For Grafana dashboards, use the InfluxDB or Prometheus output: `k6 run --out influxdb=http://localhost:8086/k6 k6/load-test.js`
