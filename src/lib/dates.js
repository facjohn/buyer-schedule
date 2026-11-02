// 날짜는 앱 안에서 'yyyy-MM-dd' 글자로 다룬다(시간대 때문에 하루가 밀리지 않게).
// 표기: 한국어 "10월 20일 (화)", 영어 "Oct 20"(9월은 Sept). 숫자만 쓴 날짜(10/20)는 쓰지 않는다.

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const MONTHS_EN_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

export function isIso(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function parts(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function toUtc(iso) {
  const { y, m, d } = parts(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(dt) {
  return dt.toISOString().slice(0, 10);
}

export function weekdayKo(iso) {
  return WEEKDAYS_KO[toUtc(iso).getUTCDay()];
}

/** "10월 20일 (화)" */
export function fmtKo(iso) {
  if (!isIso(iso)) return '';
  const { m, d } = parts(iso);
  return `${m}월 ${d}일 (${weekdayKo(iso)})`;
}

/** 올해면 "10월 20일 (화)", 다른 해면 "2027년 1월 12일 (화)" (해를 잘못 고른 걸 알아보게) */
export function fmtKoYear(iso, todayIso) {
  if (!isIso(iso)) return '';
  return todayIso && iso.slice(0, 4) === todayIso.slice(0, 4) ? fmtKo(iso) : `${parts(iso).y}년 ${fmtKo(iso)}`;
}

/** "10월 20일" */
export function fmtKoShort(iso) {
  if (!isIso(iso)) return '';
  const { m, d } = parts(iso);
  return `${m}월 ${d}일`;
}

/** "Oct 20" */
export function fmtEn(iso) {
  if (!isIso(iso)) return '';
  const { m, d } = parts(iso);
  return `${MONTHS_EN[m - 1]} ${d}`;
}

/** "Oct 13, 2026" */
export function fmtEnLong(iso) {
  if (!isIso(iso)) return '';
  const { y } = parts(iso);
  return `${fmtEn(iso)}, ${y}`;
}

/** 월 묶음 이름. 올해면 "10월", 아니면 "2027년 1월" */
export function fmtMonthKo(monthKey, todayIso) {
  const [y, m] = monthKey.split('-').map(Number);
  return todayIso && Number(todayIso.slice(0, 4)) === y ? `${m}월` : `${y}년 ${m}월`;
}

/** "October" (JPG 월 제목) */
export function fmtMonthEn(monthKey) {
  const m = Number(monthKey.split('-')[1]);
  return MONTHS_EN_FULL[m - 1];
}

export function addDays(iso, n) {
  const dt = toUtc(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUtc(dt);
}

/** n개월 뒤 같은 날(그달에 없는 날이면 그달 마지막 날) */
export function addMonths(iso, n) {
  const { y, m, d } = parts(iso);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return fromUtc(first);
}

/** 'yyyy-MM'에서 n달 앞뒤 'yyyy-MM' (홈 달력 넘기기) */
export function addMonthKey(monthKey, n) {
  return addMonths(monthKey + '-01', n).slice(0, 7);
}

/** 달력 한 달: 1일의 요일(0=일요일)과 그달 날 수. monthKey 'yyyy-MM' */
export function monthInfo(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return { lead: new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), days: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

/** 달력 제목 "2026년 11월"(해는 늘 쓴다) */
export function fmtMonthKoFull(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return `${y}년 ${m}월`;
}

export function daysBetween(a, b) {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
}

const KST_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false
});

function kst(dateLike) {
  const o = {};
  for (const p of KST_PARTS.formatToParts(new Date(dateLike))) o[p.type] = p.value;
  return { iso: `${o.year}-${o.month}-${o.day}`, hm: `${o.hour === '24' ? '00' : o.hour}:${o.minute}` };
}

/** 서울 기준 오늘 'yyyy-MM-dd' (서버가 준 today가 없을 때만 쓴다) */
export function todayKst() {
  return kst(Date.now()).iso;
}

/** "10월 13일 (화) 17:40" (서울 시간) */
export function fmtKoDateTime(dateLike) {
  if (!dateLike) return '';
  const k = kst(dateLike);
  return `${fmtKo(k.iso)} ${k.hm}`;
}
