import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
  vus: 80,          // 80 kết nối WebSocket đồng thời
  duration: '30s',  // Bơm tải liên tục trong 30s
};

const wsBlob = 'WS_BINARY_MEMORY_INJECTION_'.repeat(2000); // ~50KB / frame

export default function () {
  const url = 'wss://fumifood.dpdns.org/ws';
  const params = { tags: { my_tag: 'websocket-oom' } };

  const res = ws.connect(url, params, function (socket) {
    socket.on('open', () => {
      // Bơm dữ liệu liên tục mỗi 50ms vào socket
      socket.setInterval(() => {
        socket.send(JSON.stringify({
          action: 'STREAM_DATA_BURST',
          payload: wsBlob,
          ts: Date.now()
        }));
      }, 50);
    });

    socket.on('message', () => {});
    socket.on('close', () => console.log('Socket closed'));
    socket.on('error', (e) => console.log('Socket error:', e.error()));

    socket.setTimeout(() => {
      socket.close();
    }, 28000);
  });

  check(res, { 'status is 101': (r) => r && r.status === 101 });
}

