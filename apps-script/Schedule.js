/**
 * 스케줄 읽기·저장·삭제 표시와 id·No. 붙이기.
 *
 * No. 규칙 (CLAUDE.md 절대 규칙 5)
 * - 선적(컨테이너나 항공 건) 하나에 하나. 같은 컨테이너의 사이즈·과일은 같은 No.의 줄 여러 개.
 * - 바이어별로, 번호를 센 해(noYear = 처음 붙일 때의 ETA 해)마다 지운 건 포함 최댓값 + 1.
 * - 한 번 붙은 No.와 noYear는 ETA가 해를 넘어가도 그대로. 바이어를 바꾼 줄만 새 No.
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
    noMax: noMaxTable_(t.rows),
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
    no: toNum_(r.no),
    noYear: toNum_(r.noYear),
    fruit: fruit,
    ship: normShip_(r.ship) || str_(r.ship),
    specKo: specKo,
    specEn: specMap[fruit + '|' + specKo] || str_(r.specEn),
    eta: toIsoDate_(r.eta),
    price: toNum_(r.price),
    cost: toNum_(r.cost),
    workCost: toNum_(r.workCost),
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

function specMap_(specs) {
  var map = {};
  specs.forEach(function (s) {
    var k = s.fruitKo + '|' + s.specKo;
    if (!map[k] && s.specEn) map[k] = s.specEn;
  });
  return map;
}

/** 바이어·해별 No. 최댓값. 지운 줄도 센다(지운 번호를 다시 쓰지 않게). */
function noMaxTable_(rows) {
  var max = {};
  rows.forEach(function (r) {
    var buyer = str_(r.buyer);
    var no = toNum_(r.no);
    if (!buyer || !no) return;
    var k = buyer + '|' + (toNum_(r.noYear) || yearOf_(r.eta));
    if (!max[k] || no > max[k]) max[k] = no;
  });
  return max;
}

