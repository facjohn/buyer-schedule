import { describe, it, expect } from 'vitest';
import { fmtKo, fmtKoYear, fmtEn, fmtEnLong, fmtMonthKo, fmtMonthEn, addMonths, addDays } from './dates.js';
import { fmtPrice, fmtWon, parseMoney } from './money.js';
import { toBuyerRow, BUYER_FIELDS, fruitEnMap } from './buyerView.js';
import { buyerCards, containersOf, expectedNo, filterPeriod, groupByMonth, homeStats, lastCost, lastPrice, shipmentKey } from './schedule.js';
import { extractCode, codeFromUrl } from './link.js';

describe('날짜 표기 (표기 규칙)', () => {
  it('한국어 "10월 20일 (화)", 영어 "Oct 20"', () => {
    expect(fmtKo('2026-10-20')).toBe('10월 20일 (화)');
    expect(fmtEn('2026-10-20')).toBe('Oct 20');
    expect(fmtEnLong('2026-10-13')).toBe('Oct 13, 2026');
  });
  it('9월은 Sept', () => {
    expect(fmtEn('2026-09-03')).toBe('Sept 3');
    expect(fmtMonthEn('2026-09')).toBe('September');
  });
  it('숫자만 쓴 날짜를 만들지 않는다', () => {
    for (const s of [fmtKo('2027-01-05'), fmtEn('2027-01-05')]) expect(s).not.toMatch(/\d+\/\d+/);
  });
  it('월 제목은 올해가 아니면 해를 붙인다', () => {
    expect(fmtMonthKo('2026-12', '2026-10-14')).toBe('12월');
    expect(fmtMonthKo('2027-01', '2026-10-14')).toBe('2027년 1월');
  });
  it('달 더하기는 말일을 넘지 않는다', () => {
    expect(addMonths('2026-12-31', 2)).toBe('2027-02-28');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('금액', () => {
  it('바이어가는 통화, 산지가는 원', () => {
    expect(fmtPrice(24.5, 'USD')).toBe('$24.50');
    expect(fmtPrice(1234.5, 'USD')).toBe('$1,234.50');
    expect(fmtPrice(null, 'USD')).toBe('');
    expect(fmtWon(28000)).toBe('₩28,000');
  });
  it('입력 글자 읽기', () => {
    expect(parseMoney('28,000')).toBe(28000);
    expect(parseMoney('')).toBe(null);
    expect(Number.isNaN(parseMoney('이만원'))).toBe(true);
  });
});

describe('JPG용 허용 칸 (규칙 1)', () => {
  const row = {
    id: 'x', buyer: '바이어 A', no: 4, noYear: 2026, fruit: '신고배', ship: '항공', specKo: '15kg 18-24',
    specEn: '15kg, 18-24', eta: '2026-11-03', price: 31, cost: 28000, workCost: 12000, status: '미정',
    loadDate: '2026-10-28', exporter: 'Royal', origin: '나주', qty: '40ft 1대', memo: '비밀', updatedBy: '김'
  };
  const fruits = fruitEnMap([{ fruitKo: '신고배', fruitEn: 'Singo pear' }]);

  it('허용한 일곱 칸만 담는다', () => {
    expect(Object.keys(toBuyerRow(row, fruits)).sort()).toEqual([...BUYER_FIELDS].sort());
  });
  it('내부 값(산지가·작업비·산지·수량·메모·상차일·회사)이 어디에도 없다', () => {
    const s = JSON.stringify(toBuyerRow(row, fruits));
    for (const v of ['28000', '12000', '나주', '40ft 1대', '비밀', '2026-10-28', 'Royal', '15kg 18-24']) {
      expect(s).not.toContain(v);
    }
  });
  it('영어로 바꾸고, 영어가 없으면 한글을 넣지 않는다', () => {
    expect(toBuyerRow(row, fruits)).toMatchObject({ fruit: 'Singo pear', ship: 'Air', spec: '15kg, 18-24', status: 'tbc' });
    expect(toBuyerRow({ ...row, fruit: '단감', specEn: '' }, fruits)).toMatchObject({ fruit: '', spec: '' });
  });
  it('바이어가 표시를 끄면 가격도 빠진다', () => {
    expect(toBuyerRow(row, fruits, { withPrice: false }).price).toBe(null);
  });
});

const today = '2026-10-14';
const rows = [
  { id: '1', buyer: 'A', no: 1, noYear: 2026, fruit: '신고배', specKo: '5kg 7과', eta: '2026-10-20', price: 13.8, cost: 15500, workCost: 1800, status: '확정', ship: '40ft' },
  { id: '2', buyer: 'A', no: 2, noYear: 2026, fruit: '신고배', specKo: '5kg 7과', eta: '2026-11-03', price: 14.2, cost: null, status: '미정', ship: '40ft' },
  { id: '3', buyer: 'A', no: 2, noYear: 2026, fruit: '단감', specKo: '10kg', eta: '2026-11-03', price: 15, cost: 17000, status: '미정', ship: '40ft' },
  { id: '4', buyer: 'A', no: 3, noYear: 2026, fruit: '신고배', specKo: '5kg 7과', eta: '2027-01-05', price: 14.5, cost: 16000, status: '미정', ship: '40ft' },
  { id: '5', buyer: 'B', no: 1, noYear: 2026, fruit: '신고배', specKo: '5kg 7과', eta: '2026-10-01', price: 13.5, cost: 15000, workCost: 1700, status: '확정', ship: '40ft' },
  { id: '6', buyer: 'A', no: 9, noYear: 2026, fruit: '신고배', specKo: '5kg 7과', eta: '', price: null, cost: null, status: '미정', ship: '' }
];

describe('스케줄 고르기·묶기', () => {
  it('다음 2개월: 오늘부터 2개월 뒤까지 + 날짜 없는 줄', () => {
    expect(filterPeriod(rows.filter((r) => r.buyer === 'A'), 'next2', today).map((r) => r.id)).toEqual(['1', '3', '2', '6']);
  });
  it('지난 일정은 최근 것부터', () => {
    expect(filterPeriod(rows, 'past', today).map((r) => r.id)).toEqual(['5']);
  });
  it('월 묶음은 해가 바뀌면 해를 붙인다', () => {
    const g = groupByMonth(filterPeriod(rows.filter((r) => r.buyer === 'A'), 'future', today), today);
    expect(g.map((x) => x.label)).toEqual(['10월', '11월', '2027년 1월', '날짜 없음']);
  });
  it('홈 숫자: 7일 안 ETA, 미정, 산지가 빈 줄', () => {
    const s = homeStats(rows, today);
    expect(s.eta7.map((r) => r.id)).toEqual(['1']);
    expect(s.tbc.map((r) => r.id).sort()).toEqual(['2', '3', '4']);
    expect(s.noCost.map((r) => r.id)).toEqual(['2']);
  });
  it('바이어 카드: 남은 선적은 No. 기준(같은 No.는 한 번)', () => {
    const cards = buyerCards({ today, rows, buyers: [{ name: 'B' }, { name: 'A' }] });
    expect(cards[0].buyer.name).toBe('A');
    expect(cards[0].shipments).toBe(3);
    expect(cards[0].next).toMatchObject({ eta: '2026-10-20', fruits: '신고배' });
    expect(cards[1]).toMatchObject({ shipments: 0, next: null });
  });
  it('예상 번호는 지운 번호까지 센 최댓값 + 1', () => {
    expect(expectedNo({ 'A|2026': 9 }, 'A', 2026)).toBe(10);
    expect(expectedNo({ 'A|2026': 9 }, 'A', 2027)).toBe(1);
  });
  it('같은 컨테이너 목록은 앞으로의 선적이 먼저', () => {
    const c = containersOf(rows, 'A', today);
    expect(c.map((x) => x.no)).toEqual([1, 2, 3, 9]);
    expect(c[1].label).toBe('No. 2 · 11월 3일 (화) · 신고배·단감');
  });
  it('직전 바이어가는 같은 바이어·과일·스펙의 가장 늦은 ETA', () => {
    expect(lastPrice(rows, { buyer: 'A', fruit: '신고배', specKo: '5kg 7과' })).toBe(14.5);
    expect(lastPrice(rows, { buyer: 'B', fruit: '단감', specKo: '10kg' })).toBe(null);
  });
  it('직전 산지가·작업비는 바이어 상관없이', () => {
    expect(lastCost(rows, { fruit: '신고배', specKo: '5kg 7과' })).toEqual({ cost: 16000, workCost: 1800 });
  });
});

describe('번호 해가 빈 줄(시트에서 No.만 적은 줄)', () => {
  it('ETA의 해로 같은 컨테이너로 본다', () => {
    const r = [
      { id: 'x1', buyer: 'A', no: 3, noYear: 2026, fruit: '신고배', eta: '2026-11-03' },
      { id: 'x2', buyer: 'A', no: 3, noYear: null, fruit: '단감', eta: '2026-11-03' }
    ];
    expect(shipmentKey(r[0])).toBe(shipmentKey(r[1]));
    const c = containersOf(r, 'A', '2026-10-14');
    expect(c).toHaveLength(1);
    expect(c[0].value).toBe('2026|3');
  });
  it('다른 해 날짜는 컨테이너 이름에 해를 붙인다', () => {
    expect(fmtKoYear('2027-01-12', '2026-10-14')).toBe('2027년 1월 12일 (화)');
    expect(fmtKoYear('2026-11-03', '2026-10-14')).toBe('11월 3일 (화)');
  });
});

describe('접속 코드 읽기', () => {
  it('링크를 통째로 붙여도, 코드만 넣어도 된다', () => {
    expect(extractCode('https://x.github.io/app/#code=abcdefghjkmnpq23')).toBe('abcdefghjkmnpq23');
    expect(extractCode('  abcdefghjkmnpq23 ')).toBe('abcdefghjkmnpq23');
    expect(extractCode('짧은코드')).toBe('짧은코드');
    expect(extractCode('https://x.github.io/app/#code=%ED%98%84%EB%86%8D2026')).toBe('현농2026');
    expect(extractCode('   ')).toBe('');
  });
  it('주소에 code=가 없으면 화면 주소(#/b/바이어)를 코드로 오해하지 않는다', () => {
    expect(codeFromUrl('#/b/%EB%B0%94%EC%9D%B4%EC%96%B4')).toBe('');
    expect(codeFromUrl('#code=abc')).toBe('abc');
  });
});
