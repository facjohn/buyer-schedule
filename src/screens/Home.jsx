// ① 홈: 맨 위 '바이어별 보기 / 상차일로 보기' 버튼(2026-10-20 사용자 요청, 바이어 검색은 없앰).
// 홈 바탕은 아이보리, 바둑판 칸은 흰색(2026-10-20 사용자 요청).
// 바이어별 보기: 바이어 바둑판(두 칸씩, 모두 같은 색, 다음 상차 가까운 순. 바이어마다 다른 색은 2026-10-20 사용자 요청으로 없앰: 헷갈림). 카드에는 다음 ETA 대신 다음 상차(2026-10-20 사용자 요청).
//   상차일이 없으면 "미정", 모두 실었으면 "상차 다 끝남".
// 상차일로 보기: 앞으로의 일정(ETA가 오늘 이후이거나 미정)을 상차일 순으로 한 줄씩. 상차 당일까지만 보이고(지난 상차는 빠짐), 상차일 없는 줄은 맨 뒤.
//   위 '지난 일정' 버튼을 누르면 이번 시즌(7월부터) 지난 상차를 최근 날짜부터(2026-10-20 사용자 요청).
import { useEffect, useMemo, useState } from 'react';
import { useRemembered } from '../lib/uiMemory.js';
import { fmtKo, fmtKoDateTime, fmtKoYear } from '../lib/dates.js';
import { buyerCards, loadingDays, seasonLabel, shortNo } from '../lib/schedule.js';
import { navigate, buyerPath } from '../router.js';
import { Chip, Segmented } from '../components/Controls.jsx';
import { fruitToneClass } from '../lib/fruitTone.js';
import { isTbdBuyer, isTbdOrigin, isTbdRow } from '../lib/undecided.js';
import TbdChip from '../components/TbdChip.jsx';
import { IconPlus, IconSheet } from '../components/icons.jsx';

const VIEWS = [
  { value: 'buyers', label: '바이어별 보기' },
  { value: 'load', label: '상차일로 보기' }
];

export default function Home({ data, fetchedAt, loading }) {
  const [viewRaw, setView] = useRemembered('home.view', 'buyers');
  const view = viewRaw === 'load' ? 'load' : 'buyers';

  return (
    <div className="screen home">
      <header className="home-head">
        <div>
          <h1 className="title">바이어 스케줄</h1>
          <div className="sub">
            {loading && !fetchedAt ? '불러오는 중…' : fetchedAt ? `${fmtKoDateTime(fetchedAt)} 업데이트` : ''}
          </div>
        </div>
        <div className="head-actions">
          {data.sheetUrl && (
            <a className="btn-pill" href={data.sheetUrl} target="_blank" rel="noopener noreferrer">
              <IconSheet size={20} /> 시트
            </a>
          )}
          <button type="button" className="btn-round" aria-label="스케줄 추가" onClick={() => navigate('/new')}>
            <IconPlus size={26} />
          </button>
        </div>
      </header>

      <div className="view-switch">
        <Segmented options={VIEWS} value={view} onChange={setView} label="보기" />
      </div>

      {view === 'load' ? <LoadingList data={data} /> : <BuyerTiles data={data} />}
    </div>
  );
}

// 바둑판 칸이 톡톡 나타나는 움직임은 앱을 처음 열 때 한 번만(뒤로 올 때마다 다시 하면 화면 넘김과 겹쳐 어지럽다)
let tilesIntroDone = false;

