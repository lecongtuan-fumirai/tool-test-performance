import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 50 },    // Ramp-up 50 VUs
    { duration: '20s', target: 200 },  // Đỉnh Spike 200 VUs dồn dập
    { duration: '5s', target: 0 },     // Hạ tải
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],    // Tỉ lệ lỗi < 5%
    http_req_duration: ['p(95)<1000'], // 95% request phải dưới 1s
  },
};

// Tạo một payload JSON nặng 1MB ép bộ nhớ Heap
const heavyChunk = 'OOM_HEAVY_PAYLOAD_CHUNK_0123456789_'.repeat(30000); // ~1MB
const payload = JSON.stringify({
  event: 'STRESS_TEST_BURST',
  timestamp: Date.now(),
  data: heavyChunk,
});

export default function () {
  const url = 'https://fumifood.dpdns.org/healthz?oom_stress_test=true';
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
    },
    timeout: '5s',
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'latency < 2000ms': (r) => r.timings.duration < 2000,
  });

  sleep(0.05);
}

