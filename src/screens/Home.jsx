// ① 홈: 바이어 바둑판(두 칸씩, 바이어마다 다른 색, 다음 ETA 가까운 순)과 검색.
import { useMemo } from 'react';
import { useRemembered } from '../lib/uiMemory.js';
import { fmtKo, fmtKoDateTime } from '../lib/dates.js';
import { buyerCards } from '../lib/schedule.js';
import { buyerColor } from '../lib/buyerColor.js';
import { navigate, buyerPath } from '../router.js';
import { IconPlus, IconSearch, IconSheet } from '../components/icons.jsx';

export default function Home({ data, fetchedAt, loading }) {
  const [query, setQuery] = useRemembered('home.query', '');
  const cards = useMemo(() => buyerCards(data), [data]);

  const q = query.trim().toLowerCase();
  const shown = cards.filter((c) => !q ||
    [c.buyer.name, c.buyer.nameEn, c.buyer.country].some((s) => String(s || '').toLowerCase().includes(q)));

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

      <label className="input search">
        <IconSearch size={20} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="바이어 검색"
          aria-label="바이어 검색" />
      </label>

      <div className="section-title">다음 ETA 가까운 순</div>

      <div className="tiles">
        {shown.map((c) => {
          const color = buyerColor(data.buyers, c.buyer.name);
          return (
            <button key={c.buyer.name} type="button" className="tile"
              style={{ '--tile-bg': color.bg, '--tile-fg': color.fg }}
              onClick={() => navigate(buyerPath(c.buyer.name))}>
              <div className="tile-top">
                <div className="tile-name">{c.buyer.name}</div>
                <span className={'tile-count' + (c.shipments ? '' : ' none')}>
                  <span className="num">{c.shipments}</span>
                  <span>예정</span>
                </span>
              </div>
              {c.buyer.country && <div className="tile-country">{c.buyer.country}</div>}
              <div className="tile-next">
                {c.next ? (
                  <>
                    <div className="tile-label">
                      다음 ETA{c.next.eta && c.nextTbc && <span className="chip-tbc">미정</span>}
                    </div>
                    <div className="tile-date">{c.next.eta ? fmtKo(c.next.eta) : 'ETA 미정'}</div>
                    <div className="tile-what">{c.next.fruits}{c.next.ship ? ` · ${c.next.ship}` : ''}</div>
                  </>
                ) : (
                  <div className="tile-label">앞으로 일정 없음</div>
                )}
              </div>
            </button>
          );
        })}
        {!shown.length && q && <div className="empty-box tiles-empty">맞는 바이어가 없어요.</div>}
        <button type="button" className="tile tile-add" onClick={() => navigate('/buyer/new')}>
          <IconPlus size={28} />
          <span>바이어 추가</span>
        </button>
      </div>
    </div>
  );
}
