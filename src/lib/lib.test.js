import { describe, it, expect } from 'vitest';
import { fmtKo, fmtKoYear, fmtEn, fmtEnLong, fmtMonthKo, fmtMonthEn, addMonths, addDays } from './dates.js';
import { fmtPrice, fmtWon, parseMoney } from './money.js';
import { toBuyerRow, BUYER_FIELDS, fruitEnMap } from './buyerView.js';
import { buyerCards, containersOf, derivedSpecEn, expectedNo, filterPeriod, groupByMonth, groupInNoOrder, lastCost, lastPrice, loadedPast, loadingDays, seasonLabel, seasonStartIso, shipmentKey, sortByNo, sortRecentFirst } from './schedule.js';
import { extractCode, codeFromUrl } from './link.js';
import { fruitTone } from './fruitTone.js';
import { isTbdBuyer, isTbdOrigin, isTbdRow, rowsForBuyer, buyerLabel } from './undecided.js';

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
    expect(parseMoney('$17.80')).toBe(17.8);
    expect(parseMoney('')).toBe(null);
    expect(Number.isNaN(parseMoney('이만원'))).toBe(true);
  });
  it('가격이 여럿이면 적은 글자 그대로(2026-10-16 사용자 요청)', () => {
    expect(parseMoney('17.3/17.8')).toBe('17.3/17.8');
    expect(parseMoney('17.3/17.8/18.2')).toBe('17.3/17.8/18.2');
    expect(parseMoney('17.3/')).toBe(17.3); // '/' 버튼만 누르고 안 쓴 경우
    expect(parseMoney('17 18')).toBe('17 18'); // 1718로 읽지 않는다
    expect(parseMoney('17.')).toBe(17);
    expect(parseMoney('.5')).toBe(0.5);
    expect(parseMoney('17.3~17.8')).toBe('17.3~17.8');
    expect(Number.isNaN(parseMoney('-5'))).toBe(true);
    expect(fmtPrice('17.3/17.8', 'USD')).toBe('17.3/17.8');
    expect(fmtWon('23000/22000')).toBe('23000/22000');
  });
});

describe('스펙 영어: 적은 글자 그대로 (2026-10-16 사용자 요청)', () => {
  const specs = [
    { fruitKo: '샤인머스캣', specKo: '2kg 4송이', specEn: '2kg, 4 bunches' },
    { fruitKo: '샤인머스캣', specKo: '450g', specEn: '450g' }
  ];
  it('한글이 없으면 그대로', () => {
    expect(derivedSpecEn(specs, '샤인머스캣', '4kg/450g')).toBe('4kg/450g');
    expect(derivedSpecEn(specs, '신고배', '15kg 18-24')).toBe('15kg 18-24');
  });
  it('/로 이은 스펙은 조각마다 사전에서, 못 찾으면 빈칸(영어를 넣게)', () => {
    expect(derivedSpecEn(specs, '샤인머스캣', '2kg 4송이/450g')).toBe('2kg, 4 bunches/450g');
    expect(derivedSpecEn(specs, '샤인머스캣', '2kg 4송이/4kg 5송이')).toBe('');
    expect(derivedSpecEn(specs, '샤인머스캣', '')).toBe('');
  });
});

