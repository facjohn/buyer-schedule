// 스케줄 한 건 = 두 줄. 윗줄 No. · 과일 · 운송 · 스펙 · 산지(흐리게), 아랫줄 ETA · 바이어가 · 산지가(작업비는 그 아래 작게).
import { fmtKo } from '../lib/dates.js';
import { fmtPrice, fmtWon } from '../lib/money.js';
import { useLongPress } from '../hooks/useLongPress.js';
import { shortNo } from '../lib/schedule.js';
import { IconLock } from './icons.jsx';

export function TableHead() {
  return (
    <div className="srow srow-head">
      <div className="srow-no">No.</div>
      <div className="srow-top">과일 · 운송 · 스펙</div>
      <div className="srow-eta">ETA</div>
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
      aria-label={`No. ${row.no || ''} ${row.fruit} ${row.specKo} ${fmtKo(row.eta)}`} {...press}>
      <div className={'srow-no num' + (shortNo(row.no).length > 3 ? ' long' : '')} title={String(row.no ?? '')}>
        {shortNo(row.no)}
      </div>
      <div className="srow-top">
        <span className="fruit">{row.fruit || '과일 없음'}</span>
        {row.ship && <span className="ship-chip">{row.ship}</span>}
        <span className="spec">{row.specKo}</span>
        {row.origin && <span className="origin">· {row.origin}</span>}
      </div>
      <div className="srow-eta">
        <span className="eta">{row.eta ? fmtKo(row.eta) : '날짜 없음'}</span>
        {row.status !== '확정' && <span className="chip-tbc">미정</span>}
      </div>
      <div className={'srow-price num' + (price.length > 8 ? ' small' : '')}>
        {price || <span className="empty">—</span>}
      </div>
      <div className={'srow-cost num' + (cost.length > 8 ? ' small' : '')}>
        {cost || <span className="empty">—</span>}
        {work && <div className="work">작업 {work}</div>}
      </div>
    </div>
  );
}
