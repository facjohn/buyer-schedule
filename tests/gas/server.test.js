import { describe, it, expect } from 'vitest';
import { makeWorld, d, randomCode } from './harness.js';

const CODE_1 = randomCode();
const CODE_2 = randomCode();
const Y = new Date().getFullYear();
// 번호 해 = 시즌(7월 1일~다음 해 6월 30일)의 시작 해(2026-10-30 사용자 결정 "매년 7월 1일부터 리셋")
const sy = (date) => (date.getMonth() + 1 >= 7 ? date.getFullYear() : date.getFullYear() - 1);
const S = sy(new Date());

function iso(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
function daysFromNow(n) {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + n);
}

function world(extra = {}) {
  return makeWorld({
    members: [
      { name: '김산지', code: CODE_1 },
      { name: '박바이어', code: CODE_2 },
      { name: '짧은코드', code: 'short123' }
    ],
    buyers: [
      { name: '바이어 A', nameEn: 'Buyer A', currency: 'USD', exporter: 'Hyun Nong Fresh' },
      { name: '바이어 B', nameEn: 'Buyer B', currency: 'USD', exporter: 'Royal' }
    ],
    fruits: [
      { fruitKo: '신고배', fruitEn: 'Singo pear', seasonStart: 9 },
      { fruitKo: '단감', fruitEn: 'Sweet persimmon' }
    ],
    specs: [{ fruitKo: '신고배', specKo: '5kg 7과', specEn: '5kg, Size 7' }],
    schedule: [
      { id: 'a1', buyer: '바이어 A', no: 1, noYear: S, fruit: '신고배', ship: '40ft', specKo: '5kg 7과',
        eta: daysFromNow(10), price: 13.8, cost: 15500, workCost: 1800, status: '확정', origin: '나주', qty: '40ft 1대', memo: '비밀 메모' },
      { id: 'a2', buyer: '바이어 A', no: 2, noYear: S, fruit: '단감', ship: '40ft', specKo: '10kg',
        eta: daysFromNow(20), price: 15.2, cost: 17000, status: '미정' },
      { id: 'a5', buyer: '바이어 A', no: 5, noYear: S, fruit: '단감', ship: '20ft', specKo: '10kg',
        eta: daysFromNow(30), price: 15, cost: 16000, status: '미정', deleted: true },
      { id: 'old', buyer: '바이어 A', no: 1, noYear: Y - 2, fruit: '신고배', ship: '40ft', specKo: '5kg 7과',
        eta: d(`${Y - 2}-11-01`), price: 12.5, cost: 14000, workCost: 1600, status: '확정' }
    ],
    ...extra
  });
}

function makeWorldWithOrder() {
  return makeWorld({
    members: [{ name: '김산지', code: CODE_1 }],
    buyers: [
      { name: '바이어 A', sortOrder: 2 },
      { name: '바이어 B' },
      { name: '바이어 C', sortOrder: 1 }
    ],
    fruits: [{ fruitKo: '신고배', fruitEn: 'Singo pear' }]
  });
}

describe('접속 코드 (규칙 2)', () => {
  it('틀린 코드는 데이터 없이 거절하고 로그에 남긴다', () => {
    const w = world();
    const res = w.call({ action: 'list', code: 'wrong-code-123456' });
    expect(res).toEqual({ ok: false, error: 'bad_code' });
    const log = w.read('log').filter((r) => r.type);
    expect(log).toHaveLength(1);
    expect(log[0].type).toBe('bad_code');
    expect(String(log[0].detail)).not.toContain('wrong-code-123456');
  });

  it('10분 안의 반복은 한 줄로 묶어 횟수만 올린다', () => {
    const w = world();
    for (let i = 0; i < 5; i++) w.call({ action: 'list', code: 'nope-' + i + 'xxxxxxxxx' });
    const log = w.read('log').filter((r) => r.type);
    expect(log).toHaveLength(1);
    expect(log[0].count).toBe(5);
  });

  it('시트에 적은 코드 그대로 통한다(짧아도, 한글·숫자만이어도, 앞뒤 공백·대소문자 상관없이)', () => {
    const w = makeWorld({
      members: [
        { name: '짧은코드', code: 'short123' },
        { name: '한글', code: '현농2026' },
        { name: '숫자', code: 20261014 },
        { name: '대문자', code: 'KingoTeam' }
      ]
    });
    expect(w.call({ action: 'list', code: 'short123' }).me).toEqual({ name: '짧은코드' });
    expect(w.call({ action: 'list', code: ' 현농2026 ' }).me).toEqual({ name: '한글' });
    expect(w.call({ action: 'list', code: '20261014' }).me).toEqual({ name: '숫자' });
    expect(w.call({ action: 'list', code: 'kingoteam' }).me).toEqual({ name: '대문자' });
    expect(w.call({ action: 'list', code: 'short12' }).error).toBe('bad_code');
    expect(w.call({ action: 'list', code: '' }).error).toBe('bad_code');
  });

  it('JSON이 아닌 본문은 거절한다', () => {
    expect(world().call('not json').ok).toBe(false);
  });

  it('맞는 코드는 틀린 요청이 많아도 통과한다', () => {
    const w = world();
    for (let i = 0; i < 20; i++) w.call({ action: 'list', code: 'x'.repeat(14) + i });
    expect(w.call({ action: 'list', code: CODE_1 }).ok).toBe(true);
  });
});