describe('바이어 스케줄 목록: No. 순 (2026-10-19 사용자 요청)', () => {
  const r = (no, eta, extra = {}) => ({ id: String(no) + eta, buyer: '킹고', no, noYear: 2026, eta, fruit: '배', specKo: '15kg', ...extra });
  it('ETA 미정 줄도 No. 자리에, 월 제목은 달이 바뀔 때만(ETA 없으면 상차일의 달)', () => {
    const rows = [r(7, '2026-10-23'), r(8, '2026-10-28'), r(10, '2026-11-15'), r(9, '', { loadDate: '2026-11-04' })];
    const sorted = sortByNo(rows);
    expect(sorted.map((x) => x.no)).toEqual([7, 8, 9, 10]);
    const g = groupInNoOrder(sorted, '2026-10-19');
    expect(g.map((x) => [x.label, x.rows.map((y) => y.no)])).toEqual([['10월', [7, 8]], ['11월', [9, 10]]]);
  });
  it('상차일도 없으면 앞 줄의 달에 둔다', () => {
    const g = groupInNoOrder(sortByNo([r(7, '2026-10-23'), r(9, '2026-11-15'), r(8, '')]), '2026-10-19');
    expect(g.map((x) => [x.label, x.rows.map((y) => y.no)])).toEqual([['10월', [7, 8]], ['11월', [9]]]);
  });
  it('인보이스 번호는 숫자를 크기대로, 옛 숫자 번호는 해마다, No. 없는 줄은 뒤', () => {
    const inv = sortByNo([r('KINGO-26-10', '2026-10-01'), r('KINGO-26-9', '2026-12-01'), r('KINGO-27-01', '2027-08-01')]);
    expect(inv.map((x) => x.no)).toEqual(['KINGO-26-9', 'KINGO-26-10', 'KINGO-27-01']);
    const old = sortByNo([r(1, '2027-01-05', { noYear: 2027 }), r(5, '2026-12-01'), r(null, '2026-10-01')]);
    expect(old.map((x) => x.no)).toEqual([5, 1, null]);
  });
  it('sortByNo desc는 큰 번호부터', () => {
    expect(sortByNo([r(3, '2026-09-01'), r(5, '2026-09-20'), r(4, '2026-09-10')], { desc: true }).map((x) => x.no)).toEqual([5, 4, 3]);
  });
  it('지난 일정은 ETA가 최근인 것이 맨 위, 같은 날이면 큰 번호부터 (2026-10-20 사용자 요청)', () => {
    const s = sortRecentFirst([r(7, '2026-10-26'), r(8, '2026-10-23'), r(9, '2026-10-26'), r(6, '2026-10-01')]);
    expect(s.map((x) => x.no)).toEqual([9, 7, 8, 6]);
    const g = groupInNoOrder(s, '2026-10-30');
    expect(g.map((x) => x.label)).toEqual(['10월']);
  });
  it('같은 No.(같은 컨테이너)는 붙어 있다', () => {
    const s = sortByNo([r(8, '2026-10-28', { specKo: '15kg' }), r(7, '2026-10-23'), r(8, '2026-10-28', { specKo: '5kg' })]);
    expect(s.map((x) => x.no + x.specKo)).toEqual(['715kg', '815kg', '85kg']);
  });
});

describe('상차 끝난 줄 주황 바탕, ETA 지난 줄은 지난 일정 (2026-10-20 사용자 요청)', () => {
  const today = '2026-10-20';
  it('상차일이 오늘보다 앞이면 상차 끝남, 오늘·앞으로·빈 상차일은 아님', () => {
    expect(loadedPast({ loadDate: '2026-10-19' }, today)).toBe(true);
    expect(loadedPast({ loadDate: '2026-10-15' }, today)).toBe(true);
    expect(loadedPast({ loadDate: '2026-10-20' }, today)).toBe(false);
    expect(loadedPast({ loadDate: '2026-10-27' }, today)).toBe(false);
    expect(loadedPast({ loadDate: '' }, today)).toBe(false);
    expect(loadedPast({}, today)).toBe(false);
    expect(loadedPast({ loadDate: '2026-10-15' }, '')).toBe(false);
  });
  it('ETA가 오늘보다 앞이면 지난 일정, 오늘 ETA와 ETA 미정은 앞으로', () => {
    const rows = [
      { id: 'a', eta: '2026-10-19', loadDate: '2026-10-15' },
      { id: 'b', eta: '2026-10-20', loadDate: '2026-10-15' },
      { id: 'c', eta: '2026-10-23', loadDate: '2026-10-16' },
      { id: 'd', eta: '', loadDate: '2026-11-03' }
    ];
    expect(filterPeriod(rows, 'past', today).map((r) => r.id)).toEqual(['a']);
    expect(filterPeriod(rows, 'future', today).map((r) => r.id).sort()).toEqual(['b', 'c', 'd']);
  });
});

describe('지난 일정은 이번 시즌(7월~다음 해 6월)만 (2026-10-20 사용자 요청)', () => {
  it('시즌 첫날은 7월 1일, 7월 전이면 지난해 7월 1일', () => {
    expect(seasonStartIso('2026-10-20')).toBe('2026-07-01');
    expect(seasonStartIso('2026-07-01')).toBe('2026-07-01');
    expect(seasonStartIso('2027-06-30')).toBe('2026-07-01');
    expect(seasonStartIso('2027-07-01')).toBe('2027-07-01');
    expect(seasonStartIso('')).toBe('');
    expect(seasonLabel('2026-10-20')).toBe('2026년 7월');
    expect(seasonLabel('2027-03-02')).toBe('2026년 7월');
  });
  it('지난 일정에는 이번 시즌 줄만, 7월 1일이 되면 지난 시즌 줄은 빠진다(앞으로 일정은 그대로)', () => {
    const rows = [
      { id: 'jun', eta: '2026-06-30' },
      { id: 'jul', eta: '2026-07-01' },
      { id: 'oct', eta: '2026-10-19' },
      { id: 'next', eta: '2026-10-25' },
      { id: 'tbc', eta: '' }
    ];
    expect(filterPeriod(rows, 'past', '2026-10-20').map((r) => r.id)).toEqual(['oct', 'jul']);
    expect(filterPeriod(rows, 'past', '2027-07-01').map((r) => r.id)).toEqual([]);
    expect(filterPeriod(rows, 'future', '2026-10-20').map((r) => r.id).sort()).toEqual(['next', 'tbc']);
  });
});

