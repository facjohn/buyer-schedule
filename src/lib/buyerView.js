// 바이어에게 나가는 JPG용 데이터. 절대 규칙 1: 허용한 칸만 골라 담은 새 객체를 만든다.
// 산지가, 작업비, 산지, 수량, 메모, 상차일, 회사, 수정자 같은 내부 칸은 여기서 빠지고, 이 함수 말고는 JPG에 데이터를 넘기지 않는다.

// 미정/확정 상태는 2026-10-19 사용자 요청으로 없앴다(JPG에도 TBC 칩 없음). ETA가 없는 줄은 ETA 칸에 TBC.
export const BUYER_FIELDS = ['no', 'fruit', 'ship', 'spec', 'eta', 'price'];

const SHIP_EN = { '20ft': '20ft', '40ft': '40ft', 항공: 'Air' };

/**
 * row: list가 준 스케줄 한 줄, fruitEn: { 신고배: 'Singo pear', ... }
 * 영어가 없으면 한글을 대신 넣지 않고 빈칸으로 둔다(미리보기에서 알린다).
 */
export function toBuyerRow(row, fruitEn, { withPrice = true } = {}) {
  return {
    no: row.no ?? null,
    fruit: fruitEn[row.fruit] || '',
    ship: SHIP_EN[row.ship] || '',
    spec: row.specEn || '',
    eta: row.eta || '',
    price: withPrice ? buyerPrice(row.price) : null
  };
}

/** JPG 바이어가: 숫자, 또는 '17.3/17.8'처럼 적힌 글자 그대로. 한글이 든 글자는 영어 사진에 내지 않는다(TBC) */
export function buyerPrice(p) {
  if (typeof p === 'number') return isFinite(p) ? p : null;
  if (typeof p !== 'string' || !p.trim() || /[\u3131-\u318E\uAC00-\uD7A3]/.test(p)) return null;
  return p.trim();
}

export function fruitEnMap(fruits) {
  const map = {};
  for (const f of fruits || []) if (f.fruitKo) map[f.fruitKo] = f.fruitEn || '';
  return map;
}
