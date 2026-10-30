// list를 읽어 두고 30초마다 다시 읽는다. 앱이 가려져 있으면 쉬고, 다시 보이면 바로 읽는다.
// 마지막으로 받은 데이터는 이 폰에 남겨 두어 다음에 열 때 바로 보인다(코드가 거절되면 지움).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { call, AuthError } from '../api.js';
import { REFRESH_MS } from '../config.js';
import { todayKst } from '../lib/dates.js';

const CACHE_KEY = 'bs.cache';

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return c && c.data && c.data.ok ? c : null;
  } catch {
    return null;
  }
}

function writeCache(data, fetchedAt) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt }));
  } catch {
    // 저장 공간이 없으면 캐시 없이 쓴다
  }
}

export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // 무시
  }
}

export function useScheduleData(code, onAuthFail) {
  const cached = useRef(readCache());
  const [data, setData] = useState(cached.current ? cached.current.data : null);
  const [fetchedAt, setFetchedAt] = useState(cached.current ? cached.current.fetchedAt : null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inflight = useRef(null);
  // 지금 보이는 목록을 창구가 만든 때(serverTime). 이보다 옛 목록(늦게 도착한 다시 읽기·저장 응답)은 버린다(2026-10-30 검토)
  const latestServer = useRef(cached.current && cached.current.data ? cached.current.data.serverTime || '' : '');
  const isOlder = (res) => !!(res && res.serverTime && latestServer.current && res.serverTime < latestServer.current);
  // 저장 중인 줄(화면에 먼저 보여 주기): { key, kind: 'edit'|'new'|'remove', id, patch, row }
  const [pending, setPending] = useState([]);
  const authFail = useRef(onAuthFail);
  authFail.current = onAuthFail;

  // fresh: 저장·삭제 직후처럼 '지금부터' 읽어야 할 때. 진행 중인 읽기는 저장 전에 출발했을 수 있으니
  // 끝나기를 기다렸다가 새로 한 번 더 읽는다(동시에 나가는 읽기는 언제나 하나).
  const refresh = useCallback(async (opts) => {
    if (!code) return null;
    if (inflight.current) {
      if (!(opts && opts.fresh)) return inflight.current;
      await inflight.current;
      if (inflight.current) return refresh(opts);
    }
    setLoading(true);
    const p = (async () => {
      try {
        const res = await call(code, 'list');
        if (isOlder(res)) return res; // 이미 더 새 목록(저장 응답)을 보여 주는 중
        latestServer.current = res.serverTime || latestServer.current;
        const at = new Date().toISOString();
        setData(res);
        setFetchedAt(at);
        setError('');
        writeCache(res, at);
        return res;
      } catch (e) {
        if (e instanceof AuthError) {
          clearCache();
          setData(null);
          authFail.current(e.message);
        } else {
          setError(e.message);
        }
        return null;
      } finally {
        setLoading(false);
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, [code]);

  useEffect(() => {
    if (!code) return undefined;
    refresh();
    let timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [code, refresh]);

  // 오늘 날짜는 창구(서울 기준)가 준 값을 쓰되, 이 폰에 남겨 둔 옛 응답이라 하루 이상 지났으면 폰의 서울 날짜로 올린다
  // (오프라인으로 다음 날 열었을 때 상차 끝남 주황·지난 일정이 하루 늦지 않게, 2026-10-20 검토).
  const day = todayKst();
  const view = useMemo(() => {
    if (!data) return data;
    let d = !data.today || data.today < day ? { ...data, today: day } : data;
    // 저장 중인 줄을 목록에 먼저 보여 준다(고친 칸 덮기, 새 줄 더하기, 지운 줄 빼기). 저장이 끝나면 창구의 목록으로 바뀐다
    if (pending.length) {
      let rows = d.rows;
      for (const op of pending) {
        if (op.kind === 'edit') rows = rows.map((r) => (r.id === op.id ? { ...r, ...op.patch, pending: true } : r));
        else if (op.kind === 'remove') rows = rows.filter((r) => r.id !== op.id);
        else if (op.kind === 'new' && op.row) rows = [...rows, { ...op.row, pending: true }];
      }
      d = { ...d, rows };
    }
    return d;
  }, [data, day, pending]);

  /** 저장·지우기 응답에 붙어 온 새 목록을 그대로 쓴다(다시 읽기 요청을 따로 하지 않아도 되게) */
  const applyList = useCallback((list) => {
    if (!list || !list.ok || isOlder(list)) return;
    latestServer.current = list.serverTime || latestServer.current;
    const at = new Date().toISOString();
    setData(list);
    setFetchedAt(at);
    setError('');
    writeCache(list, at);
  }, []);
  const addPending = useCallback((op) => setPending((p) => [...p, op]), []);
  const dropPending = useCallback((key) => setPending((p) => p.filter((op) => op.key !== key)), []);

  // 저장은 됐는데 다시 읽기가 실패했을 때: 저장 결과(id → No.)만 지금 목록에 바로 반영한다(2026-10-30 점검)
  const patchSaved = useCallback((saved) => {
    const byId = new Map((saved || []).filter((s) => s && s.id).map((s) => [s.id, s]));
    if (!byId.size) return;
    setData((d) => (d && d.rows ? {
      ...d,
      rows: d.rows.map((r) => {
        const s = byId.get(r.id);
        return s && s.no !== undefined ? { ...r, no: s.no, noYear: s.noYear || r.noYear } : r;
      })
    } : d));
  }, []);

  return { data: view, fetchedAt, error, loading, refresh, patchSaved, applyList, addPending, dropPending, pendingCount: pending.length };
}
