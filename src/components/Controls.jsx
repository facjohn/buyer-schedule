// 버튼·입력 부품. 입력 글자는 16px 이상(아이폰이 확대하지 않게), 누르는 곳은 44px 이상.
import { useId, useState, useRef } from 'react';
import { fmtKo } from '../lib/dates.js';
import { IconCalendar, IconDown } from './icons.jsx';

export function Segmented({ options, value, onChange, label }) {
  // 고른 칸 표시가 미끄러지듯 옮겨 간다(아이폰 분할 버튼, 2026-10-30 사용자 요청)
  const idx = options.findIndex((o) => (typeof o === 'string' ? o : o.value) === value);
  return (
    <div className={'seg' + (idx >= 0 ? ' has-thumb' : '')} role="radiogroup" aria-label={label}
      style={{ '--n': options.length, '--idx': Math.max(0, idx) }}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const text = typeof o === 'string' ? o : o.label;
        return (
          <button key={v} type="button" role="radio" aria-checked={value === v}
            className={'seg-btn' + (value === v ? ' on' : '')} onClick={() => onChange(v)}>
            {text}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ on, children, ...rest }) {
  return (
    <button type="button" className={'chip' + (on ? ' on' : '')} aria-pressed={!!on} {...rest}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <div className={'field ' + className}>
      <div className="field-label">
        {label}
        {hint && <span className="field-hint"> · {hint}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * 날짜 칸: 보이는 글자는 "10월 20일 (화)"(다른 해면 "2027년 1월 12일 (화)"), 누르면 폰의 날짜 고르기가 뜬다.
 * 지울 수 있는 칸은 달력 아이콘 자리에 ✕를 둔다(날짜 글자를 가리지 않게, 누르는 곳 44px).
 */
export function DateField({ value, onChange, placeholder = '날짜 고르기', label, clearable, today }) {
  const id = useId();
  const showClear = clearable && value;
  return (
    <div className={'input date-input' + (showClear ? ' has-clear' : '')}>
      <label htmlFor={id} className="date-hit">
        {/* 다른 해면 해를 작은 윗줄로(폭 360px 칸에서도 날짜·요일이 잘리지 않게) */}
        <span className="date-text">
          {value ? (
            <>
              {today && value.slice(0, 4) !== today.slice(0, 4) && <span className="date-year">{value.slice(0, 4)}년</span>}
              <span className="date-main">{fmtKo(value)}</span>
            </>
          ) : (
            <span className="placeholder">{placeholder}</span>
          )}
        </span>
        {!showClear && <IconCalendar size={20} />}
        <input id={id} type="date" value={value || ''} aria-label={label}
          onClick={(e) => {
            try {
              if (e.currentTarget.showPicker) e.currentTarget.showPicker();
            } catch {
              // 이미 열려 있거나 지원하지 않는 브라우저
            }
          }}
          onChange={(e) => onChange(e.target.value)} />
      </label>
      {showClear && (
        <button type="button" className="date-clear" aria-label={label + ' 지우기'} onClick={() => onChange('')}>✕</button>
      )}
    </div>
  );
}

/**
 * 금액 칸. 바이어가는 소수점, 산지가·작업비는 원 단위.
 * 가격이 여럿이면 17.3/17.8처럼 '/'로 잇는다. 폰 숫자 자판에는 '/'가 없어서 오른쪽 '/' 버튼으로 넣는다.
 */
export function MoneyField({ value, onChange, symbol, decimal, placeholder, label }) {
  const ref = useRef(null);
  const addSlash = () => {
    // 누른 그 자리에서 바로 이 칸으로(아이폰은 손가락 누름 안에서 focus해야 자판이 뜬다). 바뀐 글자 뒤에 커서가 간다
    if (ref.current) ref.current.focus();
    const v = String(value || '').trim();
    if (v && !v.endsWith('/')) onChange(v + '/');
  };
  return (
    <div className="input money-input">
      <span className="money-symbol">{symbol}</span>
      <input ref={ref} inputMode={decimal ? 'decimal' : 'numeric'} value={value} placeholder={placeholder}
        aria-label={label} autoComplete="off"
        onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="money-more" aria-label={label + ' 가격 하나 더 (/)'}
        onMouseDown={(e) => e.preventDefault()} onClick={addSlash}>/</button>
    </div>
  );
}

export function TextField({ value, onChange, placeholder, label, ...rest }) {
  return (
    <input className="input" value={value} placeholder={placeholder} aria-label={label}
      autoComplete="off" onChange={(e) => onChange(e.target.value)} {...rest} />
  );
}

/** 고르기 칸(폰의 기본 고르기 화면을 쓴다). 지금 값이 목록에 없으면 그대로 보이게 맨 위에 넣는다. */
export function SelectField({ value, onChange, options, label, className = '' }) {
  const all = value && !options.some((o) => o.value === value)
    ? [{ value, label: value }, ...options]
    : options;
  return (
    <div className={'input select-input' + (className ? ' ' + className : '')}>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {all.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
      <IconDown size={20} />
    </div>
  );
}

export function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={'collapsible' + (open ? ' open' : '')}>
      <button type="button" className="collapsible-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        {title}
        <IconDown size={20} />
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}