describe('홈 상차일로 보기 (2026-10-20 사용자 요청)', () => {
  it('앞으로의 줄만 상차일 순, 같은 날은 바이어 탭 순서 → No. 순, 상차일이 지난 줄은 빼고(당일까지만), 상차일 없는 줄은 맨 뒤', () => {
    const today = '2026-10-20';
    const rows = [
      { id: 'k6', buyer: '킹고', no: 6, noYear: 2026, eta: '2026-10-26', loadDate: '2026-10-22' },
      { id: 'h9', buyer: '하워드', no: 9, noYear: 2026, eta: '2026-10-26', loadDate: '2026-10-16' },
      { id: 'h7', buyer: '하워드', no: 7, noYear: 2026, eta: '2026-10-23', loadDate: '2026-10-15' },
      { id: 's4', buyer: '샤인', no: 4, noYear: 2026, eta: '2026-10-26', loadDate: '2026-10-22' },
      { id: 'k5', buyer: '킹고', no: 5, noYear: 2026, eta: '2026-10-26', loadDate: '2026-10-22' },
      { id: 'p7', buyer: '포미나', no: 7, noYear: 2026, eta: '2026-10-23', loadDate: '2026-10-20' },
      { id: 'w3', buyer: 'S&W', no: 3, noYear: 2026, eta: '', loadDate: '2026-11-03' },
      { id: 'p9', buyer: '포미나', no: 9, noYear: 2026, eta: '', loadDate: '' },
      { id: 'old', buyer: '킹고', no: 1, noYear: 2026, eta: '2026-10-19', loadDate: '2026-10-10' }
    ];
    const buyers = [{ name: '킹고' }, { name: '샤인' }, { name: '포미나' }, { name: '하워드' }, { name: 'S&W' }];
    const days = loadingDays({ today, rows, buyers });
    expect(days.map((d) => [d.key, d.isToday, d.rows.map((r) => r.id)])).toEqual([
      ['2026-10-20', true, ['p7']],
      ['2026-10-22', false, ['k5', 'k6', 's4']],
      ['2026-11-03', false, ['w3']],
      ['none', false, ['p9']]
    ]);
    // 지난 일정: 이번 시즌(7월 1일부터) 상차일이 지난 줄, 최근 날짜부터(ETA가 지났어도)
    const past = loadingDays({ today, rows: [...rows, { id: 'jun', buyer: '킹고', no: 2, noYear: 2026, eta: '2026-07-10', loadDate: '2026-06-28' }], buyers }, { past: true });
    expect(past.map((d) => [d.key, d.rows.map((r) => r.id)])).toEqual([
      ['2026-10-16', ['h9']],
      ['2026-10-15', ['h7']],
      ['2026-10-10', ['old']]
    ]);
  });
});

