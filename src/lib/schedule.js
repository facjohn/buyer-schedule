// 스케줄 줄을 고르고 묶고 세는 함수들. 화면은 이 함수들만 쓴다.
import { addDays, addMonths, fmtKoYear, fmtMonthKo } from './dates.js';

/** 번호 해. 시트에서 No.만 적고 번호 해를 비운 줄은 서버처럼 ETA의 해로 본다 */
export function noYearOf(r) {
  return r.noYear || (r.eta ? Number(r.eta.slice(0, 4)) : null);
}

export function shipmentKey(r) {
  return `${r.buyer}|${noYearOf(r)}|${r.no}`;
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** ETA 순(날짜 없는 줄은 뒤), 같은 날이면 No.·과일·스펙 순 */
export function sortRows(rows, { desc = false } = {}) {
  return rows.slice().sort((a, b) => {
    if (!a.eta !== !b.eta) return a.eta ? -1 : 1;
    const byEta = desc ? cmp(b.eta, a.eta) : cmp(a.eta, b.eta);
    return byEta || cmp(a.noYear || 0, b.noYear || 0) || cmp(a.no || 0, b.no || 0) ||
      cmp(a.fruit, b.fruit) || cmp(a.specKo, b.specKo);
  });
}

export const PERIODS = [
  { key: 'next2', label: '다음 2개월' },
  { key: 'future', label: '앞으로 전부' },
  { key: 'past', label: '지난 일정' }
];

/** 기간 버튼. 날짜 없는 줄은 '다음 2개월'과 '앞으로 전부'에 넣는다(놓치지 않게). */
export function filterPeriod(rows, period, today) {
  if (period === 'past') return sortRows(rows.filter((r) => r.eta && r.eta < today), { desc: true });
  const end = period === 'next2' ? addMonths(today, 2) : null;
  return sortRows(rows.filter((r) => !r.eta || (r.eta >= today && (!end || r.eta <= end))));
}

/** 월별 묶음. [{ key: '2026-10', label: '10월', rows }] (날짜 없는 줄은 맨 뒤 '날짜 없음') */
export function groupByMonth(rows, today) {
  const groups = [];
  const byKey = {};
  for (const r of rows) {
    const key = r.eta ? r.eta.slice(0, 7) : 'none';
    if (!byKey[key]) {
      byKey[key] = { key, label: key === 'none' ? '날짜 없음' : fmtMonthKo(key, today), rows: [] };
      groups.push(byKey[key]);
    }
    byKey[key].rows.push(r);
  }
  return groups.sort((a, b) => (a.key === 'none') - (b.key === 'none'));
}

function isUpcoming(r, today) {
  return !!r.eta && r.eta >= today;
}

/** 홈 숫자 세 칸(줄 수). 7일 안 ETA, 앞으로의 미정, 앞으로의 산지가 빈 줄 */
export function homeStats(rows, today) {
  const week = addDays(today, 7);
  const up = rows.filter((r) => isUpcoming(r, today));
  return {
    eta7: up.filter((r) => r.eta <= week),
    tbc: up.filter((r) => r.status !== '확정'),
    noCost: up.filter((r) => r.cost === null || r.cost === undefined)
  };
}

/**
 * 홈 바이어 카드. 바이어 탭 순서를 바탕으로, 다음 ETA가 가까운 바이어가 위, 일정 없는 바이어는 아래.
 * 바이어 탭에 없는데 스케줄에만 있는 이름도 카드로 보인다(시트에서 이름을 바꾼 경우 놓치지 않게).
 */
export function buyerCards(data) {
  const today = data.today;
  const byName = new Map();
  for (const b of data.buyers || []) {
    if (!b.archived) byName.set(b.name, { buyer: b, rows: [] });
  }
  for (const r of data.rows || []) {
    if (!isUpcoming(r, today)) continue;
    if (!byName.has(r.buyer)) byName.set(r.buyer, { buyer: { name: r.buyer }, rows: [] });
    byName.get(r.buyer).rows.push(r);
  }
  const cards = [...byName.values()].map(({ buyer, rows }, order) => {
    const sorted = sortRows(rows);
    const first = sorted[0];
    const nextRows = first ? sorted.filter((r) => shipmentKey(r) === shipmentKey(first)) : [];
    return {
      buyer,
      order,
      next: first ? {
        eta: first.eta,
        fruits: [...new Set(nextRows.map((r) => r.fruit))].join('·'),
        ship: first.ship
      } : null,
      shipments: new Set(rows.map(shipmentKey)).size,
      // 카드의 '미정'은 바로 옆에 적힌 다음 선적이 미정일 때만(시안 01과 같게)
      nextTbc: nextRows.some((r) => r.status !== '확정'),
      rowIds: new Set(rows.map((r) => r.id))
    };
  });
  return cards.sort((a, b) => {
    if (!a.next !== !b.next) return a.next ? -1 : 1;
    if (a.next && b.next && a.next.eta !== b.next.eta) return cmp(a.next.eta, b.next.eta);
    return a.order - b.order;
  });
}

/** 숫자만 쓰는 옛 번호의 예상값: 그 바이어·해의 최댓값(지운 번호 포함) + 1 */
export function expectedNo(noMax, buyer, year) {
  return ((noMax || {})[`${buyer}|${year}`] || 0) + 1;
}

/**
 * 새 스케줄에 미리 채울 No. 인보이스 번호를 쓰는 바이어는 마지막 번호 다음 차수(KINGO-26-02),
 * 아니면 숫자 예상값. 확정은 저장할 때 창구가 한다.
 */
export function suggestNo(data, buyer, year) {
  if (!buyer) return '';
  const next = data.noNext && data.noNext[buyer];
  return next || String(expectedNo(data.noMax, buyer, year));
}

/** 목록의 좁은 No. 칸용: 'KINGO-26-01' → '26-01' (맨 앞 바이어 글자는 바이어 화면이라 뺀다) */
export function shortNo(no) {
  const s = String(no ?? '');
  const parts = s.split('-');
  return parts.length > 1 && /^[^\d]+$/.test(parts[0]) ? parts.slice(1).join('-') : s;
}

/** 같은 컨테이너에 더할 때 고르는 그 바이어의 선적들. 앞으로의 것이 먼저 */
export function containersOf(rows, buyer, today) {
  const map = new Map();
  for (const r of rows) {
    if (r.buyer !== buyer || !r.no || !noYearOf(r)) continue;
    const k = shipmentKey(r);
    if (!map.has(k)) map.set(k, { no: r.no, noYear: noYearOf(r), eta: r.eta, fruits: new Set() });
    const c = map.get(k);
    c.fruits.add(r.fruit);
    if (r.eta && (!c.eta || r.eta < c.eta)) c.eta = r.eta;
  }
  const list = [...map.values()].map((c) => ({
    ...c,
    value: `${c.noYear}|${c.no}`,
    label: `No. ${c.no}${c.eta ? ' · ' + fmtKoYear(c.eta, today) : ''} · ${[...c.fruits].join('·')}`
  }));
  const up = list.filter((c) => c.eta && c.eta >= today).sort((a, b) => cmp(a.eta, b.eta));
  const past = list.filter((c) => !c.eta || c.eta < today).sort((a, b) => cmp(b.eta || '', a.eta || ''));
  return [...up, ...past.slice(0, 10)];
}

function latestBy(rows, test, field) {
  let best = null;
  for (const r of rows) {
    if (!test(r) || r[field] === null || r[field] === undefined) continue;
    if (!best || (r.eta || '') > (best.eta || '')) best = r;
  }
  return best ? best[field] : null;
}

/** 같은 바이어·과일·스펙의 직전 바이어가 */
export function lastPrice(rows, { buyer, fruit, specKo }, excludeId) {
  return latestBy(rows, (r) => r.id !== excludeId && r.buyer === buyer && r.fruit === fruit &&
    r.specKo === specKo, 'price');
}

/** 같은 과일·스펙의 직전 산지가와 작업비(바이어 상관없이). 자동으로 넣지 않고 안내로만 쓴다(규칙 6). */
export function lastCost(rows, { fruit, specKo }, excludeId) {
  const test = (r) => r.id !== excludeId && r.fruit === fruit && r.specKo === specKo;
  return { cost: latestBy(rows, test, 'cost'), workCost: latestBy(rows, test, 'workCost') };
}

/** 산지 칸 자동완성: 줄에 쓰인 산지 이름, 많이 쓴 순 */
export function originsOf(rows) {
  const count = new Map();
  for (const r of rows || []) {
    const o = String(r.origin || '').trim();
    if (o) count.set(o, (count.get(o) || 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0])).map(([o]) => o);
}

/** 회사 버튼에 보일 이름들: 바이어 탭 기본 회사와 줄에 쓰인 회사 */
export function exportersOf(data) {
  const set = new Set();
  for (const b of data.buyers || []) if (b.exporter) set.add(b.exporter);
  for (const r of data.rows || []) if (r.exporter) set.add(r.exporter);
  return [...set];
}

/** 스펙 사전의 영어. 서버(specMap_)와 같게 영어가 빈 줄은 건너뛴다. */
export function specEnOf(specs, fruit, specKo) {
  const k = String(specKo || '').trim();
  const s = (specs || []).find((x) => x.fruitKo === fruit && x.specKo === k && x.specEn);
  return s ? s.specEn : '';
}
