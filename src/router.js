// 주소의 # 뒤로 화면을 고른다(GitHub Pages에서 다시 열어도 같은 화면이 열리게).
//   #/            홈
//   #/b/바이어     바이어 스케줄
//   #/new?buyer=  새 줄
//   #/edit/id     고치기
//   #/dup/id      복제(같은 컨테이너에 추가)
import { useEffect, useState } from 'react';
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

// 입력 중인 화면이 '나가기 전에 확인'을 걸어 둘 수 있다(뒤로 가기 몸짓이나 안드로이드 뒤로 버튼).
let guard = null;
let skipGuard = false;
let last = { state: window.history.state, hash: window.location.hash };

function remember() {
  last = { state: window.history.state, hash: window.location.hash };
}

function onPop() {
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
  remember();
  notify();
}

window.addEventListener('popstate', onPop);
window.addEventListener('hashchange', () => {
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
  window.history.pushState({ depth: depth() + 1 }, '', '#' + path);
  remember();
  notify();
}

export function replace(path) {
  window.history.replaceState({ depth: depth() }, '', '#' + path);
  remember();
  notify();
}

/** 앱 안에서 온 화면이면 뒤로, 바로 열린 화면이면 fallback으로. 앱이 스스로 가는 거라 확인은 건너뛴다. */
export function back(fallback = '/') {
  if (depth() > 0) {
    skipGuard = true;
    window.history.back();
  } else {
    replace(fallback);
  }
}

/** 사람이 뒤로 가기를 할 때(밀어서 뒤로): 입력 중이면 먼저 확인한다 */
export function userBack(fallback = '/') {
  if (guard && !guard()) return;
  back(fallback);
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
