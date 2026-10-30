// 주소의 # 뒤로 화면을 고른다(GitHub Pages에서 다시 열어도 같은 화면이 열리게).
//   #/            홈
//   #/b/바이어     바이어 스케줄
//   #/new?buyer=  새 줄
//   #/edit/id     고치기
//   #/dup/id      복제(같은 컨테이너에 추가)
//   #/buyer/new   바이어 추가
//   #/buyer/edit/바이어  바이어 고치기
//
// 화면이 바뀔 때 아이폰처럼 새 화면은 오른쪽에서 밀려 들어오고, 뒤로 가면 오른쪽으로 빠진다
// (2026-10-30 사용자 요청 "화면 바뀔때 애플 특유의 애니메이션"). 브라우저의 View Transitions로 그리고,
// 안 되는 브라우저·'동작 줄이기'·브라우저가 이미 밀기 움직임을 보여 준 뒤로 가기(사파리 밀어서 뒤로)는 그냥 바꾼다.
// 뒤로 오면 그 화면을 보던 스크롤 위치로 돌아간다.
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { takeCodeOnNavigate } from './lib/link.js';

const listeners = new Set();

function current() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  const segs = path.split('/').filter(Boolean).map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });
  return { path, segs, params };
}

function notify() {
  for (const fn of listeners) fn(current());
}

// ── 화면 넘김 움직임 ─────────────────────────────
let suppressNext = false; // 손으로 밀기에서 이미 움직임을 보여 줬으면 다음 한 번은 그냥 바꾼다
let navToken = 0; // 연달아 넘길 때 앞 움직임이 뒤 움직임의 방향 표시를 지우지 않게

function reduceMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** dir: 'forward'(밀려 들어옴) · 'back'(빠져나감) · 'fade' · 'none' */
function transition(dir, update) {
  const skip = suppressNext;
  suppressNext = false;
  const html = document.documentElement;
  if (dir === 'none' || skip || !document.startViewTransition || reduceMotion() || document.visibilityState !== 'visible') {
    update();
    return;
  }
  html.dataset.nav = dir;
  const token = ++navToken;
  try {
    const vt = document.startViewTransition(() => {
      flushSync(update);
    });
    // 빠르게 연달아 넘기면 앞의 움직임은 건너뛴다(오류로 남지 않게)
    vt.ready.catch(() => {});
    vt.updateCallbackDone.catch(() => {});
    vt.finished.catch(() => {}).finally(() => {
      if (token === navToken) delete html.dataset.nav;
    });
  } catch {
    delete html.dataset.nav;
    update();
  }
}

/** 손으로 밀어서 이미 화면을 옮겼을 때: 다음 화면 바꾸기는 움직임 없이 */
export function suppressNextTransition() {
  suppressNext = true;
}

// ── 스크롤 위치 기억(뒤로 오면 보던 곳으로) ──────────
const scrollPos = new Map();
const posKey = () => `${depth()}|${window.location.hash}`;
function saveScroll() {
  scrollPos.set(posKey(), window.scrollY);
}
function restoreScroll() {
  // 기억한 위치가 있을 때만(없으면 브라우저가 되살린 위치를 그대로 둔다)
  const key = posKey();
  if (scrollPos.has(key)) window.scrollTo(0, scrollPos.get(key));
}

// ── 앞으로 가기 ────────────────────────────────
let maxDepth = 0; // 이 앱 안에서 쌓은 가장 깊은 화면(뒤로 간 뒤에는 앞으로 갈 수 있다)

// 입력 중인 화면이 '나가기 전에 확인'을 걸어 둘 수 있다(뒤로 가기 몸짓이나 안드로이드 뒤로 버튼).
let guard = null;
let skipGuard = false;
let replaceAfterBack = null; // backTo: 뒤로 간 다음 그 화면을 이 주소로 바꾼다
let last = { state: window.history.state, hash: window.location.hash };
let lastDepth = depth();

function remember() {
  last = { state: window.history.state, hash: window.location.hash };
  lastDepth = depth();
}

