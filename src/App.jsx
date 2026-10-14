import { useCallback, useEffect, useRef, useState } from 'react';
import { call, AuthError } from './api.js';
import { clearCode, saveCode, takeCodeFromUrl, CODE_EVENT } from './lib/link.js';
import { useRoute, replace, userBack } from './router.js';
import { useSwipeBack, isIosStandalone } from './hooks/useSwipeBack.js';
import { useScheduleData, clearCache } from './hooks/useScheduleData.js';
import { Toast } from './components/Sheet.jsx';
import CodeEntry from './screens/CodeEntry.jsx';
import Home from './screens/Home.jsx';
import BuyerSchedule from './screens/BuyerSchedule.jsx';
import Editor from './screens/Editor.jsx';

const FOCUS_MS = 15000;

export default function App() {
  const [code, setCode] = useState(takeCodeFromUrl);
  const [authMessage, setAuthMessage] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const lastSaved = useRef(null); // 방금 저장한 줄(돌아간 목록이 그 줄이 보이는 기간·과일로 열리게)
  const route = useRoute();

  const onAuthFail = useCallback((message) => {
    clearCode();
    setCode('');
    setAuthMessage(message);
  }, []);

  // 앱이 열린 채로 새 초대 링크(#code=...)를 열면 그 코드로 바꾼다
  useEffect(() => {
    const onCode = (e) => {
      setAuthMessage('');
      setCode(e.detail);
    };
    window.addEventListener(CODE_EVENT, onCode);
    return () => window.removeEventListener(CODE_EVENT, onCode);
  }, []);

  const { data, fetchedAt, error, loading, refresh } = useScheduleData(code, onAuthFail);

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  // 바뀐 칸만 담아 보내고, 저장 직후 바로 다시 읽는다. 성공하면 true, 실패하면 알림 글자를 돌려준다.
  const save = useCallback(async (items, buyer, eta, fruit) => {
    try {
      const res = await call(code, 'save', { items });
      lastSaved.current = { buyer, eta, fruit, at: Date.now() };
      await refresh({ fresh: true });
      const s = res.saved && res.saved[0];
      showToast(s && s.no ? `저장했어요 · ${buyer} No. ${s.no}` : '저장했어요');
      return true;
    } catch (e) {
      if (e instanceof AuthError) onAuthFail(e.message);
      else refresh({ fresh: true }); // 지워진 줄·컨테이너 때문에 거절됐을 수 있으니 목록을 새로 받아 둔다
      return e.message;
    }
  }, [code, refresh, showToast, onAuthFail]);

  const remove = useCallback(async (id) => {
    try {
      await call(code, 'remove', { ids: [id] });
      await refresh({ fresh: true });
      showToast('지웠어요 · 시트의 삭제 칸에 표시만 했어요');
      return true;
    } catch (e) {
      if (e instanceof AuthError) onAuthFail(e.message);
      else showToast(e.message);
      return e.message;
    }
  }, [code, refresh, showToast, onAuthFail]);

  const saveLost = useCallback((message) => showToast('저장하지 못했어요 · ' + message), [showToast]);

  // 홈 화면 앱에서 오른쪽으로 밀면 뒤로(홈에서는 갈 곳이 없어 끔)
  useSwipeBack(isIosStandalone() && !!code && route.segs.length > 0, () => userBack('/'));

  useEffect(() => {
    if (!code) clearCache();
  }, [code]);

  if (!code) {
    return (
      <CodeEntry message={authMessage} onSubmit={(c) => {
        saveCode(c);
        setAuthMessage('');
        setCode(c);
        replace('/');
      }} />
    );
  }

  if (!data) {
    return (
      <div className="screen center">
        {error ? (
          <>
            <p className="form-error">{error}</p>
            <button type="button" className="btn-primary" onClick={() => refresh()}>다시 해 보기</button>
          </>
        ) : (
          <p className="sub">불러오는 중…</p>
        )}
      </div>
    );
  }

  const [first, second] = route.segs;
  let screen;
  if (first === 'b' && second) {
    const ls = lastSaved.current;
    const recent = ls && ls.buyer === second && Date.now() - ls.at < FOCUS_MS;
    screen = (
      <BuyerSchedule key={second} data={data} buyerName={second} onRemove={remove}
        focusEta={recent ? ls.eta : null} focusFruit={recent ? ls.fruit : null} />
    );
  } else if (first === 'new') {
    screen = (
      <Editor key={'new' + (route.params.buyer || '')} data={data} mode="new" presetBuyer={route.params.buyer}
        onSave={save} onRemove={remove} onSaveLost={saveLost} />
    );
  } else if ((first === 'edit' || first === 'dup') && second) {
    screen = (
      <Editor key={first + second + (route.params.as || '')} data={data} mode={first} id={second}
        dupAs={route.params.as === 'next' ? 'next' : 'same'} onSave={save} onRemove={remove} onSaveLost={saveLost} />
    );
  } else {
    screen = <Home data={data} fetchedAt={fetchedAt} loading={loading} />;
  }

  return (
    <>
      {error && <div className="net-banner" role="status">{error} · 잠시 뒤 다시 읽어요</div>}
      {screen}
      <Toast text={toast} />
    </>
  );
}