describe('list', () => {
  it('지운 줄과 13개월보다 오래된 줄은 보내지 않는다', () => {
    const res = world().call({ action: 'list', code: CODE_1 });
    expect(res.ok).toBe(true);
    expect(res.rows.map((r) => r.id).sort()).toEqual(['a1', 'a2']);
  });

  it('다음 번호는 지운 줄을 세지 않고, 가운데 빈 번호부터 채운다 (2026-10-30 사용자 결정)', () => {
    const res = world().call({ action: 'list', code: CODE_1 });
    expect(res.noMax[`바이어 A|${S}`]).toBe(2); // 지운 5는 세지 않는다
    expect(res.noFree[`바이어 A|${S}`]).toBe(3);
    expect(res.noMax[`바이어 A|${Y - 2}`]).toBe(1);
    // 1·3이 남고 2를 지웠으면 다음은 2(가운데부터 채움), 그다음은 4
    const w = world();
    w.call({ action: 'save', code: CODE_1, items: [{ id: 'a2', no: '3', changes: {} }] });
    const add = () => w.call({ action: 'save', code: CODE_1, items: [{ changes: { buyer: '바이어 A', fruit: '신고배', ship: '40ft', specKo: '5kg 7과', eta: iso(daysFromNow(15)) } }] }).saved[0].no;
    expect(w.call({ action: 'list', code: CODE_1 }).noFree[`바이어 A|${sy(daysFromNow(15))}`]).toBe(sy(daysFromNow(15)) === S ? 2 : 1);
    if (sy(daysFromNow(15)) === S) {
      expect(add()).toBe(2);
      expect(add()).toBe(4);
    }
  });

  it('스펙 영어와 회사는 비어 있으면 사전과 바이어 탭에서 채운다', () => {
    const a1 = world().call({ action: 'list', code: CODE_1 }).rows.find((r) => r.id === 'a1');
    expect(a1.specEn).toBe('5kg, Size 7');
    expect(a1.exporter).toBe('Hyun Nong Fresh');
    expect(a1.eta).toBe(iso(daysFromNow(10)));
  });

  it('스펙 영어는 스펙 탭이 기준이다(시트에서 사전을 고치면 줄에 저장된 영어보다 앞선다)', () => {
    const w = world();
    w.sheet('schedule').data[1][w.ctx.COLUMNS.schedule.findIndex((c) => c[0] === 'specEn')] = '옛 영어';
    w.sheet('specs').data[1][2] = '5kg, 7 pcs';
    const a1 = w.call({ action: 'list', code: CODE_1 }).rows.find((r) => r.id === 'a1');
    expect(a1.specEn).toBe('5kg, 7 pcs');
  });

  it('사전에도 줄에도 영어가 없으면: 한글 없는 스펙은 적힌 그대로, /로 이은 스펙은 조각마다 사전에서', () => {
    const w = world();
    const col = (f) => w.ctx.COLUMNS.schedule.findIndex((c) => c[0] === f);
    const set = (row, spec) => { w.sheet('schedule').data[row][col('specKo')] = spec; w.sheet('schedule').data[row][col('specEn')] = ''; };
    set(2, '4kg/450g');
    const list1 = w.call({ action: 'list', code: CODE_1 }).rows;
    expect(list1.find((r) => r.id === 'a2').specEn).toBe('4kg/450g');
    w.sheet('schedule').data[1][col('specKo')] = '5kg 7과/15kg';
    expect(w.call({ action: 'list', code: CODE_1 }).rows.find((r) => r.id === 'a1').specEn).toBe('5kg, Size 7/15kg');
    w.sheet('schedule').data[1][col('specKo')] = '5kg 7과/4송이';
    expect(w.call({ action: 'list', code: CODE_1 }).rows.find((r) => r.id === 'a1').specEn).toBe('');
  });

  it('스펙을 바꾸면서 영어를 안 보내면 줄의 옛 영어를 지우고, 스펙 탭에 옛 영어를 더하지 않는다', () => {
    const w = world();
    const col = (f) => w.ctx.COLUMNS.schedule.findIndex((c) => c[0] === f);
    w.sheet('schedule').data[2][col('specEn')] = '10kg box';
    const res = w.call({ action: 'save', code: CODE_1, items: [{ id: 'a2', changes: { specKo: '15kg' } }] });
    expect(res.ok).toBe(true);
    expect(w.read('schedule').find((r) => r.id === 'a2').specEn).toBe('');
    expect(w.read('specs').some((s) => s.specEn === '10kg box')).toBe(false);
    expect(w.call({ action: 'list', code: CODE_1 }).rows.find((r) => r.id === 'a2').specEn).toBe('15kg');
  });

  it('스펙을 바꾸며 영어를 보내면 그 영어를 쓴다', () => {
    const w = world();
    w.call({ action: 'save', code: CODE_1, items: [{ id: 'a2', changes: { specKo: '15kg', specEn: '15kg box' } }] });
    expect(w.read('schedule').find((r) => r.id === 'a2').specEn).toBe('15kg box');
    expect(w.read('specs').find((s) => s.fruitKo === '단감' && s.specKo === '15kg').specEn).toBe('15kg box');
  });

  it('사전에 없는 스펙은 줄에 적힌 영어를 쓴다', () => {
    const w = world();
    w.sheet('schedule').data[2][w.ctx.COLUMNS.schedule.findIndex((c) => c[0] === 'specEn')] = '10kg';
    const a2 = w.call({ action: 'list', code: CODE_1 }).rows.find((r) => r.id === 'a2');
    expect(a2.specEn).toBe('10kg');
  });

  it('코드가 맞으면 누구나 가격과 시트 주소를 받는다(가격 보기 구분 없음)', () => {
    for (const code of [CODE_1, CODE_2]) {
      const res = world().call({ action: 'list', code });
      const a1 = res.rows.find((r) => r.id === 'a1');
      expect(a1.price).toBe(13.8);
      expect(a1.cost).toBe(15500);
      expect(a1.workCost).toBe(1800);
      expect(res.sheetUrl).toContain('docs.google.com');
    }
    expect(world().call({ action: 'list', code: CODE_2 }).me).toEqual({ name: '박바이어' });
  });

  it('시트에서 복사해 붙인 줄(id 겹침·빈 No.)은 id와 No.를 새로 채운다 (규칙 5)', () => {
    const w = world();
    w.sheet('schedule').data.push(
      // a1을 그대로 복사한 줄: id 겹침, No. 있음 → id만 새로
      w.ctx.COLUMNS.schedule.map((c) => ({ id: 'a1', buyer: '바이어 A', no: 1, noYear: S, fruit: '신고배', specKo: '5kg 7과', eta: daysFromNow(10) })[c[0]] ?? ''),
      // id와 No.를 비우고 붙인 줄 → 둘 다 새로
      w.ctx.COLUMNS.schedule.map((c) => ({ buyer: '바이어 B', fruit: '단감', specKo: '10kg', eta: daysFromNow(40) })[c[0]] ?? '')
    );
    const res = w.call({ action: 'list', code: CODE_1 });
    const ids = res.rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(Boolean)).toBe(true);
    const copied = res.rows.filter((r) => r.buyer === '바이어 A' && r.no === 1 && r.noYear === Y);
    expect(copied).toHaveLength(2);
    const pasted = res.rows.find((r) => r.buyer === '바이어 B');
    expect(pasted.no).toBe(1);
    expect(pasted.noYear).toBe(sy(daysFromNow(40)));
  });
});