function onPop(e) {
  if (takeCodeOnNavigate()) {
    skipGuard = false;
    remember();
    notify();
    return;
  }
  if (guard && !skipGuard && !guard()) {
    // 나가지 않기로 했으면 방금 떠난 화면 기록을 되살린다
    window.history.pushState(last.state, '', last.hash || '#/');
    return;
  }
  skipGuard = false;
  if (replaceAfterBack) {
    const path = replaceAfterBack;
    replaceAfterBack = null;
    window.history.replaceState({ depth: depth() }, '', '#' + path);
  }
  const d = depth();
  const dir = e && e.hasUAVisualTransition ? 'none' : d < lastDepth ? 'back' : d > lastDepth ? 'forward' : 'fade';
  remember();
  transition(dir, () => {
    notify();
    restoreScroll();
  });
}

window.addEventListener('popstate', onPop);
window.addEventListener('hashchange', () => {
  // 뒤로·앞으로는 popstate(onPop)가 이미 움직임과 함께 바꿨다. 같은 주소의 hashchange는 넘긴다(2026-10-30 검토:
  // 여기서 먼저 바꾸면 화면 넘김의 앞 화면 사진이 새 화면으로 찍혀 움직임이 틀어짐)
  if (window.location.hash === last.hash) return;
  takeCodeOnNavigate();
  remember();
  notify();
});

/** fn이 false를 돌려주면 뒤로 가기를 막는다. 해제 함수를 돌려준다. */
export function setLeaveGuard(fn) {
  guard = fn;
  return () => {
    if (guard === fn) guard = null;
  };
}

function depth() {
  return (window.history.state && window.history.state.depth) || 0;
}

export function navigate(path) {
  saveScroll();
  window.history.pushState({ depth: depth() + 1 }, '', '#' + path);
  maxDepth = depth();
  remember();
  transition('forward', () => {
    notify();
    // 새 화면은 맨 위부터 보인다(홈 '상차일로 보기'처럼 긴 목록 아래에서 줄을 눌러도 고치기 화면 머리글이 보이게)
    try { window.scrollTo(0, 0); } catch { /* 무시 */ }
  });
}

/** 이 화면을 다른 주소로 바꾸기(기록은 하나). dir: 움직임(기본 살짝 겹쳐 바뀜) */
export function replace(path, dir = 'fade') {
  window.history.replaceState({ depth: depth() }, '', '#' + path);
  remember();
  transition(dir, () => {
    notify();
    try { window.scrollTo(0, 0); } catch { /* 무시 */ }
  });
}

/** 앱 안에서 온 화면이면 뒤로, 바로 열린 화면이면 fallback으로. 앱이 스스로 가는 거라 확인은 건너뛴다. */
export function back(fallback = '/') {
  if (depth() > 0) {
    skipGuard = true;
    window.history.back();
  } else {
    replace(fallback, 'back');
  }
}

/** 뒤로 가되, 돌아간 화면을 path로 바꾼다(바이어 이름을 바꾼 뒤 옛 이름 화면이 남지 않게) */
export function backTo(path) {
  if (depth() > 0) {
    skipGuard = true;
    replaceAfterBack = path;
    window.history.back();
  } else {
    replace(path, 'back');
  }
}

/** 나가도 되는지(입력 중이면 묻는다). 손으로 밀기에서 화면을 빼기 전에 쓴다 */
export function confirmLeave() {
  return !guard || guard();
}

/** 사람이 뒤로 가기를 할 때(밀어서 뒤로): 입력 중이면 먼저 확인한다. 갔으면 true */
export function userBack(fallback = '/', { confirmed = false } = {}) {
  if (!confirmed && guard && !guard()) return false;
  back(fallback);
  return true;
}

/** 뒤로 갔다가 다시 앞으로 갈 화면이 있는지 */
export function canGoForward() {
  return depth() < maxDepth;
}

export function goForward() {
  if (canGoForward()) window.history.forward();
}

export function buyerPath(name) {
  return '/b/' + encodeURIComponent(name);
}

export function useRoute() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    listeners.add(setRoute);
    return () => listeners.delete(setRoute);
  }, []);
  return route;
}
