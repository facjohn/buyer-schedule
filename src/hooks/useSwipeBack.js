// 손으로 밀어서 뒤로·앞으로(2026-10-30 사용자 요청: "아이폰어플처럼 ... 손으로 슬라이드하면 뒤로가기 앞으로가기").
// 아이폰 홈 화면 앱에는 사파리의 '밀어서 뒤로'가 없어서 직접 만든다(사파리·안드로이드는 브라우저·폰의 몸짓을 쓴다).
// - 뒤로: 화면 왼쪽 절반에서 오른쪽으로 밀면 화면이 손가락을 따라 오른쪽으로 밀리고, 반 넘게 밀거나 빠르게 튕기면
//   그대로 빠져나가며 앞 화면이 왼쪽에서 들어온다. 덜 밀면 제자리로 튕겨 돌아온다. 입력 중이면 먼저 묻는다.
// - 앞으로: 뒤로 갔던 화면이 있을 때 오른쪽 끝에서 왼쪽으로 밀면 › 동그라미가 따라 나오고, 놓으면 앞으로.
// - 입력칸·아래 메뉴에서 시작한 밀기는 글자 고르기와 겹치지 않게 무시한다. 세로로 움직이면 스크롤로 본다.
import { useEffect, useRef } from 'react';
import { confirmLeave, suppressNextTransition } from '../router.js';

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'; // 아이폰 화면 넘김 감속
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'; // 제자리로 튕겨 돌아오기
const EDGE = 32; // 앞으로 가기는 오른쪽 끝 이만큼에서 시작
const FWD_TRIGGER = 70;

export function isIosStandalone() {
  return typeof navigator !== 'undefined' && navigator.standalone === true;
}

function reduceMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * enabled: 켤지(아이폰 홈 화면 앱)
 * canBack: 뒤로 갈 수 있는지(홈에서는 false), onBack: 뒤로(확인은 이미 했음)
 * canForward(): 앞으로 갈 화면이 있는지, onForward: 앞으로
 */
