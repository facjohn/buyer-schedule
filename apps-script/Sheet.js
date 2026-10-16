/**
 * 시트 이름과 열, 값 변환.
 * 열은 머리글 이름으로 찾는다. 시트에서 열 순서가 바뀌어도 읽히지만, 머리글 글자가 바뀌면 멈춘다.
 */

var TZ = 'Asia/Seoul';

var TAB = {
  schedule: '스케줄',
  buyers: '바이어',
  fruits: '품목',
  specs: '스펙',
  members: '팀원',
  log: '로그'
};

// [코드 이름, 시트 머리글]. 처음 설정할 때 시트 열도 이 순서로 만든다.
var COLUMNS = {
  schedule: [
    ['id', 'id'],
    ['buyer', '바이어'],
    ['no', 'No.'],
    ['fruit', '과일'],
    ['ship', '운송'],
    ['specKo', '스펙'],
    ['specEn', '스펙 영어'],
    ['eta', 'ETA'],
    ['price', '바이어가'],
    ['cost', '산지가'],
    ['workCost', '작업비'],
    ['status', '상태'],
    ['loadDate', '상차일'],
    ['exporter', '회사'],
    ['origin', '산지'],
    ['qty', '수량'],
    ['memo', '메모'],
    ['noYear', '번호 해'],
    ['updatedBy', '수정자'],
    ['updatedAt', '수정 시각'],
    ['deleted', '삭제']
  ],
  buyers: [
    ['name', '이름'],
    ['nameEn', '영어 이름'],
    ['country', '나라'],
    ['countryEn', '나라 영어'],
    ['currency', '통화'],
    ['priceUnit', '가격 단위'],
    ['priceTerm', '가격 조건'],
    ['exporter', '기본 회사'],
    ['sortOrder', '순서'],
    ['archived', '숨김']
  ],
  fruits: [
    ['fruitKo', '과일'],
    ['fruitEn', '영어'],
    ['seasonStart', '시즌 시작 월'],
    ['sortOrder', '순서']
  ],
  specs: [
    ['fruitKo', '과일'],
    ['specKo', '스펙'],
    ['specEn', '스펙 영어']
  ],
  members: [
    ['name', '이름'],
    ['code', '접속 코드']
  ],
  log: [
    ['at', '처음 시각'],
    ['lastAt', '마지막 시각'],
    ['type', '종류'],
    ['detail', '내용'],
    ['count', '횟수']
  ]
};

// 이 칸 중 하나라도 차 있어야 데이터 줄로 본다. 체크박스만 있는 빈 줄은 건너뛴다.
var KEY_FIELDS = {
  schedule: ['id', 'buyer', 'fruit', 'specKo', 'eta'],
  buyers: ['name'],
  fruits: ['fruitKo'],
  specs: ['fruitKo', 'specKo'],
  members: ['name', 'code'],
  log: ['type']
};

function sheet_(key) {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB[key]);
  if (!sh) throw new Error('"' + TAB[key] + '" 탭이 없어요. 시트 메뉴의 처음 설정을 먼저 실행해 주세요.');
  return sh;
}

function headerMap_(key, header) {
  var names = header.map(function (h) { return String(h).trim(); });
  var map = {};
  COLUMNS[key].forEach(function (c) {
    var idx = names.indexOf(c[1]);
    if (idx < 0) throw new Error('"' + TAB[key] + '" 탭 머리글에 "' + c[1] + '" 칸이 없어요.');
    map[c[0]] = idx;
  });
  return map;
}

/**
 * 탭 하나를 읽는다.
 * rows: 데이터 줄(_row는 시트 행 번호), lastRow: 내용이 있는 마지막 행(새 줄은 그 아래에 붙인다)
 */
function readTable_(key) {
  var sh = sheet_(key);
  var values = sh.getDataRange().getValues();
  var header = values[0] || [];
  var map = headerMap_(key, header);
  var rows = [];
  var lastRow = 1;
  for (var i = 1; i < values.length; i++) {
    var line = values[i];
    if (rowHasAny_(line)) lastRow = i + 1;
    var o = { _row: i + 1 };
    for (var k in map) o[k] = line[map[k]];
    if (!isKeyRow_(key, o)) continue;
    rows.push(o);
  }
  return { key: key, sheet: sh, map: map, rows: rows, lastRow: lastRow, width: header.length };
}

