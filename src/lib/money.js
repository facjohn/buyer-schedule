// 금액 표기. 바이어가는 바이어 탭의 통화로 "$24.50", 산지가·작업비는 "₩28,000".
// 가격이 여럿이면('17.3/17.8') 창구가 적힌 글자 그대로 보내고, 화면과 JPG도 글자 그대로 쓴다(2026-10-16 사용자 요청).

const SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', HKD: 'HK$', TWD: 'NT$', SGD: 'S$',
  MYR: 'RM', AUD: 'A$', CAD: 'C$', NZD: 'NZ$', THB: '฿', VND: '₫', PHP: '₱', IDR: 'Rp', KRW: '₩'
};
const NO_DECIMALS = ['JPY', 'KRW', 'VND', 'IDR'];

export function currencySymbol(currency) {
  const c = String(currency || 'USD').toUpperCase();
  return SYMBOLS[c] || c + ' ';
}

function decimalsOf(currency) {
  return NO_DECIMALS.includes(String(currency || '').toUpperCase()) ? 0 : 2;
}

/** 24.5, 'USD' → "$24.50". 글자('17.3/17.8')는 그대로. 값이 없으면 '' */
export function fmtPrice(n, currency = 'USD') {
  if (typeof n === 'string') return n.trim();
  if (n === null || n === undefined || !isFinite(n)) return '';
  const dec = decimalsOf(currency);
  return currencySymbol(currency) + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: dec, maximumFractionDigits: dec
  });
}

/** 28000 → "₩28,000". 글자('28000/23000')는 그대로 */
export function fmtWon(n) {
  if (typeof n === 'string') return n.trim();
  if (n === null || n === undefined || !isFinite(n)) return '';
  return '₩' + Math.round(Number(n)).toLocaleString('en-US');
}

/** 숫자 하나로 읽히면 숫자('$17.80', '28,000', '28000원'), 아니면 null. '17 18'은 숫자 하나가 아니다 */
export function moneyNumber(s) {
  let t = String(s ?? '').trim().replace(/^[₩$]\s*/, '').replace(/\s*원$/, '');
  if (/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(t)) t = t.replace(/,/g, '');
  // '17.'(소수점까지만 친 값)과 '.5'도 숫자 하나
  return /^(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : null;
}

/**
 * 입력칸 글자 → 저장할 값. 비었으면 null, 숫자 하나면 숫자,
 * '17.3/17.8'처럼 여러 값(숫자가 들어간 글자)이면 적은 글자 그대로, 못 쓰는 값이면 NaN.
 * 끝에 남은 '/'는 뺀다(가격 하나 더 버튼만 누르고 안 쓴 경우).
 */
export function parseMoney(s) {
  const t = String(s ?? '').trim().replace(/[\s/]+$/, '');
  if (t === '') return null;
  const n = moneyNumber(t);
  if (n !== null) return n;
  return /\d/.test(t) && !t.startsWith('-') && t.length <= 60 ? t : NaN;
}

/** 숫자 → 입력칸 글자(천 단위 쉼표). 바이어가는 14.20처럼 소수 둘째 자리까지 */
export function moneyInput(n, decimals, minDecimals = 0) {
  if (typeof n === 'string') return n.trim();
  if (n === null || n === undefined || !isFinite(n)) return '';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: minDecimals, maximumFractionDigits: decimals });
}