describe('바이어 미정·산지 미정 (2026-10-30 사용자 요청)', () => {
  const today = '2026-10-30';
  const rows = [
    { id: 't1', buyer: '@미정', no: 1, noYear: 2026, fruit: '샤인머스캣', eta: '', loadDate: '2026-11-05', origin: '' },
    { id: 'k9', buyer: '킹고', no: 9, noYear: 2026, fruit: '샤인머스캣', eta: '2026-11-10', loadDate: '2026-11-03', origin: '미정' },
    { id: 'k8', buyer: '킹고', no: 8, noYear: 2026, fruit: '배', eta: '2026-11-19', loadDate: '2026-11-16', origin: '꿀배' },
    { id: 'h1', buyer: '하워드', no: 1, noYear: 2026, fruit: '배', eta: '2026-11-02', loadDate: '2026-10-31', origin: '산지 미정' }
  ];
  it('미정 알아보기', () => {
    expect(isTbdBuyer('@미정')).toBe(true);
    expect(isTbdBuyer('킹고')).toBe(false);
    expect(['미정', '산지 미정', '산지미정', ' 미정 '].map(isTbdOrigin)).toEqual([true, true, true, true]);
    expect(['', '?????', '미정농장', null].map(isTbdOrigin)).toEqual([false, false, false, false]);
    expect(rows.map(isTbdRow)).toEqual([true, true, false, true]);
    expect(buyerLabel('@미정')).toBe('바이어 미정');
    expect(buyerLabel('킹고')).toBe('킹고');
  });
  it('@미정 화면에는 바이어 미정 줄과 산지 미정 줄(다른 바이어 줄도) 모두, 원래 바이어 화면에도 산지 미정 줄이 그대로', () => {
    expect(rowsForBuyer(rows, '@미정').map((r) => r.id)).toEqual(['t1', 'k9', 'h1']);
    expect(rowsForBuyer(rows, '킹고').map((r) => r.id)).toEqual(['k9', 'k8']);
  });
  it('홈 @미정 칸: 미정 줄 수를 세고, 미정이 남아 있으면 맨 앞', () => {
    const buyers = [{ name: '킹고' }, { name: '하워드' }, { name: '@미정' }];
    const cards = buyerCards({ today, rows, buyers });
    expect(cards[0]).toMatchObject({ tbd: true, count: 3 });
    expect(cards[0].buyer.name).toBe('@미정');
    expect(cards.find((c) => c.buyer.name === '킹고').count).toBe(2);
    // 바이어 탭에 @미정이 없어도 산지 미정 줄이 있으면 @미정 칸이 생긴다
    const noTab = buyerCards({ today, rows: rows.filter((r) => r.buyer !== '@미정'), buyers: [{ name: '킹고' }, { name: '하워드' }] });
    expect(noTab[0]).toMatchObject({ tbd: true, count: 2 });
    // 미정이 없으면 @미정 칸은 보통 순서(일정 없음 → 뒤)
    const none = buyerCards({ today, rows: [rows[2]], buyers });
    expect(none[none.length - 1]).toMatchObject({ tbd: true, count: 0 });
  });
});

describe('과일 글자색 (2026-10-20 사용자 요청)', () => {
  it('배 검정, 샤인머스캣 보라, 단감 진한 주황, 딸기 진한 빨강, 키위 진한 키위색, 나머지는 기본', () => {
    expect(['배', '신고배', '신화배'].map(fruitTone)).toEqual(['pear', 'pear', 'pear']);
    expect(fruitTone('샤인머스캣')).toBe('grape');
    expect(fruitTone('단감')).toBe('persimmon');
    expect(['딸기', '설향 딸기'].map(fruitTone)).toEqual(['berry', 'berry']);
    expect(fruitTone('키위')).toBe('kiwi');
    expect(['곶감', '홍시', '참외', '', null].map(fruitTone)).toEqual(['', '', '', '', '']);
  });
});