function rowHasAny_(line) {
  for (var i = 0; i < line.length; i++) {
    if (line[i] !== '' && line[i] !== false && line[i] !== null) return true;
  }
  return false;
}

function isKeyRow_(key, o) {
  return KEY_FIELDS[key].some(function (f) { return str_(o[f]) !== ''; });
}

function writeCell_(table, rowNum, field, value) {
  table.sheet.getRange(rowNum, table.map[field] + 1).setValue(value);
}

/** objs: [{필드: 값}] 를 마지막 내용 아래에 붙인다. */
function appendRows_(table, objs) {
  if (!objs.length) return;
  var sh = table.sheet;
  var start = table.lastRow + 1;
  var need = start + objs.length - 1 - sh.getMaxRows();
  if (need > 0) sh.insertRowsAfter(sh.getMaxRows(), need);
  var data = objs.map(function (o) {
    var line = [];
    for (var i = 0; i < table.width; i++) line.push('');
    for (var f in o) {
      if (table.map[f] !== undefined) line[table.map[f]] = o[f];
    }
    return line;
  });
  sh.getRange(start, 1, data.length, table.width).setValues(data);
  table.lastRow = start + data.length - 1;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    throw new Error('다른 사람이 저장하는 중이에요. 잠시 뒤 다시 해 주세요.');
  }
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

// ── 값 변환 ──────────────────────────────────────────

function str_(v) {
  if (v === null || v === undefined || v === false) return '';
  return String(v).trim();
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function toNum_(v) {
  if (v === '' || v === null || v === undefined || v === false) return null;
  var n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s₩$]/g, ''));
  return isFinite(n) ? n : null;
}

/**
 * 금액 칸의 숫자 하나. '$17.80', '28,000', '28000원'은 숫자로, '17.3/17.8'·'17 18'처럼 여러 값이면 null.
 * (toNum_은 칸 안의 빈칸·쉼표를 모두 지워 '17 18'을 1718로 읽으므로 금액에는 쓰지 않는다)
 */
function moneyNum_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (isDate_(v)) return null;
  var s = str_(v).replace(/^[₩$]\s*/, '').replace(/\s*원$/, '');
  if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(s)) s = s.replace(/,/g, '');
  // '17.'(소수점까지만 친 값)과 '.5'도 숫자 하나
  return /^(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null;
}

/** 금액 칸 → 앱: 숫자 하나면 숫자, '17.3/17.8'처럼 여러 값이나 다른 글자면 적힌 글자 그대로, 비었으면 null */
function moneyOut_(v) {
  var n = moneyNum_(v);
  if (n !== null) return n;
  var s = moneyText_(v);
  return s === '' ? null : s;
}

/** 금액 칸의 글자. 시트가 '12/13'(두 가격)을 날짜로 바꿔 둔 칸은 적은 모양(12/13)으로 되돌린다 */
function moneyText_(v) {
  return isDate_(v) ? Utilities.formatDate(v, TZ, 'M/d') : str_(v);
}

function toBool_(v) {
  if (v === true) return true;
  var s = String(v).trim().toUpperCase();
  return s === 'TRUE' || s === 'Y' || s === 'O' || s === '1';
}

/** 시트 날짜 값 → 'yyyy-MM-dd'. 날짜가 아니면 ''. */
function toIsoDate_(v) {
  if (isDate_(v)) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  var s = str_(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/** 'yyyy-MM-dd' → 그날 0시(서울) Date. 빈 값이면 ''. */
function parseIsoDate_(s) {
  s = str_(s);
  if (!s) return '';
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error('날짜 형식이 아니에요: ' + s);
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (toIsoDate_(d) !== s) throw new Error('없는 날짜예요: ' + s);
  return d;
}

function toIsoDateTime_(v) {
  return isDate_(v) ? v.toISOString() : '';
}

function todayIso_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function currentYear_() {
  return Number(todayIso_().slice(0, 4));
}

/** 오늘부터 n개월 전 날짜 'yyyy-MM-dd' */
function monthsAgoIso_(n) {
  var t = todayIso_();
  var y = Number(t.slice(0, 4));
  var m = Number(t.slice(5, 7)) - n;
  while (m < 1) { m += 12; y -= 1; }
  return y + '-' + (m < 10 ? '0' : '') + m + t.slice(7);
}

/** 날짜 값의 해. 날짜가 없으면 올해. */
function yearOf_(v) {
  var iso = toIsoDate_(v);
  return iso ? Number(iso.slice(0, 4)) : currentYear_();
}

function newId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}
