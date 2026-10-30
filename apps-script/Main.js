/**
 * 웹 앱 창구. 앱은 POST로만 부른다(본문은 JSON 문자열, text/plain).
 * 모든 요청에서 접속 코드를 먼저 확인하고, 틀리면 데이터 없이 거절한다.
 */

function doPost(e) {
  var req = null;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    req = null;
  }
  if (!req || typeof req !== 'object' || Array.isArray(req)) {
    logEvent_('bad_request', '본문이 JSON이 아님');
    return reply_({ ok: false, error: 'bad_request' });
  }

  var member = findMember_(req.code);
  if (!member) {
    logEvent_('bad_code', maskCode_(req.code) + ' · ' + str_(req.action).slice(0, 20));
    return reply_({ ok: false, error: 'bad_code' });
  }

  try {
    return reply_(route_(req, member));
  } catch (err) {
    return reply_({ ok: false, error: 'server', message: String((err && err.message) || err) });
  }
}

function route_(req, member) {
  switch (req.action) {
    case 'list': return list_(member);
    case 'save': return withList_(save_(member, req.items), req, member);
    case 'remove': return withList_(remove_(member, req.ids), req, member);
    case 'prices': return prices_(member, req.fruit);
    case 'saveBuyer': return saveBuyer_(member, req.buyer, req.original);
    default: return { ok: false, error: 'bad_action' };
  }
}

/**
 * 앱이 바라면(withList) 저장·지우기 결과에 새 목록을 붙여 보낸다. 저장 뒤 목록 다시 읽기 요청 한 번을 줄여
 * 폰에서 저장이 빨라진다(2026-10-30 사용자 요청 "스케쥴 저장할때 로딩시간이 너무 오래걸려").
 */
function withList_(res, req, member) {
  if (res && res.ok && req.withList) res.list = list_(member);
  return res;
}

/** 브라우저로 주소를 열었을 때. 데이터는 주지 않는다. */
function doGet() {
  return reply_({ ok: false, error: 'use_post' });
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
