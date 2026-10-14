/**
 * 접속 코드 확인과 로그.
 * 맞는 코드는 언제나 통과시킨다. 창구는 요청한 기기를 구분할 수 없어서, 한꺼번에 막으면 팀 전체가 막힌다.
 * 코드가 맞으면 누구나 모든 칸(가격 포함)을 본다(2026-10-14 결정).
 */

var MIN_CODE_LENGTH = 12;
var LOG_MERGE_MS = 10 * 60 * 1000;

/** 팀원 탭에서 코드를 찾는다. 없거나 12자 미만이면 null. */
function findMember_(code) {
  code = str_(code);
  if (code.length < MIN_CODE_LENGTH) return null;
  var rows = readTable_('members').rows;
  for (var i = 0; i < rows.length; i++) {
    if (str_(rows[i].code) === code) return { name: str_(rows[i].name) || '이름 없음' };
  }
  return null;
}

/** 틀린 코드는 앞 두 글자와 길이만 남긴다. 실제 코드와 한 글자 차이인 오타가 로그에 그대로 남지 않게. */
function maskCode_(code) {
  code = str_(code);
  if (!code) return '코드 없음';
  return code.slice(0, 2) + '… (' + code.length + '자)';
}

/** 로그 탭에 남긴다. 마지막 줄과 종류가 같고 10분 안이면 그 줄의 횟수만 올린다. */
function logEvent_(type, detail) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return;
  try {
    var t = readTable_('log');
    var now = new Date();
    var last = t.rows.length ? t.rows[t.rows.length - 1] : null;
    if (last && str_(last.type) === type && isDate_(last.lastAt) &&
        now.getTime() - last.lastAt.getTime() < LOG_MERGE_MS) {
      writeCell_(t, last._row, 'lastAt', now);
      writeCell_(t, last._row, 'detail', detail);
      writeCell_(t, last._row, 'count', (toNum_(last.count) || 1) + 1);
    } else {
      appendRows_(t, [{ at: now, lastAt: now, type: type, detail: detail, count: 1 }]);
    }
  } catch (e) {
    // 로그를 못 남겨도 거절은 그대로 한다.
  } finally {
    lock.releaseLock();
  }
}
