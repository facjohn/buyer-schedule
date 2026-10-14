// 화면을 오가도 필터·검색이 풀리지 않게 앱이 켜져 있는 동안만 기억한다(이 폰 메모리에만, 저장하지 않음).
import { useState } from 'react';

const memory = new Map();

/** adjust(prev): 화면을 열 때 기억한 값을 바꿔야 하면 바꾼 값을 돌려준다 */
export function useRemembered(key, initial, adjust) {
  const [value, setValue] = useState(() => {
    const prev = memory.has(key) ? memory.get(key) : initial;
    const v = adjust ? adjust(prev) : prev;
    memory.set(key, v);
    return v;
  });
  const set = (v) => {
    memory.set(key, v);
    setValue(v);
  };
  return [value, set];
}

export function remember(key, value) {
  memory.set(key, value);
}
