// 홈 '상차일로 보기'·'달력으로 보기'의 한 줄(바이어 · No. · 과일 · 운송 · 스펙 · 산지). 누르면 그 줄 고치기.
// 바이어 칩은 모두 같은 색(2026-10-20 사용자 요청: 바이어마다 색이 다르면 헷갈림)
import { fmtKo } from '../lib/dates.js';
import { shortNo } from '../lib/schedule.js';
import { navigate } from '../router.js';
import { fruitToneClass } from '../lib/fruitTone.js';
import { isTbdBuyer, isTbdOrigin, isTbdRow } from '../lib/undecided.js';
import TbdChip from './TbdChip.jsx';

export default function LoadRow({ r }) {
  const no = shortNo(r.no);
  return (
    <button type="button" className={'lrow' + (isTbdRow(r) ? ' tbd' : '') + (r.pending ? ' pending' : '')}
      disabled={!!r.pending}
      aria-label={`${r.buyer} No. ${r.no || ''} ${r.fruit} ${r.specKo} 상차 ${fmtKo(r.loadDate) || '미정'}`}
      onClick={() => navigate('/edit/' + encodeURIComponent(r.id))}>
      {isTbdBuyer(r.buyer) ? <TbdChip>바이어 미정</TbdChip> : <span className="lrow-buyer">{r.buyer}</span>}
      {no && <span className="lrow-no num">No.{no}</span>}
      <span className={'lrow-fruit' + fruitToneClass(r.fruit)}>{r.fruit || '과일 없음'}</span>
      {r.pending && <span className="pending-tag">저장 중</span>}
      {r.ship && <span className="ship-chip">{r.ship}</span>}
      {r.specKo && <span className="lrow-spec">{r.specKo}</span>}
      {isTbdOrigin(r.origin) ? <TbdChip>산지 미정</TbdChip> : r.origin && <span className="origin-chip">{r.origin}</span>}
    </button>
  );
}
