import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 100,
  duration: '20s',
};

export default function () {
  // Trỏ thẳng vào IP Node K3s trực tiếp để không bị Cloudflare nuốt gói tin
  const url = 'http://13.140.183.90:8080/healthz';
  const params = {
    headers: {
      'Host': 'fumifood.dpdns.org',
    },
  };

  const res = http.get(url, params);
  check(res, { 'status is 200': (r) => r.status === 200 });
}

