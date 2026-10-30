/**
 * 스케줄 읽기·저장·삭제 표시와 id·No. 붙이기.
 *
 * No. 규칙 (CLAUDE.md 절대 규칙 5)
 * - No.는 인보이스 번호(예: KINGO-26-01 = 바이어-시즌-차수). 선적(컨테이너나 항공 건) 하나에 하나이고,
 *   같은 컨테이너의 사이즈·과일은 같은 No.의 줄 여러 개.
 * - 사람이 직접 쓸 수 있다. 비워 두면 그 바이어의 다음 차수(KINGO-26-02, 자릿수 유지). 앞글자는 가장 뒤(시즌이 큰) 것.
 *   지운 줄은 세지 않고 가운데 빈 번호부터 채운다(2026-10-30 사용자 결정: 인보이스는 차례대로, 지운 번호는 다시 쓴다).
 * - 숫자만 쓰는 번호(1, 2, 3)는 바이어·번호 해(noYear)마다 최댓값 + 1. 번호 해는 시즌(7월 1일~다음 해 6월 30일)의 시작 해
 *   (2026-10-30 사용자 결정 "매년 7월 1일부터 리셋": 1월에 1번으로 돌아가지 않고 7월에 돌아간다).
 * - 바이어를 바꾼 줄은 그 바이어의 다음 번호(직접 쓰면 그 번호).
 */

var SAVE_FIELDS = ['buyer', 'fruit', 'ship', 'specKo', 'specEn', 'eta', 'price', 'cost', 'workCost',
  'status', 'loadDate', 'exporter', 'origin', 'qty', 'memo'];
var DATE_FIELDS = ['eta', 'loadDate'];
var MONEY_FIELDS = ['price', 'cost', 'workCost'];
var SHIP_VALUES = ['20ft', '40ft', '항공'];
var STATUS_VALUES = ['미정', '확정'];
var LIST_MONTHS_BACK = 13;
var MAX_ITEMS = 50;

// ── list ─────────────────────────────────────────────

function list_(member) {
  repairIfNeeded_();
  var t = readTable_('schedule');
  var buyers = readBuyers_();
  var fruits = readFruits_();
  var specs = readSpecs_();
  var buyerMap = indexBy_(buyers, 'name');
  var specMap = specMap_(specs);
  var cutoff = monthsAgoIso_(LIST_MONTHS_BACK);

  var rows = [];
  t.rows.forEach(function (r) {
    if (toBool_(r.deleted)) return;
    var eta = toIsoDate_(r.eta);
    if (eta && eta < cutoff) return;
    rows.push(rowOut_(r, buyerMap, specMap));
  });

  return {
    ok: true,
    me: { name: member.name },
    today: todayIso_(),
    serverTime: new Date().toISOString(),
    rows: rows,
    buyers: buyers,
    fruits: fruits,
    specs: specs,
    noMax: legacyOut_(numbering_(t.rows), maxOf_), // 숫자 번호: '바이어|해' → 지금 쓰는 가장 큰 번호(옛 앱용)
    noFree: legacyOut_(numbering_(t.rows), nextFree_), // 숫자 번호: '바이어|해' → 다음 번호(가운데 빈 번호부터)
    noNext: peekNext_(numbering_(t.rows)), // 인보이스 번호: 바이어 → 다음 번호(예: KINGO-26-02)
    sheetUrl: SpreadsheetApp.getActive().getUrl()
  };
}

function rowOut_(r, buyerMap, specMap) {
  var buyer = str_(r.buyer);
  var fruit = str_(r.fruit);
  var specKo = str_(r.specKo);
  var b = buyerMap[buyer];
  return {
    id: str_(r.id),
    buyer: buyer,
    no: r.no === '' || r.no === null ? null : (typeof r.no === 'number' ? r.no : str_(r.no)),
    noYear: toNum_(r.noYear),
    fruit: fruit,
    ship: normShip_(r.ship) || str_(r.ship),
    specKo: specKo,
    specEn: specMap[fruit + '|' + specKo] || str_(r.specEn) || derivedSpecEn_(specMap, fruit, specKo),
    eta: toIsoDate_(r.eta),
    // 가격이 여럿('17.3/17.8')이면 시트에 적힌 글자 그대로 보낸다(2026-10-16 사용자 요청)
    price: moneyOut_(r.price),
    cost: moneyOut_(r.cost),
    workCost: moneyOut_(r.workCost),
    status: str_(r.status) === '확정' ? '확정' : '미정',
    loadDate: toIsoDate_(r.loadDate),
    exporter: str_(r.exporter) || (b ? b.exporter : ''),
    exporterSet: !!str_(r.exporter), // 회사 칸에 직접 적힌 값인지(비어서 바이어 기본 회사를 쓰는지)
    origin: str_(r.origin),
    qty: str_(r.qty),
    memo: str_(r.memo),
    updatedBy: str_(r.updatedBy),
    updatedAt: toIsoDateTime_(r.updatedAt)
  };
}

