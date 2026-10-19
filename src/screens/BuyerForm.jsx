// 바이어 더하기·고치기(2026-10-19 사용자 요청). 시트 바이어 탭에 저장된다.
// 칸은 이름, 영어 이름(JPG 제목), 나라, 통화, 회사만. 가격 조건(FOB/CIF)은 2026-10-19 사용자 요청으로 뺐다(오퍼 가격이라 나눌 필요 없음).
// 나머지(나라 영어, 가격 단위, 가격 조건, 순서, 숨김)는 시트에 그대로 남고 앱은 건드리지 않는다.
import { useEffect, useRef, useState } from 'react';
import { back, backTo, buyerPath, replace, setLeaveGuard } from '../router.js';
import { Field, Segmented, SelectField, TextField } from '../components/Controls.jsx';
import { IconAlert, IconClose } from '../components/icons.jsx';

const CURRENCIES = ['USD', 'SGD', 'HKD', 'TWD', 'MYR', 'THB', 'VND', 'IDR', 'PHP', 'CAD', 'AUD', 'NZD', 'EUR', 'GBP', 'JPY', 'CNY', 'KRW'];
const EXPORTERS = ['Hyun Nong Fresh', 'Royal'];

/** 지금 바이어들이 가장 많이 쓰는 값(새 바이어의 처음 값) */
function mostUsed(buyers, key, fallback) {
  const count = {};
  for (const b of buyers) if (b[key]) count[b[key]] = (count[b[key]] || 0) + 1;
  const top = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  return top || fallback;
}

const uniq = (list) => [...new Set(list.filter(Boolean))];
const keyOf = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

export default function BuyerForm({ data, buyerName, onSave }) {
  const editing = !!buyerName;
  const src = editing ? data.buyers.find((b) => b.name === buyerName) : null;
  const [init] = useState(() => (src ? {
    name: src.name, nameEn: src.nameEn || '', country: src.country || '',
    currency: src.currency || 'USD', exporter: src.exporter || ''
  } : {
    name: '', nameEn: '', country: '',
    currency: mostUsed(data.buyers, 'currency', 'USD'),
    exporter: mostUsed(data.buyers, 'exporter', EXPORTERS[0])
  }));
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const dirtyRef = useRef(false);

  const dirty = Object.keys(init).some((k) => String(form[k]).trim() !== String(init[k]).trim());
  dirtyRef.current = dirty && !saving;

  useEffect(() => {
    alive.current = true;
    const release = setLeaveGuard(() => !dirtyRef.current || window.confirm('저장하지 않고 나갈까요?'));
    return () => {
      alive.current = false;
      release();
    };
  }, []);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setError('');
  };

  const name = form.name.trim().replace(/\s+/g, ' ');
  const dup = data.buyers.find((b) => b.name !== buyerName && keyOf(b.name) === keyOf(name));
  const renaming = editing && name && name !== buyerName;
  const rowCount = editing ? data.rows.filter((r) => r.buyer === buyerName).length : 0;

  async function save() {
    if (saving) return;
    if (!name) return setError('바이어 이름을 넣어 주세요.');
    if (dup) return setError(dup.archived ? `"${dup.name}"는 바이어 탭에 숨겨져 있어요. 시트에서 숨김을 풀어 주세요.` : `"${dup.name}"는 이미 있는 바이어예요.`);
    setSaving(true);
    const ok = await onSave({ ...form, name }, buyerName || '');
    if (!alive.current) return;
    setSaving(false);
    if (ok !== true) return setError(ok || '저장하지 못했어요.');
    dirtyRef.current = false;
    if (!editing) replace(buyerPath(name)); // 새 바이어는 그 바이어 스케줄로(일정을 바로 더할 수 있게)
    else backTo(buyerPath(name)); // 고쳤으면 바이어 스케줄로 돌아간다(이름을 바꿨으면 새 이름으로)
  }

  function close() {
    if (saving) return;
    if (dirty && !window.confirm('저장하지 않고 나갈까요?')) return;
    back(editing ? buyerPath(buyerName) : '/');
  }

  if (editing && !src) {
    return (
      <div className="screen page">
        <header className="page-head">
          <button type="button" className="icon-btn" aria-label="닫기" onClick={() => back('/')}><IconClose size={26} /></button>
          <div className="page-title"><h1>바이어 고치기</h1></div>
        </header>
        <p className="empty-box">"{buyerName}" 바이어를 바이어 탭에서 찾지 못했어요.</p>
      </div>
    );
  }

  const currencies = uniq([form.currency, ...data.buyers.map((b) => b.currency), ...CURRENCIES]);
  const exporters = uniq([...EXPORTERS, ...data.buyers.map((b) => b.exporter), form.exporter]);
  const countries = uniq(data.buyers.map((b) => b.country));

  return (
    <div className="screen editor with-bottom">
      <header className="page-head">
        <button type="button" className="icon-btn" aria-label="닫기" onClick={close} disabled={saving}><IconClose size={26} /></button>
        <div className="page-title">
          <h1>{editing ? '바이어 고치기' : '바이어 추가'}</h1>
          <div className="sub">시트 바이어 탭에 저장돼요</div>
        </div>
      </header>

      <div className={'form' + (error ? ' has-error' : '')}>
        <Field label="이름">
          <TextField value={form.name} onChange={(v) => set({ name: v })} placeholder="예: 킹고" label="바이어 이름" />
        </Field>
        {dup && <p className="warn"><IconAlert size={18} /> "{dup.name}"는 이미 있는 바이어예요{dup.archived ? '(시트에서 숨김)' : ''}.</p>}
        {renaming && rowCount > 0 && (
          <p className="hint">이름을 바꾸면 이 바이어의 스케줄 {rowCount}줄도 새 이름으로 함께 바뀌어요.</p>
        )}

        <Field label="영어 이름" hint="JPG 제목(예: Kingo Schedule)">
          <TextField value={form.nameEn} onChange={(v) => set({ nameEn: v })} placeholder="예: Kingo" label="영어 이름" />
        </Field>
        {!form.nameEn.trim() && <p className="hint">비우면 JPG 제목이 "Shipping Schedule"로 나가요.</p>}

        <Field label="나라">
          <TextField value={form.country} onChange={(v) => set({ country: v })} placeholder="예: 대만" label="나라" list="country-list" />
          <datalist id="country-list">
            {countries.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>

        <Field label="통화" hint="바이어가">
          <SelectField value={form.currency} onChange={(v) => set({ currency: v })} label="통화"
            options={currencies.map((c) => ({ value: c, label: c }))} />
        </Field>

        <Field label="회사" hint="JPG 맨 위">
          <Segmented options={exporters} value={form.exporter} onChange={(v) => set({ exporter: v })} label="회사" />
        </Field>

        {error && <p className="form-error" role="alert">{error}</p>}
      </div>

      <div className="bottom-bar two">
        <button type="button" className="btn-secondary" onClick={close} disabled={saving}>취소</button>
        <button type="button" className="btn-primary" onClick={save} disabled={saving || !!dup}>
          {saving ? '저장 중…' : editing ? '바이어 저장' : '바이어 추가'}
        </button>
      </div>
    </div>
  );
}
