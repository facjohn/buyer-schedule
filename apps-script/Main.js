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
    case 'save': return save_(member, req.items);
    case 'remove': return remove_(member, req.ids);
    case 'prices': return prices_(member, req.fruit);
    default: return { ok: false, error: 'bad_action' };
  }
}

/** 브라우저로 주소를 열었을 때. 데이터는 주지 않는다. */
function doGet() {
  return reply_({ ok: false, error: 'use_post' });
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
