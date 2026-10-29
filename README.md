# KubePulse Studio — OpenLens / Rancher Style Active Load & Security Platform

**KubePulse Studio** là nền tảng độc lập (Standalone Platform) kết hợp **Khám phá Hạ tầng Sống (Inside-Out K8s Introspection)** theo phong cách **OpenLens / Rancher** và **Bắn tải & Kiểm toán Bảo mật Thực tế (Outside-In Active Load & Security Runner)** trên một giao diện 4 bước trực quan.

---

## 1. Kiến trúc Bảo mật & Chuẩn Production (Zero-Hardcode)

1. **Tuyệt đối không Hardcode Bí mật / IP / Domain trong Source Code**:
   - Không lưu trữ bất kỳ file `k3s.yaml`, `*.kubeconfig`, khóa TLS hay IP/Domain cố định nào trong Git repository.
2. **AES-256-GCM Encrypted Credential Vault**:
   - Mọi `kubeconfig` được người dùng nạp qua giao diện hoặc nhận diện từ `~/.kube/config` đều được mã hóa bằng thuật toán `AES-256-GCM` ([cryptoVault.ts](backend/src/security/cryptoVault.ts)) trước khi lưu xuống `backend/data/kubepulse.storage.json` (thư mục này đã được chặn trong `.gitignore`).
   - API Backend chỉ trả về metadata công khai (`ClusterConnectionPublic`), không bao giờ trả ngược nội dung khóa bí mật ra Frontend.
3. **100% Số liệu Thực tế (Zero Mock / Zero Synthetic Math)**:
   - **Inside-Out**: Truy vấn trực tiếp Kubernetes API thật (`Namespaces`, `Ingresses`, `Services`, `Deployments`, `StatefulSets`, `Pods`, `NetworkPolicies` và `metrics.k8s.io/v1beta1`).
   - **Outside-In**: Bắn lưu lượng HTTP (`fetch` + `performance.now()`) và WebSocket (`ws`) thật tới Endpoint đích, đo đạc độ trễ phân vị thật (`p50`, `p95`, `p99`) và kiểm toán Security Headers / CORS / K8s Manifest thật.
   - **Cầu chì An toàn (Safety Circuit Breaker)**: Tự động ngắt bài kiểm thử trong `< 500ms` nếu RAM thực tế của Pod trên K8s chạm ngưỡng an toàn (mặc định `85%`) hoặc Pod tăng `restartCount`.

---

## 2. Cấu trúc Monorepo (`pnpm` Workspace)

```text
Tool-test-performance/
├── backend/                  # @kubepulse/backend (Port 3334 - Express + WS + @kubernetes/client-node)
│   └── src/
│       ├── index.ts          # REST API & WebSocket /ws/studio
│       ├── types.ts          # Data models
│       ├── security/         # AES-256-GCM CryptoVault
│       ├── storage/          # Persistent JSON/Vault Repository
│       └── services/         # K8sDiscoveryService & RealRunnerEngine
├── frontend/                 # @kubepulse/frontend (Port 3333 - React + TypeScript + Tailwind CSS)
│   └── src/
│       ├── App.tsx           # 4-Step Progressive Navigation
│       └── components/
│           ├── Step1Connections.tsx      # Bước 1: Quản lý Kết nối Cụm & Đích
│           ├── Step2TopologyExplorer.tsx # Bước 2: Khám phá Hạ tầng K8s theo Namespace
│           ├── Step3ScenarioStudio.tsx   # Bước 3: Thiết kế Kịch bản Động (Dynamic CRUD)
│           └── Step4LiveMonitor.tsx      # Bước 4: Chạy Thực tế & Báo cáo Lịch sử
└── pnpm-workspace.yaml
```

---

## 3. Hướng dẫn Chạy Dự án & Sử dụng 4 Bước

### Cài đặt & Khởi chạy

```bash
pnpm install
pnpm dev
```

- **Giao diện Web (Frontend)**: Mở trình duyệt tại `http://localhost:3330`
- **API & WebSocket (Backend)**: Chạy tại `http://127.0.0.1:3335`

### Quy trình 4 Bước trên Giao diện

1. **Bước 1 — Kết nối Đích (`Step 1`)**:
   - Bấm **"Nhận diện tự động từ `~/.kube/config` trên máy"** (giống OpenLens) hoặc dán nội dung `kubeconfig` / nhập `External URL`.
   - Nếu cụm K8s nằm sau SSH Tunnel, mở sẵn tunnel trên máy (ví dụ: `ssh -L 6443:127.0.0.1:6443 user@server-ip`).
2. **Bước 2 — Khám phá Hạ tầng (`Step 2`)**:
   - Chọn **Namespace** từ dropdown thực tế của cụm K8s.
   - Quan sát danh sách **Ingress Routes**, **Services & NetworkPolicies**, và **Workloads & Live Pod RAM/CPU**.
   - Bấm **"Tạo Kịch bản từ Hạ tầng này"** để tự động sinh bộ kịch bản mẫu từ các route thực tế, hoặc bấm vào từng Ingress Route để tạo kịch bản riêng.
3. **Bước 3 — Thiết kế Kịch bản Động (`Step 3`)**:
   - Tuỳ chỉnh tự do giao thức (`HTTP`, `WEBSOCKET`, `SECURITY_AUDIT`), URL, Path, Headers, Body JSON, số lượng Virtual Users (`1 - 500`), Thời lượng chạy (`5s - 300s`), và ngưỡng Cầu chì Tự ngắt RAM (`50% - 95%`).
   - Bấm **"Chạy Kiểm thử Thật"** để bắt đầu.
4. **Bước 4 — Theo dõi Thời gian thực & Báo cáo (`Step 4`)**:
   - Theo dõi 4 thẻ KPI thời gian thực (RPS, Latency `p95`, Mã phản hồi HTTP/WS, và RAM/CPU thực tế của Pod).
   - Chuyển đổi giữa 3 tab: **Báo cáo Dễ hiểu (Non-Tech)**, **Biểu đồ & Log K8s (Kỹ sư)**, và **Kiểm toán Bảo mật Thực tế**.