describe('과일 버튼 (2026-10-19 사용자 요청)', () => {
  it('줄에 있는 과일만, 품목 탭 순서로(품목 탭에 없는 과일은 뒤)', async () => {
    const { fruitsInOrder } = await import('./schedule.js');
    const tab = [{ fruitKo: '배' }, { fruitKo: '샤인머스캣' }, { fruitKo: '단감' }, { fruitKo: '키위' }];
    const rows = [{ fruit: '단감' }, { fruit: '배' }, { fruit: '신고' }, { fruit: '배' }, { fruit: '' }];
    expect(fruitsInOrder(rows, tab)).toEqual(['배', '단감', '신고']);
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
    expect(toBuyerRow(row, fruits)).toMatchObject({ fruit: 'Singo pear', ship: 'Air', spec: '15kg, 18-24' });
    expect(toBuyerRow(row, fruits)).not.toHaveProperty('status'); // 미정/확정은 없앰(2026-10-19)
    expect(toBuyerRow({ ...row, fruit: '단감', specEn: '' }, fruits)).toMatchObject({ fruit: '', spec: '' });
  });
  it('바이어가 표시를 끄면 가격도 빠진다', () => {
    expect(toBuyerRow(row, fruits, { withPrice: false }).price).toBe(null);
  });
  it('여러 가격은 글자 그대로, 한글이 든 가격은 넣지 않는다', () => {
    expect(toBuyerRow({ ...row, price: '17.3/17.8' }, fruits).price).toBe('17.3/17.8');
    expect(toBuyerRow({ ...row, price: '17.3 협의중' }, fruits).price).toBe(null);
    expect(toBuyerRow({ ...row, price: '17.3/17.8' }, fruits, { withPrice: false }).price).toBe(null);
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
    expect(g.map((x) => x.label)).toEqual(['10월', '11월', '2027년 1월', 'ETA 미정']);
  });
  it('바이어 카드: 예정 수는 앞으로의 스케줄 줄 수(같은 No.의 줄도 하나씩, ETA 미정 줄도 셈). 상차일이 없으면 다음 상차 미정', () => {
    const cards = buyerCards({ today, rows, buyers: [{ name: 'B' }, { name: 'A' }] });
    expect(cards[0].buyer.name).toBe('A');
    expect(cards[0].count).toBe(5); // 1, 2(신고배), 2(단감), 3, 9
    expect(cards[0].next).toMatchObject({ loadDate: '', fruits: '신고배' });
    expect(cards[1]).toMatchObject({ count: 0, next: null, allLoaded: false });
  });
  it('상차일 미정 선적만 있는 바이어는 상차일 있는 바이어 다음, 일정 없는 바이어 앞', () => {
    const r = [
      { id: 'u', buyer: 'U', no: 1, noYear: 2026, fruit: '단감', eta: '' },
      { id: 'd', buyer: 'D', no: 1, noYear: 2026, fruit: '단감', eta: '2026-12-01', loadDate: '2026-11-20' }
    ];
    const cards = buyerCards({ today, rows: r, buyers: [{ name: 'E' }, { name: 'U' }, { name: 'D' }] });
    expect(cards.map((c) => c.buyer.name)).toEqual(['D', 'U', 'E']);
    expect(cards[0].next).toMatchObject({ loadDate: '2026-11-20', fruits: '단감' });
    expect(cards[1].next).toMatchObject({ loadDate: '', fruits: '단감' });
  });
  it('다음 상차 기준(2026-10-20 사용자 요청): ETA가 늦어도 상차가 먼저면 그 선적, 오늘 상차 포함, 이미 실은 줄은 빼고, 다 실었으면 상차 다 끝남', () => {
    const r = [
      { id: 'x1', buyer: 'X', no: 1, noYear: 2026, fruit: '배', ship: '40ft', eta: '2026-10-25', loadDate: '2026-10-10' },
      { id: 'x2', buyer: 'X', no: 2, noYear: 2026, fruit: '배', ship: '40ft', eta: '2026-11-02', loadDate: '2026-10-18' },
      { id: 'x3', buyer: 'X', no: 3, noYear: 2026, fruit: '샤인머스캣', ship: '항공', eta: '2026-11-05', loadDate: '2026-10-16' },
      { id: 'y1', buyer: 'Y', no: 1, noYear: 2026, fruit: '단감', ship: '20ft', eta: '2026-10-20', loadDate: '2026-10-01' },
      { id: 'z1', buyer: 'Z', no: 1, noYear: 2026, fruit: '키위', ship: '40ft', eta: '2026-11-30', loadDate: '2026-10-14' }
    ];
    const cards = buyerCards({ today, rows: r, buyers: [{ name: 'Y' }, { name: 'X' }, { name: 'Z' }, { name: 'N' }] });
    expect(cards.map((c) => c.buyer.name)).toEqual(['Z', 'X', 'Y', 'N']);
    expect(cards[0].next).toMatchObject({ loadDate: '2026-10-14', fruits: '키위' });
    expect(cards[1].next).toMatchObject({ loadDate: '2026-10-16', fruits: '샤인머스캣', ship: '항공' });
    expect(cards[1].count).toBe(3);
    expect(cards[2]).toMatchObject({ next: null, allLoaded: true, count: 1 });
    expect(cards[3]).toMatchObject({ next: null, allLoaded: false, count: 0 });
  });
  it('다음 상차 선적의 과일은 같은 컨테이너에서 상차일을 안 적은 줄까지 모은다', () => {
    const r = [
      { id: 'a1', buyer: 'A', no: 5, noYear: 2026, fruit: '신고배', ship: '40ft', eta: '2026-11-05', loadDate: '2026-10-22' },
      { id: 'a2', buyer: 'A', no: 5, noYear: 2026, fruit: '단감', ship: '40ft', eta: '2026-11-05', loadDate: '' }
    ];
    const [card] = buyerCards({ today, rows: r, buyers: [{ name: 'A' }] });
    expect(card.next.loadDate).toBe('2026-10-22');
    expect(card.next.fruits.split('·').sort()).toEqual(['단감', '신고배']); // 순서는 목록(No. 순)과 같게
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
