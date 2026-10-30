import { useCallback, useEffect, useRef, useState } from 'react';
import { call, AuthError } from './api.js';
import { clearCode, saveCode, takeCodeFromUrl, CODE_EVENT } from './lib/link.js';
import { useRoute, replace, userBack, canGoForward, goForward } from './router.js';
import { useSwipeNav, isIosStandalone } from './hooks/useSwipeBack.js';
import { buyerLabel } from './lib/undecided.js';
import { useScheduleData, clearCache } from './hooks/useScheduleData.js';
import { Toast } from './components/Sheet.jsx';
import CodeEntry from './screens/CodeEntry.jsx';
import Home from './screens/Home.jsx';
import BuyerSchedule from './screens/BuyerSchedule.jsx';
import Editor from './screens/Editor.jsx';
import JpgPreview from './screens/JpgPreview.jsx';
import BuyerForm from './screens/BuyerForm.jsx';

const FOCUS_MS = 15000;
const FAILED_KEY = 'bs.failed'; // 저장하지 못한 줄(다시 시도할 수 있게 이 폰에 남겨 둔다)
const QUEUE_KEY = 'bs.queue'; // 보내는 중인 줄(앱이 닫혀 결과를 모르면 다음에 열 때 '저장하지 못한 줄'로)

function readList(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  try {
    if (list.length) localStorage.setItem(key, JSON.stringify(list));
    else localStorage.removeItem(key);
  } catch {
    // 저장 공간이 없으면 화면에만 남긴다
  }
}

/** 처음 열 때: 지난번에 보내다 만 줄도 '저장하지 못한 줄'로 모은다(읽기만, 보내던 목록은 아래 effect가 비운다) */
function initialFailed() {
  const left = readList(QUEUE_KEY).map((j) => ({ ...j, message: '앱이 닫혀 저장됐는지 확인하지 못했어요' }));
  const keys = new Set(left.map((j) => j.key));
  return [...readFailed().filter((j) => !keys.has(j.key)), ...left];
}

/** 고치기 일이 이미 시트에 들어가 있는지(지금 목록의 그 줄 값이 보낸 값과 같으면) */
function alreadyApplied(job, rows) {
  const item = job.payload && job.payload.items && job.payload.items[0];
  if (!item || !item.id) return false;
  const row = (rows || []).find((r) => r.id === item.id && !r.pending);
  if (!row) return false;
  const same = (a, b) => String(a ?? '') === String(b ?? '');
  if (item.no && !same(item.no, row.no)) return false;
  return Object.entries(item.changes || {}).every(([k, v]) => same(v, row[k]));
}