describe('save', () => {
  it('새 줄은 지운 번호를 다시 쓴다(지운 줄은 세지 않음, 2026-10-30 사용자 결정)', () => {
    const w = world();
    const res = w.call({ action: 'save', code: CODE_1, items: [{ key: 'k1', changes: {
      buyer: '바이어 A', fruit: '신고배', ship: '40ft', specKo: '5kg 7과', specEn: '5kg, Size 7', eta: iso(daysFromNow(50)), price: 14, cost: 16000, workCost: 1800
    } }] });
    expect(res.ok).toBe(true);
    const yr = sy(daysFromNow(50));
    expect(res.saved[0]).toMatchObject({ key: 'k1', no: yr === S ? 3 : 1, noYear: yr });
    const row = w.read('schedule').find((r) => r.id === res.saved[0].id);
    expect(row.updatedBy).toBe('김산지');
    expect(row.deleted).toBe(false);
  });

  it('번호는 시즌마다: 다음 해 1~6월 ETA는 이번 시즌 번호를 이어 가고, 7월 1일 ETA부터 1번 (2026-10-30 사용자 결정)', () => {
    const w = world();
    const item = (eta) => ({ changes: { buyer: '바이어 A', fruit: '신고배', ship: '40ft', specKo: '5kg 7과', eta } });
    const jun = w.call({ action: 'save', code: CODE_1, items: [item(`${S + 1}-06-30`)] });
    expect(jun.saved[0]).toMatchObject({ no: 3, noYear: S }); // 지운 5는 세지 않는다(1·2 다음)
    const jul = w.call({ action: 'save', code: CODE_1, items: [item(`${S + 1}-07-01`)] });
    expect(jul.saved[0]).toMatchObject({ no: 1, noYear: S + 1 });
  });

  it('ETA가 해를 넘어가도 No.와 noYear는 그대로', () => {
    const w = world();
    const res = w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { eta: `${S + 1}-07-08` } }] });
    expect(res.saved[0]).toMatchObject({ id: 'a1', no: 1, noYear: S });
    const row = w.read('schedule').find((r) => r.id === 'a1');
    expect(row.no).toBe(1);
    expect(row.noYear).toBe(S);
  });

  it('바이어를 바꾼 줄만 새 No.를 받는다', () => {
    const w = world();
    const res = w.call({ action: 'save', code: CODE_1, items: [{ id: 'a2', changes: { buyer: '바이어 B' } }] });
    expect(res.saved[0]).toMatchObject({ no: 1 });
    expect(w.read('schedule').find((r) => r.id === 'a1').no).toBe(1);
  });

  it('같은 컨테이너에 더하면 같은 No.', () => {
    const w = world();
    const res = w.call({ action: 'save', code: CODE_1, items: [{ join: { no: 1, noYear: S }, changes: {
      buyer: '바이어 A', fruit: '신고배', ship: '40ft', specKo: '15kg 18-24', specEn: '15kg, 18-24', eta: iso(daysFromNow(10)), cost: 28000, workCost: 12000
    } }] });
    expect(res.saved[0]).toMatchObject({ no: 1, noYear: S });
  });

  it('없는 컨테이너(지운 No. 포함)에는 더할 수 없다', () => {
    const res = world().call({ action: 'save', code: CODE_1, items: [{ join: { no: 5, noYear: S }, changes: { buyer: '바이어 A' } }] });
    expect(res.ok).toBe(false);
  });

  it('바뀐 칸만 쓴다 (규칙 4)', () => {
    const w = world();
    const sh = w.sheet('schedule');
    sh.cellWrites = [];
    w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: {
      buyer: '바이어 A', fruit: '신고배', ship: '40ft', specKo: '5kg 7과', eta: iso(daysFromNow(10)), price: 13.8, cost: 16000
    } }] });
    const cols = w.ctx.COLUMNS.schedule.map((c) => c[0]);
    const written = sh.cellWrites.map(([, c]) => cols[c - 1]).sort();
    expect(written).toEqual(['cost', 'updatedAt', 'updatedBy']);
  });

  it('같은 값만 보내면 아무것도 쓰지 않는다', () => {
    const w = world();
    const sh = w.sheet('schedule');
    sh.cellWrites = [];
    const res = w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { ship: '40ft', price: '13.80' } }] });
    expect(res.saved[0].changed).toBe(0);
    expect(sh.cellWrites).toHaveLength(0);
  });

  it('두 사람이 같은 줄의 다른 칸을 고치면 둘 다 남는다', () => {
    const w = world();
    w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { cost: 16500 } }] });
    w.call({ action: 'save', code: CODE_2, items: [{ id: 'a1', changes: { eta: iso(daysFromNow(12)) } }] });
    const row = w.read('schedule').find((r) => r.id === 'a1');
    expect(row.cost).toBe(16500);
    expect(iso(row.eta)).toBe(iso(daysFromNow(12)));
    expect(row.updatedBy).toBe('박바이어');
  });

  it('누구나 모든 칸을 고친다(역할·가격 보기 구분 없음)', () => {
    const w = world();
    w.call({ action: 'save', code: CODE_2, items: [{ id: 'a1', changes: { price: 14, cost: 16000, workCost: 1900, memo: '바뀜' } }] });
    const row = w.read('schedule').find((r) => r.id === 'a1');
    expect([row.price, row.cost, row.workCost, row.memo]).toEqual([14, 16000, 1900, '바뀜']);
  });

  it('시트에 가격을 여럿 적으면(17.3/17.8) 적힌 글자 그대로 보낸다', () => {
    const w = world();
    const col = (f) => w.ctx.COLUMNS.schedule.findIndex((c) => c[0] === f);
    const a1 = w.sheet('schedule').data[1];
    a1[col('price')] = '17.3/17.8';
    a1[col('cost')] = '23000/22000/21000';
    a1[col('workCost')] = '₩1,800';
    const r = w.call({ action: 'list', code: CODE_1 }).rows.find((x) => x.id === 'a1');
    expect([r.price, r.cost, r.workCost]).toEqual(['17.3/17.8', '23000/22000/21000', 1800]);
  });

  it("'17 18'처럼 빈칸으로 나눈 두 값을 1718로 읽지 않는다", () => {
    const w = world();
    w.sheet('schedule').data[1][w.ctx.COLUMNS.schedule.findIndex((c) => c[0] === 'price')] = '17 18';
    expect(w.call({ action: 'list', code: CODE_1 }).rows.find((x) => x.id === 'a1').price).toBe('17 18');
  });

  it('앱에서 가격을 여럿 넣으면 글자 그대로 저장하고, 같은 글자면 다시 쓰지 않는다', () => {
    const w = world();
    const res = w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { price: '17.3/17.8' } }] });
    expect(res.ok).toBe(true);
    expect(w.read('schedule').find((r) => r.id === 'a1').price).toBe('17.3/17.8');
    expect(w.call({ action: 'list', code: CODE_1 }).rows.find((x) => x.id === 'a1').price).toBe('17.3/17.8');

    const again = w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { price: '17.3/17.8' } }] });
    expect(again.saved[0].changed).toBe(0);
    const changed = w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { price: '17.3/17.9' } }] });
    expect(changed.saved[0].changed).toBe(1);
    expect(w.read('schedule').find((r) => r.id === 'a1').price).toBe('17.3/17.9');
  });

  it('새 줄도 여러 가격을 글자 그대로', () => {
    const w = world();
    const res = w.call({ action: 'save', code: CODE_1, items: [{ changes: {
      buyer: '바이어 B', fruit: '단감', ship: '40ft', specKo: '10kg', eta: iso(daysFromNow(15)), price: '15.2/15.5', cost: '17000/16500'
    } }] });
    expect(res.ok).toBe(true);
    const row = w.read('schedule').find((r) => r.id === res.saved[0].id);
    expect([row.price, row.cost]).toEqual(['15.2/15.5', '17000/16500']);
  });

  it('시트가 두 가격(12/13)을 날짜로 바꿔 둔 칸은 적은 모양으로 되돌린다', () => {
    const w = world();
    w.sheet('schedule').data[1][w.ctx.COLUMNS.schedule.findIndex((c) => c[0] === 'price')] = d('2026-12-13');
    expect(w.call({ action: 'list', code: CODE_1 }).rows.find((x) => x.id === 'a1').price).toBe('12/13');
  });

  it("'17.'과 '.5'는 숫자 하나", () => {
    const w = world();
    expect(w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { price: '17.' } }] }).ok).toBe(true);
    expect(w.read('schedule').find((r) => r.id === 'a1').price).toBe(17);
    w.sheet('schedule').data[1][w.ctx.COLUMNS.schedule.findIndex((c) => c[0] === 'cost')] = '.5';
    expect(w.call({ action: 'list', code: CODE_1 }).rows.find((x) => x.id === 'a1').cost).toBe(0.5);
  });

  it('숫자가 없는 금액은 거절한다', () => {
    const res = world().call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { price: '미정' } }] });
    expect(res.ok).toBe(false);
    expect(res.message).toContain('17.3/17.8');
  });

  it('금액을 지우면 빈칸이 된다', () => {
    const w = world();
    w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { workCost: '' } }] });
    expect(w.read('schedule').find((r) => r.id === 'a1').workCost).toBe('');
  });

  it('새 스펙 짝은 스펙 탭에 한 번만 더한다', () => {
    const w = world();
    const item = { changes: { buyer: '바이어 A', fruit: '신고배', ship: '40ft', specKo: '15kg 26-30', specEn: '15kg, 26-30', eta: iso(daysFromNow(10)) } };
    w.call({ action: 'save', code: CODE_1, items: [item, item] });
    const specs = w.read('specs').filter((r) => r.fruitKo);
    expect(specs.map((s) => s.specKo).sort()).toEqual(['15kg 26-30', '5kg 7과']);
  });

  it('앱에서 스펙 영어를 고치면 사전도 고친다(그 스펙의 모든 줄에 반영)', () => {
    const w = world();
    w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { specEn: '5kg, 7 pcs' } }] });
    const specs = w.read('specs').filter((r) => r.fruitKo);
    expect(specs).toHaveLength(1);
    expect(specs[0].specEn).toBe('5kg, 7 pcs');
  });

  it('스펙 영어를 보내지 않으면 사전은 그대로', () => {
    const w = world();
    w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { cost: 16000 } }] });
    expect(w.read('specs')[0].specEn).toBe('5kg, Size 7');
  });

  it('잘못된 값은 저장하지 않는다', () => {
    const w = world();
    const bad = [
      { buyer: '없는 바이어' },
      { buyer: '바이어 A', ship: '배' },
      { buyer: '바이어 A', status: '보류' },
      { buyer: '바이어 A', eta: '2026-02-30' },
      { buyer: '바이어 A', cost: '이만원' }
    ];
    for (const changes of bad) {
      expect(w.call({ action: 'save', code: CODE_1, items: [{ changes }] }).ok).toBe(false);
    }
    expect(w.read('schedule').filter((r) => r.id)).toHaveLength(4);
  });

  it('Air는 항공으로 맞춰 저장한다', () => {
    const w = world();
    w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { ship: 'Air' } }] });
    expect(w.read('schedule').find((r) => r.id === 'a1').ship).toBe('항공');
  });

  it('다른 사람이 지운 줄에 저장하면 거절하고 아무것도 쓰지 않는다', () => {
    const w = world();
    const sh = w.sheet('schedule');
    sh.cellWrites = [];
    const res = w.call({ action: 'save', code: CODE_1, items: [{ id: 'a5', changes: { cost: 99999, buyer: '바이어 B' } }] });
    expect(res.ok).toBe(false);
    expect(res.message).toContain('지웠어요');
    expect(sh.cellWrites).toHaveLength(0);
  });

  it('응답만 끊긴 새 줄을 같은 표시로 다시 보내면 줄이 하나만 생기고, 그사이 고친 값을 덮지 않는다 (2026-10-30 기다리지 않는 저장)', () => {
    const w = world();
    const item = { key: 'save-key-123', changes: { buyer: '바이어 A', fruit: '신고배', ship: '40ft', specKo: '5kg 7과', eta: iso(daysFromNow(40)), cost: 16000 } };
    const first = w.call({ action: 'save', code: CODE_1, items: [item] });
    // 그사이 다른 사람이 산지가를 고침
    w.call({ action: 'save', code: CODE_2, items: [{ id: first.saved[0].id, changes: { cost: 17000 } }] });
    const again = w.call({ action: 'save', code: CODE_1, items: [item] });
    expect(again.saved[0].id).toBe(first.saved[0].id);
    expect(again.saved[0].no).toBe(first.saved[0].no);
    const made = w.read('schedule').filter((r) => r.id === first.saved[0].id);
    expect(made).toHaveLength(1);
    expect(made[0].cost).toBe(17000);
    expect(w.read('schedule').filter((r) => r.id)).toHaveLength(5);
  });

  it('바이어·품목은 시트의 순서 칸대로 보낸다(빈 칸은 뒤에 시트 순서대로)', () => {
    const w = makeWorldWithOrder();
    const res = w.call({ action: 'list', code: CODE_1 });
    expect(res.buyers.map((b) => b.name)).toEqual(['바이어 C', '바이어 A', '바이어 B']);
  });

  it('회사 칸이 비었는지(바이어 기본 회사를 쓰는지) 알려 준다', () => {
    const w = world();
    w.call({ action: 'save', code: CODE_1, items: [{ id: 'a2', changes: { exporter: 'Royal' } }] });
    const rows = w.call({ action: 'list', code: CODE_1 }).rows;
    expect(rows.find((r) => r.id === 'a1')).toMatchObject({ exporter: 'Hyun Nong Fresh', exporterSet: false });
    expect(rows.find((r) => r.id === 'a2')).toMatchObject({ exporter: 'Royal', exporterSet: true });
  });
});

