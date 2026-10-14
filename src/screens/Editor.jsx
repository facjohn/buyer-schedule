// ③ 스케줄 입력·수정. 한 화면에 한 줄.
// - 바뀐 칸만 보낸다(규칙 4). 산지가·작업비는 자동으로 넣지 않고 "직전" 안내만(규칙 6).
// - 복제는 같은 No.(같은 컨테이너)에 같은 값으로 열린다. 사이즈와 가격만 고치면 된다.
import { useEffect, useRef, useState } from 'react';
import { fmtKoDateTime } from '../lib/dates.js';
import { currencySymbol, fmtWon, moneyInput, parseMoney } from '../lib/money.js';
import { containersOf, expectedNo, lastCost, lastPrice, noYearOf, originsOf, specEnOf } from '../lib/schedule.js';
import { back, buyerPath, replace, setLeaveGuard } from '../router.js';
import { Chip, DateField, Field, MoneyField, Segmented, SelectField, TextField } from '../components/Controls.jsx';
import { IconAlert, IconClose, IconTrash } from '../components/icons.jsx';

// 회사(exporter)와 스펙 영어(specEn)는 따로 다룬다(아래 buildChanges).
// 회사 칸은 화면에 없다(바이어 탭 기본 회사를 따름, 바꿀 땐 시트에서). 수량·메모도 시트에서만 다루고 앱은 건드리지 않는다.
const PLAIN_FIELDS = ['buyer', 'fruit', 'ship', 'origin', 'specKo', 'eta', 'loadDate', 'status'];
const MONEY_FIELDS = ['price', 'cost', 'workCost'];
const ALL_FIELDS = [...PLAIN_FIELDS, 'specEn', 'exporter', ...MONEY_FIELDS];
const SHIPS = ['20ft', '40ft', '항공'];

function formFromRow(row) {
  return {
    buyer: row.buyer || '',
    fruit: row.fruit || '',
    ship: row.ship || '',
    specKo: row.specKo || '',
    specEn: row.specEn || '',
    eta: row.eta || '',
    loadDate: row.loadDate || '',
    price: moneyInput(row.price, 2, 2),
    cost: moneyInput(row.cost, 0),
    workCost: moneyInput(row.workCost, 0),
    status: row.status === '확정' ? '확정' : '미정',
    exporter: row.exporter || '',
    origin: row.origin || ''
  };
}

const EMPTY = formFromRow({});

function norm(field, v) {
  if (MONEY_FIELDS.includes(field)) return parseMoney(v);
  return String(v ?? '').trim();
}

function same(a, b) {
  return (a === null ? '' : a) === (b === null ? '' : b);
}

