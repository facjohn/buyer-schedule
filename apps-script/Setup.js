/**
 * 시트 메뉴, 처음 설정, 예시 데이터, 팀원 코드, 시트에서 고친 줄 표시.
 * 접속 코드는 실행할 때 무작위로 만들고 알림창으로만 보여 준다. 이 파일에 코드를 적지 않는다.
 */

// 시트 드롭다운의 처음 값. 시트의 데이터 확인 규칙에서 바꿀 수 있다. 앱과 JPG는 이 목록이 아니라 줄과 바이어 탭의 값을 쓴다.
var DEFAULT_EXPORTERS = ['Hyun Nong Fresh', 'Royal'];

// 품목 첫 등록값 (CLAUDE.md 표기 규칙). 시즌 시작 월은 사람이 채운다.
var DEFAULT_FRUITS = [
  ['신고배', 'Singo pear'],
  ['신화배', 'Sinhwa pear'],
  ['샤인머스캣', 'Shine Muscat'],
  ['단감', 'Sweet persimmon'],
  ['설향 딸기', 'Seolhyang strawberry'],
  ['딸기', 'Strawberry'],
  ['곶감', 'Dried persimmon'],
  ['홍시', 'Soft persimmon'],
  ['키위', 'Kiwi'],
  ['참외', 'Korean melon']
];

var TAB_ORDER = ['schedule', 'buyers', 'fruits', 'specs', 'members', 'log'];
var HEADER_PROTECTION = '머리글 잠금';
var CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 헷갈리는 i l o 0 1 은 뺌
var PROP_APP_URL = 'APP_URL';
var PROP_SAMPLE = 'SAMPLE';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('바이어 스케줄')
    .addItem('팀원 코드 만들기', 'menuMakeMemberCode')
    .addItem('id·No. 정리', 'menuRepair')
    .addSeparator()
    .addItem('처음 설정 (탭·머리글·드롭다운)', 'setup')
    .addItem('앱 주소 넣기', 'menuSetAppUrl')
    .addSeparator()
    .addItem('예시 데이터 넣기', 'seedSample')
    .addItem('예시 데이터 지우기', 'clearSample')
    .addToUi();
}

// ── 처음 설정 ─────────────────────────────────────────

