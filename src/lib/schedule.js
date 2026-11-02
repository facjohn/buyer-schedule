// 스케줄 줄을 고르고 묶고 세는 함수들. 화면은 이 함수들만 쓴다.
import { addMonths, fmtKoYear, fmtMonthKo } from './dates.js';
import { TBD_BUYER, isTbdBuyer, isTbdOrigin } from './undecided.js';

/** 날짜('yyyy-MM-dd')가 속한 시즌(7월 1일~다음 해 6월 30일)의 시작 해. 2027-03-05 → 2026 (서버 seasonYear_와 같다) */
export function seasonYear(iso) {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number(iso.slice(5, 7)) >= 7 ? y : y - 1;
}

/** 번호 해(시즌 시작 해). 시트에서 No.만 적고 번호 해를 비운 줄은 서버처럼 ETA의 시즌으로 본다 */
export function noYearOf(r) {
  return r.noYear || (r.eta ? seasonYear(r.eta) : null);
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

/** 상차일이 오늘보다 앞이면(오늘 상차는 아직) 상차가 끝난 줄. 목록에서 주황 바탕(2026-10-20 사용자 요청, JPG와 상관없음) */
export function loadedPast(r, today) {
  return !!(r && r.loadDate && today && r.loadDate < today);
}

/** 시즌은 7월 1일에 시작한다(7월~다음 해 6월, 2026-10-20 사용자 요청 "시즌 (7월~내년7월까지) 유지하자") */
export const SEASON_START_MONTH = 7;

/** 오늘이 속한 시즌의 첫날 'yyyy-07-01'. 오늘이 7월 전이면 지난해 7월 1일 */
export function seasonStartIso(today, month = SEASON_START_MONTH) {
  if (!today) return '';
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  return `${m >= month ? y : y - 1}-${String(month).padStart(2, '0')}-01`;
}

/** 지난 일정 순서: ETA가 최근인 것이 맨 위(2026-10-20 사용자 요청 "지난일정에는 최근 게 가장 위에"), 같은 날이면 큰 번호부터 */
export function sortRecentFirst(rows) {
  return sortByNo(rows, { desc: true }).sort((a, b) => cmp(b.eta || '', a.eta || ''));
}

/** 시즌 안내 글자 "2026년 7월" */
export function seasonLabel(today) {
  const s = seasonStartIso(today);
  return s ? `${s.slice(0, 4)}년 ${Number(s.slice(5, 7))}월` : '';
}

/** 기간. 앞으로: ETA가 오늘 이후이거나 미정. 지난 일정: ETA가 오늘보다 앞이고 이번 시즌(7월 1일부터) 것만 */
export function filterPeriod(rows, period, today) {
  if (period === 'past') {
    const from = seasonStartIso(today);
    return sortRows(rows.filter((r) => r.eta && r.eta < today && r.eta >= from), { desc: true });
  }
  const end = period === 'next2' ? addMonths(today, 2) : null;
  return sortRows(rows.filter((r) => !r.eta || (r.eta >= today && (!end || r.eta <= end))));
}

/** 월별 묶음. [{ key: '2026-10', label: '10월', rows }] (ETA 미정 줄은 맨 뒤 'ETA 미정') */
export function groupByMonth(rows, today) {
  const groups = [];
  const byKey = {};
  for (const r of rows) {
    const key = r.eta ? r.eta.slice(0, 7) : 'none';
    if (!byKey[key]) {
      byKey[key] = { key, label: key === 'none' ? 'ETA 미정' : fmtMonthKo(key, today), rows: [] };
      groups.push(byKey[key]);
    }
    byKey[key].rows.push(r);
  }
  return groups.sort((a, b) => (a.key === 'none') - (b.key === 'none'));
}

/** 글자 안의 숫자는 숫자로 비교(KINGO-26-9 < KINGO-26-10) */
function natCmp(a, b) {
  const ta = String(a).match(/\d+|\D+/g) || [];
  const tb = String(b).match(/\d+|\D+/g) || [];
  for (let i = 0; i < Math.max(ta.length, tb.length); i++) {
    const x = ta[i];
    const y = tb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (/^\d/.test(x) && /^\d/.test(y) && Number(x) !== Number(y)) return Number(x) - Number(y);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

const hasNo = (r) => r.no !== null && r.no !== undefined && String(r.no).trim() !== '';
const isLegacyNo = (r) => /^\d+$/.test(String(r.no).trim());

/**
 * 바이어 스케줄 목록 순서: No. 순(2026-10-19 사용자 요청: ETA 미정이라도 No. 순서대로).
 * 인보이스 번호(KINGO-26-01)는 글자 속 숫자를 크기대로, 숫자만 쓰는 옛 번호는 번호 해(noYear)마다 따로 센다.
 * 같은 No.(같은 컨테이너)는 ETA·과일·스펙 순, No.가 없는 줄은 맨 뒤. desc면 큰 번호부터(지난 일정).
 */
export function sortByNo(rows, { desc = false } = {}) {
  const dir = desc ? -1 : 1;
  return rows.slice().sort((a, b) => {
    if (hasNo(a) !== hasNo(b)) return hasNo(a) ? -1 : 1;
    let c = 0;
    if (hasNo(a)) {
      const la = isLegacyNo(a);
      const lb = isLegacyNo(b);
      if (la !== lb) c = la ? -1 : 1;
      else if (la) c = cmp(noYearOf(a) || 0, noYearOf(b) || 0) || Number(a.no) - Number(b.no);
      else c = natCmp(String(a.no).trim(), String(b.no).trim());
    }
    return dir * c || cmp(a.eta || '9999', b.eta || '9999') || cmp(a.fruit, b.fruit) || cmp(a.specKo, b.specKo);
  });
}

/**
 * No. 순으로 놓인 줄에 월 제목을 붙인다. 달이 바뀔 때만 새 제목(그래서 같은 달이 두 번 나올 수도 있다).
 * ETA가 없는 줄은 상차일의 달, 그것도 없으면 앞 줄의 달에 둔다. 모두 날짜가 없으면 'ETA 미정'.
 * [{ key, label, rows }]
 */
export function groupInNoOrder(rows, today) {
  const groups = [];
  let prev = null;
  for (const r of rows) {
    const month = r.eta ? r.eta.slice(0, 7) : r.loadDate ? r.loadDate.slice(0, 7) : prev || 'none';
    if (!groups.length || month !== prev) {
      groups.push({ key: month + '#' + groups.length, label: month === 'none' ? 'ETA 미정' : fmtMonthKo(month, today), rows: [] });
    }
    groups[groups.length - 1].rows.push(r);
    prev = month;
  }
  return groups;
}

/** 줄에 있는 과일을 품목 탭 순서로(품목 탭에 없는 과일은 뒤에 가나다순). 바이어 스케줄의 과일 버튼용 */
export function fruitsInOrder(rows, fruitsTab) {
  const present = new Set(rows.map((r) => r.fruit).filter(Boolean));
  const order = (fruitsTab || []).map((f) => f.fruitKo);
  const known = order.filter((f) => present.has(f));
  const extra = [...present].filter((f) => !order.includes(f)).sort((a, b) => a.localeCompare(b, 'ko'));
  return [...known, ...extra];
}

/** 앞으로의 줄: ETA가 오늘 이후이거나 ETA 미정 */
function isUpcoming(r, today) {
  return !r.eta || r.eta >= today;
}

/**
 * 홈 바이어 카드. 다음 상차일이 가까운 바이어가 위(2026-10-20 사용자 요청: 다음 ETA 말고 다음 상차 기준),
 * 그다음 상차일 미정만 남은 바이어, 상차가 다 끝난(배가 가는 중) 바이어, 앞으로 일정이 없는 바이어. 같으면 바이어 탭 순서.
 * 예정 수는 앞으로의 스케줄 줄 수(ETA가 오늘 이후이거나 미정, 같은 No.의 줄도 하나씩 셈. 2026-10-20 사용자 요청 "스케쥴 갯수만큼").
 * 바이어 스케줄 목록(앞으로)의 줄 수와 같다.
 * 바이어 탭에 없는데 스케줄에만 있는 이름도 카드로 보인다(시트에서 이름을 바꾼 경우 놓치지 않게).
 * @미정 칸(2026-10-30 사용자 요청)에는 바이어 미정 줄과 산지 미정 줄(다른 바이어 줄이어도)이 모두 모이고, 줄이 있으면 맨 앞에 온다(긴급).
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
    // 산지 미정 줄은 원래 바이어 칸에도, @미정 칸에도(사용자 선택 "둘 다 보이기")
    if (isTbdOrigin(r.origin) && !isTbdBuyer(r.buyer)) {
      if (!byName.has(TBD_BUYER)) byName.set(TBD_BUYER, { buyer: { name: TBD_BUYER }, rows: [] });
      byName.get(TBD_BUYER).rows.push(r);
    }
  }
  const cards = [...byName.values()].map(({ buyer, rows }, order) => {
    const byNo = sortByNo(rows);
    // 다음 상차: 상차일이 오늘이거나 그 뒤인 가장 이른 줄(같은 날이면 No. 순). 없으면 상차일이 빈 줄(미정).
    // 상차일이 오늘보다 앞인 줄은 이미 실은 것(목록에서 주황)이라 다음 상차가 아니다.
    const toLoad = byNo.filter((r) => r.loadDate && r.loadDate >= today).sort((a, b) => cmp(a.loadDate, b.loadDate));
    const pool = toLoad.length ? toLoad : byNo.filter((r) => !r.loadDate);
    const first = pool[0];
    // 과일은 그 선적(같은 No.)의 앞으로의 줄 전부에서 모은다(같은 컨테이너에 상차일을 안 적은 줄이 있어도 빠지지 않게)
    const nextRows = first ? byNo.filter((r) => shipmentKey(r) === shipmentKey(first)) : [];
    return {
      buyer,
      order,
      next: first ? {
        loadDate: first.loadDate || '',
        fruits: [...new Set(nextRows.map((r) => r.fruit))].join('·'),
        ship: first.ship
      } : null,
      allLoaded: rows.length > 0 && !first, // 앞으로의 선적이 있는데 모두 상차가 끝남
      count: rows.length, // 예정 수 = 앞으로의 스케줄 줄 수
      tbd: isTbdBuyer(buyer.name),
      // 칸 안 알림(2026-10-30 사용자 요청 "바둑판 안에 산지미정 1건 알람처럼"): 앞으로의 줄 중 미정 수
      tbdOrigin: rows.filter((r) => isTbdOrigin(r.origin)).length,
      tbdBuyer: rows.filter((r) => isTbdBuyer(r.buyer)).length
    };
  });
  // 미정이 남은 @미정 칸 → 다음 상차가 가까운 순 → 상차일 미정 → 상차 다 끝남 → 일정 없는 바이어
  const rank = (c) => (c.tbd && c.count ? -1 : c.next ? (c.next.loadDate ? 0 : 1) : c.allLoaded ? 2 : 3);
  return cards.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 0 && a.next.loadDate !== b.next.loadDate) return cmp(a.next.loadDate, b.next.loadDate);
    return a.order - b.order;
  });
}

/**
 * 홈 '상차일로 보기'(2026-10-20 사용자 요청): 앞으로의 줄(ETA가 오늘 이후이거나 미정)을 상차일 순으로 한 줄씩, 날짜마다 묶는다.
 * 같은 날은 바이어 탭 순서 → No. 순. 상차일이 빈 줄은 맨 뒤 묶음.
 * 상차일이 지난 줄(상차 끝남)은 빼고, 상차 당일까지만 보인다(2026-10-20 사용자 요청 "상차 끝남은 당일까지만 유지하고 지난거는 지워줘").
 * past면 '지난 일정'(같은 날 사용자 요청 "상차일로 보기누르면 지난일정 칸을 따로"): 이번 시즌(7월 1일부터) 상차일이 지난 줄을
 * 최근 날짜부터(ETA가 지났어도 보임).
 * [{ key, date, isToday, rows }]
 */
export function loadingDays(data, { past = false } = {}) {
  const today = data.today;
  const ord = buyerOrder(data);
  const from = seasonStartIso(today);
  const keep = past
    ? (r) => loadedPast(r, today) && r.loadDate >= from
    : (r) => isUpcoming(r, today) && !loadedPast(r, today);
  const rows = sortByNo((data.rows || []).filter(keep));
  rows.sort((a, b) => {
    if (!a.loadDate !== !b.loadDate) return a.loadDate ? -1 : 1;
    if (a.loadDate !== b.loadDate) return past ? cmp(b.loadDate, a.loadDate) : cmp(a.loadDate, b.loadDate);
    return ord(a) - ord(b) || cmp(a.buyer, b.buyer);
  });
  const days = [];
  for (const r of rows) {
    const key = r.loadDate || 'none';
    let d = days[days.length - 1];
    if (!d || d.key !== key) {
      d = { key, date: r.loadDate || '', isToday: !!r.loadDate && r.loadDate === today, rows: [] };
      days.push(d);
    }
    d.rows.push(r);
  }
  return days;
}

/** 줄의 바이어가 바이어 탭에서 몇 번째인지(탭에 없는 이름은 맨 뒤). 같은 상차일 안 순서용 */
function buyerOrder(data) {
  const orderOf = new Map((data.buyers || []).map((b, i) => [b.name, i]));
  return (r) => (orderOf.has(r.buyer) ? orderOf.get(r.buyer) : orderOf.size);
}

/**
 * 홈 '달력으로 보기'(2026-11-02 사용자 요청): 상차일마다 그날 싣는 줄. 지난 상차도 빼지 않는다(달력에서 지난 날도 보이게).
 * 같은 날 순서는 상차일로 보기와 같다(바이어 탭 순서 → No. 순). 상차일이 빈 줄은 없다(loadingDays의 '상차일 미정' 묶음).
 * Map('yyyy-MM-dd' → rows)
 */
export function rowsByLoadDate(data) {
  const ord = buyerOrder(data);
  const map = new Map();
  for (const r of sortByNo((data.rows || []).filter((r) => r.loadDate))) {
    if (!map.has(r.loadDate)) map.set(r.loadDate, []);
    map.get(r.loadDate).push(r);
  }
  for (const rows of map.values()) rows.sort((a, b) => ord(a) - ord(b) || cmp(a.buyer, b.buyer));
  return map;
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
  if (next) return next;
  // 창구가 알려 준 다음 숫자 번호(지운 줄은 세지 않고 가운데 빈 번호부터, 2026-10-30 사용자 결정)
  const free = data.noFree && data.noFree[`${buyer}|${year}`];
  return String(free || expectedNo(data.noMax, buyer, year));
}

/** 목록의 좁은 No. 칸용: 'KINGO-26-01' → '26-01' (맨 앞 바이어 글자는 바이어 화면이라 뺀다) */
export function shortNo(no) {
  const s = String(no ?? '');
  const parts = s.split('-');
  return parts.length > 1 && /^[^\d]+$/.test(parts[0]) ? parts.slice(1).join('-') : s;
}

/**
 * 그 바이어의 선적들(번호 판단용 전체 목록). 앞으로의 것(ETA 미정 포함)이 먼저이고 upcoming 표시가 붙는다.
 * 입력 화면의 번호 고르기 목록에는 앞으로의 것만 보인다(2026-10-30 점검: 목록에 안 보이는 지난 선적 번호가 떠서 헷갈림,
 * ETA 미정 선적이 지난 쪽으로 들어가 10개 뒤에서 잘리던 문제).
 */
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
  const up = list.filter((c) => !c.eta || c.eta >= today)
    .sort((a, b) => cmp(a.eta || '9999', b.eta || '9999'))
    .map((c) => ({ ...c, upcoming: true }));
  const past = list.filter((c) => c.eta && c.eta < today).sort((a, b) => cmp(b.eta, a.eta))
    .map((c) => ({ ...c, upcoming: false }));
  return [...up, ...past];
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

const HANGUL = /[\u3131-\u318E\uAC00-\uD7A3]/;

/**
 * 사전에 없는 스펙의 영어(서버 derivedSpecEn_과 같은 규칙, 2026-10-16 사용자 요청: 적은 글자 그대로).
 * 한글이 없는 스펙('4kg/450g')은 그대로, '/'로 이은 스펙은 조각마다 사전에서 찾아 잇는다. 못 찾으면 ''
 */
export function derivedSpecEn(specs, fruit, specKo) {
  const s = String(specKo || '').trim();
  if (!s) return '';
  if (!HANGUL.test(s)) return s;
  const en = [];
  for (const part of s.split('/').map((p) => p.trim())) {
    const e = part ? specEnOf(specs, fruit, part) || (HANGUL.test(part) ? '' : part) : '';
    if (!e) return '';
    en.push(e);
  }
  return en.join('/');
}
