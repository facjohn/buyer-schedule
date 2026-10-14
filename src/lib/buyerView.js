// 바이어에게 나가는 JPG용 데이터. 절대 규칙 1: 허용한 칸만 골라 담은 새 객체를 만든다.
// 산지가, 작업비, 산지, 수량, 메모, 상차일, 회사, 수정자 같은 내부 칸은 여기서 빠지고, 이 함수 말고는 JPG에 데이터를 넘기지 않는다.

export const BUYER_FIELDS = ['no', 'fruit', 'ship', 'spec', 'eta', 'price', 'status'];

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
    price: withPrice && typeof row.price === 'number' ? row.price : null,
    status: row.status === '확정' ? 'confirmed' : 'tbc'
  };
}

export function fruitEnMap(fruits) {
  const map = {};
  for (const f of fruits || []) if (f.fruitKo) map[f.fruitKo] = f.fruitEn || '';
  return map;
}