function BuyerTiles({ data }) {
  const cards = useMemo(() => buyerCards(data), [data]);
  const [intro, setIntro] = useState(() => !tilesIntroDone);
  useEffect(() => {
    tilesIntroDone = true;
    // 나타나기가 끝나면 끈다(목록이 새로 와서 칸 순서가 바뀌어도 다시 튀어나오지 않게)
    const t = setTimeout(() => setIntro(false), 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      <div className="section-title">다음 상차 가까운 순</div>
      <div className={'tiles' + (intro ? ' tiles-intro' : '')}>
        {cards.map((c, i) => {
          const next = (
            <div className="tile-next">
              {c.next ? (
                <>
                  <div className="tile-label">다음 상차</div>
                  <div className="tile-date">{c.next.loadDate ? fmtKo(c.next.loadDate) : '미정'}</div>
                  <div className="tile-what">{c.next.fruits}{c.next.ship ? ` · ${c.next.ship}` : ''}</div>
                </>
              ) : (
                <div className="tile-label">{c.allLoaded ? '상차 다 끝남' : '앞으로 일정 없음'}</div>
              )}
            </div>
          );
          // @미정 칸: 왼쪽에 이름·다음 상차, 오른쪽을 미정 수가 크게 차지한다(2026-10-30 사용자 요청 "숫자가 오른쪽 대부분 공간을")
          if (c.tbd) {
            return (
              <button key={c.buyer.name} type="button" className="tile tile-tbd" style={{ '--i': i }}
                aria-label={`${c.buyer.name} 미정 ${c.count}건`} onClick={() => navigate(buyerPath(c.buyer.name))}>
                <div className="tbd-left">
                  <div className="tile-name">{c.buyer.name}</div>
                  {next}
                </div>
                <span className="tbd-count" style={{ '--d': Math.max(1, String(c.count).length) }}>
                  <span className="num">{c.count}</span>
                  <span>예정</span>
                </span>
              </button>
            );
          }
          return (
            <button key={c.buyer.name} type="button" className={'tile' + (c.tbd ? ' tile-tbd' : '')} style={{ '--i': i }}
              onClick={() => navigate(buyerPath(c.buyer.name))}>
              <div className="tile-top">
                <div className="tile-name">{c.buyer.name}</div>
                <span className={'tile-count' + (c.count ? '' : ' none')}>
                  <span className="num">{c.count}</span>
                  <span>예정</span>
                </span>
              </div>
              {c.buyer.country && <div className="tile-country">{c.buyer.country}</div>}
              {/* 미정 알림: 빨간 꼬리표(깜빡이는 테두리)로 칸 안에 "산지 미정 1건"(2026-10-30 사용자 요청) */}
              {(c.tbdBuyer > 0 || c.tbdOrigin > 0) && (
                <div className="tile-alerts">
                  {c.tbdBuyer > 0 && <TbdChip>바이어 미정 {c.tbdBuyer}건</TbdChip>}
                  {c.tbdOrigin > 0 && <TbdChip>산지 미정 {c.tbdOrigin}건</TbdChip>}
                </div>
              )}
              {next}
            </button>
          );
        })}
        <button type="button" className="tile tile-add" style={{ '--i': cards.length }} onClick={() => navigate('/buyer/new')}>
          <IconPlus size={28} />
          <span>바이어 추가</span>
        </button>
      </div>
    </>
  );
}

/** 상차일로 보기: 날짜 제목 아래 한 줄씩(바이어 · No. · 과일 · 운송 · 스펙 · 산지). 누르면 그 줄 고치기.
 *  바이어 칩은 모두 같은 색(2026-10-20 사용자 요청: 바이어마다 색이 다르면 헷갈림) */
function LoadingList({ data }) {
  const [periodRaw, setPeriod] = useRemembered('home.load.period', 'future');
  const past = periodRaw === 'past';
  const days = useMemo(() => loadingDays(data, { past }), [data, past]);
  return (
    <div className="loadlist">
      <div className="filters">
        <Chip on={past} onClick={() => setPeriod(past ? 'future' : 'past')}>지난 일정</Chip>
      </div>
      {past && <p className="period-note">이번 시즌({seasonLabel(data.today)}부터) 지난 상차예요. 최근 날짜부터 보여요.</p>}
      {!days.length && <div className="empty-box">{past ? '이번 시즌 지난 상차가 없어요.' : '앞으로 일정이 없어요.'}</div>}
      {days.map((d) => (
        <section key={d.key}>
          <h2 className="lday">
            {d.date ? fmtKoYear(d.date, data.today) : '상차일 미정'}
            {d.isToday && <span className="lday-tag today">오늘</span>}
          </h2>
          {d.rows.map((r) => {
            const no = shortNo(r.no);
            return (
              <button key={r.id} type="button" className={'lrow' + (isTbdRow(r) ? ' tbd' : '') + (r.pending ? ' pending' : '')}
                disabled={!!r.pending}
                aria-label={`${r.buyer} No. ${r.no || ''} ${r.fruit} ${r.specKo} 상차 ${fmtKo(d.date) || '미정'}`}
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
          })}
        </section>
      ))}
    </div>
  );
}
