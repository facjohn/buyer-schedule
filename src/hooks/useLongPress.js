// 누르면 onTap, 0.5초 길게 누르면 onLong. 손가락이 움직이면(스크롤) 길게 누르기를 취소한다.
import { useRef } from 'react';

export function useLongPress(onLong, onTap, ms = 500) {
  const timer = useRef(null);
  const start = useRef(null);
  const fired = useRef(false);

  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = null;
  };

  return {
    onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(() => {
        fired.current = true;
        if (navigator.vibrate) navigator.vibrate(10);
        onLong();
      }, ms);
    },
    onPointerMove(e) {
      if (!start.current || !timer.current) return;
      if (Math.abs(e.clientX - start.current.x) > 10 || Math.abs(e.clientY - start.current.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClick(e) {
      if (fired.current) {
        e.preventDefault();
        fired.current = false;
        return;
      }
      onTap();
    },
    onContextMenu(e) {
      // 컴퓨터 오른쪽 클릭, 안드로이드 길게 누르기
      e.preventDefault();
      cancel();
      if (!fired.current) {
        fired.current = true;
        onLong();
      }
    },
    onKeyDown(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTap();
      }
    }
  };
}