function newSaveKey() {
  try {
    return crypto.randomUUID().replace(/-/g, '');
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}

/**
 * mode: new(새 줄) · edit(고치기) · dup(복제)
 * dupAs: same(같은 컨테이너에 사이즈 추가, 같은 No.) · next(다음 선적, 새 No., 날짜·산지가는 비움)
 */
export default function Editor({ data, mode, id, presetBuyer, dupAs = 'same', onSave, onRemove, onSaveLost }) {
  const liveSrc = mode === 'new' ? null : data.rows.find((r) => r.id === id);
  // 고치는 사이 30초 다시 읽기에서 그 줄이 빠져도 넣던 값이 사라지지 않게 처음 본 줄을 붙잡아 둔다
  const srcRef = useRef(liveSrc);
  if (liveSrc) srcRef.current = liveSrc;
  const src = liveSrc || srcRef.current;
  const rowGone = mode !== 'new' && !liveSrc && !!src;
  const asNext = mode === 'dup' && dupAs === 'next';

  // 화면을 연 순간의 값. 고치기는 이 값과 달라진 칸만 보낸다(그사이 다른 사람이 고친 칸을 덮지 않게).
  const [init] = useState(() => {
    if (!src) return { ...EMPTY, buyer: presetBuyer || '', exporter: defaultExporter(data, presetBuyer) };
    const f = formFromRow(src);
    // 다음 선적: 날짜는 새로 고르고, 산지가는 다시 확인해서 넣게 비운다(규칙 6)
    return asNext ? { ...f, eta: '', loadDate: '', cost: '', status: '미정' } : f;
  });
  // 회사 칸에 직접 적힌 줄이었는지(열 때 값). 고치기에서만 그 값을 지킨다.
  const [initExporterSet] = useState(() => mode === 'edit' && !!(src && src.exporterSet));
  // 입력값, 사람이 직접 고친 칸 표시(자동으로 바꾸지 않음), No. 고르기를 한 상태로 둔다.
  // 빠르게 연달아 눌러도 앞의 값이 덮이지 않게 언제나 최신 상태에서 다음 상태를 만든다.
  const [st, setSt] = useState(() => ({
    form: init,
    touched: {
      price: mode === 'edit',
      cost: mode === 'edit',
      specEn: false,
      // 복제는 새 줄이라 바이어를 바꾸면 회사도 새 바이어의 기본 회사로 따라간다
      exporter: initExporterSet
    },
    noChoice: mode === 'dup' && !asNext && src && src.no && noYearOf(src) ? `${noYearOf(src)}|${src.no}` : 'new'
  }));
  const { form, touched, noChoice } = st;
  const setNoChoice = (v) => setSt((s) => ({ ...s, noChoice: v }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteArmedAt, setDeleteArmedAt] = useState(0);
  const [saveKey] = useState(newSaveKey); // 응답만 끊겨 다시 눌러도 줄이 두 번 생기지 않게
  const alive = useRef(true);
  const dirtyRef = useRef(false);

  const original = mode === 'edit' ? init : null;
  const dirty = ALL_FIELDS.some((f) => !same(norm(f, form[f]), norm(f, init[f])));
  dirtyRef.current = dirty && !saving;

  useEffect(() => {
    alive.current = true;
    const release = setLeaveGuard(() => !dirtyRef.current || window.confirm('저장하지 않고 나갈까요?'));
    return () => {
      alive.current = false;
      release();
    };
  }, []);

  if (mode !== 'new' && !src) {
    return (
      <div className="screen">
        <header className="page-head">
          <button type="button" className="icon-btn" aria-label="닫기" onClick={() => back('/')}><IconClose size={26} /></button>
          <div className="page-title"><h1>찾을 수 없어요</h1></div>
        </header>
        <div className="empty-box">이 줄이 지워졌거나 기간 밖이에요. 목록으로 돌아가 주세요.</div>
      </div>
    );
  }

  const buyerObj = data.buyers.find((b) => b.name === form.buyer);
  const currency = (buyerObj && buyerObj.currency) || 'USD';
  const specKnown = !!(form.fruit && form.specKo.trim() && specEnOf(data.specs, form.fruit, form.specKo));
  const containers = form.buyer ? containersOf(data.rows, form.buyer, data.today) : [];
  const etaYear = Number((form.eta || data.today).slice(0, 4));
  const newNo = form.buyer ? expectedNo(data.noMax, form.buyer, etaYear) : null;
  const costHint = form.fruit && form.specKo ? lastCost(data.rows, { fruit: form.fruit, specKo: form.specKo.trim() }, src && src.id) : {};
  // 산지 칸 자동완성: 전에 쓴 산지 이름(많이 쓴 순)
  const origins = originsOf(data.rows);
  const etaBeforeLoad = form.eta && form.loadDate && form.eta < form.loadDate;
  // 지난 날짜 경고: 새 줄·복제는 언제나, 고치기는 ETA를 바꿨을 때만(원래 지난 줄은 조용히)
  const etaPast = form.eta && form.eta < data.today && (mode !== 'edit' || form.eta !== init.eta);

  /** 칸 하나를 바꾸고, 거기에 따라 채워지는 칸(스펙 영어, 바이어가 직전 값, 회사)을 같이 바꾼다 */
  function update(patch, touch = []) {
    setSt((s) => {
      const t = { ...s.touched };
      touch.forEach((k) => { t[k] = true; });
      const next = { ...s.form, ...patch };
      let nextNo = s.noChoice;

      if ('buyer' in patch) {
        if (!t.exporter) next.exporter = defaultExporter(data, next.buyer);
        if (mode === 'new' || (mode === 'dup' && next.buyer !== src.buyer)) nextNo = 'new';
      }
      const specChanged = 'fruit' in patch || 'specKo' in patch;
      if (specChanged) {
        // 사전에 있는 스펙으로 바뀌면 사전 영어를 쓴다(앞 스펙에 맞춰 친 영어가 다른 스펙의 사전을 덮지 않게).
        // 사전에 없는 스펙이면 직접 친 영어는 그대로 둔다.
        const dictEn = specEnOf(data.specs, next.fruit, next.specKo);
        if (dictEn) {
          next.specEn = dictEn;
          t.specEn = false;
        } else if (!t.specEn) {
          next.specEn = '';
        }
      }
      if (mode !== 'edit' && !t.price && (specChanged || 'buyer' in patch)) {
        const p = lastPrice(data.rows, { buyer: next.buyer, fruit: next.fruit, specKo: next.specKo.trim() });
        next.price = p === null ? '' : moneyInput(p, 2, 2);
      }
      // 복제한 줄의 사이즈를 바꾸면 산지가도 다르니 비운다(규칙 6: 직전 값은 안내 칩으로만)
      if (mode === 'dup' && !t.cost && specChanged &&
          (next.specKo.trim() !== src.specKo || next.fruit !== src.fruit)) {
        next.cost = '';
      }
      return { form: next, touched: t, noChoice: nextNo };
    });
    setError('');
  }

  const missing = [];
  const need = (field, label) => {
    const empty = !norm(field, form[field]);
    // 고칠 때는 원래 비어 있던 칸은 막지 않는다(시트에서 만든 줄일 수 있어서)
    if (empty && (!original || norm(field, original[field]))) missing.push(label);
  };
  need('buyer', '바이어');
  need('fruit', '과일');
  need('ship', '운송');
  need('specKo', '스펙');
  if (form.specKo.trim()) need('specEn', '스펙 영어');
  need('eta', 'ETA');
  const badMoney = MONEY_FIELDS.some((f) => Number.isNaN(parseMoney(form[f])));

  function buildChanges() {
    const out = {};
    for (const f of [...PLAIN_FIELDS, ...MONEY_FIELDS]) {
      const v = norm(f, form[f]);
      if (original) {
        if (!same(v, norm(f, original[f]))) out[f] = v === null ? '' : v;
      } else if (f !== 'buyer' || v) {
        // 새 줄은 빈 칸도 ''로 보낸다(응답만 끊겨 다시 보낼 때 그사이 지운 칸도 시트에서 지워지게)
        out[f] = v === null ? '' : v;
      }
    }

    // 스펙 영어: 사람이 직접 고쳤거나 사전에 없는 스펙일 때만 보낸다.
    // 사전에서 자동으로 채운 값을 보내면, 그사이 시트 스펙 탭에서 고친 영어를 옛 값으로 되돌릴 수 있다.
    const en = norm('specEn', form.specEn);
    if (en && (touched.specEn || !specKnown) && (!original || en !== norm('specEn', original.specEn))) {
      out.specEn = en;
    }

    // 회사: 바이어 기본 회사와 다를 때만 칸에 적는다(같으면 비워 두어 기본 회사를 따른다).
    // 고치기에서 회사 칸에 직접 적혀 있던 줄이면(열 때 기준) 바꿨을 때만 그대로 적는다.
    const exp = norm('exporter', form.exporter);
    const expDefault = defaultExporter(data, form.buyer);
    if (original && initExporterSet) {
      if (exp !== norm('exporter', original.exporter)) out.exporter = exp;
    } else if (original) {
      if (exp !== norm('exporter', original.exporter) && exp && exp !== expDefault) out.exporter = exp;
    } else if (exp && exp !== expDefault) {
      out.exporter = exp;
    }
    return out;
  }

  async function save() {
    if (saving) return;
    if (missing.length) {
      setError(`빈 칸을 채워 주세요: ${missing.join(', ')}`);
      return;
    }
    if (badMoney) {
      setError('금액은 숫자만 넣어 주세요.');
      return;
    }
    if (etaBeforeLoad && !window.confirm('ETA가 상차일보다 빨라요. 그래도 저장할까요?')) return;
    const changes = buildChanges();
    if (mode === 'edit' && !Object.keys(changes).length) {
      back(buyerPath(form.buyer));
      return;
    }
    const item = { key: saveKey, changes };
    if (mode === 'edit') item.id = src.id;
    if (mode !== 'edit' && noChoice !== 'new') {
      const [noYear, no] = noChoice.split('|').map(Number);
      item.join = { no, noYear };
    }
    setSaving(true);
    const ok = await onSave([item], form.buyer, form.eta, form.fruit);
    if (!alive.current) {
      // 그사이 뒤로 가기로 화면을 떠났으면 이동하지 않는다. 실패만 알림으로 알린다(성공 알림은 App이 띄움).
      if (ok !== true && onSaveLost) onSaveLost(ok || '저장하지 못했어요.');
      return;
    }
    setSaving(false);
    const movedBuyer = (mode === 'new' && form.buyer !== (presetBuyer || '')) || (src && form.buyer !== src.buyer);
    if (ok !== true) {
      setError(ok || '저장하지 못했어요.');
    } else if (movedBuyer) {
      replace(buyerPath(form.buyer)); // 홈에서 +로 왔거나 바이어를 바꿨으면 그 바이어 스케줄로
    } else {
      back(buyerPath(form.buyer));
    }
  }

  async function remove() {
    // 두 번 빠르게 눌러 확인 없이 지워지지 않게, 확인 버튼이 뜬 뒤 잠깐은 누름을 받지 않는다
    if (saving || Date.now() - deleteArmedAt < 600) return;
    setSaving(true);
    const ok = await onRemove(src.id); // 실패 알림은 App이 띄운다
    if (!alive.current) return;
    setSaving(false);
    setDeleteArmedAt(0);
    if (ok === true) back(buyerPath(src.buyer));
  }

  function close() {
    if (saving) return;
    if (dirty && !window.confirm('저장하지 않고 나갈까요?')) return;
    back(form.buyer ? buyerPath(form.buyer) : '/');
  }

  const title = mode === 'edit' ? '스케줄 고치기'
    : mode === 'dup' ? (noChoice === 'new' ? '다음 선적으로 복제' : '같은 컨테이너에 사이즈 추가') : '새 스케줄';
  const subtitle = mode === 'edit'
    ? (src.updatedBy ? `마지막 수정 ${src.updatedBy}${src.updatedAt ? ' · ' + fmtKoDateTime(src.updatedAt) : ''}` : '')
    : mode === 'dup' ? (noChoice === 'new' ? 'ETA와 산지가를 새로 넣어 주세요' : '스펙과 가격만 고쳐 주세요') : '';

  const noOptions = [
    { value: 'new', label: newNo ? `${newNo} 새 번호` : '새 번호' },
    ...containers.map((c) => ({ value: c.value, label: c.label }))
  ];
  if (noChoice !== 'new' && !noOptions.some((o) => o.value === noChoice)) {
    noOptions.push({ value: noChoice, label: `No. ${noChoice.split('|')[1]} (${noChoice.split('|')[0]}년)` });
  }
  const buyerOptions = [
    ...(form.buyer ? [] : [{ value: '', label: '바이어 고르기', disabled: true }]),
    ...data.buyers.filter((b) => !b.archived || b.name === form.buyer).map((b) => ({
      value: b.name, label: b.country ? `${b.name} · ${b.country}` : b.name
    }))
  ];
  if (form.buyer && !buyerOptions.some((o) => o.value === form.buyer)) {
    buyerOptions.unshift({ value: form.buyer, label: `${form.buyer} (바이어 탭에 없음)` });
  }
  const saveLabel = saving ? '저장 중…' : form.buyer && form.buyer.length <= 8 ? `${form.buyer} 스케줄에 저장` : '저장';

  return (
    <div className="screen editor with-bottom">
      <header className="page-head">
        <button type="button" className="icon-btn" aria-label="닫기" onClick={close} disabled={saving}><IconClose size={26} /></button>
        <div className="page-title">
          <h1>{title}</h1>
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
      </header>

      <div className={'form' + (error ? ' has-error' : '')}>
        {rowGone && (
          <div className="warn-box" role="status">
            <IconAlert size={18} />
            <span>이 줄이 다른 사람에게 지워졌거나 목록에서 빠졌어요. 넣은 값은 그대로 있지만 저장은 안 될 수 있어요.</span>
          </div>
        )}
        {form.buyer && !buyerObj && (
          <div className="warn-box" role="status">
            <IconAlert size={18} />
            <span>"{form.buyer}"는 바이어 탭에 없어요. 시트에서 이름이 바뀌었으면 바이어를 다시 골라 주세요.</span>
          </div>
        )}

        <div className="row-2 buyer-no">
          <Field label="바이어">
            <SelectField value={form.buyer} onChange={(v) => update({ buyer: v })} options={buyerOptions} label="바이어" />
          </Field>
          <Field label="No.">
            {mode === 'edit' ? (
              <div className="input readonly num">
                {form.buyer !== src.buyer ? '새 번호' : src.no || '—'}
              </div>
            ) : (
              <SelectField value={noChoice} onChange={setNoChoice} options={noOptions} label="No." />
            )}
          </Field>
        </div>
        {mode === 'edit' && form.buyer !== src.buyer && (
          <p className="hint">바이어를 바꾸면 그 바이어의 새 번호를 받아요.</p>
        )}
        {mode !== 'edit' && noChoice !== 'new' && (
          <p className="hint">같은 컨테이너(No. {noChoice.split('|')[1]})에 줄을 더해요. 다음 선적이면 No.를 새 번호로 바꿔 주세요.</p>
        )}

        <Field label="과일">
          <div className="chips">
            {data.fruits.map((f) => (
              <Chip key={f.fruitKo} on={form.fruit === f.fruitKo} onClick={() => update({ fruit: f.fruitKo })}>
                {f.fruitKo}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="운송">
          <Segmented options={SHIPS} value={form.ship} onChange={(v) => update({ ship: v })} label="운송" />
        </Field>

        <Field label="산지">
          <TextField value={form.origin} onChange={(v) => update({ origin: v })} placeholder="예: 나주" label="산지"
            list="origin-list" />
          {/* 전에 쓴 산지 이름을 자동완성으로 */}
          <datalist id="origin-list">
            {origins.map((o) => <option key={o} value={o} />)}
          </datalist>
        </Field>

        <div className="row-2">
          <Field label="스펙" hint="직접 입력">
            <TextField value={form.specKo} onChange={(v) => update({ specKo: v })} placeholder="예: 15kg 18-24" label="스펙" />
          </Field>
          <Field label="영어" hint="JPG용">
            <TextField value={form.specEn} onChange={(v) => update({ specEn: v }, ['specEn'])}
              placeholder={form.specKo ? '예: 15kg, 18-24' : ''} label="스펙 영어"
              className={'input' + (specKnown && !touched.specEn ? ' soft' : '')} />
          </Field>
        </div>
        {form.specKo.trim() && form.fruit && (
          <p className="hint">
            {specKnown ? '한 번 쓴 스펙은 영어가 자동으로 채워져요. 고치면 이 스펙 전체에 반영돼요.' : '처음 쓰는 스펙이에요. 영어를 한 번만 넣어 주세요.'}
          </p>
        )}

        <div className="row-2">
          <Field label="상차일">
            <DateField value={form.loadDate} onChange={(v) => update({ loadDate: v })} label="상차일"
              placeholder="정해지면" clearable today={data.today} />
          </Field>
          <Field label="ETA">
            <DateField value={form.eta} onChange={(v) => update({ eta: v })} label="ETA" today={data.today} />
          </Field>
        </div>
        {etaPast && (
          <p className="warn"><IconAlert size={18} /> ETA가 지난 날짜예요. 해와 날짜를 확인해 주세요.</p>
        )}
        {etaBeforeLoad && (
          <p className="warn"><IconAlert size={18} /> ETA가 상차일보다 빨라요. 날짜를 확인해 주세요.</p>
        )}

        {/* 산지담당 칸(산지가·작업비)과 바이어담당 칸(바이어가·상태)을 한 줄씩 묶었다. 누구나 다 고친다. */}
        <div className="row-2">
          <Field label="산지가">
            <MoneyField value={form.cost} onChange={(v) => update({ cost: v }, ['cost'])} symbol="₩" label="산지가" />
          </Field>
          <Field label="작업비" hint="참고">
            <MoneyField value={form.workCost} onChange={(v) => update({ workCost: v })} symbol="₩" label="작업비" />
          </Field>
        </div>
        {(hasValue(costHint.cost) && !form.cost) || (hasValue(costHint.workCost) && !form.workCost) ? (
          <div className="hint-chips">
            {hasValue(costHint.cost) && !form.cost && (
              <button type="button" className="hint-chip" onClick={() => update({ cost: moneyInput(costHint.cost, 0) }, ['cost'])}>
                직전 산지가 {fmtWon(costHint.cost)} 넣기
              </button>
            )}
            {hasValue(costHint.workCost) && !form.workCost && (
              <button type="button" className="hint-chip" onClick={() => update({ workCost: moneyInput(costHint.workCost, 0) })}>
                직전 작업비 {fmtWon(costHint.workCost)} 넣기
              </button>
            )}
          </div>
        ) : null}
        <div className="row-2">
          <Field label="바이어가" hint={mode === 'new' && !touched.price && form.price ? '직전 값' : ''}>
            <MoneyField value={form.price} onChange={(v) => update({ price: v }, ['price'])}
              symbol={currencySymbol(currency)} decimal label="바이어가" />
          </Field>
          <Field label="상태">
            <Segmented options={['미정', '확정']} value={form.status} onChange={(v) => update({ status: v })} label="상태" />
          </Field>
        </div>

        {mode === 'edit' && (
          <div className="danger-zone">
            {deleteArmedAt ? (
              <div className="delete-confirm">
                <span>이 줄을 지울까요? 시트에는 삭제 표시만 남아요.</span>
                <div className="row-2">
                  <button type="button" className="btn-secondary" onClick={() => setDeleteArmedAt(0)} disabled={saving}>두기</button>
                  <button type="button" className="btn-danger" onClick={remove} disabled={saving}>
                    <IconTrash size={20} /> 지우기
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="link-btn danger" onClick={() => setDeleteArmedAt(Date.now())} disabled={saving}>
                <IconTrash size={18} /> 이 줄 지우기
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="form-error floating" role="alert">{error}</p>}

      <div className="bottom-bar two">
        <button type="button" className="btn-secondary" onClick={close} disabled={saving}>취소</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saveLabel}</button>
      </div>
    </div>
  );
}

function hasValue(n) {
  return n !== null && n !== undefined;
}

function defaultExporter(data, buyerName) {
  const b = data.buyers.find((x) => x.name === buyerName);
  return (b && b.exporter) || '';
}
