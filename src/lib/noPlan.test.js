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
    expect(planNo(base({ touched: true, typed: '3', etaYear: 2026 })).payload).toEqual({ join: { no: 3, noYear: 2026 } });
    expect(planNo(base({ touched: true, typed: '3', etaYear: 2027 })).payload).toEqual({ no: '3' });
    expect(planNo(base({ touched: true, typed: '9' })).payload).toEqual({ no: '9' });
  });

  it('인보이스 번호는 해와 상관없이 같은 번호의 선적에 붙는다', () => {
    const inv = [row('k1', 'KINGO-26-01', 2026, '2026-12-20'), row('k2', 'KINGO-26-01', 2027, '2027-01-10')];
    const p = planNo(base({ rows: inv, containers: containersOf(inv, 'B', today), touched: true, typed: 'KINGO-26-01', etaYear: 2027 }));
    expect(p.payload.join.no).toBe('KINGO-26-01');
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
