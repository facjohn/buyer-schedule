// 입력 화면의 No.(인보이스 번호) 판단을 한곳에 모은다.
// 2026-10-19 사용자 신고("저장했던 No.가 자꾸 바뀌어")와 검토에서 나온 규칙:
// - 번호 칸을 직접 치지 않았으면 새 줄·다음 선적 복제·바이어를 바꾼 고치기는 번호를 보내지 않는다.
//   창구가 저장하는 순간 잠금 안에서 다음 번호를 붙인다(열어 둔 사이 남이 그 번호를 써도 섞이지 않게).
// - 고치기는 번호 칸을 직접 쳐서 지금 번호와 달라졌을 때만 보낸다(그사이 남이 바꾼 번호를 옛 번호로 되돌리지 않게).
// - '같은 컨테이너에 사이즈 추가'는 원래 줄의 선적에 바로 붙인다.
// - 숫자만 쓰는 번호는 시즌(7월 1일~다음 해 6월 30일, noYear)마다 따로 세므로 같은 시즌 선적만 같은 번호로 본다.
import { noYearOf } from './schedule.js';

export const isPlainNo = (s) => /^\d+$/.test(String(s ?? '').trim());

const str = (v) => (v === null || v === undefined ? '' : String(v));

/** 서버 normNo_와 같게: 전각 숫자는 보통 숫자로, 숫자만이면 앞의 0을 뗀다('08' → '8') */
export function normNo(s) {
  const t = str(s).trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  if (/^\d+$/.test(t)) return t.replace(/^0+(?=\d)/, '');
  // 인보이스 번호(KINGO-26-01)는 대문자로(kingo-26-01과 KINGO-26-01이 다른 선적이 되지 않게)
  return INVOICE.test(t) && /[A-Za-z]/.test(t) ? t.toUpperCase() : t;
}

const INVOICE = /^([^-]+-\d{2}-)(\d+)$/;

/** 같은 앞글자(KINGO-26-)의 지금 보이는 가장 큰 차수 */
function liveSeriesMax(rows, buyer, prefix) {
  let max = 0;
  for (const r of rows || []) {
    if (r.buyer !== buyer) continue;
    const m = INVOICE.exec(str(r.no).toUpperCase());
    if (m && m[1] === prefix) max = Math.max(max, Number(m[2]));
  }
  return max;
}

/** 이 바이어·해에서 목록에 보이는 숫자 번호의 최댓값(지운 줄은 목록에 없다) */
function liveMax(rows, buyer, year) {
  let max = 0;
  for (const r of rows || []) {
    if (r.buyer !== buyer || !isPlainNo(r.no) || noYearOf(r) !== year) continue;
    max = Math.max(max, Number(r.no));
  }
  return max;
}

/**
 * @param {object} p
 * @param {'new'|'edit'|'dup'} p.mode
 * @param {boolean} p.asNext  다음 선적으로 복제
 * @param {boolean} p.touched 번호 칸을 직접 쳤는지
 * @param {string} p.typed    친 글자
 * @param {object} p.src      원래 줄(새 줄이면 null). 지금 목록의 값(그사이 바뀌었으면 바뀐 값)
 * @param {string} p.buyer    지금 고른 바이어
 * @param {Array} p.containers containersOf(그 바이어)
 * @param {string} p.sugg     지금의 다음 번호
 * @param {number} p.etaYear  ETA(없으면 오늘)의 시즌 시작 해(번호 해)
 * @param {number} p.todayYear 오늘의 시즌 시작 해
 * @param {Array} p.rows      전체 줄
 * @returns {{ shown: string, value: string, payload: object, match: object|null, hint: string,
 *   placeholder: string, merge: object|null }}
 *   merge: 고치기에서 이 줄을 다른 선적(이미 있는 번호)에 합칠 때 그 선적(저장 전에 확인용)
 */
