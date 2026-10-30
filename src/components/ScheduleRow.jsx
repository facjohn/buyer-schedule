// 스케줄 한 건. 윗줄 No. · 과일 · 운송 · 스펙 · 산지(검은 바탕 흰 글자 칩, 2026-10-19 사용자 요청),
// 아랫줄 상차일·ETA(위아래로, 2026-10-16 사용자 요청, ETA 미정 버튼으로 저장한 줄은 날짜 대신 "미정") · 바이어가 · 산지가(작업비는 그 아래 작게).
// 상차일이 오늘보다 앞인 줄(상차 끝남)은 줄 전체를 주황 바탕으로(2026-10-20 사용자 요청: 직원이 한눈에 보게, 노랑 말고 주황, JPG는 그대로).
import { fmtKo } from '../lib/dates.js';
import { fmtPrice, fmtWon } from '../lib/money.js';
import { useLongPress } from '../hooks/useLongPress.js';
import { loadedPast, shortNo } from '../lib/schedule.js';
import { IconLock } from './icons.jsx';
import { fruitToneClass } from '../lib/fruitTone.js';
import { isTbdBuyer, isTbdOrigin, isTbdRow } from '../lib/undecided.js';
import TbdChip from './TbdChip.jsx';

/** 여러 가격('17.3/17.8/18.2')은 좁은 칸에서 '/' 뒤에서 줄이 바뀌게 */
function breakAtSlash(s) {
  return s ? s.replace(/\//g, '/\u200B') : s;
}

export function TableHead() {
  return (
    <div className="srow srow-head">
      <div className="srow-no">No.</div>
      <div className="srow-top">과일 · 운송 · 스펙</div>
      <div className="srow-eta">상차일 · ETA</div>
      <div className="srow-price">바이어가</div>
      <div className="srow-cost"><IconLock size={11} /> 산지가</div>
    </div>
  );
}

/** showBuyer: @미정 화면처럼 여러 바이어 줄이 섞일 때 줄마다 바이어 이름표(바이어 미정은 빨간 꼬리표) */
export default function ScheduleRow({ row, currency, today, showBuyer, onTap, onLong }) {
  const press = useLongPress(onLong, onTap);
  const loaded = loadedPast(row, today);
  const tbd = isTbdRow(row);
  const price = fmtPrice(row.price, currency);
  const cost = fmtWon(row.cost);
  const work = fmtWon(row.workCost);
  return (
    <div className={'srow' + (loaded ? ' loaded' : '') + (tbd ? ' tbd' : '')} role="button" tabIndex={0}
      aria-label={`No. ${row.no || ''} ${row.fruit} ${row.specKo} 상차 ${fmtKo(row.loadDate) || '없음'}${loaded ? '(상차 끝남)' : ''} ETA ${fmtKo(row.eta) || '미정'}`} {...press}>
      <div className={'srow-no num' + (shortNo(row.no).length > 3 ? ' long' : '')} title={String(row.no ?? '')}>
        {shortNo(row.no)}
      </div>
      <div className="srow-top">
        {showBuyer && (isTbdBuyer(row.buyer) ? <TbdChip>바이어 미정</TbdChip> : <span className="buyer-chip">{row.buyer}</span>)}
        <span className={'fruit' + fruitToneClass(row.fruit)}>{row.fruit || '과일 없음'}</span>
        {row.ship && <span className="ship-chip">{row.ship}</span>}
        <span className="spec">{row.specKo}</span>
        {isTbdOrigin(row.origin) ? <TbdChip>산지 미정</TbdChip> : row.origin && <span className="origin-chip">{row.origin}</span>}
      </div>
      <div className="srow-eta srow-dates">
        <span className="dlabel">상차</span>
        <span className="dval">
          {row.loadDate ? <span className="load">{fmtKo(row.loadDate)}</span> : <span className="empty">—</span>}
        </span>
        <span className="dlabel">ETA</span>
        <span className="dval">
          {row.eta ? (
            <span className="eta">{fmtKo(row.eta)}</span>
          ) : (
            <span className="chip-tbc">미정</span>
          )}
        </span>
      </div>
      <div className={'srow-price num' + (price.length > 8 ? ' small' : '')}>
        {breakAtSlash(price) || <span className="empty">—</span>}
      </div>
      <div className={'srow-cost num' + (cost.length > 8 ? ' small' : '')}>
        {breakAtSlash(cost) || <span className="empty">—</span>}
        {work && <div className="work">작업 {breakAtSlash(work)}</div>}
      </div>
    </div>
  );
}
