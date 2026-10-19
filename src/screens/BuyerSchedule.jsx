// ② 바이어 스케줄: 한 건 두 줄, No. 순(월 제목은 달이 바뀔 때만). 누르면 고치기, 길게 누르면 복제·삭제.
// 위에 '지난 일정' 버튼(기본은 앞으로의 일정 전부)과 과일 버튼(2026-10-19 사용자 요청: 다음 2개월·앞으로 전부 없앰).
import { useMemo, useState } from 'react';
import { filterPeriod, fruitsInOrder, groupInNoOrder, sortByNo } from '../lib/schedule.js';
import { fmtKo } from '../lib/dates.js';
import { useRemembered } from '../lib/uiMemory.js';
import { navigate, back } from '../router.js';
import ScheduleRow, { TableHead } from '../components/ScheduleRow.jsx';
import { ActionSheet } from '../components/Sheet.jsx';
import { Chip } from '../components/Controls.jsx';
import { IconBack, IconCopy, IconEdit, IconImage, IconPlus, IconTrash } from '../components/icons.jsx';

// 기간은 둘: 앞으로(future, 기본, ETA 미정 포함)와 지난 일정(past)
function periodShows(period, eta, today) {
  return period === 'past' ? !!eta && eta < today : !eta || eta >= today;
}

/** 방금 저장한 줄이 보이는 기간(지난 날짜로 저장하고 돌아왔는데 목록에 안 보이지 않게) */
function periodFor(eta, today) {
  return eta && eta < today ? 'past' : 'future';
}

export default function BuyerSchedule({ data, buyerName, focusEta, focusFruit, onRemove }) {
  // 기간·과일 필터는 줄을 열었다 돌아와도 그대로. 방금 저장한 줄이 안 보이게 걸려 있으면 그 줄이 보이게 바꾼다.
  const [periodRaw, setPeriod] = useRemembered('buyer.period.' + buyerName, 'future', (prev) => {
    const p = prev === 'past' ? 'past' : 'future';
    return focusEta !== null && focusEta !== undefined && !periodShows(p, focusEta, data.today) ? periodFor(focusEta, data.today) : p;
  });
  const period = periodRaw === 'past' ? 'past' : 'future';
  const [fruit, setFruit] = useRemembered('buyer.fruit.' + buyerName, '',
    (prev) => (focusFruit && prev && prev !== focusFruit ? '' : prev));
  const [menuRow, setMenuRow] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const buyer = data.buyers.find((b) => b.name === buyerName) || { name: buyerName, currency: 'USD' };
  const mine = useMemo(() => data.rows.filter((r) => r.buyer === buyerName), [data, buyerName]);
  const inPeriod = useMemo(() => filterPeriod(mine, period, data.today), [mine, period, data.today]);
  // 과일 버튼: 지금 보이는 일정에 있는 과일만, 품목 탭 순서로
  const fruits = useMemo(() => fruitsInOrder(inPeriod, data.fruits), [inPeriod, data.fruits]);
  const activeFruit = fruits.includes(fruit) ? fruit : ''; // 기억한 과일이 여기에 없으면 전체로
  const rows = useMemo(() => inPeriod.filter((r) => !activeFruit || r.fruit === activeFruit), [inPeriod, activeFruit]);
  // No. 순서대로(ETA 미정 줄도 제 번호 자리에). 월 제목은 달이 바뀔 때만
  const groups = groupInNoOrder(sortByNo(rows, { desc: period === 'past' }), data.today);

  const closeMenu = () => {
    setMenuRow(null);
    setConfirmDelete(false);
  };

  // 가격 조건(FOB/CIF)은 보이지 않는다(2026-10-19 사용자 요청)
  const sub = [buyer.country, buyer.currency].filter(Boolean).join(' · ');

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
        <Chip on={period === 'past'} onClick={() => setPeriod(period === 'past' ? 'future' : 'past')}>지난 일정</Chip>
        {/* 과일이 한 가지여도 보인다(2026-10-19 사용자 요청: 프루티시마처럼 샤인머스캣만 있어도) */}
        {fruits.length > 0 && (
          <>
            <span className="chip-sep" aria-hidden="true" />
            <Chip on={!activeFruit} onClick={() => setFruit('')}>전체</Chip>
            {fruits.map((f) => (
              <Chip key={f} on={activeFruit === f} onClick={() => setFruit(f)}>{f}</Chip>
            ))}
          </>
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
            {period === 'past' ? '지난 일정이 없어요.' : '앞으로 일정이 없어요.'}
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
