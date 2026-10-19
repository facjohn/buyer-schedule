// 입력 화면의 No.(인보이스 번호) 판단을 한곳에 모은다.
// 2026-10-19 사용자 신고("저장했던 No.가 자꾸 바뀌어")와 검토에서 나온 규칙:
// - 번호 칸을 직접 치지 않았으면 새 줄·다음 선적 복제·바이어를 바꾼 고치기는 번호를 보내지 않는다.
//   창구가 저장하는 순간 잠금 안에서 다음 번호를 붙인다(열어 둔 사이 남이 그 번호를 써도 섞이지 않게).
// - 고치기는 번호 칸을 직접 쳐서 지금 번호와 달라졌을 때만 보낸다(그사이 남이 바꾼 번호를 옛 번호로 되돌리지 않게).
// - '같은 컨테이너에 사이즈 추가'는 원래 줄의 선적에 바로 붙인다.
// - 숫자만 쓰는 옛 번호는 해(noYear)마다 따로 세므로 같은 해 선적만 같은 번호로 본다.
import { noYearOf } from './schedule.js';

export const isPlainNo = (s) => /^\d+$/.test(String(s ?? '').trim());

const str = (v) => (v === null || v === undefined ? '' : String(v));

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
 * @param {number} p.etaYear  ETA(없으면 오늘)의 해
 * @param {Array} p.rows      전체 줄
 * @returns {{ shown: string, value: string, payload: object, match: object|null, hint: string }}
 */
export function planNo({ mode, asNext, touched, typed, src, buyer, containers, sugg, etaYear, rows }) {
  const srcNo = src ? str(src.no).trim() : '';
  const buyerChanged = mode !== 'new' && !!src && buyer !== src.buyer;
  const sameShip = mode === 'dup' && !asNext && !buyerChanged && !touched && !!srcNo;
  const auto = !touched && !sameShip && (mode !== 'edit' || buyerChanged);
  const shown = touched ? str(typed) : auto ? str(sugg) : srcNo;
  const value = shown.trim();
  // 숫자만 쓰는 번호는 그 해의 선적만 같은 번호(고치기는 그 줄의 번호 해, 새 줄은 ETA의 해)
  const year = mode === 'edit' && !buyerChanged ? noYearOf(src) || etaYear : etaYear;
  const match = touched && value
    ? (containers || []).find((c) => str(c.no) === value && (!isPlainNo(value) || c.noYear === year)) || null
    : null;

  const payload = {};
  let hint = '';
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
      hint = match ? `이 줄만 No. ${value} 선적으로 옮겨요.`
        : same > 1 ? `이 줄만 ${value}(으)로 바꿔요. 같은 No. ${srcNo}의 다른 ${same - 1}줄은 그대로예요.`
          : `번호를 ${value}(으)로 바꿔요.`;
    }
  } else if (sameShip) {
    payload.join = { no: src.no, noYear: noYearOf(src) };
    hint = `No. ${srcNo} 선적(같은 컨테이너)에 줄을 더해요.`;
  } else if (auto) {
    hint = sugg ? '다음 번호예요. 저장할 때 그때의 다음 번호가 붙어요. 인보이스 번호가 다르면 고쳐 써 주세요.'
      : '저장할 때 다음 번호가 자동으로 붙어요.';
  } else if (!value) {
    hint = '비워 두면 다음 번호가 자동으로 붙어요.';
  } else if (match) {
    payload.join = { no: match.no, noYear: match.noYear };
    hint = `No. ${value} 선적(${str(match.label).split(' · ').slice(1).join(' · ')})에 줄을 더해요. 다음 선적이면 다른 번호를 써 주세요.`;
  } else {
    payload.no = value;
    hint = '새 번호로 새 선적을 만들어요.';
  }
  return { shown, value, payload, match, hint };
}
