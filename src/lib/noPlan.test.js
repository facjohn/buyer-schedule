// No. 판단(2026-10-19 사용자 신고 "저장했던 No.가 자꾸 바뀌어"와 검토에서 나온 경우)
import { describe, it, expect } from 'vitest';
import { planNo } from './noPlan.js';
import { containersOf } from './schedule.js';

const today = '2026-10-19';
const row = (id, no, noYear, eta, extra = {}) => ({ id, buyer: 'B', no, noYear, eta, fruit: '배', specKo: '15kg', ...extra });
const rows = [
  row('p3', 3, 2025, '2025-12-09'),
  row('r1', 1, 2026, '2026-10-23'),
  row('r2', 2, 2026, '2026-11-02'),
  row('r3', 3, 2026, '2026-11-20')
];
const base = (over) => ({
  mode: 'new', asNext: false, touched: false, typed: '', src: null, buyer: 'B',
  containers: containersOf(rows, 'B', today), sugg: '4', etaYear: 2026, rows, ...over
});

describe('새 줄', () => {
  it('번호를 안 치면 보내지 않는다(창구가 저장할 때 다음 번호), 화면엔 지금의 다음 번호', () => {
    const p = planNo(base({ sugg: '4' }));
    expect(p.payload).toEqual({});
    expect(p.shown).toBe('4');
  });

  it('내년 ETA에 미리 채운 1은 올해 No. 1 선적에 붙지 않는다', () => {
    const p = planNo(base({ etaYear: 2027, sugg: '1' }));
    expect(p.payload).toEqual({});
  });

  it('열어 둔 사이 남이 그 번호를 써도(낡은 미리 채움) 남의 선적에 붙지 않는다', () => {
    const p = planNo(base({ sugg: '3' })); // 다음 번호가 3이었는데 그사이 3이 생긴 경우와 같다
    expect(p.payload).toEqual({});
  });

  it('직접 친 숫자 번호는 같은 해 선적에만 붙는다', () => {
    // 친 번호는 번호로 보낸다(창구가 그 선적이 있으면 거기에, 없어졌으면 새 번호로). 안내는 그 선적을 알려 준다
    const hit = planNo(base({ touched: true, typed: '3', etaYear: 2026 }));
    expect(hit.payload).toEqual({ no: '3' });
    expect(hit.match).toMatchObject({ no: 3, noYear: 2026 });
    expect(hit.hint).toContain('선적(');
    expect(planNo(base({ touched: true, typed: '3', etaYear: 2027 })).payload).toEqual({ no: '3' });
    expect(planNo(base({ touched: true, typed: '9' })).payload).toEqual({ no: '9' });
  });

  it('인보이스 번호는 해와 상관없이 같은 번호의 선적에 붙는다', () => {
    const inv = [row('k1', 'KINGO-26-01', 2026, '2026-12-20'), row('k2', 'KINGO-26-01', 2027, '2027-01-10')];
    const p = planNo(base({ rows: inv, containers: containersOf(inv, 'B', today), touched: true, typed: 'KINGO-26-01', etaYear: 2027 }));
    expect(p.payload).toEqual({ no: 'KINGO-26-01' });
    expect(p.match.no).toBe('KINGO-26-01');
  });
});

describe('같은 컨테이너에 사이즈 추가·다음 선적 복제', () => {
  it('사이즈 추가는 원래 줄의 선적(지난해 No. 3이면 지난해 3)에 붙는다', () => {
    const p = planNo(base({ mode: 'dup', src: rows[0] }));
    expect(p.payload).toEqual({ join: { no: 3, noYear: 2025 } });
    expect(p.shown).toBe('3');
  });

  it('다음 선적 복제는 번호를 안 치면 보내지 않는다', () => {
    expect(planNo(base({ mode: 'dup', asNext: true, src: rows[1] })).payload).toEqual({});
  });
});