/** 시트의 '순서' 칸대로(비어 있으면 시트 줄 순서대로 뒤에) */
function bySortOrder_(list) {
  return list.map(function (o, i) { return { o: o, i: i }; }).sort(function (a, b) {
    var x = a.o.sortOrder, y = b.o.sortOrder;
    if ((x === null) !== (y === null)) return x === null ? 1 : -1;
    return (x === null ? 0 : x - y) || a.i - b.i;
  }).map(function (p) { return p.o; });
}

function readBuyers_() {
  return bySortOrder_(readTable_('buyers').rows.map(function (r) {
    return {
      name: str_(r.name),
      nameEn: str_(r.nameEn),
      country: str_(r.country),
      countryEn: str_(r.countryEn),
      currency: str_(r.currency) || 'USD',
      priceUnit: str_(r.priceUnit) || 'carton',
      priceTerm: str_(r.priceTerm) || 'FOB',
      exporter: str_(r.exporter),
      sortOrder: toNum_(r.sortOrder),
      archived: toBool_(r.archived)
    };
  }).filter(function (b) { return b.name; }));
}

function readFruits_() {
  return bySortOrder_(readTable_('fruits').rows.map(function (r) {
    var start = toNum_(r.seasonStart);
    return {
      fruitKo: str_(r.fruitKo),
      fruitEn: str_(r.fruitEn),
      seasonStart: start >= 1 && start <= 12 ? Math.floor(start) : 1,
      sortOrder: toNum_(r.sortOrder)
    };
  }).filter(function (f) { return f.fruitKo; }));
}

function readSpecs_() {
  return readTable_('specs').rows.map(function (r) {
    return { fruitKo: str_(r.fruitKo), specKo: str_(r.specKo), specEn: str_(r.specEn) };
  }).filter(function (s) { return s.fruitKo && s.specKo; });
}

function indexBy_(list, key) {
  var map = {};
  list.forEach(function (o) { if (!map[o[key]]) map[o[key]] = o; });
  return map;
}

var HANGUL_RE = /[\u3131-\u318E\uAC00-\uD7A3]/;

/**
 * 사전에도 줄에도 영어가 없을 때의 스펙 영어(2026-10-16 사용자 요청: 적은 글자 그대로).
 * - 한글이 없는 스펙('4kg/450g', '15kg 18-24')은 적힌 글자 그대로
 * - '/'로 이은 스펙은 조각마다 사전(한글 없는 조각은 그대로)에서 찾아 '/'로 잇는다. 하나라도 못 찾으면 ''
 * 번역은 하지 않는다(CLAUDE.md 표기 규칙).
 */
function derivedSpecEn_(specMap, fruit, specKo) {
  var s = str_(specKo);
  if (!s) return '';
  if (!HANGUL_RE.test(s)) return s;
  var parts = s.split('/').map(function (p) { return p.trim(); });
  var en = [];
  for (var i = 0; i < parts.length; i++) {
    var e = parts[i] ? specMap[fruit + '|' + parts[i]] || (HANGUL_RE.test(parts[i]) ? '' : parts[i]) : '';
    if (!e) return '';
    en.push(e);
  }
  return en.join('/');
}

function specMap_(specs) {
  var map = {};
  specs.forEach(function (s) {
    var k = s.fruitKo + '|' + s.specKo;
    if (!map[k] && s.specEn) map[k] = s.specEn;
  });
  return map;
}

// ── No.(인보이스 번호) ────────────────────────────

/** No. 칸 값을 글자로. 숫자 1 → '1', 빈 칸 → '' */
function noStr_(v) {
  if (v === null || v === undefined || v === false) return '';
  if (typeof v === 'number') return isFinite(v) ? String(v) : '';
  return String(v).trim();
}

/** 시트에 쓸 값. 0으로 시작하지 않는 숫자만 숫자로, 나머지는 글자 그대로 */
function noCell_(s) {
  return /^[1-9]\d{0,8}$/.test(s) ? Number(s) : s;
}

