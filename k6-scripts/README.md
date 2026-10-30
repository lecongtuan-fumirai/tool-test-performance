# K6 Performance Benchmark Scripts

Bộ kịch bản kiểm thử độc lập viết bằng K6 (Grafana Labs) để kiểm chứng hiệu năng và đối chiếu với KubePulse Studio.

## 1. Yêu cầu cài đặt K6
- Windows: `winget install k6` hoặc tải từ [k6.io](https://k6.io)
- Mac: `brew install k6`
- Linux: `sudo apt-get install k6`

## 2. Danh sách kịch bản:
- `http-oom-bomb.js`: Bắn HTTP POST với 200 VUs dồn dập, payload JSON 1MB.
  ```bash
  k6 run k6-scripts/http-oom-bomb.js
  ```
- `ws-stream-buffer.js`: Mở 80 kết nối WebSocket vào `/ws`, bơm dữ liệu 50KB mỗi 50ms.
  ```bash
  k6 run k6-scripts/ws-stream-buffer.js
  ```
- `direct-k3s-ingress.js`: Bắn thẳng vào IP K3s Node `13.140.183.90:8080` kèm header `Host: fumifood.dpdns.org` để bypass Cloudflare.
  ```bash
  k6 run k6-scripts/direct-k3s-ingress.js
  ```

