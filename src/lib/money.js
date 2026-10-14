// 금액 표기. 바이어가는 바이어 탭의 통화로 "$24.50", 산지가·작업비는 "₩28,000".

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

/** 24.5, 'USD' → "$24.50". 값이 없으면 '' */
export function fmtPrice(n, currency = 'USD') {
  if (n === null || n === undefined || n === '' || !isFinite(n)) return '';
  const dec = decimalsOf(currency);
  return currencySymbol(currency) + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: dec, maximumFractionDigits: dec
  });
}

/** 28000 → "₩28,000" */
export function fmtWon(n) {
  if (n === null || n === undefined || n === '' || !isFinite(n)) return '';
  return '₩' + Math.round(Number(n)).toLocaleString('en-US');
}

/** 입력칸 글자 → 숫자. 비었으면 null, 숫자가 아니면 NaN */
export function parseMoney(s) {
  const t = String(s ?? '').replace(/[,\s₩$]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return isFinite(n) && n >= 0 ? n : NaN;
}

/** 숫자 → 입력칸 글자(천 단위 쉼표). 바이어가는 14.20처럼 소수 둘째 자리까지 */
export function moneyInput(n, decimals, minDecimals = 0) {
  if (n === null || n === undefined || n === '' || !isFinite(n)) return '';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: minDecimals, maximumFractionDigits: decimals });
}
