// 바이어에게 보내는 영어 JPG.
// 화면을 찍지 않고 전용 그림판(canvas)에 직접 그린다. 그리는 쪽(layoutJpg)은 buildJpgModel이 만든 모델만 받고,
// 모델의 줄은 toBuyerRow(허용한 칸 7개)로만 만든다(절대 규칙 1). 산지가·작업비·산지·상차일·수량·메모는 모델에 없다.
import { fmtEn, fmtEnLong } from './dates.js';
import { fmtPrice } from './money.js';
import { sortByNo } from './schedule.js';
import { buyerPrice, fruitEnMap, toBuyerRow } from './buyerView.js';

export const JPG_WIDTH = 1080;
export const JPG_MIN_HEIGHT = 1350;
// 아이폰 캔버스 한도(가로 x 세로 16,777,216픽셀)보다 넉넉히 작게
export const JPG_MAX_HEIGHT = 15000;

const FAMILY = '"IBM Plex Sans KR", "Helvetica Neue", Arial, sans-serif';
const font = (weight, size) => `${weight} ${size}px ${FAMILY}`;
const C = {
  text: '#18201D', text2: '#56615C', muted: '#6B7570', brand: '#1F6B4F', line: '#EEF1EF', border: '#E2E6E3',
  head: '#F1F3F2', tbc: '#A15C07', tbcBg: '#FCF1E3', white: '#FFFFFF'
};

/**
 * 오늘 이후(ETA가 오늘이거나 그 뒤)와 ETA 미정 줄을 No. 순으로(2026-10-19 사용자 요청: 바이어 화면처럼 No. 대로, ETA 미정도 제 번호 자리에).
 * JPG에 담을 원본 줄(내부 칸 포함)이라 화면 밖으로 내보내지 않는다. 번호 해(noYear)로 줄 세운 다음 허용 칸만 담는다.
 */
export function upcomingRowsOf(data, buyerName) {
  return sortByNo((data.rows || []).filter((r) => r.buyer === buyerName && (!r.eta || r.eta >= data.today)));
}

/**
 * JPG 준비. { model, exporters, exporter, warnings }
 * - model: 그리는 쪽(layoutJpg)에 넘기는 유일한 데이터. rows는 허용한 칸만 담은 새 객체들이다.
 * - exporters·warnings: 미리보기 화면용(그리지 않는다)
 * opts: { exporter: 고른 회사(null이면 첫 회사, ''는 회사 칸이 빈 줄), showPrice: 바이어가 넣기 }
 */
export function buildJpg(data, buyerName, { exporter = null, showPrice = true } = {}) {
  const buyer = (data.buyers || []).find((b) => b.name === buyerName) || { name: buyerName };
  const all = upcomingRowsOf(data, buyerName);
  // 회사가 섞이면 회사별로 따로(한 JPG에는 한 회사만). 회사 칸이 빈 줄(바이어 탭 기본 회사도 빈 경우)은
  // 다른 회사 사진에 섞지 않고 '' 묶음으로 따로 두며, 그 사진에는 회사 이름을 쓰지 않는다.
  const named = [...new Set(all.map((r) => r.exporter || ''))].filter(Boolean);
  const blankCount = all.filter((r) => !r.exporter).length;
  const exporters = blankCount || !named.length ? [...named, ''] : named;
  const chosen = exporter !== null && exporters.includes(exporter) ? exporter : exporters[0];
  const mine = all.filter((r) => (r.exporter || '') === chosen);
  const fruitEn = fruitEnMap(data.fruits);

  const missing = new Set();
  if (blankCount) missing.add(`회사가 비어 있는 줄 ${blankCount}개(바이어 탭 기본 회사나 스케줄 탭 회사 칸)`);
  for (const r of mine) {
    if (showPrice && typeof r.price === 'string' && r.price.trim() && buyerPrice(r.price) === null) {
      missing.add(`바이어가 "${r.price.trim()}"에 한글이 있어 사진에는 TBC로 나가요`);
    }
    if (!fruitEn[r.fruit]) missing.add(`과일 "${r.fruit}"의 영어(품목 탭)`);
    if (!r.specEn) missing.add(`${r.fruit} "${r.specKo}"의 스펙 영어(스펙 탭)`);
  }
  const currency = buyer.currency || 'USD';
  const model = {
    rows: mine.map((r) => toBuyerRow(r, fruitEn, { withPrice: showPrice })),
    showPrice,
    currency,
    header: {
      // 일정이 하나도 없으면 바이어 탭의 기본 회사로
      exporter: chosen || (all.length ? '' : buyer.exporter || ''),
      // 영어 이름이 없으면 한글 이름을 대신 쓰지 않는다(미리보기에서 알린다)
      buyer: buyer.nameEn || '',
      // 사진에는 그리지 않는다(파일 이름과 올해가 아닌 ETA에 해를 붙일 때만 쓴다)
      date: data.today
    }
  };
  return {
    model,
    exporters,
    exporter: chosen,
    warnings: [...(buyer.nameEn ? [] : [`바이어 "${buyer.name}"의 영어 이름(바이어 탭)`]), ...missing]
  };
}

