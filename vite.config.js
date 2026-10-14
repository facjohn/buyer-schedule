import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages의 하위 경로(/저장소이름/)에서도 열리게 상대 경로로 만든다
  base: './',
  plugins: [react()],
  // 한글 폴더 경로에서 파일 변경 알림이 빠지는 일이 있어, 개발 서버는 파일을 주기적으로 직접 확인한다
  server: { host: true, port: 5173, watch: { usePolling: true, interval: 300 } },
  test: {
    include: ['tests/**/*.test.js', 'src/**/*.test.{js,jsx}'],
    environment: 'node'
  }
});