describe('시트에서 복사해 붙인 줄의 No. (규칙 5)', () => {
  function pasted(w, fields) {
    w.sheet('schedule').data.push(w.ctx.COLUMNS.schedule.map((c) => (fields[c[0]] === undefined ? '' : fields[c[0]])));
  }

  it('시트에서 5분 안에 고친 줄은 id만 주고 No.는 미룬다(ETA를 고치는 중일 수 있어서)', () => {
    const w = world();
    pasted(w, { buyer: '바이어 B', fruit: '단감', specKo: '10kg', eta: daysFromNow(5), updatedBy: '시트', updatedAt: new Date() });
    const row = w.call({ action: 'list', code: CODE_1 }).rows.find((r) => r.buyer === '바이어 B');
    expect(row.id).toBeTruthy();
    expect(row.no).toBe(null);
  });

  it('시간이 지나면 그때의 ETA 시즌으로 No.를 붙인다', () => {
    const w = world();
    pasted(w, { buyer: '바이어 B', fruit: '단감', specKo: '10kg', eta: d(`${S + 1}-07-12`), updatedBy: '시트', updatedAt: new Date(Date.now() - 6 * 60 * 1000) });
    const row = w.call({ action: 'list', code: CODE_1 }).rows.find((r) => r.buyer === '바이어 B');
    expect(row).toMatchObject({ no: 1, noYear: S + 1 });
  });

  it('No.만 적고 번호 해를 비운 줄도 그 컨테이너로 본다(ETA의 해)', () => {
    const w = world();
    pasted(w, { id: 'p1', buyer: '바이어 A', no: 1, fruit: '단감', specKo: '10kg', eta: daysFromNow(10), updatedBy: '시트', updatedAt: new Date() });
    const yr = sy(daysFromNow(10));
    const res = w.call({ action: 'save', code: CODE_1, items: [{ join: { no: 1, noYear: yr }, changes: {
      buyer: '바이어 A', fruit: '단감', ship: '40ft', specKo: '10kg', eta: iso(daysFromNow(10))
    } }] });
    expect(res.ok).toBe(true);
    expect(res.saved[0]).toMatchObject({ no: 1, noYear: yr });
  });

  it('No.가 빈 줄을 앱에서 고쳐도 그 자리에서 No.를 붙이지 않고, 5분 뒤 정리에서 그때의 ETA 해로 붙인다', () => {
    const w = world();
    pasted(w, { id: 'p2', buyer: '바이어 B', fruit: '단감', specKo: '10kg', eta: daysFromNow(5), updatedBy: '시트', updatedAt: new Date() });
    const res = w.call({ action: 'save', code: CODE_2, items: [{ id: 'p2', changes: { cost: 15000 } }] });
    expect(res.saved[0].no).toBe(null);
    const row = w.read('schedule').find((r) => r.id === 'p2');
    expect(row.no).toBe('');
    expect(row.updatedBy).toBe('박바이어');
    // 앱에서 고쳐도(수정자가 사람 이름이어도) 5분 안이면 아직 미룬다
    expect(w.call({ action: 'list', code: CODE_1 }).rows.find((r) => r.id === 'p2').no).toBe(null);
  });

  it('응답만 끊긴 새 줄을 다시 보내면 이미 만든 줄 그대로(번호·칸을 다시 바꾸지 않는다)', () => {
    const w = world();
    const changes = { buyer: '바이어 A', fruit: '신고배', ship: '40ft', specKo: '5kg 7과', eta: iso(daysFromNow(10)) };
    const first = w.call({ action: 'save', code: CODE_1, items: [{ key: 'retry-key-0001', changes }] });
    expect(first.saved[0].no).not.toBe(1);
    const again = w.call({ action: 'save', code: CODE_1, items: [{ key: 'retry-key-0001', join: { no: 1, noYear: S }, changes: { ...changes, memo: '' } }] });
    expect(again.saved[0]).toMatchObject({ id: first.saved[0].id, no: first.saved[0].no });
  });

  it('메뉴의 id·No. 정리는 기다리지 않고 바로 붙인다', () => {
    const w = world();
    pasted(w, { buyer: '바이어 B', fruit: '단감', specKo: '10kg', eta: daysFromNow(5), updatedBy: '시트', updatedAt: new Date() });
    expect(w.ctx.repairIfNeeded_(true)).toBe(1);
    const row = w.read('schedule').find((r) => r.buyer === '바이어 B');
    expect(row.no).toBe(1);
  });
});

