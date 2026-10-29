# KubePulse Studio — Nền tảng Kiểm thử Chịu tải & Bảo mật Độc lập (OpenLens + Active Studio)

Nền tảng độc lập kết hợp **Outside-In Active Load & Security Testing** và **Inside-Out Live Kubernetes Introspection** với giao diện chuyển đổi tức thì giữa **Chế độ Kỹ sư (Engineer Mode)** và **Chế độ Trực quan cho Quản lý (Non-Tech / Business Mode)**.

---

## 1. Cấu trúc Dự án (Monorepo `pnpm` Tách biệt `backend` & `frontend`)

```text
Tool-test-performance/
├── pnpm-workspace.yaml          # Cấu hình pnpm workspace
├── package.json                 # Scripts chạy song song cả FE + BE
├── docker-compose.yml           # Chạy độc lập 2 container backend (3334) & frontend (3333)
├── backend/                     # @kubepulse/backend (Express + WS + @kubernetes/client-node)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             # API & WebSocket Server (:3334)
│       ├── types.ts             # Data contracts cho Topology, Scenario, Correlator
│       ├── connectors/
│       │   └── targetDiscovery.ts # Layer 1: K8s Auto-Discovery & Hybrid Simulator
│       └── engine/
│           ├── scenarioPacks.ts   # Layer 2: Pluggable Scenario Hub & {{target.*}} Interpolation
│           └── correlatorEngine.ts# Layer 3: Bi-Directional Correlator & Safety Circuit Breaker (<500ms)
└── frontend/                    # @kubepulse/frontend (Vite + React + Tailwind CSS)
    ├── package.json
    ├── vite.config.ts           # Chạy trên :3333, proxy /api & /ws sang :3334
    └── src/
        ├── App.tsx              # Giao diện kiểu OpenLens/Rancher + Workspace Switcher
        └── components/
            ├── LiveTopologyCanvas.tsx # Sơ đồ Kiến trúc & Khiên Bảo vệ Thời gian thực
            ├── DualModeDashboard.tsx  # Chuyển ngữ Non-Tech (Preview Phụ đề) & Kỹ sư (K8s Logs/YAML)
            └── ConnectTargetModal.tsx # Thêm mới bất kỳ Cluster K8s / SSH Tunnel / External URL
```

---

## 2. Cách Cài đặt & Chạy Bằng `pnpm`

```bash
# 1. Cài đặt dependencies cho cả backend và frontend
pnpm install

# 2. Chạy đồng thời cả Backend (:3334) và Frontend (:3333)
pnpm dev
```

Hoặc chạy riêng từng phần ở 2 cửa sổ terminal:
```bash
# Terminal 1: Chạy Backend
pnpm dev:be

# Terminal 2: Chạy Frontend
pnpm dev:fe
```

Sau đó mở trình duyệt tại: **`http://localhost:3333`**
