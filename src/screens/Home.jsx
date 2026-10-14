// ① 홈: 바이어 목록(다음 ETA 가까운 순)과 검색.
import { useMemo } from 'react';
import { useRemembered } from '../lib/uiMemory.js';
import { fmtKo, fmtKoDateTime } from '../lib/dates.js';
import { buyerCards } from '../lib/schedule.js';
import { navigate, buyerPath } from '../router.js';
import { IconChevron, IconPlus, IconSearch, IconSheet } from '../components/icons.jsx';

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

      <div className="cards">
        {shown.map((c) => (
          <button key={c.buyer.name} type="button" className="card buyer-card" onClick={() => navigate(buyerPath(c.buyer.name))}>
            <div className="buyer-main">
              <div className="buyer-name">
                {c.buyer.name} <span className="buyer-country">{c.buyer.country}</span>
              </div>
              <div className="buyer-next">
                {c.next ? (
                  <>
                    ETA <b>{c.next.eta ? fmtKo(c.next.eta) : '미정'}</b> · {c.next.fruits}{c.next.ship ? ` · ${c.next.ship}` : ''}
                    {c.next.eta && c.nextTbc && <span className="chip-tbc">미정</span>}
                  </>
                ) : '앞으로 일정 없음'}
              </div>
            </div>
            <div className="buyer-count">
              <span className="num" style={{ color: c.shipments ? 'var(--brand)' : 'var(--muted)' }}>{c.shipments}</span>
              <span>예정</span>
            </div>
            <IconChevron size={20} className="chev" />
          </button>
        ))}
        {!shown.length && (
          <div className="empty-box">
            {data.buyers.length ? '맞는 바이어가 없어요.' : '바이어 탭에 바이어를 먼저 넣어 주세요.'}
          </div>
        )}
      </div>
    </div>
  );
}