describe('인보이스 번호 (규칙 5: KINGO-26-01 = 바이어-시즌-차수)', () => {
  const base = (eta) => ({ buyer: '바이어 A', fruit: '신고배', ship: '40ft', specKo: '5kg 7과', eta: iso(eta || daysFromNow(10)) });
  const save = (w, item) => w.call({ action: 'save', code: CODE_1, items: [item] });

  it('직접 쓴 번호로 저장하고, 다음 새 줄은 그다음 차수(자릿수 유지)', () => {
    const w = world();
    expect(save(w, { no: 'KINGO-26-01', changes: base() }).saved[0].no).toBe('KINGO-26-01');
    expect(w.call({ action: 'list', code: CODE_1 }).noNext['바이어 A']).toBe('KINGO-26-02');
    expect(save(w, { changes: base(daysFromNow(20)) }).saved[0].no).toBe('KINGO-26-02');
    expect(save(w, { changes: base(daysFromNow(30)) }).saved[0].no).toBe('KINGO-26-03');
  });

  it('시즌이 큰 번호를 쓰면 그다음부터는 그 시즌에서 이어간다', () => {
    const w = world();
    save(w, { no: 'KINGO-26-09', changes: base() });
    save(w, { no: 'KINGO-27-01', changes: base(daysFromNow(40)) });
    save(w, { no: 'KINGO-26-10', changes: base(daysFromNow(15)) }); // 늦게 넣은 26시즌 건
    expect(save(w, { changes: base(daysFromNow(50)) }).saved[0].no).toBe('KINGO-27-02');
  });

  it('이미 있는 번호를 쓰면 그 선적(같은 컨테이너)에 줄을 더한다', () => {
    const w = world();
    const first = save(w, { no: 'KINGO-26-01', changes: base() }).saved[0];
    const second = save(w, { no: 'KINGO-26-01', changes: { ...base(), specKo: '15kg 18-24', specEn: '15kg, 18-24' } }).saved[0];
    expect(second).toMatchObject({ no: 'KINGO-26-01', noYear: first.noYear });
    expect(w.call({ action: 'list', code: CODE_1 }).noNext['바이어 A']).toBe('KINGO-26-02');
  });

  it('고치기에서 없는 번호로 바꾸면 이 줄만 바뀌고, 같은 번호의 다른 줄은 그대로 (2026-10-19)', () => {
    const w = world();
    const a = save(w, { no: 'KINGO-26-01', changes: base() }).saved[0];
    const b = save(w, { no: 'KINGO-26-01', changes: { ...base(), specKo: '15kg 18-24', specEn: '15kg, 18-24' } }).saved[0];
    const res = w.call({ action: 'save', code: CODE_2, items: [{ id: a.id, no: 'KINGO-26-11', changes: {} }] });
    expect(res.ok).toBe(true);
    const rows = w.read('schedule');
    expect(rows.find((r) => r.id === a.id).no).toBe('KINGO-26-11');
    expect(rows.find((r) => r.id === b.id).no).toBe('KINGO-26-01');
  });

  it('숫자 번호는 그 해 선적만: 2024년 No. 3이 있어도 2026년에 친 3은 2026년 새 선적 (2026-10-19 검토)', () => {
    const w = makeWorld({
      members: [{ name: '김산지', code: CODE_1 }],
      buyers: [{ name: '바이어 B', nameEn: 'Buyer B' }],
      fruits: [{ fruitKo: '신고배', fruitEn: 'Singo pear' }],
      schedule: [
        { id: 'old3', buyer: '바이어 B', no: 3, noYear: 2024, fruit: '신고배', specKo: '5kg', eta: d('2024-11-01'), deleted: false },
        { id: 'old5', buyer: '바이어 B', no: 5, noYear: 2024, fruit: '신고배', specKo: '5kg', eta: d('2024-12-01'), deleted: false },
        { id: 'r2', buyer: '바이어 B', no: 2, noYear: 2026, fruit: '신고배', specKo: '5kg', eta: d('2026-11-02'), deleted: false }
      ]
    });
    const res = w.call({ action: 'save', code: CODE_1, items: [{ no: '3', changes: { buyer: '바이어 B', fruit: '신고배', specKo: '15kg', eta: '2026-11-20' } }] });
    expect(res.saved[0]).toMatchObject({ no: 3, noYear: 2026 });
    const ed = w.call({ action: 'save', code: CODE_1, items: [{ id: 'r2', no: '5', changes: {} }] });
    expect(ed.saved[0]).toMatchObject({ no: 5, noYear: 2026 });
    expect(w.read('schedule').find((r) => r.id === 'old5').no).toBe(5);
  });

  it('숫자 번호: 10으로 저장한 두 줄 중 하나를 11로 고쳐도 먼저 저장한 줄은 10 그대로 (2026-10-19 사용자 신고)', () => {
    const w = world();
    const base2 = { ...base(), specKo: '5kg 7과' };
    const a = save(w, { no: '10', changes: base2 }).saved[0];
    const b = save(w, { no: '10', changes: { ...base2, specKo: '15kg 18-24', specEn: '15kg, 18-24' } }).saved[0];
    expect(w.call({ action: 'save', code: CODE_1, items: [{ id: b.id, no: '11', changes: {} }] }).ok).toBe(true);
    const rows = w.read('schedule');
    expect(rows.find((r) => r.id === a.id).no).toBe(10);
    expect(rows.find((r) => r.id === b.id).no).toBe(11);
    // 다른 칸을 고쳐도 번호는 그대로
    expect(w.call({ action: 'save', code: CODE_1, items: [{ id: a.id, changes: { price: 20 } }] }).ok).toBe(true);
    expect(w.read('schedule').find((r) => r.id === a.id).no).toBe(10);
  });

  it('고치기에서 이미 있는 번호로 바꾸면 이 줄만 그 선적으로 옮긴다', () => {
    const w = world();
    const a = save(w, { no: 'KINGO-26-01', changes: base() }).saved[0];
    const b = save(w, { no: 'KINGO-26-01', changes: { ...base(), specKo: '15kg 18-24', specEn: '15kg, 18-24' } }).saved[0];
    save(w, { no: 'KINGO-26-02', changes: base(daysFromNow(20)) });
    w.call({ action: 'save', code: CODE_1, items: [{ id: b.id, no: 'KINGO-26-02', changes: {} }] });
    const rows = w.read('schedule');
    expect(rows.find((r) => r.id === a.id).no).toBe('KINGO-26-01');
    expect(rows.find((r) => r.id === b.id).no).toBe('KINGO-26-02');
  });

  it('바이어를 바꾸며 번호를 쓰면 새 바이어의 그 번호로', () => {
    const w = world();
    const res = w.call({ action: 'save', code: CODE_1, items: [{ id: 'a2', no: 'ROYAL-26-07', changes: { buyer: '바이어 B' } }] });
    expect(res.saved[0].no).toBe('ROYAL-26-07');
    expect(w.read('schedule').find((r) => r.id === 'a2')).toMatchObject({ buyer: '바이어 B', no: 'ROYAL-26-07' });
  });

  it('번호가 너무 길거나 | 가 있으면 저장하지 않는다', () => {
    const w = world();
    expect(save(w, { no: 'A|B', changes: base() }).ok).toBe(false);
    expect(save(w, { no: 'X'.repeat(41), changes: base() }).ok).toBe(false);
  });

  it("'9-1', '#9' 같은 번호를 한 번 써도 그 바이어의 다음 번호는 숫자 그대로 (2026-10-30 점검)", () => {
    const w = world();
    const odd = save(w, { no: '9-1', changes: base() }).saved[0];
    expect(odd.no).toBe('9-1');
    save(w, { no: '#9', changes: base() });
    expect(w.call({ action: 'list', code: CODE_1 }).noNext['바이어 A']).toBeUndefined();
    expect(save(w, { changes: base() }).saved[0].no).toBe(3); // 숫자 1·2 다음(지운 5는 세지 않음)
  });

  it('잘못 쓰고 지운 인보이스 번호는 번호 줄기를 바꾸지 않는다', () => {
    const w = world();
    const typo = save(w, { no: 'hw-26-02', changes: base() }).saved[0];
    w.call({ action: 'remove', code: CODE_1, ids: [typo.id] });
    expect(w.call({ action: 'list', code: CODE_1 }).noNext['바이어 A']).toBeUndefined();
    expect(save(w, { changes: base() }).saved[0].no).toBe(3);
    // 인보이스 줄기 안에서도 지운 차수는 다시 쓴다(차례대로)
    save(w, { no: 'KINGO-26-01', changes: base() });
    const k2 = save(w, { changes: base() }).saved[0];
    expect(k2.no).toBe('KINGO-26-02');
    w.call({ action: 'remove', code: CODE_1, ids: [k2.id] });
    expect(save(w, { changes: base() }).saved[0].no).toBe('KINGO-26-02');
  });

  it("'KINGO-26-05-1'처럼 덩어리가 더 붙은 번호는 번호 줄기를 가로채지 않고, 0번은 받지 않는다 (2026-10-30 검토)", () => {
    const w = world();
    save(w, { no: 'KINGO-26-05', changes: base() });
    save(w, { no: 'KINGO-26-05-1', changes: base() });
    expect(w.call({ action: 'list', code: CODE_1 }).noNext['바이어 A']).toBe('KINGO-26-06');
    expect(save(w, { no: '00', changes: base() }).ok).toBe(false);
    expect(save(w, { no: 'kingo-26-05', changes: base() }).saved[0].no).toBe('KINGO-26-05');
    const long = save(w, { no: '12345678901234567890', changes: base() }).saved[0];
    expect(String(long.no)).toBe('12345678901234567890');
  });

  it("앞에 0을 붙인 '08'은 8과 같은 번호(같은 선적에 붙는다) (2026-10-30 점검)", () => {
    const w = world();
    const r = save(w, { no: '02', changes: base() }).saved[0];
    expect(r).toMatchObject({ no: 2, noYear: S });
    const ed = w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', no: '０２', changes: {} }] });
    expect(ed.saved[0]).toMatchObject({ no: 2, noYear: S });
  });

  it('숫자 번호만 쓰던 바이어는 지금처럼 해마다 최댓값 + 1', () => {
    const w = world();
    expect(save(w, { changes: { ...base(), buyer: '바이어 B' } }).saved[0].no).toBe(1);
    expect(w.call({ action: 'list', code: CODE_1 }).noNext['바이어 B']).toBeUndefined();
  });
});

