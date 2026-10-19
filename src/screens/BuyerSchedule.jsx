// ② 바이어 스케줄: 한 건 두 줄, 월별 묶음. 누르면 고치기, 길게 누르면 복제·삭제.
import { useMemo, useState } from 'react';
import { PERIODS, filterPeriod, groupByMonth } from '../lib/schedule.js';
import { addMonths, fmtKo } from '../lib/dates.js';
import { useRemembered } from '../lib/uiMemory.js';
import { navigate, back } from '../router.js';
import ScheduleRow, { TableHead } from '../components/ScheduleRow.jsx';
import { ActionSheet } from '../components/Sheet.jsx';
import { Chip, SelectField } from '../components/Controls.jsx';
import { IconBack, IconCopy, IconEdit, IconImage, IconPlus, IconTrash } from '../components/icons.jsx';

function periodShows(period, eta, today) {
  if (period === 'past') return eta < today;
  if (period === 'future') return eta >= today;
  return eta >= today && eta <= addMonths(today, 2);
}

/** 방금 저장한 줄이 보이는 기간(내년 1월 ETA를 저장하고 돌아왔는데 목록이 비어 보이지 않게) */
function periodFor(eta, today) {
  if (eta < today) return 'past';
  return eta > addMonths(today, 2) ? 'future' : 'next2';
}

export default function BuyerSchedule({ data, buyerName, focusEta, focusFruit, onRemove }) {
  // 기간·과일 필터는 줄을 열었다 돌아와도 그대로. 방금 저장한 줄이 안 보이게 걸려 있으면 그 줄이 보이게 바꾼다.
  const [period, setPeriod] = useRemembered('buyer.period.' + buyerName, 'next2',
    (prev) => (focusEta && !periodShows(prev, focusEta, data.today) ? periodFor(focusEta, data.today) : prev));
  const [fruit, setFruit] = useRemembered('buyer.fruit.' + buyerName, '',
    (prev) => (focusFruit && prev && prev !== focusFruit ? '' : prev));
  const [menuRow, setMenuRow] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const buyer = data.buyers.find((b) => b.name === buyerName) || { name: buyerName, currency: 'USD' };
  const mine = useMemo(() => data.rows.filter((r) => r.buyer === buyerName), [data, buyerName]);
  const fruits = useMemo(() => [...new Set(mine.map((r) => r.fruit).filter(Boolean))], [mine]);
  const activeFruit = fruits.includes(fruit) ? fruit : ''; // 기억한 과일이 더는 없으면 전체로
  const byFruit = (list) => list.filter((r) => !activeFruit || r.fruit === activeFruit);
  const rows = useMemo(
    () => byFruit(filterPeriod(mine, period, data.today)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mine, period, activeFruit, data.today]
  );
  const groups = groupByMonth(rows, data.today);

  const closeMenu = () => {
    setMenuRow(null);
    setConfirmDelete(false);
  };

  const sub = [buyer.country, buyer.currency, buyer.priceTerm].filter(Boolean).join(' · ');

  return (
    <div className="screen page with-bottom">
      <header className="page-head">
        <button type="button" className="icon-btn" aria-label="뒤로" onClick={() => back('/')}>
          <IconBack size={26} />
        </button>
        <div className="page-title">
          <h1>{buyerName}</h1>
          {sub && <div className="sub">{sub}</div>}
        </div>
        <button type="button" className="icon-btn" aria-label="바이어 고치기"
          onClick={() => navigate('/buyer/edit/' + encodeURIComponent(buyerName))}>
          <IconEdit size={22} />
        </button>
      </header>

      <div className="filters">
        {PERIODS.map((p) => (
          <Chip key={p.key} on={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</Chip>
        ))}
        {fruits.length > 1 && (
          <div className="fruit-filter">
            <SelectField value={activeFruit} onChange={setFruit} label="과일"
              options={[{ value: '', label: '과일 전체' }, ...fruits.map((f) => ({ value: f, label: f }))]} />
          </div>
        )}
      </div>

      <div className="table">
        <TableHead />
        {groups.map((g) => (
          <section key={g.key}>
            <h2 className="month">{g.label}</h2>
            {g.rows.map((r) => (
              <ScheduleRow key={r.id} row={r} currency={buyer.currency}
                onTap={() => navigate('/edit/' + encodeURIComponent(r.id))}
                onLong={() => setMenuRow(r)} />
            ))}
          </section>
        ))}
        {!groups.length && (
          <div className="empty-box">
            {period === 'past' ? '지난 일정이 없어요.' : '이 기간에 일정이 없어요.'}
            {period === 'next2' && byFruit(filterPeriod(mine, 'future', data.today)).length > 0 && (
              <div>
                <button type="button" className="link-btn" onClick={() => setPeriod('future')}>
                  2개월 뒤 일정 보기
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bottom-bar two-even">
        <button type="button" className="btn-secondary"
          onClick={() => navigate('/jpg/' + encodeURIComponent(buyerName))}>
          <IconImage size={20} /> JPG로 보내기
        </button>
        <button type="button" className="btn-primary"
          onClick={() => navigate('/new?buyer=' + encodeURIComponent(buyerName))}>
          <IconPlus size={22} /> 추가
        </button>
      </div>

      {menuRow && (
        <ActionSheet
          title={`No. ${menuRow.no || ''} · ${menuRow.fruit} ${menuRow.specKo} · ${fmtKo(menuRow.eta)}`}
          onClose={closeMenu}
          actions={confirmDelete ? [
            { label: '정말 지울까요? 지우기', danger: true, icon: <IconTrash />, onClick: () => { const id = menuRow.id; closeMenu(); onRemove(id); } }
          ] : [
            { label: `같은 컨테이너(No. ${menuRow.no || ''})에 사이즈 추가`, icon: <IconCopy />, onClick: () => { const id = menuRow.id; closeMenu(); navigate('/dup/' + encodeURIComponent(id)); } },
            { label: '다음 선적으로 복제', icon: <IconCopy />, onClick: () => { const id = menuRow.id; closeMenu(); navigate('/dup/' + encodeURIComponent(id) + '?as=next'); } },
            { label: '지우기', danger: true, icon: <IconTrash />, onClick: () => setConfirmDelete(true) }
          ]}
        />
      )}
    </div>
  );
}