export function planNo({ mode, asNext, touched, typed, src, buyer, containers, sugg, etaYear, todayYear, rows }) {
  const srcNo = src ? str(src.no).trim() : '';
  const buyerChanged = mode !== 'new' && !!src && buyer !== src.buyer;
  const sameShip = mode === 'dup' && !asNext && !buyerChanged && !touched && !!srcNo;
  const auto = !touched && !sameShip && (mode !== 'edit' || buyerChanged);
  const shown = touched ? str(typed) : auto ? str(sugg) : srcNo;
  const value = normNo(shown);
  // 숫자만 쓰는 번호는 그 해의 선적만 같은 번호(고치기는 그 줄의 번호 해, 새 줄은 ETA의 해)
  const year = mode === 'edit' && !buyerChanged ? noYearOf(src) || etaYear : etaYear;
  const match = touched && value
    ? (containers || []).find((c) => str(c.no) === value && (!isPlainNo(value) || c.noYear === year)) || null
    : null;

  const payload = {};
  let hint = '';
  let merge = null;
  // 칸이 비었을 때의 흐린 글자: 고치기는 지금 번호(없는 다음 번호가 떠 보이지 않게), 그 밖은 다음 번호
  const placeholder = mode === 'edit' && !buyerChanged ? srcNo || '예: KINGO-26-01' : str(sugg) || '예: KINGO-26-01';
  const info = match ? str(match.label).split(' · ').slice(1).join(' · ') : '';
  if (mode === 'edit') {
    if (buyerChanged) {
      if (touched && value) {
        payload.no = value;
        hint = match ? `${buyer}의 No. ${value} 선적으로 옮겨요.` : `${buyer}의 새 번호 ${value}(으)로 옮겨요.`;
      } else {
        hint = `${buyer}의 다음 번호로 옮겨요.`;
      }
    } else if (touched && value && value !== srcNo) {
      payload.no = value; // 이 줄만: 있는 번호면 그 선적으로, 없는 번호면 새 번호로(창구가)
      const same = (rows || []).filter((r) => r.buyer === src.buyer && str(r.no).trim() === srcNo &&
        noYearOf(r) === noYearOf(src)).length;
      if (match) {
        // 이미 있는 번호: 같은 번호 줄이 둘이 되고 목록·JPG에 둘 다 보인다(2026-10-30 사용자 요청 "번호가 똑같아도 똑같은거 두 개 다 뜨게").
        // 어느 선적과 같은 번호가 되는지 알린다(번호를 맞바꾸다 헷갈리지 않게)
        merge = match;
        hint = `No. ${value}은(는) 이미 있는 번호예요(${info}). 저장하면 두 줄 모두 No. ${value}(으)로 보여요. 번호만 바꾸려면 안 쓰는 번호를 써 주세요.`;
      } else {
        hint = same > 1 ? `이 줄만 ${value}(으)로 바꿔요. 같은 No. ${srcNo}의 다른 ${same - 1}줄은 그대로예요.`
          : `번호를 ${value}(으)로 바꿔요.`;
      }
    } else if (touched && !value && srcNo) {
      hint = `비워 두면 번호는 그대로예요(No. ${srcNo}).`;
    }
  } else if (sameShip) {
    // 번호 해가 비고 ETA도 없는 줄은 창구가 오늘의 시즌으로 본다(같게 맞춘다)
    payload.join = { no: src.no, noYear: noYearOf(src) || todayYear || etaYear };
    hint = `No. ${srcNo} 선적(같은 컨테이너)에 줄을 더해요.`;
  } else if (auto) {
    hint = sugg ? '다음 번호예요. 저장할 때 그때의 다음 번호가 붙어요. 인보이스 번호가 다르면 고쳐 써 주세요.'
      : '저장할 때 다음 번호가 자동으로 붙어요.';
    // 인보이스는 차례대로라 가운데 빈 번호(지운 줄 등)부터 채운다(2026-10-30 사용자 결정). 그럴 때 알린다
    const inv = INVOICE.exec(str(sugg).toUpperCase());
    const gap = isPlainNo(sugg) ? Number(sugg) < liveMax(rows, buyer, etaYear)
      : !!inv && Number(inv[2]) < liveSeriesMax(rows, buyer, inv[1]);
    if (gap) hint = `비어 있는 ${sugg}번을 채워요(인보이스는 차례대로). 다른 번호를 쓰려면 고쳐 써 주세요.`;
  } else if (!value) {
    hint = '비워 두면 다음 번호가 자동으로 붙어요.';
  } else if (match) {
    // 친 번호는 번호로 보낸다. 창구가 저장하는 순간 그 선적이 있으면 거기에, 그사이 없어졌으면 새 번호로 만든다
    // (목록이 조금 낡았을 때 '선적이 없어요'로 저장이 막히던 문제, 2026-10-30 점검)
    payload.no = value;
    hint = `No. ${value} 선적(${info})에 줄을 더해요. 다음 선적이면 다른 번호를 써 주세요.`;
  } else {
    payload.no = value;
    hint = '새 번호로 새 선적을 만들어요.';
  }
  return { shown, value, payload, match, hint, placeholder, merge };
}
