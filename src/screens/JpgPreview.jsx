// ④ JPG 미리보기·공유: 오늘 이후로 잡힌 일정(ETA 미정 포함)을 바이어용 영어 사진으로.
// 미리보기가 곧 보낼 사진이다. 공유하기(카톡·왓츠앱·위챗) 또는 사진을 길게 눌러 사진 앱에 저장.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildJpg, jpgFileName, layoutJpg, paintJpg, JPG_MAX_HEIGHT } from '../lib/jpg.js';
import { back, buyerPath } from '../router.js';
import { Segmented } from '../components/Controls.jsx';
import { IconAlert, IconBack, IconImage, IconLock } from '../components/icons.jsx';

// 사진에 쓰는 글자(영어)를 그리기 전에 글꼴을 받아 둔다. 못 받으면 기본 글꼴로 그린다.
async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const sample = 'Shipping Schedule ABC abc 0123456789 $.,-·';
  try {
    await Promise.all([400, 600, 700].map((w) => document.fonts.load(`${w} 28px "IBM Plex Sans KR"`, sample)));
  } catch {
    // 기본 글꼴로 그린다
  }
}

async function renderJpg(model) {
  await loadFonts();
  const scratch = document.createElement('canvas').getContext('2d');
  const measure = (text, font) => {
    scratch.font = font;
    return scratch.measureText(text).width;
  };
  const layout = layoutJpg(model, measure);
  if (layout.height > JPG_MAX_HEIGHT) throw new Error('줄이 너무 많아 한 장에 담을 수 없어요. 회사를 나눠 보내 주세요.');
  // 결과 파일도 정확히 폭 1080px(기기 배율을 따르지 않는다)
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  paintJpg(canvas.getContext('2d'), layout);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('사진을 만들지 못했어요.'))), 'image/jpeg', 0.92);
  });
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

export default function JpgPreview({ data, buyerName }) {
  const [exporter, setExporter] = useState(null); // null이면 첫 회사
  const [showPrice, setShowPrice] = useState(true);
  const [img, setImg] = useState(null); // { key, blob, url, name } key = 그린 모델
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [retry, setRetry] = useState(0);
  const urlRef = useRef('');

  const jpg = useMemo(() => buildJpg(data, buyerName, { exporter, showPrice }), [data, buyerName, exporter, showPrice]);
  // 30초마다 다시 읽어도 담길 내용이 같으면 다시 그리지 않는다
  const key = JSON.stringify(jpg.model);

  const swapUrl = (url) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
  };

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError('');
    renderJpg(jpg.model)
      .then((blob) => {
        if (!alive) return;
        const url = URL.createObjectURL(blob);
        swapUrl(url);
        setImg({ key, blob, url, name: jpgFileName(jpg.model) });
      })
      .catch((e) => {
        if (!alive) return;
        // 못 만들었으면 이전 사진(다른 회사·가격 설정)을 남기지 않는다
        swapUrl('');
        setImg(null);
        setError(e.message);
      })
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, retry]);

  useEffect(() => () => swapUrl(''), []);

  // 지금 고른 내용으로 그린 사진만 보내고 저장한다(다시 그리는 동안의 옛 사진은 흐리게, 누를 수 없게)
  const ready = !!img && img.key === key && !busy && !error;
  const file = ready ? new File([img.blob], img.name, { type: 'image/jpeg' }) : null;
  const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));

  async function share() {
    if (!ready) return;
    setNote('');
    if (canShare) {
      try {
        await navigator.share({ files: [file] });
      } catch (e) {
        if (e && e.name !== 'AbortError') setNote('공유하지 못했어요. 사진을 길게 눌러 저장한 뒤 보내 주세요.');
      }
      return;
    }
    // 공유가 안 되는 기기(컴퓨터 등)는 내려받기
    const a = document.createElement('a');
    a.href = img.url;
    a.download = img.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const count = jpg.model.rows.length;

  return (
    <div className="screen page with-bottom jpg-screen">
      <header className="page-head">
        <button type="button" className="icon-btn" aria-label="뒤로" onClick={() => back(buyerPath(buyerName))}>
          <IconBack size={26} />
        </button>
        <div className="page-title">
          <h1>JPG 미리보기</h1>
          <div className="sub">{buyerName}에게 보낼 영어 사진 · 오늘 이후 일정 {count}줄</div>
        </div>
      </header>

      <div className="form">
        {jpg.exporters.length > 1 && (
          <div className="field">
            <div className="field-label">회사 <span className="field-hint">· 회사마다 사진을 따로 만들어요</span></div>
            <Segmented options={jpg.exporters.map((x) => ({ value: x, label: x || '회사 빈칸' }))}
              value={jpg.exporter} onChange={setExporter} label="회사" />
          </div>
        )}
        <div className="field">
          <div className="field-label">바이어가</div>
          <Segmented options={[{ value: 'on', label: '넣기' }, { value: 'off', label: '빼기' }]}
            value={showPrice ? 'on' : 'off'} onChange={(v) => setShowPrice(v === 'on')} label="바이어가" />
        </div>

        {jpg.warnings.length > 0 && (
          <div className="warn-box" role="status">
            <IconAlert size={18} />
            <span>
              시트에서 채워 주세요. 비어 있는 칸은 사진에 빈칸이나 "—"로 나가요:
              {jpg.warnings.map((w) => <span key={w} className="warn-item">· {w}</span>)}
            </span>
          </div>
        )}

        <div className="jpg-frame">
          {img && !error && (
            <img src={img.url} alt={`${buyerName} 영어 스케줄 사진`} className={'jpg-img' + (ready ? '' : ' stale')} />
          )}
          {!img && busy && <div className="empty-box">사진을 만드는 중…</div>}
          {error && (
            <div className="empty-box">
              <p className="form-error">{error}</p>
              <button type="button" className="link-btn" onClick={() => setRetry((n) => n + 1)}>다시 만들기</button>
            </div>
          )}
        </div>

        <p className="jpg-lock"><IconLock size={16} /> 산지가·작업비·산지·상차일은 사진에 안 들어가요</p>
        <p className="note center">미리보기를 길게 누르면 사진 앱에 저장돼요</p>
        {note && <p className="form-error">{note}</p>}
      </div>

      <div className="bottom-bar">
        <button type="button" className="btn-primary wide" onClick={share} disabled={!ready}>
          <IconImage size={22} /> {canShare ? '공유하기 (카톡·왓츠앱·위챗)' : '사진 내려받기'}
        </button>
      </div>
    </div>
  );
}