describe('저장 결과에 새 목록 붙이기(withList, 2026-10-30 빠른 저장)', () => {
  it('같은 저장 표시로 다시 보낸 새 줄은 캐시가 비어도(시간이 지나도) 두 번 생기지 않는다', () => {
    const w = world();
    const changes = { buyer: '바이어 A', fruit: '단감', ship: '40ft', specKo: '10kg', eta: iso(daysFromNow(12)) };
    const first = w.call({ action: 'save', code: CODE_1, items: [{ key: 'durable-key-0001', changes }] });
    const before = w.read('schedule').length;
    w.cacheMap.clear(); // 캐시가 비워진 뒤(6시간 지남)
    const again = w.call({ action: 'save', code: CODE_1, items: [{ key: 'durable-key-0001', changes }] });
    expect(again.saved[0].id).toBe(first.saved[0].id);
    expect(w.read('schedule').length).toBe(before);
  });

  it('withList면 저장·지우기 응답에 새 목록이 붙고, 없으면 붙지 않는다', () => {
    const w = world();
    const plain = w.call({ action: 'save', code: CODE_1, items: [{ id: 'a1', changes: { price: 21 } }] });
    expect(plain.list).toBeUndefined();
    const res = w.call({ action: 'save', code: CODE_1, withList: true, items: [{ id: 'a1', changes: { price: 22 } }] });
    expect(res.ok).toBe(true);
    expect(res.list.ok).toBe(true);
    expect(res.list.rows.find((r) => r.id === 'a1').price).toBe(22);
    const rm = w.call({ action: 'remove', code: CODE_1, withList: true, ids: ['a2'] });
    expect(rm.list.rows.some((r) => r.id === 'a2')).toBe(false);
    // 실패한 저장에는 목록을 붙이지 않는다
    const bad = w.call({ action: 'save', code: CODE_1, withList: true, items: [{ id: 'nope', changes: { price: 1 } }] });
    expect(bad.ok).toBe(false);
    expect(bad.list).toBeUndefined();
  });
});