/** 몇 번 돌려도 된다. 이미 있는 탭과 데이터는 지우지 않는다. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  ss.setSpreadsheetLocale('ko_KR');

  TAB_ORDER.forEach(function (key, i) {
    var sh = ss.getSheetByName(TAB[key]) || ss.insertSheet(TAB[key]);
    ensureHeader_(sh, key);
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });

  // 처음 만든 빈 탭(시트1 등)은 지운다
  ss.getSheets().forEach(function (sh) {
    var ours = TAB_ORDER.some(function (k) { return TAB[k] === sh.getName(); });
    if (!ours && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  setupSchedule_(sheet_('schedule'));
  setupBuyers_(sheet_('buyers'));
  setupFruits_(sheet_('fruits'));
  setupMembers_(sheet_('members'));
  TAB_ORDER.forEach(function (key) { protectHeader_(sheet_(key)); });
  sheet_('log').hideSheet();
  ss.setActiveSheet(sheet_('schedule'));

  notify_('처음 설정을 마쳤어요.\n\n' +
    '· 탭: 스케줄, 바이어, 품목, 스펙, 팀원 (로그 탭은 숨김)\n' +
    '· 품목 탭의 "시즌 시작 월"(1~12)을 과일마다 채워 주세요. 비우면 1월부터로 봅니다.\n' +
    '· 다음: 메뉴 > 예시 데이터 넣기, 또는 바이어 탭부터 실제 값을 넣으세요.');
}

function ensureHeader_(sh, key) {
  var want = COLUMNS[key].map(function (c) { return c[1]; });
  if (sh.getLastRow() === 0 && sh.getLastColumn() === 0) {
    if (sh.getMaxColumns() < want.length) sh.insertColumnsAfter(sh.getMaxColumns(), want.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, want.length).setValues([want]);
  } else {
    headerMap_(key, sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]); // 빠진 칸이 있으면 여기서 멈춘다
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#E6F1EC');
}

function colRange_(sh, map, field) {
  return sh.getRange(2, map[field] + 1, sh.getMaxRows() - 1, 1);
}

function listRule_(values) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
}

function rangeRule_(range) {
  return SpreadsheetApp.newDataValidation().requireValueInRange(range, true).setAllowInvalid(false).build();
}

function setupSchedule_(sh) {
  var map = headerMap_('schedule', sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]);
  var buyers = sheet_('buyers');
  var fruits = sheet_('fruits');
  colRange_(sh, map, 'buyer').setDataValidation(rangeRule_(buyers.getRange('A2:A')));
  colRange_(sh, map, 'fruit').setDataValidation(rangeRule_(fruits.getRange('A2:A')));
  colRange_(sh, map, 'ship').setDataValidation(listRule_(SHIP_VALUES));
  colRange_(sh, map, 'status').setDataValidation(listRule_(STATUS_VALUES));
  colRange_(sh, map, 'exporter').setDataValidation(listRule_(DEFAULT_EXPORTERS));
  var dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build();
  ['eta', 'loadDate'].forEach(function (f) {
    colRange_(sh, map, f).setDataValidation(dateRule).setNumberFormat('yy"년" m"월" d"일" (ddd)');
  });
  colRange_(sh, map, 'price').setNumberFormat('#,##0.00');
  colRange_(sh, map, 'cost').setNumberFormat('"₩"#,##0');
  colRange_(sh, map, 'workCost').setNumberFormat('"₩"#,##0');
  colRange_(sh, map, 'no').setNumberFormat('@'); // 인보이스 번호(KINGO-26-01, 01)를 글자 그대로
  colRange_(sh, map, 'noYear').setNumberFormat('0');
  colRange_(sh, map, 'updatedAt').setNumberFormat('yy"년" m"월" d"일" hh:mm');
  colRange_(sh, map, 'deleted').insertCheckboxes();
  sh.hideColumns(map.id + 1);
}

function setupBuyers_(sh) {
  var map = headerMap_('buyers', sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]);
  colRange_(sh, map, 'exporter').setDataValidation(listRule_(DEFAULT_EXPORTERS));
  colRange_(sh, map, 'archived').insertCheckboxes();
}

function setupFruits_(sh) {
  var t = readTable_('fruits');
  if (!t.rows.length) {
    appendRows_(t, DEFAULT_FRUITS.map(function (f, i) {
      return { fruitKo: f[0], fruitEn: f[1], seasonStart: '', sortOrder: i + 1 };
    }));
  }
  var rule = SpreadsheetApp.newDataValidation().requireNumberBetween(1, 12)
    .setHelpText('1~12 (비우면 1월)').setAllowInvalid(false).build();
  colRange_(sh, t.map, 'seasonStart').setDataValidation(rule);
}

/** 가격 보기 구분은 없앴다(2026-10-14). 예전 설정으로 생긴 '가격 보기' 칸이 있으면 지운다. */
function setupMembers_(sh) {
  var header = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  var idx = header.indexOf('가격 보기');
  if (idx >= 0) sh.deleteColumn(idx + 1);
}

function protectHeader_(sh) {
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) {
    if (p.getDescription() === HEADER_PROTECTION) p.remove();
  });
  var p = sh.getRange(1, 1, 1, sh.getMaxColumns()).protect().setDescription(HEADER_PROTECTION);
  p.removeEditors(p.getEditors());
  if (p.canDomainEdit()) p.setDomainEdit(false);
}

// ── 팀원 코드 ─────────────────────────────────────────

/** 12자 이상 무작위 코드. 무작위 UUID를 해시해서 글자를 고른다(치우침 없게 248 이상 바이트는 버림). */
function makeCode_(len) {
  len = len || 16;
  var out = '';
  while (out.length < len) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
    for (var i = 0; i < bytes.length && out.length < len; i++) {
      var b = bytes[i] & 0xff;
      if (b < 248) out += CODE_ALPHABET.charAt(b % CODE_ALPHABET.length);
    }
  }
  return out;
}

