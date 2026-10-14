// 화면을 오른쪽으로 밀면 뒤로. 아이폰 홈 화면 앱에는 사파리의 '밀어서 뒤로'가 없어서 직접 만든다.
// - 왼쪽 절반에서 시작해 오른쪽으로 70px 넘게 밀고(세로로는 거의 안 움직이고) 손을 떼면 onBack
// - 입력칸에서 시작한 밀기는 글자 고르기와 겹치지 않게 무시한다
// - 미는 동안 왼쪽에 ‹ 동그라미가 따라 나온다
import { useEffect, useRef } from 'react';

const TRIGGER = 70;

export function isIosStandalone() {
  return typeof navigator !== 'undefined' && navigator.standalone === true;
}

export function useSwipeBack(enabled, onBack) {
  const cb = useRef(onBack);
  cb.current = onBack;

  useEffect(() => {
    if (!enabled) return undefined;
    const dot = document.createElement('div');
    dot.className = 'swipe-back';
    dot.setAttribute('aria-hidden', 'true');
    dot.textContent = '‹';
    document.body.appendChild(dot);

    let start = null;
    const show = (dx) => {
      const d = Math.min(dx, TRIGGER + 20);
      dot.style.transform = `translate(${d - 48}px, -50%)`;
      dot.style.opacity = String(Math.min(1, dx / TRIGGER));
      dot.classList.toggle('ready', dx >= TRIGGER);
    };
    const hide = () => {
      dot.style.transform = 'translate(-48px, -50%)';
      dot.style.opacity = '0';
      dot.classList.remove('ready');
    };
    hide();

    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > window.innerWidth / 2) return;
      if (e.target.closest && e.target.closest('input, textarea, select, .sheet')) return;
      start = { x: t.clientX, y: t.clientY, moved: false };
    };
    const onMove = (e) => {
      if (!start) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      // 세로 스크롤이면 그만
      if (!start.moved && dy > 12 && dy > dx) {
        start = null;
        hide();
        return;
      }
      if (dx > 12 && dx > dy * 2) {
        start.moved = true;
        show(dx);
      }
    };
    const onEnd = (e) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      const ok = start.moved && dx >= TRIGGER && dx > dy * 2;
      start = null;
      hide();
      if (ok) cb.current();
    };
    const onCancel = () => {
      start = null;
      hide();
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
      dot.remove();
    };
  }, [enabled]);
}
