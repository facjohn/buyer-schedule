// 스케줄 한 건. 윗줄 No. · 과일 · 운송 · 스펙 · 산지(흐리게),
// 아랫줄 상차일·ETA(위아래로, 2026-10-16 사용자 요청) · 바이어가 · 산지가(작업비는 그 아래 작게). 정렬과 월 묶음은 ETA 기준.
import { fmtKo } from '../lib/dates.js';
import { fmtPrice, fmtWon } from '../lib/money.js';
import { useLongPress } from '../hooks/useLongPress.js';
import { shortNo } from '../lib/schedule.js';
import { IconLock } from './icons.jsx';

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

export default function ScheduleRow({ row, currency, onTap, onLong }) {
  const press = useLongPress(onLong, onTap);
  const price = fmtPrice(row.price, currency);
  const cost = fmtWon(row.cost);
  const work = fmtWon(row.workCost);
  return (
    <div className="srow" role="button" tabIndex={0}
      aria-label={`No. ${row.no || ''} ${row.fruit} ${row.specKo} 상차 ${fmtKo(row.loadDate) || '없음'} ETA ${fmtKo(row.eta) || '미정'}`} {...press}>
      <div className={'srow-no num' + (shortNo(row.no).length > 3 ? ' long' : '')} title={String(row.no ?? '')}>
        {shortNo(row.no)}
      </div>
      <div className="srow-top">
        <span className="fruit">{row.fruit || '과일 없음'}</span>
        {row.ship && <span className="ship-chip">{row.ship}</span>}
        <span className="spec">{row.specKo}</span>
        {row.origin && <span className="origin">· {row.origin}</span>}
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
            <span className="chip-tbc">ETA 미정</span>
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
