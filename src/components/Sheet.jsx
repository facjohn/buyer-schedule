// 아래에서 올라오는 메뉴(길게 누르기)와 잠깐 뜨는 알림.
import { useEffect } from 'react';

export function ActionSheet({ title, actions, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {title && <div className="sheet-title">{title}</div>}
        {actions.map((a) => (
          <button key={a.label} type="button" className={'sheet-btn' + (a.danger ? ' danger' : '')}
            onClick={a.onClick}>
            {a.icon}
            <span>{a.label}</span>
          </button>
        ))}
        <button type="button" className="sheet-btn cancel" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}

export function Toast({ text }) {
  if (!text) return null;
  return <div className="toast" role="status">{text}</div>;
}