export function useSwipeNav(enabled, opts) {
  const ref = useRef(opts);
  ref.current = opts;

  useEffect(() => {
    if (!enabled) return undefined;
    const root = document.getElementById('root') || document.body;
    // 움직일 것: 화면(.screen) 안의 조각들과 화면 밖 띠들. 화면이나 #root 자체를 옮기면 그 안의 고정된 아래 버튼 띠가
    // 화면 맨 아래로 튀어서(transform이 position:fixed의 기준을 바꿈) 조각마다 옮긴다(2026-10-30 검토)
    const parts = () => [...root.children].flatMap((el) => (el.classList.contains('screen') ? [...el.children] : [el]));
    const dot = document.createElement('div');
    dot.className = 'swipe-fwd';
    dot.setAttribute('aria-hidden', 'true');
    dot.textContent = '›';
    document.body.appendChild(dot);

    let st = null;
    let cleanupTimer = 0; // 튕겨 돌아온 뒤 치우기(다음 밀기가 시작되면 취소)
    const width = () => window.innerWidth || 375;

    let moved = [];
    const setPage = (x, animate, ease = EASE, ms = 300) => {
      moved = parts();
      moved.forEach((el) => {
        el.style.transition = animate ? `transform ${ms}ms ${ease}` : 'none';
        el.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
      });
    };
    const clearPage = () => {
      moved.forEach((el) => {
        el.style.transition = '';
        el.style.transform = '';
      });
      moved = [];
      document.documentElement.classList.remove('swiping');
    };
    // 제자리로 튕겨 돌아오기('동작 줄이기'면 바로)
    const springBack = () => {
      clearTimeout(cleanupTimer);
      if (reduceMotion()) {
        clearPage();
        return;
      }
      setPage(0, true, SPRING, 380);
      cleanupTimer = setTimeout(clearPage, 400);
    };
    const showDot = (d) => {
      const x = Math.min(d, FWD_TRIGGER + 20);
      dot.style.transform = `translate(${48 - x}px, -50%)`;
      dot.style.opacity = String(Math.min(1, d / FWD_TRIGGER));
      dot.classList.toggle('ready', d >= FWD_TRIGGER);
    };
    const hideDot = () => {
      dot.style.transform = 'translate(48px, -50%)';
      dot.style.opacity = '0';
      dot.classList.remove('ready');
    };
    hideDot();

    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (e.target.closest && e.target.closest('input, textarea, select, .sheet, .sheet-backdrop')) return;
      clearTimeout(cleanupTimer);
      const o = ref.current;
      const w = width();
      if (o.canBack && t.clientX < w / 2) st = { mode: 'back', x: t.clientX, y: t.clientY, t0: Date.now(), moved: false, dx: 0 };
      else if (t.clientX > w - EDGE && o.canForward && o.canForward()) st = { mode: 'fwd', x: t.clientX, y: t.clientY, t0: Date.now(), moved: false, dx: 0 };
    };

    const onMove = (e) => {
      if (!st) return;
      const t = e.touches[0];
      const dx = t.clientX - st.x;
      const dy = Math.abs(t.clientY - st.y);
      st.dx = dx;
      // 세로로 움직이면 스크롤이니 그만
      if (!st.moved && dy > 10 && dy > Math.abs(dx)) {
        st = null;
        hideDot();
        return;
      }
      st.dy = dy;
      if (st.mode === 'back') {
        // 밀다가 위아래로 더 많이 움직이면 스크롤로 보고 제자리로
        if (st.moved && dy > Math.max(30, Math.abs(dx))) {
          st = null;
          springBack();
          return;
        }
        if (!st.moved && dx > 10 && dx > dy * 1.5) {
          st.moved = true;
          document.documentElement.classList.add('swiping');
        }
        if (st.moved) setPage(Math.max(0, dx), false);
      } else {
        const d = -dx;
        if (!st.moved && d > 10 && d > dy * 1.5) st.moved = true;
        if (st.moved) showDot(d);
      }
    };

    const onEnd = () => {
      if (!st) return;
      const s = st;
      st = null;
      if (s.mode === 'fwd') {
        hideDot();
        if (s.moved && -s.dx >= FWD_TRIGGER) ref.current.onForward();
        return;
      }
      if (!s.moved) return;
      const w = width();
      const v = s.dx / Math.max(1, Date.now() - s.t0); // px/ms
      const go = (s.dx > w * 0.35 || (v > 0.5 && s.dx > 40)) && (s.dy || 0) < s.dx * 0.7;
      if (!go || !confirmLeave()) {
        // 덜 밀었으면(또는 나가지 않기로 했으면) 제자리로 튕겨 돌아온다
        springBack();
        return;
      }
      // 그대로 오른쪽으로 빠져나가고, 앞 화면이 왼쪽에서 들어온다
      const ms = reduceMotion() ? 0 : Math.max(140, Math.min(280, ((w - s.dx) / Math.max(v, 1)) | 0));
      setPage(w, ms > 0, EASE, ms);
      setTimeout(() => {
        suppressNextTransition();
        // 뒤로 가기는 바로 끝나지 않는다. 앞 화면이 그려진 다음에 밀어 둔 화면을 치워야 밀려난 화면이 잠깐 다시 보이지 않는다
        let finished = false;
        const arrive = () => {
          if (finished) return;
          finished = true;
          window.removeEventListener('popstate', onPop);
          requestAnimationFrame(() => {
            clearPage();
            const screen = root.querySelector('.screen');
            if (screen && !reduceMotion()) {
              screen.classList.remove('swipe-arrive');
              void screen.offsetWidth; // 움직임을 다시 시작하게
              screen.classList.add('swipe-arrive');
              setTimeout(() => screen.classList.remove('swipe-arrive'), 420);
            }
          });
        };
        const onPop = () => setTimeout(arrive, 0);
        window.addEventListener('popstate', onPop);
        setTimeout(arrive, 600); // 뒤로 갈 곳이 없어 화면만 바꾼 경우
        ref.current.onBack();
      }, ms);
    };

    const onCancel = () => {
      if (st && st.mode === 'back' && st.moved) springBack();
      st = null;
      hideDot();
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
      clearTimeout(cleanupTimer);
      dot.remove();
      clearPage();
    };
  }, [enabled]);
}