/**
 * 인보이스 번호 'KINGO-26-01' → { prefix: 'KINGO-26-', key: 'KINGO-26-', num: 1, width: 2 }.
 * 글자가 든 앞글자 + '-' + 두 자리(시즌) + '-' + 차수일 때만 인보이스 번호로 본다(2026-10-30 점검:
 * '9-1', '#9', 'A12', '9.5'처럼 한 번 쓴 번호가 그 바이어의 다음 번호를 '9-2'로 바꾸던 문제). 아니면 null.
 * key는 대소문자를 무시한 비교용.
 */
var INVOICE_RE = /^([^-]+-\d{2}-)(\d+)$/;
function parseInvoice_(s) {
  var m = INVOICE_RE.exec(s);
  // 앞글자(바이어 글자)에 글자가 있어야 한다. 'KINGO-26-05-1'처럼 덩어리가 더 붙은 번호는 인보이스 줄기로 보지 않는다
  if (!m || !/[A-Za-z\uAC00-\uD7A3]/.test(m[1])) return null;
  return { prefix: m[1], key: m[1].toUpperCase(), num: Number(m[2]), width: m[2].length };
}

/** 앞글자 비교. 안의 숫자는 숫자로 비교한다(KINGO-27- > KINGO-26-) */
function cmpPrefix_(a, b) {
  var ta = a.match(/\d+|\D+/g) || [];
  var tb = b.match(/\d+|\D+/g) || [];
  for (var i = 0; i < Math.max(ta.length, tb.length); i++) {
    var x = ta[i], y = tb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (/^\d/.test(x) && /^\d/.test(y) && Number(x) !== Number(y)) return Number(x) - Number(y);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * 바이어별 다음 번호를 셀 준비. 지운 줄은 세지 않는다(2026-10-30 사용자 결정: "지운 번호를 다시 써야해.
 * 중간에 띄어넘고 이런거 없어서. 차례대로 인보이스라서 채우면서 가야해").
 * series: 인보이스 번호를 쓰는 바이어의 { 가장 뒤 앞글자, 쓰는 차수들, 자릿수 }, legacy: 숫자 번호의 '바이어|해' → 쓰는 번호들.
 * (쓰는 번호들은 { 번호: true } 객체)
 * - 인보이스 번호도 숫자도 아닌 번호('9-1', '#9')는 셈에 넣지 않는다.
 */
function numbering_(rows) {
  var series = {};
  var legacy = {};
  var live = rows.filter(function (r) { return !toBool_(r.deleted); });
  live.forEach(function (r) {
    var buyer = str_(r.buyer);
    var p = parseInvoice_(noStr_(r.no));
    if (!buyer || !p) return;
    var cur = series[buyer];
    if (!cur || cmpPrefix_(p.key, cur.key) > 0) series[buyer] = { prefix: p.prefix, key: p.key, nums: {}, width: p.width };
  });
  live.forEach(function (r) {
    var buyer = str_(r.buyer);
    var no = noStr_(r.no);
    if (!buyer || !no) return;
    var p = parseInvoice_(no);
    if (p) {
      var cur = series[buyer];
      if (cur && cur.key === p.key) {
        cur.nums[p.num] = true;
        if (p.width > cur.width) cur.width = p.width;
      }
    } else if (/^\d+$/.test(no)) {
      var k = buyer + '|' + (toNum_(r.noYear) || seasonYear_(r.eta));
      (legacy[k] = legacy[k] || {})[Number(no)] = true;
    }
  });
  return { series: series, legacy: legacy };
}

/**
 * 다음에 쓸 번호: 쓰는 번호 중 가장 작은 번호~가장 큰 번호 사이에 빈 번호가 있으면 그 번호(가운데부터 채움),
 * 없으면 가장 큰 번호 + 1, 아무것도 없으면 1. 가장 작은 번호보다 앞(시트 밖에서 쓴 번호일 수 있음)은 채우지 않는다.
 */
function nextFree_(used) {
  var nums = Object.keys(used || {}).map(Number).filter(function (n) { return n >= 1; });
  if (!nums.length) return 1;
  var min = Math.min.apply(null, nums);
  var max = Math.max.apply(null, nums);
  for (var n = min; n < max; n++) if (!used[n]) return n;
  return max + 1;
}

function maxOf_(used) {
  var nums = Object.keys(used || {}).map(Number);
  return nums.length ? Math.max.apply(null, nums) : 0;
}

/** 이번 저장에서 쓴 번호를 셈에 넣는다(한 번에 여러 줄을 저장할 때 같은 번호를 두 번 주지 않게) */
function markNo_(state, buyer, no, year) {
  if (!state || !buyer) return;
  var s = noStr_(no);
  var p = parseInvoice_(s);
  if (p) {
    var cur = state.series[buyer];
    if (cur && cur.key === p.key) cur.nums[p.num] = true;
  } else if (/^\d+$/.test(s)) {
    var k = buyer + '|' + year;
    (state.legacy[k] = state.legacy[k] || {})[Number(s)] = true;
  }
}

function pad_(n, width) {
  var t = String(n);
  while (t.length < width) t = '0' + t;
  return t;
}

/** 다음 번호를 정하고 셈에 넣는다. 인보이스 번호가 있는 바이어는 그 앞글자의 다음 차수, 없으면 그 시즌 숫자(가운데 빈 번호부터) */
function nextNo_(state, buyer, year) {
  var s = state.series[buyer];
  if (s) {
    var n = nextFree_(s.nums);
    s.nums[n] = true;
    return s.prefix + pad_(n, s.width);
  }
  var k = buyer + '|' + year;
  var used = state.legacy[k] = state.legacy[k] || {};
  var m = nextFree_(used);
  used[m] = true;
  return m;
}

/** 앱 입력 화면에 미리 채울 다음 인보이스 번호(셈에는 넣지 않음) */
function peekNext_(state) {
  var out = {};
  Object.keys(state.series).forEach(function (b) {
    var s = state.series[b];
    out[b] = s.prefix + pad_(nextFree_(s.nums), s.width);
  });
  return out;
}

/** 숫자 번호: '바이어|해' → 다음에 쓸 번호(noFree), 쓰는 가장 큰 번호(noMax, 옛 앱용) */
function legacyOut_(state, pick) {
  var out = {};
  Object.keys(state.legacy).forEach(function (k) { out[k] = pick(state.legacy[k]); });
  return out;
}

/** 남은(지우지 않은) 선적들: '바이어|번호|해' 와 '바이어|번호' → 해 */
function containerIndex_(rows) {
  var nb = { keys: {}, years: {} };
  rows.forEach(function (r) {
    if (toBool_(r.deleted)) return;
    addContainer_(nb, str_(r.buyer), noStr_(r.no), toNum_(r.noYear) || seasonYear_(r.eta));
  });
  return nb;
}

function addContainer_(nb, buyer, no, noYear) {
  if (!buyer || !no) return;
  nb.keys[containerKey_(buyer, no, noYear)] = true;
  var k = buyer + '|' + no;
  if (!nb.years[k] || noYear > nb.years[k]) nb.years[k] = noYear;
}

/**
 * 그 바이어에 그 번호의 선적이 있으면 {no, noYear}.
 * 숫자만 쓰는 옛 번호는 해마다 1부터 다시 세므로 year 해의 선적만 찾는다(2년 전 같은 번호에 붙지 않게).
 * 앞글자가 있는 인보이스 번호(KINGO-26-01)는 번호에 시즌이 들어 있어 해와 상관없이 찾는다(여러 해면 가장 최근 해).
 */
function findContainer_(nb, buyer, no, year) {
  if (/^\d+$/.test(no)) {
    return year && nb.keys[containerKey_(buyer, no, year)] ? { no: no, noYear: year } : null;
  }
  var y = nb.years[buyer + '|' + no];
  return y ? { no: no, noYear: y } : null;
}

/** 전각 숫자(０-９)는 보통 숫자로, 숫자만이면 앞의 0을 뗀다('08' → '8', '0'은 그대로). 2026-10-30 점검 */
function normNo_(s) {
  var t = String(s || '').replace(/[\uFF10-\uFF19]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  if (/^\d+$/.test(t)) return t.replace(/^0+(?=\d)/, '');
  // 인보이스 번호는 대문자로(kingo-26-01과 KINGO-26-01이 다른 선적이 되지 않게)
  return parseInvoice_(t) && /[A-Za-z]/.test(t) ? t.toUpperCase() : t;
}

/** 사람이 쓴 번호 확인 */
function cleanNo_(v) {
  var s = normNo_(noStr_(v));
  if (!s) return '';
  if (s === '0') throw new Error('No.는 1부터 써 주세요.');
  if (s.length > 40 || s.indexOf('|') >= 0) throw new Error('No.가 너무 길거나 쓸 수 없는 글자(|)가 있어요: ' + s);
  return s;
}

// ── id·No. 정리 (시트에서 복사해 붙인 줄) ─────────────

// 시트에서 막 고친 줄은 이만큼 기다렸다가 No.를 붙인다(붙여 넣은 직후의 옛 ETA로 번호 해가 정해지지 않게)
var SHEET_EDIT_WAIT_MS = 5 * 60 * 1000;

/**
 * 고칠 곳만 돌려준다(시트는 건드리지 않음).
 * - id가 비었거나 위 줄과 겹치면 새 id (바로)
 * - No.가 있는데 noYear가 비었으면 ETA 해
 * - 바이어가 있는데 No.가 비었으면 새 No.
 * - No.·noYear는 5분 안에 고친 줄이면 미룬다(force면 바로). 앱에서 만든 줄은 늘 No.를 받으므로
 *   No.나 번호 해가 빈 채 최근에 고친 줄은 시트에서 붙여 넣고 고치는 중인 줄이다.
 */
function findRepairs_(rows, makeId, force) {
  var state = numbering_(rows);
  var seen = {};
  var fixes = [];
  var now = new Date().getTime();
  rows.forEach(function (r) {
    var fix = { row: r._row };
    var changed = false;
    var id = str_(r.id);
    if (!id || seen[id]) {
      fix.id = makeId();
      changed = true;
    } else {
      seen[id] = true;
    }
    var buyer = str_(r.buyer);
    var no = noStr_(r.no);
    var justEdited = isDate_(r.updatedAt) && now - r.updatedAt.getTime() < SHEET_EDIT_WAIT_MS;
    if (justEdited && !force) {
      if (changed) fixes.push(fix);
      return;
    }
    if (buyer && no && !toNum_(r.noYear)) {
      fix.noYear = seasonYear_(r.eta);
      changed = true;
    }
    if (buyer && !no) {
      fix.noYear = seasonYear_(r.eta);
      fix.no = nextNo_(state, buyer, fix.noYear);
      changed = true;
    }
    if (changed) fixes.push(fix);
  });
  return fixes;
}

/** 고칠 줄이 있을 때만 잠그고 다시 읽어서 고친다. 고친 줄 수를 돌려준다. force면 시트에서 막 고친 줄도 바로. */
function repairIfNeeded_(force) {
  var t = readTable_('schedule');
  if (!findRepairs_(t.rows, function () { return 'x'; }, force).length) return 0;
  return withLock_(function () {
    var t2 = readTable_('schedule');
    var fixes = findRepairs_(t2.rows, newId_, force);
    fixes.forEach(function (f) {
      if (f.id) writeCell_(t2, f.row, 'id', f.id);
      if (f.no) writeCell_(t2, f.row, 'no', f.no);
      if (f.noYear) writeCell_(t2, f.row, 'noYear', f.noYear);
    });
    return fixes.length;
  });
}

// ── save ─────────────────────────────────────────────

/**
 * items: [{ id?, key?, no?, join?: {no, noYear}, changes: {필드: 값} }]
 * - id가 있으면 그 줄의 바뀐 칸만 쓴다.
 * - id가 없으면 새 줄. No.는 join(고른 선적) → no(사람이 쓴 번호, 이미 있는 번호면 그 선적에 더함) → 다음 번호 순.
 * - 고치기에서 no를 다른 번호로 보내면 이 줄만 바꾼다. 그 번호의 선적이 있으면 그리로 옮기고, 없으면 새 번호.
 *   같은 번호의 다른 줄은 건드리지 않는다(2026-10-19 사용자 요청: 한 줄을 고쳤는데 먼저 저장한 줄 번호까지 바뀌던 문제).
 */
function save_(member, items) {
  if (!Array.isArray(items) || !items.length) return { ok: false, error: 'bad_request', message: '저장할 줄이 없어요.' };
  if (items.length > MAX_ITEMS) return { ok: false, error: 'bad_request', message: '한 번에 ' + MAX_ITEMS + '줄까지 저장해요.' };

  return withLock_(function () {
    var t = readTable_('schedule');
    var ctx = {
      buyers: indexBy_(readBuyers_(), 'name'),
      fruits: indexBy_(readFruits_(), 'fruitKo')
    };
    // 스펙 사전: '과일|스펙' → 사전 줄. 영어는 사전이 기준이다(SPEC 개발용 메모).
    var specT = readTable_('specs');
    var dict = {};
    specT.rows.forEach(function (s) {
      var k = str_(s.fruitKo) + '|' + str_(s.specKo);
      if (!dict[k]) dict[k] = s;
    });
    var byId = {};
    t.rows.forEach(function (r) {
      var id = str_(r.id);
      if (id && !byId[id]) byId[id] = r;
    });
    var nb = containerIndex_(t.rows);
    nb.state = numbering_(t.rows);
    nb.table = t;
    var now = new Date();
    var appends = [];
    var specAdds = [];
    var saved = [];

    // 응답만 끊겨 같은 새 줄을 다시 보낸 경우: 이미 만든 줄을 고치는 것으로 바꾼다(줄이 두 번 생기지 않게).
    // 저장 표시는 7일 기억한다(앱이 '저장하지 못한 줄'을 나중에 다시 보내도 두 번 생기지 않게, 2026-10-30 검토)
    var cache = CacheService.getScriptCache();
    var props = PropertiesService.getScriptProperties();
    items = items.map(function (item) {
      if (item.id || !isSaveKey_(item.key)) return item;
      var made = madeIdFor_(cache, props, item.key);
      var row = made ? byId[made] : null;
      return row && !toBool_(row.deleted)
        ? { id: made, key: item.key, join: item.join, no: item.no, changes: item.changes }
        : item;
    });

    // 먼저 모두 확인하고 나서 쓴다. 중간에 틀린 줄이 있으면 아무것도 쓰지 않는다.
    var checked = items.map(function (item) {
      var changes = cleanChanges_(item.changes || {}, ctx);
      var cur = item.id ? byId[item.id] : null;
      if (item.id && (!cur || toBool_(cur.deleted))) {
        throw new Error('다른 사람이 이 줄을 지웠어요. 목록으로 돌아가 확인해 주세요.');
      }
      if (!cur && !changes.buyer) throw new Error('바이어를 골라 주세요.');
      var buyer = changes.buyer ? changes.buyer.value : str_(cur.buyer);
      if (item.join) checkJoin_(item.join, buyer, nb);
      return { item: item, cur: cur, changes: changes, no: cleanNo_(item.no) };
    });

    checked.forEach(function (c) {
      var item = c.item, cur = c.cur, changes = c.changes;
      var result;
      if (cur) {
        result = updateRow_(cur, changes, item.join, c.no, nb, member, now);
      } else {
        result = newRow_(changes, item.join, c.no, nb, member, now);
        appends.push(result.row);
        byId[result.id] = result.row;
        if (isSaveKey_(item.key)) rememberMade_(cache, props, item.key, result.id);
      }
      saved.push({ key: item.key || null, id: result.id, no: result.no, noYear: result.noYear, changed: result.changed });

      // 처음 쓰는 스펙은 사전에 더하고, 앱에서 영어를 고쳤으면 사전도 고친다.
      var fruit = result.final.fruit, specKo = result.final.specKo, specEn = result.final.specEn;
      var sk = fruit + '|' + specKo;
      if (fruit && specKo && specEn) {
        var entry = dict[sk];
        if (!entry) {
          entry = { fruitKo: fruit, specKo: specKo, specEn: specEn };
          dict[sk] = entry;
          specAdds.push(entry);
        } else if (changes.specEn && str_(entry.specEn) !== specEn) {
          entry.specEn = specEn;
          if (entry._row) writeCell_(specT, entry._row, 'specEn', specEn);
        }
      }
    });

    appendRows_(t, appends);
    appendRows_(specT, specAdds);
    if (appends.length) pruneSaveKeys_(props);
    return { ok: true, saved: saved };
  });
}

/** 새 번호 정하기: 고른 선적(join) → 사람이 쓴 번호(있는 선적이면 그리로) → 다음 번호 */
function pickNo_(buyer, eta, join, typed, nb) {
  if (join) return checkJoin_(join, buyer, nb);
  if (typed) return findContainer_(nb, buyer, typed, seasonYear_(eta)) || { no: typed, noYear: seasonYear_(eta) };
  var noYear = seasonYear_(eta);
  return { no: noStr_(nextNo_(nb.state, buyer, noYear)), noYear: noYear };
}

function updateRow_(cur, changes, join, typed, nb, member, now) {
  var t = nb.table;
  var writes = {};
  Object.keys(changes).forEach(function (f) {
    if (changes[f].key !== cellKey_(f, cur[f])) writes[f] = changes[f].value;
  });

  var curBuyer = str_(cur.buyer);
  var buyer = writes.buyer !== undefined ? str_(writes.buyer) : curBuyer;
  var eta = writes.eta !== undefined ? writes.eta : cur.eta;
  var curNo = noStr_(cur.no);
  var curYear = toNum_(cur.noYear) || (curNo ? seasonYear_(cur.eta) : null);
  var no = curNo;
  var noYear = toNum_(cur.noYear);

  if (join || (buyer && buyer !== curBuyer)) {
    // 다른 선적으로 옮기기 / 바이어를 바꾸면 그 바이어의 번호(쓴 번호, 없으면 다음 번호)
    var p = pickNo_(buyer, eta, join, typed, nb);
    no = p.no;
    noYear = p.noYear;
  } else if (typed && typed !== curNo) {
    var there = findContainer_(nb, buyer, typed, curYear || seasonYear_(eta));
    if (there) {
      // 이미 있는 번호: 이 줄만 그 선적으로
      no = there.no;
      noYear = there.noYear;
    } else {
      // 없는 번호: 이 줄만 새 번호로(같은 번호였던 다른 줄은 그대로)
      no = typed;
      noYear = curYear || seasonYear_(eta);
    }
  }
  if (no !== curNo) writes.no = noCell_(no);
  if (no && noYear !== toNum_(cur.noYear)) writes.noYear = noYear;
  // No.가 빈 줄(시트에서 붙여 넣는 중)은 여기서 붙이지 않고 findRepairs_에 맡긴다(ETA를 고치는 중일 수 있어서)
  if (buyer && no) {
    addContainer_(nb, buyer, no, noYear || seasonYear_(eta));
    markNo_(nb.state, buyer, no, noYear || seasonYear_(eta));
  }

  // 스펙이나 과일을 바꾸면서 영어를 안 보냈으면(사전·적은 그대로 영어를 쓰는 스펙) 줄의 옛 영어를 지운다.
  // 그대로 두면 새 스펙에 옛 영어('10kg box')가 붙고 스펙 탭에도 그렇게 더해진다.
  if ((writes.specKo !== undefined || writes.fruit !== undefined) && !changes.specEn && str_(cur.specEn)) {
    writes.specEn = '';
  }
  var fields = Object.keys(writes);
  if (fields.length) {
    writes.updatedBy = member.name;
    writes.updatedAt = now;
    Object.keys(writes).forEach(function (f) { writeCell_(t, cur._row, f, writes[f]); });
  }

  return {
    id: str_(cur.id), no: no ? noCell_(no) : null, noYear: noYear, changed: fields.length,
    final: {
      fruit: str_(writes.fruit !== undefined ? writes.fruit : cur.fruit),
      specKo: str_(writes.specKo !== undefined ? writes.specKo : cur.specKo),
      specEn: str_(writes.specEn !== undefined ? writes.specEn : cur.specEn)
    }
  };
}

function newRow_(changes, join, typed, nb, member, now) {
  var row = {};
  Object.keys(changes).forEach(function (f) { row[f] = changes[f].value; });
  var buyer = str_(row.buyer);
  if (!buyer) throw new Error('바이어를 골라 주세요.');

  var p = pickNo_(buyer, row.eta, join, typed, nb);
  addContainer_(nb, buyer, p.no, p.noYear);
  markNo_(nb.state, buyer, p.no, p.noYear);

  row.id = newId_();
  row.no = noCell_(p.no);
  row.noYear = p.noYear;
  row.updatedBy = member.name;
  row.updatedAt = now;
  row.deleted = false;
  return {
    row: row, id: row.id, no: row.no, noYear: p.noYear, changed: Object.keys(changes).length,
    final: { fruit: str_(row.fruit), specKo: str_(row.specKo), specEn: str_(row.specEn) }
  };
}

var SAVE_KEY_DAYS = 7;

/** 새 줄의 저장 표시로 이미 만든 줄 id(빠른 캐시 → 7일 보관 스크립트 속성) */
function madeIdFor_(cache, props, key) {
  var c = cache.get('sv:' + key);
  if (c) return c;
  var p = props.getProperty('sv:' + key);
  return p ? String(p).split('|')[0] : null;
}

function rememberMade_(cache, props, key, id) {
  cache.put('sv:' + key, id, 21600);
  props.setProperty('sv:' + key, id + '|' + Date.now());
}

/** 7일 지난 저장 표시는 지운다(스크립트 속성 용량을 넘지 않게) */
function pruneSaveKeys_(props) {
  if (!props.getKeys) return;
  var cutoff = Date.now() - SAVE_KEY_DAYS * 24 * 3600 * 1000;
  props.getKeys().forEach(function (k) {
    if (k.indexOf('sv:') !== 0) return;
    var t = Number(String(props.getProperty(k) || '').split('|')[1]);
    if (!t || t < cutoff) props.deleteProperty(k);
  });
}

/** 앱이 입력 화면마다 만드는 저장 표시(같은 새 줄을 두 번 만들지 않으려고) */
function isSaveKey_(key) {
  return typeof key === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(key);
}

function containerKey_(buyer, no, noYear) {
  return str_(buyer) + '|' + noStr_(no) + '|' + toNum_(noYear);
}

/** 고른 선적에 더할 때: 그 바이어에 그 No.가 실제로 있어야 한다. */
function checkJoin_(join, buyer, nb) {
  var no = noStr_(join.no);
  var noYear = toNum_(join.noYear);
  if (!no || !noYear || !nb.keys[containerKey_(buyer, no, noYear)]) {
    throw new Error(buyer + '에 No. ' + (no || '?') + ' 선적이 없어요(지워졌을 수 있어요). 목록으로 돌아가 다시 골라 주세요.');
  }
  return { no: no, noYear: noYear };
}

/** 받은 칸을 시트 값으로 바꾼다. 비교용 key도 같이. 모르는 칸은 버린다. */
function cleanChanges_(changes, ctx) {
  var out = {};
  Object.keys(changes).forEach(function (f) {
    if (SAVE_FIELDS.indexOf(f) < 0) return;
    var v = changes[f];
    var value;
    if (f === 'buyer') {
      value = str_(v);
      if (!ctx.buyers[value]) throw new Error('바이어 탭에 없는 바이어예요: ' + value);
    } else if (f === 'fruit') {
      value = str_(v);
      if (value && !ctx.fruits[value]) throw new Error('품목 탭에 없는 과일이에요: ' + value);
    } else if (f === 'ship') {
      value = str_(v) ? normShip_(v) : '';
      if (value === null) throw new Error('운송은 20ft, 40ft, 항공 중 하나예요.');
    } else if (f === 'status') {
      value = str_(v);
      if (value && STATUS_VALUES.indexOf(value) < 0) throw new Error('상태는 미정이나 확정이에요.');
    } else if (DATE_FIELDS.indexOf(f) >= 0) {
      value = parseIsoDate_(v);
    } else if (MONEY_FIELDS.indexOf(f) >= 0) {
      // 숫자 하나는 숫자로, '17.3/17.8'처럼 여러 값은 적은 글자 그대로(앞에 '를 붙여 시트가 날짜·숫자로 바꾸지 않게)
      var s = str_(v);
      var n = moneyNum_(s);
      if (s === '') value = '';
      else if (n !== null) value = n;
      else if (/\d/.test(s) && s.charAt(0) !== '-' && s.length <= 60) value = "'" + s;
      else throw new Error('금액은 숫자나 17.3/17.8처럼 적어 주세요: ' + s);
    } else {
      value = str_(v).slice(0, 500);
    }
    out[f] = { value: value, key: cellKey_(f, value) };
  });
  return out;
}

/** 칸 값을 비교할 수 있는 글자로. 같은 값이면 같은 글자. */
function cellKey_(f, v) {
  if (DATE_FIELDS.indexOf(f) >= 0) return toIsoDate_(v);
  if (MONEY_FIELDS.indexOf(f) >= 0) {
    var n = moneyNum_(v);
    return n === null ? moneyText_(v).replace(/^'/, '') : String(n);
  }
  if (f === 'ship') return normShip_(v) || str_(v);
  return str_(v);
}

/** 운송 값 맞추기. Air → 항공. 모르는 값이면 null. */
function normShip_(v) {
  var s = str_(v).toLowerCase();
  if (s === '20ft' || s === '20') return '20ft';
  if (s === '40ft' || s === '40') return '40ft';
  if (s === '항공' || s === 'air') return '항공';
  return null;
}

// ── remove ───────────────────────────────────────────

function remove_(member, ids) {
  if (!Array.isArray(ids) || !ids.length) return { ok: false, error: 'bad_request', message: '지울 줄이 없어요.' };
  return withLock_(function () {
    var t = readTable_('schedule');
    var byId = {};
    t.rows.forEach(function (r) { var id = str_(r.id); if (id && !byId[id]) byId[id] = r; });
    var now = new Date();
    var removed = 0;
    ids.forEach(function (id) {
      var r = byId[str_(id)];
      if (!r || toBool_(r.deleted)) return;
      writeCell_(t, r._row, 'deleted', true);
      writeCell_(t, r._row, 'updatedBy', member.name);
      writeCell_(t, r._row, 'updatedAt', now);
      removed++;
    });
    return { ok: true, removed: removed };
  });
}
