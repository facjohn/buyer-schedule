// 바이어 미정·산지 미정(2026-10-30 사용자 요청: "긴급한 거니까 빨리 미정을 확정해야").
// - 바이어 미정 = 바이어 탭의 '@미정' 바이어. 입력 화면 바이어 고르기에서 "바이어 미정"으로 보인다.
// - 산지 미정 = 산지 칸에 '미정'. 입력 화면 산지 칸 옆 '산지 미정' 버튼으로 넣는다.
// - @미정 화면(홈 노란 칸)에는 바이어 미정 줄과 산지 미정 줄이 모두 모인다. 산지 미정 줄은 원래 바이어 화면에도 그대로 보인다.
// - 목록에서는 빨간 바탕 흰 글자 꼬리표(깜빡이는 테두리)와 줄 왼쪽 빨간 띠로 눈에 띄게 한다. JPG에는 쓰지 않는다.

export const TBD_BUYER = '@미정';
export const TBD_ORIGIN = '미정';

export function isTbdBuyer(buyer) {
  return String(buyer ?? '').trim() === TBD_BUYER;
}

/** '미정', '산지 미정', '산지미정'을 산지 미정으로 본다 */
export function isTbdOrigin(origin) {
  const s = String(origin ?? '').replace(/\s+/g, '');
  return s === TBD_ORIGIN || s === '산지미정';
}

/** 바이어 미정이거나 산지 미정인 줄 */
export function isTbdRow(r) {
  return !!r && (isTbdBuyer(r.buyer) || isTbdOrigin(r.origin));
}

/** 바이어 화면에 담을 줄: @미정이면 바이어 미정·산지 미정 줄 모두, 아니면 그 바이어 줄 */
export function rowsForBuyer(rows, buyerName) {
  const list = rows || [];
  return isTbdBuyer(buyerName) ? list.filter(isTbdRow) : list.filter((r) => r.buyer === buyerName);
}

/** 화면에 보일 바이어 이름(@미정은 "바이어 미정") */
export function buyerLabel(buyer) {
  return isTbdBuyer(buyer) ? '바이어 미정' : String(buyer ?? '');
}