describe('바이어 더하기·고치기 (2026-10-19)', () => {
  const add = (w, buyer, original) => w.call({ action: 'saveBuyer', code: CODE_1, buyer, original });

  it('새 바이어는 바이어 탭 맨 뒤 순서로 더하고, 바로 목록에 나온다', () => {
    const w = makeWorldWithOrder();
    const res = add(w, { name: ' 새 바이어 ', nameEn: 'New Buyer', country: '대만', currency: 'usd', exporter: 'Royal' });
    expect(res).toMatchObject({ ok: true, name: '새 바이어', added: true });
    const row = w.read('buyers').find((b) => b.name === '새 바이어');
    expect(row).toMatchObject({ nameEn: 'New Buyer', country: '대만', currency: 'USD', priceTerm: '', exporter: 'Royal', priceUnit: 'carton', sortOrder: 3 });
    const list = w.call({ action: 'list', code: CODE_1 });
    expect(list.buyers.map((b) => b.name)).toContain('새 바이어');
  });

  it('이미 있는 이름(숨긴 바이어 포함, 대소문자·빈칸 무시)은 막는다', () => {
    const w = makeWorld({
      members: [{ name: '김산지', code: CODE_1 }],
      buyers: [{ name: 'Kingo' }, { name: '옛 바이어', archived: true }]
    });
    expect(add(w, { name: 'kingo' })).toMatchObject({ ok: false });
    const hidden = add(w, { name: '옛  바이어' });
    expect(hidden.ok).toBe(false);
    expect(hidden.message).toContain('숨겨져');
    expect(w.read('buyers').filter((b) => b.name).length).toBe(2);
  });

  it('이름·통화가 틀리면 거절한다', () => {
    const w = makeWorldWithOrder();
    expect(add(w, { name: '' }).ok).toBe(false);
    expect(add(w, { name: 'A|B' }).ok).toBe(false);
    expect(add(w, { name: '새', currency: '달러' }).ok).toBe(false);
  });

  it('고치면 바뀐 칸만 쓰고, 이름을 바꾸면 그 바이어 스케줄 줄(지운 줄 포함)도 새 이름으로', () => {
    const w = world();
    w.sheet('buyers').data[1][w.ctx.COLUMNS.buyers.findIndex((c) => c[0] === 'priceTerm')] = 'CIF';
    const res = add(w, { name: '바이어 에이', nameEn: 'Buyer A', currency: 'USD', exporter: 'Hyun Nong Fresh' }, '바이어 A');
    expect(res).toMatchObject({ ok: true, added: false, renamed: 4 });
    const buyers = w.read('buyers').filter((b) => b.name);
    expect(buyers.map((b) => b.name)).toEqual(['바이어 에이', '바이어 B']);
    expect(buyers[0].priceTerm).toBe('CIF'); // 앱은 가격 조건을 건드리지 않는다(시트 값 그대로)
    const rows = w.read('schedule').filter((r) => r.id);
    expect(rows.filter((r) => r.buyer === '바이어 A')).toHaveLength(0);
    expect(rows.filter((r) => r.buyer === '바이어 에이')).toHaveLength(4);
    const list = w.call({ action: 'list', code: CODE_1 });
    expect(list.rows.filter((r) => r.buyer === '바이어 에이').map((r) => r.id).sort()).toEqual(['a1', 'a2']);
  });

  it('없는 바이어를 고치려 하면 거절한다', () => {
    const res = add(world(), { name: '아무개' }, '없는 바이어');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('찾지 못했어요');
  });

  it('다른 바이어 이름으로는 바꿀 수 없다', () => {
    const res = add(world(), { name: '바이어 B' }, '바이어 A');
    expect(res.ok).toBe(false);
  });
});