describe('고치기', () => {
  it('번호를 안 건드리면 보내지 않는다(그사이 남이 바꾼 번호를 옛 번호로 되돌리지 않게)', () => {
    const live = { ...rows[2], no: 5 }; // 열었을 땐 2였는데 남이 5로 바꿈
    const p = planNo(base({ mode: 'edit', src: live }));
    expect(p.payload).toEqual({});
    expect(p.shown).toBe('5');
  });

  it('번호를 쳐서 바꾸면 이 줄만, 지금 번호와 같으면 보내지 않는다', () => {
    expect(planNo(base({ mode: 'edit', src: rows[2], touched: true, typed: '7' })).payload).toEqual({ no: '7' });
    expect(planNo(base({ mode: 'edit', src: rows[2], touched: true, typed: '2' })).payload).toEqual({});
  });

  it('바이어를 바꾸고 번호를 안 치면 새 바이어의 다음 번호(창구가)', () => {
    const p = planNo(base({ mode: 'edit', src: rows[2], buyer: 'C', containers: [] }));
    expect(p.payload).toEqual({});
    expect(p.hint).toContain('C의 다음 번호');
  });
});

describe('No. 점검 (2026-10-30 사용자 신고 "NO.를 수정하면 가끔 없던것도 뜨고")', () => {
  it("'08'·전각 '０８'은 8로 본다", async () => {
    const { normNo } = await import('./noPlan.js');
    expect(['08', '０８', ' 8 ', '0', '00', 'KINGO-26-01', '9-1', '012345678901234567890'].map(normNo))
      .toEqual(['8', '8', '8', '0', '0', 'KINGO-26-01', '9-1', '12345678901234567890']);
    expect(normNo('kingo-26-01')).toBe('KINGO-26-01');
    const p = planNo(base({ touched: true, typed: '02' }));
    expect(p.payload).toEqual({ no: '2' });
    expect(p.match).toMatchObject({ no: 2, noYear: 2026 });
  });

  it('고치기에서 이미 있는 번호를 치면 어느 선적인지 알리고, 두 줄 모두 그 번호로 보인다고 안내', () => {
    const p = planNo(base({ mode: 'edit', src: rows[3], touched: true, typed: '2' }));
    expect(p.payload).toEqual({ no: '2' });
    expect(p.merge).toMatchObject({ no: 2 });
    expect(p.hint).toContain('이미 있는 번호');
    expect(p.hint).toContain('두 줄 모두 No. 2');
  });

  it('고치기에서 번호를 지우면 흐린 글자는 지금 번호, 저장해도 번호는 그대로라고 안내', () => {
    const p = planNo(base({ mode: 'edit', src: rows[3], touched: true, typed: '' }));
    expect(p.payload).toEqual({});
    expect(p.placeholder).toBe('3');
    expect(p.hint).toContain('번호는 그대로');
    expect(planNo(base({ sugg: '4' })).placeholder).toBe('4');
  });

  it('가운데 빈 번호를 채울 때는 알린다(지운 번호를 다시 쓴다, 2026-10-30 사용자 결정)', () => {
    const gap = [row('g1', 1, 2026, '2026-10-23'), row('g3', 3, 2026, '2026-11-20')];
    const p = planNo(base({ rows: gap, containers: containersOf(gap, 'B', today), sugg: '2' }));
    expect(p.payload).toEqual({});
    expect(p.hint).toContain('비어 있는 2번을 채워요');
    expect(planNo(base({ sugg: '4' })).hint).not.toContain('비어 있는');
  });

  it('번호 고르기 목록: ETA 미정 선적도 앞으로 쪽(upcoming), 지난 선적은 upcoming 아님', () => {
    const list = containersOf([...rows, row('tb', 9, 2026, '')], 'B', today);
    expect(list.map((c) => [c.no, c.upcoming])).toEqual([[1, true], [2, true], [3, true], [9, true], [3, false]]);
  });
});
