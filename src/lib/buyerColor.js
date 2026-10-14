// 홈 바둑판의 바이어별 색. 바이어 탭 순서대로 나눠 주어 앞의 10명은 서로 다른 색이고,
// 홈에서 순서(다음 ETA 순)가 바뀌어도 바이어마다 색은 그대로다.
// bg: 칸 바탕(옅게), fg: 숫자·강조(진하게, 흰 글자와 바탕 위 글자 모두 읽히는 진하기)
export const BUYER_COLORS = [
  { bg: '#E6F1EC', fg: '#1F6B4F' }, // 초록
  { bg: '#E8EEFB', fg: '#1E4FB0' }, // 파랑
  { bg: '#FCF1E3', fg: '#A15C07' }, // 주황
  { bg: '#F0EAFB', fg: '#6B3FA0' }, // 보라
  { bg: '#FCE8EF', fg: '#B4235A' }, // 분홍
  { bg: '#E3F4F4', fg: '#0F766E' }, // 청록
  { bg: '#F1F4E2', fg: '#5B6B12' }, // 올리브
  { bg: '#FDECE8', fg: '#B3401F' }, // 다홍
  { bg: '#ECEBFB', fg: '#4338CA' }, // 남색
  { bg: '#ECEFF3', fg: '#3F4A5A' } // 회색
];

function hash(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

/** 바이어 탭에 있는 바이어는 탭 순서로, 없는 바이어(시트에만 적힌 이름)는 이름으로 색을 고른다 */
export function buyerColor(buyers, name) {
  const i = (buyers || []).findIndex((b) => b.name === name);
  const n = i >= 0 ? i : hash(name);
  return BUYER_COLORS[n % BUYER_COLORS.length];
}