function readFailed() {
  try {
    const v = JSON.parse(localStorage.getItem(FAILED_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function writeFailed(list) {
  try {
    if (list.length) localStorage.setItem(FAILED_KEY, JSON.stringify(list));
    else localStorage.removeItem(FAILED_KEY);
  } catch {
    // 저장 공간이 없으면 화면에만 남긴다
  }
}

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

  const { data, fetchedAt, error, loading, refresh, patchSaved, applyList, addPending, dropPending } = useScheduleData(code, onAuthFail);
  // 저장·지우기는 화면을 기다리게 하지 않고 뒤에서 차례대로 보낸다(2026-10-30 사용자 요청: "화면은 그냥 넘어가지만 시트에는 저장되게")
  const queue = useRef(Promise.resolve());
  const [failed, setFailed] = useState(initialFailed);
  useEffect(() => writeFailed(failed), [failed]);
  // 지난번에 보내다 만 줄은 위에서 '저장하지 못한 줄'로 옮겼으니 비운다(처음 한 번)
  useEffect(() => writeList(QUEUE_KEY, []), []);
  // 보내는 중인 일: 끝나면 지운다
  const inQueue = useCallback((job, on) => {
    const list = readList(QUEUE_KEY).filter((j) => j.key !== job.key);
    writeList(QUEUE_KEY, on ? [...list, job] : list);
  }, []);

  const showToast = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  /**
   * 뒤에서 보내기. 창구가 저장·지우기 결과에 새 목록을 붙여 주면(withList) 그걸로 바로 바꾸고,
   * 실패하면 화면에 먼저 보여 준 것을 거두고 '저장하지 못한 줄'에 남긴다(다시 시도·버리기).
   * job: { key, action: 'save'|'remove', payload, label, buyer }
   */
  const runJob = useCallback((job0) => {
    const job = { ...job0, at: job0.at || Date.now() };
    inQueue(job, true);
    const task = async () => {
      try {
        const res = await call(code, job.action, { ...job.payload, withList: true });
        if (res.list) applyList(res.list);
        else {
          const fresh = await refresh({ fresh: true });
          if (!fresh && job.action === 'save') patchSaved(res.saved);
        }
        dropPending(job.key);
        inQueue(job, false);
        // 같은 줄을 먼저 고쳤다 실패한 일은, 이번에 저장한 칸을 빼고 남긴다(다시 시도해도 새 값을 옛 값으로 덮지 않게)
        const done = job.action === 'save' && job.payload.items[0] && job.payload.items[0].id ? job.payload.items[0] : null;
        setFailed((list) => list.filter((x) => x.key !== job.key).map((x) => {
          const it = x.action === 'save' && x.payload.items[0];
          if (!done || !it || it.id !== done.id || x.at > job.at) return x;
          const changes = { ...it.changes };
          Object.keys(done.changes || {}).forEach((k) => delete changes[k]);
          const no = done.no ? undefined : it.no;
          if (!Object.keys(changes).length && !no) return null;
          return { ...x, payload: { items: [{ ...it, changes, no }] } };
        }).filter(Boolean));
        if (job.action === 'save') {
          const sv = res.saved && res.saved[0];
          showToast(sv && sv.no ? `저장했어요 · ${buyerLabel(job.buyer)} No. ${sv.no}` : '저장했어요');
        } else {
          showToast('지웠어요 · 시트의 삭제 칸에 표시만 했어요');
        }
      } catch (e) {
        dropPending(job.key);
        inQueue(job, false);
        const auth = e instanceof AuthError;
        // 코드가 거절돼도 넣은 값은 '저장하지 못한 줄'로 남긴다(코드를 다시 넣고 다시 시도)
        setFailed((list) => [...list.filter((x) => x.key !== job.key),
          { ...job, message: auth ? '코드를 다시 넣은 뒤 다시 시도해 주세요' : e.message }]);
        if (auth) {
          onAuthFail(e.message);
          return;
        }
        showToast((job.action === 'save' ? '저장하지 못했어요 · ' : '지우지 못했어요 · ') + e.message);
        refresh({ fresh: true }); // 지워진 줄·컨테이너 때문에 거절됐을 수 있으니 목록을 새로 받아 둔다
      }
    };
    queue.current = queue.current.then(task, task);
    return queue.current;
  }, [code, refresh, applyList, dropPending, patchSaved, showToast, onAuthFail, inQueue]);

  // 저장: 화면에 먼저 보여 주고(저장 중) 바로 돌아간다. 성공하면 true.
  // meta: { buyer, eta, fruit, optimistic: { kind, id, patch, row }, label }
  const save = useCallback(async (items, meta = {}) => {
    const key = (items[0] && items[0].key) || `sv${Date.now().toString(36)}`;
    const { buyer, eta, fruit, optimistic, label } = meta;
    lastSaved.current = { buyer, eta, fruit, at: Date.now() };
    if (optimistic) addPending({ key, ...optimistic });
    showToast('저장 중… 시트에 넣고 있어요');
    runJob({ key, action: 'save', payload: { items }, label: label || '스케줄', buyer });
    return true;
  }, [addPending, runJob, showToast]);

  const remove = useCallback(async (id, label) => {
    const key = `rm${id}${Date.now().toString(36)}`;
    addPending({ key, kind: 'remove', id });
    showToast('지우는 중…');
    runJob({ key, action: 'remove', payload: { ids: [id] }, label: label || '줄 지우기' });
    return true;
  }, [addPending, runJob, showToast]);

  const retryFailed = useCallback(() => {
    const list = failed;
    setFailed([]);
    const rows = data && data.rows;
    const todo = list.filter((job) => !alreadyApplied(job, rows));
    showToast(todo.length ? '다시 보내고 있어요' : '이미 시트에 들어가 있어요');
    todo.forEach((job) => runJob(job));
  }, [failed, runJob, showToast, data]);

  // 바이어 더하기·고치기. 성공하면 true, 실패하면 알림 글자
  const saveBuyer = useCallback(async (buyer, original) => {
    try {
      const res = await call(code, 'saveBuyer', { buyer, original });
      await refresh({ fresh: true });
      showToast(res.added ? `바이어를 더했어요 · ${res.name}`
        : res.renamed ? `바이어를 고쳤어요 · 스케줄 ${res.renamed}줄도 새 이름으로` : '바이어를 고쳤어요');
      return true;
    } catch (e) {
      if (e instanceof AuthError) onAuthFail(e.message);
      return e.message;
    }
  }, [code, refresh, showToast, onAuthFail]);

  const saveLost = useCallback((message) => showToast('저장하지 못했어요 · ' + message), [showToast]);
  // 방금 저장한 줄 표시는 한 번만 쓴다(15초 안에 다시 들어와도 고른 필터를 또 바꾸지 않게, 2026-10-30 점검)
  const useFocus = useCallback(() => { lastSaved.current = null; }, []);

  // 홈 화면 앱(아이폰)에서 손으로 밀기: 왼쪽에서 밀면 뒤로(화면이 손가락을 따라옴), 오른쪽 끝에서 밀면 앞으로
  useSwipeNav(isIosStandalone() && !!code, {
    canBack: route.segs.length > 0,
    onBack: () => userBack('/', { confirmed: true }),
    canForward: canGoForward,
    onForward: goForward
  });

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
        focusEta={recent ? ls.eta : null} focusFruit={recent ? ls.fruit : null}
        onFocusUsed={useFocus} />
    );
  } else if (first === 'buyer' && (second === 'new' || (second === 'edit' && route.segs[2]))) {
    const name = second === 'edit' ? route.segs[2] : '';
    screen = <BuyerForm key={'buyer' + name} data={data} buyerName={name} onSave={saveBuyer} />;
  } else if (first === 'jpg' && second) {
    screen = <JpgPreview key={second} data={data} buyerName={second} />;
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
      <div className="top-banners">
      {error && <div className="net-banner" role="status">{error} · 잠시 뒤 다시 읽어요</div>}
      {failed.length > 0 && (
        <div className="save-fail" role="alert">
          <div className="save-fail-text">
            <strong>저장하지 못한 {failed.length}건</strong> · {failed[0].label}{failed[0].message ? ` · ${failed[0].message}` : ''}
          </div>
          <div className="save-fail-actions">
            <button type="button" className="btn-mini" onClick={retryFailed}>다시 시도</button>
            <button type="button" className="btn-mini ghost" onClick={() => setFailed([])}>버리기</button>
          </div>
        </div>
      )}
      </div>
      {screen}
      <Toast text={toast} />
    </>
  );
}