function nextNo_(max, buyer, year) {
  var k = buyer + '|' + year;
  max[k] = (max[k] || 0) + 1;
  return max[k];
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
  var max = noMaxTable_(rows);
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
    var no = toNum_(r.no);
    var justEdited = isDate_(r.updatedAt) && now - r.updatedAt.getTime() < SHEET_EDIT_WAIT_MS;
    if (justEdited && !force) {
      if (changed) fixes.push(fix);
      return;
    }
    if (buyer && no && !toNum_(r.noYear)) {
      fix.noYear = yearOf_(r.eta);
      changed = true;
    }
    if (buyer && !no) {
      fix.noYear = yearOf_(r.eta);
      fix.no = nextNo_(max, buyer, fix.noYear);
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
 * items: [{ id?, key?, join?: {no, noYear}, changes: {필드: 값} }]
 * - id가 있으면 그 줄의 바뀐 칸만 쓴다.
 * - id가 없으면 새 줄. join이 있으면 그 컨테이너(같은 바이어의 기존 No.)에, 없으면 새 No.
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
    var containers = {};
    t.rows.forEach(function (r) {
      var id = str_(r.id);
      if (id && !byId[id]) byId[id] = r;
      // 번호 해가 빈 줄(시트에서 No.만 적은 줄)은 noMaxTable_처럼 ETA의 해로 본다
      if (!toBool_(r.deleted)) containers[containerKey_(r.buyer, r.no, toNum_(r.noYear) || yearOf_(r.eta))] = true;
    });
    var max = noMaxTable_(t.rows);
    var now = new Date();
    var appends = [];
    var specAdds = [];
    var saved = [];

    // 응답만 끊겨 같은 새 줄을 다시 보낸 경우: 이미 만든 줄을 고치는 것으로 바꾼다(줄이 두 번 생기지 않게)
    var cache = CacheService.getScriptCache();
    items = items.map(function (item) {
      if (item.id || !isSaveKey_(item.key)) return item;
      var made = cache.get('sv:' + item.key);
      var row = made ? byId[made] : null;
      return row && !toBool_(row.deleted) ? { id: made, key: item.key, join: item.join, changes: item.changes } : item;
    });

    // 먼저 모두 확인하고 나서 쓴다. 중간에 틀린 줄이 있으면 아무것도 쓰지 않는다.
    var checked = items.map(function (item) {
      var changes = cleanChanges_(item.changes || {}, ctx);
      var cur = item.id ? byId[item.id] : null;
      if (item.id && (!cur || toBool_(cur.deleted))) {
        throw new Error('다른 사람이 이 줄을 지웠어요. 목록으로 돌아가 확인해 주세요.');
      }
      if (!cur && !changes.buyer) throw new Error('바이어를 골라 주세요.');
      if (item.join) checkJoin_(item.join, changes.buyer ? changes.buyer.value : str_(cur.buyer), containers);
      return { item: item, cur: cur, changes: changes };
    });

    checked.forEach(function (c) {
      var item = c.item, cur = c.cur, changes = c.changes;
      var result;
      if (cur) {
        result = updateRow_(t, cur, changes, item.join, max, containers, member, now);
      } else {
        result = newRow_(changes, item.join, max, containers, member, now);
        appends.push(result.row);
        byId[result.id] = result.row;
        if (isSaveKey_(item.key)) cache.put('sv:' + item.key, result.id, 1800);
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
    return { ok: true, saved: saved };
  });
}

function updateRow_(t, cur, changes, join, max, containers, member, now) {
  var writes = {};
  Object.keys(changes).forEach(function (f) {
    if (changes[f].key !== cellKey_(f, cur[f])) writes[f] = changes[f].value;
  });

  var curBuyer = str_(cur.buyer);
  var buyer = writes.buyer !== undefined ? str_(writes.buyer) : curBuyer;
  var eta = writes.eta !== undefined ? writes.eta : cur.eta;
  var no = toNum_(cur.no);
  var noYear = toNum_(cur.noYear);

  if (join) {
    var j = checkJoin_(join, buyer, containers);
    if (j.no !== no || j.noYear !== noYear) {
      writes.no = no = j.no;
      writes.noYear = noYear = j.noYear;
    }
  } else if (buyer && buyer !== curBuyer) {
    noYear = yearOf_(eta);
    no = nextNo_(max, buyer, noYear);
    writes.no = no;
    writes.noYear = noYear;
  }
  // No.가 빈 줄(시트에서 붙여 넣는 중)은 여기서 붙이지 않고 findRepairs_에 맡긴다(ETA를 고치는 중일 수 있어서)
  if (buyer && no) containers[containerKey_(buyer, no, noYear || yearOf_(eta))] = true;

  var fields = Object.keys(writes);
  if (fields.length) {
    writes.updatedBy = member.name;
    writes.updatedAt = now;
    Object.keys(writes).forEach(function (f) { writeCell_(t, cur._row, f, writes[f]); });
  }

  return {
    id: str_(cur.id), no: no, noYear: noYear, changed: fields.length,
    final: {
      fruit: str_(writes.fruit !== undefined ? writes.fruit : cur.fruit),
      specKo: str_(writes.specKo !== undefined ? writes.specKo : cur.specKo),
      specEn: str_(writes.specEn !== undefined ? writes.specEn : cur.specEn)
    }
  };
}

function newRow_(changes, join, max, containers, member, now) {
  var row = {};
  Object.keys(changes).forEach(function (f) { row[f] = changes[f].value; });
  var buyer = str_(row.buyer);
  if (!buyer) throw new Error('바이어를 골라 주세요.');
  if (!row.status) row.status = '미정';

  var no, noYear;
  if (join) {
    var j = checkJoin_(join, buyer, containers);
    no = j.no;
    noYear = j.noYear;
  } else {
    noYear = yearOf_(row.eta);
    no = nextNo_(max, buyer, noYear);
  }
  containers[containerKey_(buyer, no, noYear)] = true;

  row.id = newId_();
  row.no = no;
  row.noYear = noYear;
  row.updatedBy = member.name;
  row.updatedAt = now;
  row.deleted = false;
  return {
    row: row, id: row.id, no: no, noYear: noYear, changed: Object.keys(changes).length,
    final: { fruit: str_(row.fruit), specKo: str_(row.specKo), specEn: str_(row.specEn) }
  };
}

/** 앱이 입력 화면마다 만드는 저장 표시(같은 새 줄을 두 번 만들지 않으려고) */
function isSaveKey_(key) {
  return typeof key === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(key);
}

function containerKey_(buyer, no, noYear) {
  return str_(buyer) + '|' + toNum_(no) + '|' + toNum_(noYear);
}

/** 같은 컨테이너에 더할 때: 그 바이어에 그 No.가 실제로 있어야 한다. */
function checkJoin_(join, buyer, containers) {
  var no = toNum_(join.no);
  var noYear = toNum_(join.noYear);
  if (!no || !noYear || !containers[containerKey_(buyer, no, noYear)]) {
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
      value = str_(v) === '' ? '' : toNum_(v);
      if (value === null || value < 0) throw new Error('금액이 숫자가 아니에요: ' + v);
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
    var n = toNum_(v);
    return n === null ? '' : String(n);
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
