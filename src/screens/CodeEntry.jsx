// 접속 코드 넣기. 코드만 넣어도 되고, 받은 링크를 통째로 붙여 넣어도 된다.
import { useEffect, useState } from 'react';
import { extractCode } from '../lib/link.js';

export default function CodeEntry({ message, onSubmit }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [devMembers, setDevMembers] = useState([]);

  useEffect(() => {
    if (import.meta.env.VITE_MOCK === '1') {
      import('../dev/mockServer.js').then((m) => setDevMembers(m.mockMembers));
    }
  }, []);

  const submit = (e) => {
    e.preventDefault();
    const code = extractCode(text);
    if (!code) {
      setError('코드는 12자 이상이에요. 받은 링크를 통째로 붙여 넣어도 돼요.');
      return;
    }
    onSubmit(code);
  };

  return (
    <div className="screen code-screen">
      <h1 className="title">바이어 스케줄</h1>
      <p className="sub">받은 링크나 접속 코드를 넣어 주세요.</p>
      <form onSubmit={submit} className="code-form">
        <input className="input" value={text} onChange={(e) => { setText(e.target.value); setError(''); }}
          placeholder="링크나 코드 붙여 넣기" aria-label="접속 코드" autoComplete="off"
          autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        {(error || message) && <p className="form-error" role="alert">{error || message}</p>}
        <button type="submit" className="btn-primary">들어가기</button>
      </form>
      <p className="note">
        아이폰 홈 화면에 추가한 앱은 사파리와 저장 공간이 따로라서, 처음 한 번은 여기에 링크를 다시 붙여 넣어요.
      </p>
      {devMembers.length > 0 && (
        <div className="dev-box">
          <div className="dev-title">개발용 가짜 시트의 예시 코드</div>
          {devMembers.map((m) => (
            <button key={m.code} type="button" className="btn-secondary" onClick={() => onSubmit(m.code)}>
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