function appLink_(code) {
  var url = PropertiesService.getScriptProperties().getProperty(PROP_APP_URL);
  return url ? url.replace(/#.*$/, '') + '#code=' + code : '';
}

function addMember_(name) {
  var code = makeCode_(16);
  appendRows_(readTable_('members'), [{ name: name, code: code }]);
  return code;
}

function menuMakeMemberCode() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('팀원 코드 만들기', '팀원 이름을 넣어 주세요.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var name = str_(r.getResponseText());
  if (!name) return ui.alert('이름이 비어 있어요.');
  var code = addMember_(name);
  var link = appLink_(code);
  ui.alert('팀원 코드를 만들었어요',
    name + '님 코드: ' + code + '\n\n' +
    (link ? '이 링크를 ' + name + '님에게만 보내 주세요:\n' + link
          : '앱 주소를 아직 안 넣었어요. 메뉴 > 앱 주소 넣기를 하면 다음부터 링크로 보여 드려요.') +
    '\n\n코드를 지우려면 팀원 탭에서 그 줄을 지우면 됩니다.',
    ui.ButtonSet.OK);
}

function menuSetAppUrl() {
  var ui = SpreadsheetApp.getUi();
  var cur = PropertiesService.getScriptProperties().getProperty(PROP_APP_URL) || '';
  var r = ui.prompt('앱 주소 넣기', '앱 주소(https://…github.io/…)를 넣어 주세요.' + (cur ? '\n지금: ' + cur : ''), ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var url = str_(r.getResponseText());
  if (!/^https:\/\//.test(url)) return ui.alert('https:// 로 시작하는 주소를 넣어 주세요.');
  PropertiesService.getScriptProperties().setProperty(PROP_APP_URL, url);
  ui.alert('앱 주소를 넣었어요: ' + url);
}

function menuRepair() {
  var n = repairIfNeeded_(true); // 메뉴에서는 시트에서 막 고친 줄도 바로 붙인다
  notify_(n ? n + '줄의 id·No.를 채웠어요.' : '고칠 줄이 없어요.');
}

// ── 시트에서 고친 줄 표시 ─────────────────────────────

/** 시트에서 직접 고치면 수정자 "시트"와 수정 시각을 남긴다(앱의 저장은 이 함수를 부르지 않음). */
function onEdit(e) {
  try {
    var sh = e.range.getSheet();
    if (sh.getName() !== TAB.schedule) return;
    var r0 = Math.max(e.range.getRow(), 2);
    var r1 = e.range.getRow() + e.range.getNumRows() - 1;
    if (r1 < r0) return;
    var width = sh.getLastColumn();
    var map = headerMap_('schedule', sh.getRange(1, 1, 1, width).getValues()[0]);
    var c0 = e.range.getColumn();
    var c1 = c0 + e.range.getNumColumns() - 1;
    var stampOnly = true;
    for (var c = c0; c <= c1; c++) {
      if (c !== map.updatedBy + 1 && c !== map.updatedAt + 1) stampOnly = false;
    }
    if (stampOnly) return;

    var values = sh.getRange(r0, 1, r1 - r0 + 1, width).getValues();
    var now = new Date();
    var by = values.map(function (line) {
      var o = {};
      KEY_FIELDS.schedule.forEach(function (f) { o[f] = line[map[f]]; });
      return isKeyRow_('schedule', o) ? ['시트'] : [line[map.updatedBy]];
    });
    var at = values.map(function (line, i) { return [by[i][0] === '시트' ? now : line[map.updatedAt]]; });
    sh.getRange(r0, map.updatedBy + 1, by.length, 1).setValues(by);
    sh.getRange(r0, map.updatedAt + 1, at.length, 1).setValues(at);
  } catch (err) {
    // 표시를 못 남겨도 시트 편집은 그대로 둔다.
  }
}

// ── 예시 데이터 ───────────────────────────────────────

var SAMPLE_BUYERS = [
  ['바이어 A', 'Buyer A', '대만', 'Taiwan', 'Hyun Nong Fresh'],
  ['바이어 B', 'Buyer B', '말레이시아', 'Malaysia', 'Hyun Nong Fresh'],
  ['바이어 C', 'Buyer C', '인도네시아', 'Indonesia', 'Hyun Nong Fresh'],
  ['바이어 D', 'Buyer D', '홍콩', 'Hong Kong', 'Royal'],
  ['바이어 E', 'Buyer E', '미국', 'USA', 'Hyun Nong Fresh'],
  ['바이어 F', 'Buyer F', '베트남', 'Vietnam', 'Hyun Nong Fresh']
];

var SAMPLE_SPECS = [
  ['샤인머스캣', '2kg 4송이', '2kg, 4 bunches'],
  ['신고배', '5kg 7과', '5kg, Size 7'],
  ['신고배', '15kg 18-24', '15kg, 18-24'],
  ['신고배', '15kg 26-30', '15kg, 26-30'],
  ['단감', '10kg', '10kg']
];

// 바이어, No., 번호 해, 과일, 운송, 스펙, ETA, 바이어가, 산지가, 작업비, 상태, 상차일, 산지, 수량, 메모
// 지난 시즌(2025년) 줄은 단가 흐름에서 시즌 구분을 보려고 넣었다. 바이어 A No. 6은 산지가를 비워 '산지가 빈 건'을 보여 준다.
var SAMPLE_ROWS = [
  ['바이어 A', 1, 2025, '신고배', '40ft', '5kg 7과', '2025-10-21', 12.9, 14500, 1700, '확정', '2025-10-10', '나주', '40ft 1대', ''],
  ['바이어 B', 1, 2025, '신고배', '40ft', '5kg 7과', '2025-11-04', 12.8, 14500, 1700, '확정', '2025-10-24', '나주', '', ''],
  ['바이어 A', 2, 2025, '신고배', '40ft', '5kg 7과', '2025-11-18', 13.2, 15000, 1700, '확정', '2025-11-06', '나주', '', ''],
  ['바이어 A', 3, 2025, '신고배', '40ft', '5kg 7과', '2025-12-09', 13.4, 15000, 1700, '확정', '2025-11-27', '나주', '', ''],
  ['바이어 A', 1, 2026, '샤인머스캣', '항공', '2kg 4송이', '2026-10-20', 24.5, 28000, '', '확정', '2026-10-18', '상주', '300박스', ''],
  ['바이어 B', 1, 2026, '신고배', '40ft', '5kg 7과', '2026-10-23', 13.5, 15500, 1800, '확정', '2026-10-12', '나주', '40ft 1대', ''],
  ['바이어 A', 2, 2026, '신고배', '40ft', '5kg 7과', '2026-10-27', 13.8, 15500, 1800, '확정', '2026-10-15', '나주', '', ''],
  ['바이어 A', 3, 2026, '샤인머스캣', '항공', '2kg 4송이', '2026-10-27', 24.5, 28000, '', '확정', '2026-10-25', '상주', '', ''],
  ['바이어 C', 1, 2026, '신고배', '40ft', '5kg 7과', '2026-10-27', 13.6, 15500, 1800, '확정', '2026-10-14', '나주', '', ''],
  ['바이어 D', 1, 2026, '단감', '20ft', '10kg', '2026-10-30', 15.0, 17000, '', '확정', '2026-10-20', '창원', '', ''],
  ['바이어 A', 4, 2026, '신고배', '40ft', '5kg 7과', '2026-11-03', 13.8, 15500, 1800, '확정', '2026-10-22', '나주', '', '단감과 같은 컨테이너'],
  ['바이어 A', 4, 2026, '단감', '40ft', '10kg', '2026-11-03', 15.2, 17000, '', '확정', '2026-10-22', '창원', '', ''],
  ['바이어 A', 5, 2026, '샤인머스캣', '항공', '2kg 4송이', '2026-11-10', 24.5, 28000, '', '미정', '', '상주', '', ''],
  ['바이어 E', 1, 2026, '신고배', '40ft', '15kg 18-24', '2026-11-12', 31.0, 28000, 12000, '미정', '2026-10-28', '나주', '', ''],
  ['바이어 E', 1, 2026, '신고배', '40ft', '15kg 26-30', '2026-11-12', 26.5, 23000, 12000, '미정', '2026-10-28', '나주', '', ''],
  ['바이어 D', 2, 2026, '단감', '20ft', '10kg', '2026-11-17', 15.0, 16500, '', '미정', '', '진영', '', ''],
  ['바이어 A', 6, 2026, '신고배', '40ft', '5kg 7과', '2026-12-01', 14.2, '', '', '미정', '', '', '', '']
];

function seedSample() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(PROP_SAMPLE)) return notify_('예시 데이터가 이미 있어요. 다시 넣으려면 먼저 예시 데이터 지우기를 하세요.');

  var now = new Date();
  appendRows_(readTable_('buyers'), SAMPLE_BUYERS.map(function (b, i) {
    return { name: b[0], nameEn: b[1], country: b[2], countryEn: b[3], currency: 'USD', priceUnit: 'carton',
      priceTerm: 'FOB', exporter: b[4], sortOrder: i + 1, archived: false };
  }));
  appendRows_(readTable_('specs'), SAMPLE_SPECS.map(function (s) {
    return { fruitKo: s[0], specKo: s[1], specEn: s[2] };
  }));
  var specEn = {};
  SAMPLE_SPECS.forEach(function (s) { specEn[s[0] + '|' + s[1]] = s[2]; });

  var ids = [];
  appendRows_(readTable_('schedule'), SAMPLE_ROWS.map(function (r) {
    var id = newId_();
    ids.push(id);
    return {
      id: id, buyer: r[0], no: r[1], noYear: r[2], fruit: r[3], ship: r[4], specKo: r[5],
      specEn: specEn[r[3] + '|' + r[5]] || '', eta: parseIsoDate_(r[6]), price: r[7], cost: r[8],
      workCost: r[9], status: r[10], loadDate: parseIsoDate_(r[11]), exporter: '', origin: r[12],
      qty: r[13], memo: r[14], updatedBy: '예시', updatedAt: now, deleted: false
    };
  }));

  // 두 사람이 같이 고치는 걸 폰 두 대로 시험할 수 있게 둘
  var names = ['예시 직원 1', '예시 직원 2'];
  var codes = names.map(function (n) { return addMember_(n); });

  props.setProperty(PROP_SAMPLE, JSON.stringify({
    scheduleIds: ids,
    buyers: SAMPLE_BUYERS.map(function (b) { return b[0]; }),
    specs: SAMPLE_SPECS.map(function (s) { return s[0] + '|' + s[1]; }),
    members: names
  }));

  notify_('예시 데이터를 넣었어요. 코드는 이 창에서만 보여 드려요.\n\n' +
    names.map(function (n, i) {
      var link = appLink_(codes[i]);
      return '· ' + n + ': ' + codes[i] + (link ? '\n  ' + link : '');
    }).join('\n') +
    '\n\n두 코드는 팀원 탭에도 있어요. 실제로 쓰기 전에 메뉴 > 예시 데이터 지우기를 하세요.');
}

/** 예시로 넣은 줄만 지운다(행 삭제). 실제 데이터는 건드리지 않는다. */
function clearSample() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(PROP_SAMPLE);
  if (!raw) return notify_('지울 예시 데이터가 없어요.');
  var s = JSON.parse(raw);
  var n = 0;
  n += deleteRowsWhere_('schedule', function (r) { return s.scheduleIds.indexOf(str_(r.id)) >= 0; });
  n += deleteRowsWhere_('buyers', function (r) { return s.buyers.indexOf(str_(r.name)) >= 0; });
  n += deleteRowsWhere_('specs', function (r) { return s.specs.indexOf(str_(r.fruitKo) + '|' + str_(r.specKo)) >= 0; });
  n += deleteRowsWhere_('members', function (r) { return s.members.indexOf(str_(r.name)) >= 0; });
  props.deleteProperty(PROP_SAMPLE);
  notify_('예시 데이터 ' + n + '줄을 지웠어요.');
}

function deleteRowsWhere_(key, test) {
  var t = readTable_(key);
  var rows = t.rows.filter(test).map(function (r) { return r._row; }).sort(function (a, b) { return b - a; });
  rows.forEach(function (row) { t.sheet.deleteRow(row); });
  return rows.length;
}

function notify_(msg) {
  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}
