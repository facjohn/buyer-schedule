// 홈 '달력으로 보기'(2026-11-02 사용자 요청, 보내 준 달력 그림처럼).
// 한 달 달력에 상차일마다 그날 싣는 줄 수를 빨간 동그라미(노란 숫자)로. 오늘은 노란 칸, 일정이 있는 날은 옅은 파랑 테두리,
// 누른 날은 파랑 테두리이고 달력 아래에 그날 줄이 상차일로 보기와 같은 모양으로 보인다(누르면 그 줄 고치기).
// ‹ ›로 달을 넘기고 '오늘'은 이번 달·오늘로. 상차일이 빈 줄은 달력에 놓을 수 없어서 아래 '상차일 미정 N건' 버튼으로 본다.
import { useMemo, useState } from 'react';
import { useRemembered } from '../lib/uiMemory.js';
import { addMonthKey, fmtKo, fmtKoYear, fmtMonthKoFull, monthInfo } from '../lib/dates.js';
import { loadingDays, rowsByLoadDate } from '../lib/schedule.js';
import { Chip } from './Controls.jsx';
import { IconBack, IconChevron } from './icons.jsx';
import LoadRow from './LoadRow.jsx';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const NONE = 'none'; // '상차일 미정'을 고른 상태

export default function LoadCalendar({ data }) {
  const today = data.today;
  const thisMonth = today.slice(0, 7);
  const byDate = useMemo(() => rowsByLoadDate(data), [data]);
  const undated = useMemo(() => (loadingDays(data).find((d) => !d.date) || { rows: [] }).rows, [data]);
  const [month, setMonth] = useRemembered('home.cal.month', thisMonth);
  const [picked, setPicked] = useRemembered('home.cal.pick', today);
  const [dir, setDir] = useState(0); // 달을 넘긴 쪽(달력이 그쪽에서 밀려 들어온다)
  const { lead, days } = monthInfo(month);

  // 그달에 오늘이 있으면 오늘, 없으면 그달 첫 상차일, 그것도 없으면 고른 날 없음
  const firstPick = (m) => (today.startsWith(m) ? today : [...byDate.keys()].filter((k) => k.startsWith(m)).sort()[0] || '');
  const go = (n) => {
    const m = addMonthKey(month, n);
    setDir(n);
    setMonth(m);
    setPicked(firstPick(m));
  };
  const goToday = () => {
    setDir(thisMonth === month ? 0 : thisMonth > month ? 1 : -1);
    setMonth(thisMonth);
    setPicked(today);
  };

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(<div key={'b' + i} aria-hidden="true" />);
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    const n = (byDate.get(iso) || []).length;
    const wd = (lead + d - 1) % 7;
    cells.push(
      <button key={iso} type="button" aria-pressed={iso === picked}
        className={'cal-day' + (wd === 0 ? ' sun' : wd === 6 ? ' sat' : '') + (n ? ' has' : '') +
          (iso === today ? ' today' : '') + (iso === picked ? ' on' : '')}
        aria-label={`${fmtKo(iso)}${iso === today ? ' 오늘' : ''} 상차 ${n}건`} onClick={() => setPicked(iso)}>
        <span className="cal-num">{d}</span>
        {n > 0 && <span className="cal-badge num">{n}</span>}
      </button>
    );
  }

  const rows = picked === NONE ? undated : picked ? byDate.get(picked) || [] : [];
  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="cal-nav" aria-label="지난달" onClick={() => go(-1)}><IconBack size={22} /></button>
        <h2 className="cal-title">{fmtMonthKoFull(month)}</h2>
        <button type="button" className="cal-nav" aria-label="다음 달" onClick={() => go(1)}><IconChevron size={22} /></button>
        <button type="button" className="cal-today-btn" onClick={goToday}>오늘</button>
      </div>
      <div className="cal-week" aria-hidden="true">
        {WEEK.map((w, i) => <span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>)}
      </div>
      <div className="cal-body">
        <div key={month} className={'cal-grid' + (dir > 0 ? ' from-next' : dir < 0 ? ' from-prev' : '')}>{cells}</div>
      </div>
      {undated.length > 0 && (
        <div className="cal-undated">
          <Chip on={picked === NONE} onClick={() => setPicked(picked === NONE ? firstPick(month) : NONE)}>
            상차일 미정 {undated.length}건
          </Chip>
        </div>
      )}

      <section className="cal-list">
        {picked ? (
          <>
            <h2 className="lday">
              {picked === NONE ? '상차일 미정' : fmtKoYear(picked, today)}
              {picked === today && <span className="lday-tag today">오늘</span>}
              <span className="cal-list-count">{rows.length}건</span>
            </h2>
            {rows.length
              ? rows.map((r) => <LoadRow key={r.id} r={r} />)
              : <div className="empty-box">{picked === NONE ? '상차일 미정인 일정이 없어요.' : '이날은 상차가 없어요.'}</div>}
          </>
        ) : (
          <div className="empty-box">날짜를 누르면 그날 상차가 보여요.</div>
        )}
      </section>
    </div>
  );
}
