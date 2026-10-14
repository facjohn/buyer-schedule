// 접속 코드: 링크(앱 주소#code=...)를 통째로 붙여 넣어도, 코드만 넣어도 된다.
// 코드는 시트 팀원 탭에 적힌 그대로(글자 수·글자 종류 제한 없음, 한글도 됨).

const KEY = 'bs.code';
export const CODE_EVENT = 'bs:code';

function decode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** 주소(#code=...)에서만 코드를 꺼낸다. 없으면 '' */
export function codeFromUrl(text) {
  const m = /[#?&]code=([^&\s#]+)/.exec(String(text || ''));
  return m ? decode(m[1]).trim() : '';
}

/** 코드 넣는 칸: 링크를 붙여 넣었으면 링크 속 코드, 아니면 넣은 글자 그대로(앞뒤 공백만 뺌) */
export function extractCode(text) {
  const s = String(text || '').trim();
  return codeFromUrl(s) || s;
}

/** 주소에 #code=가 있으면 저장하고 주소창에서 바로 지운다. 저장된 코드를 돌려준다. */
export function takeCodeFromUrl() {
  const code = codeFromUrl(window.location.hash);
  if (code) {
    saveCode(code);
    window.history.replaceState({ depth: 0 }, '', window.location.pathname + window.location.search + '#/');
    return code;
  }
  return loadCode();
}

/**
 * 앱이 열린 채로 주소가 #code=...로 바뀐 경우(같은 탭에 새 링크를 붙여 넣음).
 * 코드를 저장하고 주소창에서 지운 뒤 App에 알린다. 코드를 찾았으면 true.
 */
export function takeCodeOnNavigate() {
  const code = codeFromUrl(window.location.hash);
  if (!code) return false;
  saveCode(code);
  window.history.replaceState({ depth: 0 }, '', window.location.pathname + window.location.search + '#/');
  window.dispatchEvent(new CustomEvent(CODE_EVENT, { detail: code }));
  return true;
}

export function loadCode() {
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function saveCode(code) {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 모드)면 이번 실행 동안만 쓴다
  }
}

export function clearCode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