/** 글자를 폭에 맞게 줄바꿈(띄어쓰기 기준, 한 낱말이 너무 길면 '-'·'/' 뒤에서, 그래도 길면 글자 단위) */
export function wrapText(text, fnt, maxW, measure) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  const byChar = (w) => {
    let part = '';
    for (const ch of w) {
      if (part && measure(part + ch, fnt) > maxW) {
        lines.push(part);
        part = ch;
      } else {
        part += ch;
      }
    }
    return part;
  };
  const push = (w) => {
    if (measure(w, fnt) <= maxW) return w;
    // 인보이스 번호(HONGKONG-26-01)는 하이픈 뒤에서, 여러 가격(33/28.5/24)은 '/' 뒤에서 자른다
    const pieces = w.match(/[^-/]+[-/]*|[-/]+/g) || [w];
    let part = '';
    for (const p of pieces) {
      if (part && measure(part + p, fnt) > maxW) {
        lines.push(part);
        part = '';
      }
      part = measure(part + p, fnt) <= maxW ? part + p : byChar(part + p);
    }
    return part;
  };
  for (const w of words) {
    const next = line ? line + ' ' + w : w;
    if (measure(next, fnt) <= maxW) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = push(w);
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/**
 * 모델 → 그리기 목록(ops)과 높이. measure(text, font) → 글자 폭(px).
 * ops: { t: 'rect', x, y, w, h, r, fill } | { t: 'text', x, y, text, font, fill, align }
 */
export function layoutJpg(model, measure) {
  const W = JPG_WIDTH;
  const PX = 56;
  const ops = [];
  const text = (x, y, s, f, fill, align = 'left') => ops.push({ t: 'text', x, y, text: s, font: f, fill, align });
  const rect = (x, y, w, h, fill, r = 0) => ops.push({ t: 'rect', x, y, w, h, r, fill });

  // ── 머리글 ─────────────────────────────
  let y = 64;
  const h = model.header;
  if (h.exporter) {
    // 회사명: 대문자, 자간 넓게(글자마다 그린다)
    let x = PX;
    const f = font(700, 26);
    for (const ch of h.exporter.toUpperCase()) {
      text(x, y + 24, ch, f, C.brand);
      x += measure(ch, f) + 5;
    }
  }
  // 제목은 'Kingo Schedule' 하나만(바이어 이름·나라·From·Updated 줄은 두지 않는다, 2026-10-16 사용자 요청).
  // 영어 이름이 없으면 한글 대신 'Shipping Schedule'. 길면 60px에서 40px까지 줄이고, 그래도 길면 줄바꿈
  const title = h.buyer ? `${h.buyer} Schedule` : 'Shipping Schedule';
  const titleW = W - PX * 2;
  let ts = 60;
  while (ts > 40 && measure(title, font(700, ts)) > titleW) ts -= 4;
  const titleLines = wrapText(title, font(700, ts), titleW, measure);
  titleLines.forEach((s, i) => text(PX, y + 98 + i * (ts + 10), s, font(700, ts), C.text));
  y += 132 + (titleLines.length - 1) * (ts + 10);
  rect(PX, y, W - PX * 2, 4, C.brand);
  y += 36;

  // ── 표: No. · Item · Shipping · Spec · Price · ETA ─────────
  // ETA는 맨 오른쪽(2026-10-16 사용자 요청: 스펙과 가격을 길게 쓸 여유). 칸마다 실제 글자 폭에 맞추고 남는 폭은 Spec에 준다.
  // No.는 짧으면(6·7) Item 바로 옆, 인보이스 번호(KINGO-26-01)면 넓게.
  // 월 제목(October)은 두지 않는다. No.(차수) 6·7이 '10월 6일·7일'로 읽히지 않게. 달은 ETA 칸에 있다.
  const hf = font(600, 22);
  const NO_F = font(700, 24);
  const ITEM_F = font(700, 28);
  const BODY_F = font(400, 28);
  const PRICE_F = font(700, 28);
  const LH = 36;
  const GAP = 32;
  const rows = model.rows; // buildJpg가 No. 순으로 담아 준 그대로(ETA 미정도 제 번호 자리에)
  const year = String(h.date || '').slice(0, 4);
  const noStrOf = (r) => (r.no === null || r.no === undefined ? '' : String(r.no));
  // 올해가 아닌 ETA는 해까지(Jan 5, 2027)
  const etaOf = (r) => (!r.eta ? 'TBC' : r.eta.slice(0, 4) === year ? fmtEn(r.eta) : fmtEnLong(r.eta));
  const priceOf = (r) => (r.price === null ? 'TBC' : fmtPrice(r.price, model.currency));
  const widest = (label, list) => Math.ceil(Math.max(measure(label, hf), ...list));

  const noW = Math.min(176, widest('No.', rows.map((r) => measure(noStrOf(r), NO_F))));
  const shipW = widest('Shipping', rows.map((r) => measure(r.ship || '—', BODY_F)));
  const etaW = widest('ETA', rows.map((r) => measure(etaOf(r), BODY_F)));
  // Item과 Price는 한 줄에 다 들어가는 폭(Item 최대 230, Price 최대 260)을 먼저 주고, 남는 폭은 모두 Spec에 준다
  // (스펙은 길면 두 줄로 써도 읽기 쉽다). Spec이 160px보다 좁아지면 Item(140까지)과 Price를 같은 비율로 줄인다.
  // 가격은 '/' 뒤에서만 끊을 수 있어서, 끊을 수 없는 가장 긴 조각(NT$1,300.00)이 22px로 들어갈 폭은 늘 남긴다.
  const priceHard = model.showPrice
    ? Math.ceil(Math.max(0, ...rows.flatMap((r) => (priceOf(r).match(/[^/]+\/?|\//g) || ['']).map((p) => measure(p, font(700, 22))))))
    : 0;
  const fixed = noW + 36 + shipW + GAP * 2 + (model.showPrice ? GAP : 0) + 40 + etaW;
  const avail = W - PX * 2 - 40 - fixed;
  let itemW = Math.min(230, widest('Item', rows.map((r) => measure(r.fruit || '—', ITEM_F))));
  let priceW = model.showPrice ? Math.min(260, widest('Price', rows.map((r) => measure(priceOf(r), PRICE_F)))) : 0;
  const specMin = Math.min(160, widest('Spec', rows.map((r) => measure(r.spec || '—', BODY_F))));
  let specW = avail - itemW - priceW;
  if (specW < specMin) {
    const itemFloor = Math.min(itemW, 140);
    const priceFloor = Math.min(priceW, Math.max(130, priceHard));
    const give = (itemW - itemFloor) + (priceW - priceFloor);
    const want = specMin - specW;
    if (give >= want) {
      itemW -= ((itemW - itemFloor) * want) / (give || 1);
      priceW -= ((priceW - priceFloor) * want) / (give || 1);
      specW = specMin;
    } else {
      // 그래도 모자라면 가격은 지키고 Item·Spec을 같은 비율로 줄인다
      priceW = priceFloor;
      const share = Math.max(0, avail - priceW) / ((itemFloor + specMin) || 1);
      itemW = itemFloor * share;
      specW = specMin * share;
    }
  }
  [itemW, specW, priceW] = [itemW, specW, priceW].map((v) => Math.floor(v));
  const col = { no: PX + 20 };
  col.item = col.no + noW + 36;
  col.ship = col.item + itemW + GAP;
  col.spec = col.ship + shipW + GAP;
  col.eta = W - PX - 20 - etaW; // 맨 오른쪽 칸(날짜는 왼쪽 맞춤)
  col.priceR = col.eta - 40; // 가격은 ETA 바로 왼쪽에 오른쪽 맞춤
  const width = { no: noW, item: itemW, spec: specW, price: priceW };

  rect(PX, y, W - PX * 2, 60, C.head, 12);
  text(col.no, y + 38, 'No.', hf, C.text2);
  text(col.item, y + 38, 'Item', hf, C.text2);
  text(col.ship, y + 38, 'Shipping', hf, C.text2);
  text(col.spec, y + 38, 'Spec', hf, C.text2);
  if (model.showPrice) text(col.priceR, y + 38, 'Price', hf, C.text2, 'right');
  text(col.eta, y + 38, 'ETA', hf, C.text2);
  y += 60;

  // ── 줄: No. 순(ETA 미정도 제 번호 자리에) ─────────
  y += 8;
  for (const r of rows) {
    const top = y + 22;
    // 인보이스 번호는 한 줄이 되도록 24px에서 20px까지 줄여 보고, 그래도 길면 하이픈 뒤에서 줄바꿈
    const noStr = noStrOf(r);
    let noF = NO_F;
    for (let s = 22; s >= 20 && measure(noStr, noF) > width.no; s -= 2) noF = font(700, s);
    const noLines = wrapText(noStr, noF, width.no, measure);
    const itemLines = wrapText(r.fruit || '—', ITEM_F, width.item, measure);
    const specLines = wrapText(r.spec || '—', BODY_F, width.spec, measure);
    // 가격: 칸보다 길면 28px에서 22px까지 줄이고, 그래도 길면 '/' 뒤에서 줄바꿈
    let pf = PRICE_F;
    let priceLines = [];
    if (model.showPrice) {
      const p = priceOf(r);
      for (let s = 26; s >= 22 && measure(p, pf) > width.price; s -= 2) pf = font(700, s);
      priceLines = wrapText(p, pf, width.price, measure);
    }
    const etaText = etaOf(r);
    const rowH = Math.max(noLines.length, itemLines.length, specLines.length, priceLines.length, 1) * LH;

    noLines.forEach((s, i) => text(col.no, top + 28 + i * LH, s, noF, C.text));
    itemLines.forEach((s, i) => text(col.item, top + 28 + i * LH, s, ITEM_F, C.text));
    text(col.ship, top + 28, r.ship || '—', BODY_F, C.text);
    specLines.forEach((s, i) => text(col.spec, top + 28 + i * LH, s, BODY_F, C.text));
    priceLines.forEach((s, i) => text(col.priceR, top + 28 + i * LH, s, pf, r.price === null ? C.tbc : C.text, 'right'));
    text(col.eta, top + 28, etaText, r.eta ? BODY_F : font(700, 28), r.eta ? C.text : C.tbc);
    y = top + rowH + 22;
    rect(PX, y, W - PX * 2, 2, C.line);
    y += 2;
  }
  if (!model.rows.length) {
    y += 40;
    text(W / 2, y + 30, 'No upcoming shipments.', font(400, 28), C.muted, 'center');
    y += 60;
  }

  // 맨 아래 줄(Prices in USD per carton, TBC = to be confirmed, 회사명 · Korea)은 두지 않는다(2026-10-16 사용자 요청)
  y += 56;

  return { width: W, height: Math.max(JPG_MIN_HEIGHT, Math.ceil(y)), ops };
}

/** 그리기 목록을 캔버스에 그린다(흰 바탕) */
export function paintJpg(ctx, layout) {
  ctx.fillStyle = C.white;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = 'alphabetic';
  for (const op of layout.ops) {
    if (op.t === 'rect') {
      ctx.fillStyle = op.fill;
      if (op.r) {
        const { x, y, w, h } = op;
        const r = Math.min(op.r, h / 2, w / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(op.x, op.y, op.w, op.h);
      }
    } else {
      ctx.font = op.font;
      ctx.fillStyle = op.fill;
      ctx.textAlign = op.align;
      ctx.fillText(op.text, op.x, op.y);
    }
  }
}

/** 파일 이름: Buyer_A_Schedule_2026-10-14.jpg */
export function jpgFileName(model) {
  const who = String(model.header.buyer || 'Buyer').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'Buyer';
  return `${who}_Schedule_${model.header.date}.jpg`;
}
