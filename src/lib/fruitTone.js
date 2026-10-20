// 과일 이름 글자색(2026-10-20 사용자 요청): 배 검정, 샤인머스캣 보라, 단감 진한 주황, 딸기 진한 빨강, 키위 진한 키위색.
// 앱 목록(바이어 스케줄, 홈 상차일로 보기)에서만 쓰고 JPG에는 쓰지 않는다. 그 밖의 과일은 기본 글자색.
// 신고배·신화배처럼 '배'로 끝나면 배, 설향 딸기처럼 '딸기'가 들어가면 딸기로 본다.

/** 과일 이름 → 색 이름('pear' | 'grape' | 'persimmon' | 'berry' | 'kiwi' | '') */
export function fruitTone(fruit) {
  const f = String(fruit || '').trim();
  if (!f) return '';
  if (f.endsWith('배')) return 'pear';
  if (f.includes('샤인머스캣')) return 'grape';
  if (f === '단감') return 'persimmon';
  if (f.includes('딸기')) return 'berry';
  if (f.includes('키위')) return 'kiwi';
  return '';
}

/** 과일 글자에 붙일 class 이름 */
export function fruitToneClass(fruit) {
  const t = fruitTone(fruit);
  return t ? ' fruit-' + t : '';
}
