/**
 * 바이어 더하기·고치기(2026-10-19 사용자 요청: 앱에서 바이어 추가·수정).
 * - original이 없으면 바이어 탭 맨 아래에 한 줄을 더한다(순서는 맨 뒤, 가격 단위 carton).
 * - original이 있으면 그 바이어의 바뀐 칸만 고친다. 이름을 바꾸면 스케줄 탭에서 그 바이어 줄(지운 줄 포함)의
 *   바이어 칸도 모두 새 이름으로 바꾼다(일정이 바이어와 떨어지지 않게).
 * - 이름이 이미 있으면(숨긴 바이어 포함, 앞뒤 공백·대소문자 무시) 거절한다.
 * 고치는 칸: 이름, 영어 이름, 나라, 통화, 가격 조건, 기본 회사. 나머지(나라 영어, 가격 단위, 순서, 숨김)는 시트에서.
 */

var BUYER_EDIT_FIELDS = ['name', 'nameEn', 'country', 'currency', 'priceTerm', 'exporter'];

function buyerKey_(s) {
  return str_(s).replace(/\s+/g, ' ').toLowerCase();
}

/** 받은 바이어 칸 확인. 틀리면 Error */
function cleanBuyer_(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('바이어 정보가 없어요.');
  var out = {
    name: str_(b.name).replace(/\s+/g, ' '),
    nameEn: str_(b.nameEn).replace(/\s+/g, ' '),
    country: str_(b.country),
    currency: str_(b.currency).toUpperCase() || 'USD',
    priceTerm: str_(b.priceTerm).toUpperCase(),
    exporter: str_(b.exporter)
  };
  if (!out.name) throw new Error('바이어 이름을 넣어 주세요.');
  if (out.name.length > 40 || out.name.indexOf('|') >= 0) throw new Error('바이어 이름이 너무 길거나 쓸 수 없는 글자(|)가 있어요.');
  if (out.nameEn.length > 60 || out.country.length > 40 || out.exporter.length > 60) throw new Error('글자가 너무 길어요.');
  if (!/^[A-Z]{3}$/.test(out.currency)) throw new Error('통화는 USD처럼 영어 세 글자예요.');
  if (out.priceTerm && !/^[A-Z]{2,6}$/.test(out.priceTerm)) throw new Error('가격 조건은 FOB·CIF처럼 영어로 써 주세요.');
  return out;
}

/** 시트에 쓸 값. 글자 칸은 앞에 '를 붙여 시트가 숫자·날짜로 바꾸지 않게 */
function buyerCell_(field, value) {
  if (field === 'currency' || field === 'priceTerm') return value;
  return value ? "'" + value : '';
}

function saveBuyer_(member, buyer, original) {
  var b = cleanBuyer_(buyer);
  original = str_(original);
  return withLock_(function () {
    var t = readTable_('buyers');
    var cur = null;
    if (original) {
      t.rows.forEach(function (r) { if (!cur && str_(r.name) === original) cur = r; });
      if (!cur) throw new Error('"' + original + '" 바이어를 시트에서 찾지 못했어요. 목록을 새로 불러 주세요.');
    }
    var dup = null;
    t.rows.forEach(function (r) { if (!dup && r !== cur && buyerKey_(r.name) === buyerKey_(b.name)) dup = r; });
    if (dup) {
      throw new Error(toBool_(dup.archived)
        ? '"' + str_(dup.name) + '"는 바이어 탭에 숨겨져 있어요. 시트 바이어 탭에서 숨김을 풀어 주세요.'
        : '"' + str_(dup.name) + '"는 이미 있는 바이어예요.');
    }

    if (!cur) {
      var maxOrder = 0;
      t.rows.forEach(function (r) { var n = toNum_(r.sortOrder); if (n !== null && n > maxOrder) maxOrder = n; });
      var row = { priceUnit: 'carton', sortOrder: maxOrder + 1, archived: false };
      BUYER_EDIT_FIELDS.forEach(function (f) { row[f] = buyerCell_(f, b[f]); });
      appendRows_(t, [row]);
      return { ok: true, name: b.name, added: true, renamed: 0 };
    }

    var changed = 0;
    BUYER_EDIT_FIELDS.forEach(function (f) {
      // 통화·조건은 비어 있으면 앱에서 USD·FOB로 보이므로, 그 값 그대로면 빈칸을 굳이 채우지 않는다
      var now = str_(cur[f]);
      if (f === 'currency' && !now && b[f] === 'USD') return;
      if (now === b[f]) return;
      writeCell_(t, cur._row, f, buyerCell_(f, b[f]));
      changed++;
    });

    var renamed = 0;
    if (b.name !== str_(cur.name)) {
      var s = readTable_('schedule');
      var at = new Date();
      s.rows.forEach(function (r) {
        if (str_(r.buyer) !== original) return;
        writeCell_(s, r._row, 'buyer', "'" + b.name);
        writeCell_(s, r._row, 'updatedBy', member.name);
        writeCell_(s, r._row, 'updatedAt', at);
        renamed++;
      });
    }
    return { ok: true, name: b.name, added: false, changed: changed, renamed: renamed };
  });
}