describe('remove', () => {
  it('행을 지우지 않고 삭제 칸에 표시만 한다 (규칙 4)', () => {
    const w = world();
    const before = w.read('schedule').length;
    const res = w.call({ action: 'remove', code: CODE_1, ids: ['a2'] });
    expect(res).toEqual({ ok: true, removed: 1 });
    const rows = w.read('schedule');
    expect(rows).toHaveLength(before);
    expect(rows.find((r) => r.id === 'a2').deleted).toBe(true);
    expect(w.call({ action: 'list', code: CODE_1 }).rows.map((r) => r.id)).toEqual(['a1']);
  });
});

describe('prices', () => {
  it('틀린 코드는 거절한다', () => {
    expect(world().call({ action: 'prices', code: 'nope-nope-nope-1', fruit: '신고배' })).toEqual({ ok: false, error: 'bad_code' });
  });

  it('지난 시즌까지 그 과일의 모든 줄을 보낸다(지운 줄 빼고)', () => {
    const res = world().call({ action: 'prices', code: CODE_1, fruit: '신고배' });
    expect(res.ok).toBe(true);
    expect(res.rows.map((r) => r.id).sort()).toEqual(['a1', 'old']);
    expect(res.rows.find((r) => r.id === 'old')).toMatchObject({ price: 12.5, cost: 14000, workCost: 1600 });
  });

  it('단가 흐름 그래프에는 숫자 하나인 가격만(여러 값은 null)', () => {
    const w = world();
    w.sheet('schedule').data[1][w.ctx.COLUMNS.schedule.findIndex((c) => c[0] === 'price')] = '17.3/17.8';
    const res = w.call({ action: 'prices', code: CODE_1, fruit: '신고배' });
    expect(res.rows.find((r) => r.id === 'a1').price).toBe(null);
  });
});

describe('접속 코드 만들기 (규칙 3)', () => {
  it('16자 무작위, 헷갈리는 글자 없음, 매번 다름', () => {
    const w = world();
    const codes = Array.from({ length: 50 }, () => w.ctx.makeCode_(16));
    for (const c of codes) {
      expect(c).toMatch(/^[a-hjkmnp-z2-9]{16}$/);
    }
    expect(new Set(codes).size).toBe(50);
  });
});
