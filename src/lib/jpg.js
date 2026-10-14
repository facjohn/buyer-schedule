// 바이어에게 보내는 영어 JPG.
// 화면을 찍지 않고 전용 그림판(canvas)에 직접 그린다. 그리는 쪽(layoutJpg)은 buildJpgModel이 만든 모델만 받고,
// 모델의 줄은 toBuyerRow(허용한 칸 7개)로만 만든다(절대 규칙 1). 산지가·작업비·산지·상차일·수량·메모는 모델에 없다.
import { fmtEn, fmtEnLong, fmtMonthEn } from './dates.js';
import { fmtPrice } from './money.js';
import { sortRows } from './schedule.js';
import { fruitEnMap, toBuyerRow } from './buyerView.js';

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

/** 오늘 이후(ETA가 오늘이거나 그 뒤)와 ETA 미정 줄. JPG에 담을 원본 줄(내부 칸 포함)이라 화면 밖으로 내보내지 않는다. */
export function upcomingRowsOf(data, buyerName) {
  return sortRows((data.rows || []).filter((r) => r.buyer === buyerName && (!r.eta || r.eta >= data.today)));
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
    if (!fruitEn[r.fruit]) missing.add(`과일 "${r.fruit}"의 영어(품목 탭)`);
    if (!r.specEn) missing.add(`${r.fruit} "${r.specKo}"의 스펙 영어(스펙 탭)`);
  }
  const currency = buyer.currency || 'USD';
  const model = {
    rows: mine.map((r) => toBuyerRow(r, fruitEn, { withPrice: showPrice })),
    showPrice,
    currency,
    priceLine: showPrice ? `Prices in ${currency} per ${buyer.priceUnit || 'carton'}, ${buyer.priceTerm || 'FOB'}` : '',
    header: {
      // 일정이 하나도 없으면 바이어 탭의 기본 회사로
      exporter: chosen || (all.length ? '' : buyer.exporter || ''),
      // 영어 이름이 없으면 한글 이름을 대신 쓰지 않는다(미리보기에서 알린다)
      buyer: buyer.nameEn || '',
      country: buyer.countryEn || '',
      from: data.today,
      updated: data.today
    }
  };
  return {
    model,
    exporters,
    exporter: chosen,
    warnings: [...(buyer.nameEn ? [] : [`바이어 "${buyer.name}"의 영어 이름(바이어 탭)`]), ...missing]
  };
}

/** 글자를 폭에 맞게 줄바꿈(띄어쓰기 기준, 한 낱말이 너무 길면 하이픈 뒤에서, 그래도 길면 글자 단위) */
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
    // 인보이스 번호(HONGKONG-26-01)는 하이픈 뒤에서 자른다
    const pieces = w.match(/[^-]+-*|-+/g) || [w];
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
  text(PX, y + 98, 'Shipping Schedule', font(700, 60), C.text);
  const rightW = W - PX * 2 - measure('Shipping Schedule', font(700, 60)) - 32;
  const buyerLine = [h.buyer, h.country].filter(Boolean).join(' · ');
  let bs = 36;
  while (bs > 24 && measure(buyerLine, font(700, bs)) > rightW) bs -= 2;
  if (buyerLine) text(W - PX, y + 34, buyerLine, font(700, bs), C.text, 'right');
  text(W - PX, y + 74, `From ${fmtEnLong(h.from)}`, font(400, 26), C.muted, 'right');
  text(W - PX, y + 110, `Updated ${fmtEnLong(h.updated)}`, font(400, 26), C.muted, 'right');
  y += 132;
  rect(PX, y, W - PX * 2, 4, C.brand);
  y += 36;

  // ── 표 머리 ─────────────────────────────
  // No.는 인보이스 번호(KINGO-26-01)가 한 줄에 들어가게 넉넉히
  const col = { no: PX + 20, item: PX + 210, ship: PX + 390, spec: PX + 500, eta: PX + 680, priceR: W - PX - 20 };
  const width = {
    no: col.item - col.no - 14,
    item: col.ship - col.item - 14,
    spec: col.eta - col.spec - 14
  };
  rect(PX, y, W - PX * 2, 60, C.head, 12);
  const hf = font(600, 22);
  text(col.no, y + 38, 'No.', hf, C.text2);
  text(col.item, y + 38, 'Item', hf, C.text2);
  text(col.ship, y + 38, 'Shipping', hf, C.text2);
  text(col.spec, y + 38, 'Spec', hf, C.text2);
  text(col.eta, y + 38, 'ETA', hf, C.text2);
  if (model.showPrice) text(col.priceR, y + 38, 'Price', hf, C.text2, 'right');
  y += 60;

  // ── 줄: 월별로 묶고, ETA 미정은 맨 뒤 ─────────
  const groups = [];
  for (const r of model.rows) {
    const key = r.eta ? r.eta.slice(0, 7) : 'tbc';
    let g = groups.find((x) => x.key === key);
    if (!g) {
      // 올해가 아닌 달은 해를 붙인다(January 2027). 두 해에 걸쳐도 같은 달 이름이 헷갈리지 않게
      const label = key === 'tbc' ? 'ETA to be confirmed'
        : fmtMonthEn(key) + (key.slice(0, 4) !== String(h.from).slice(0, 4) ? ' ' + key.slice(0, 4) : '');
      g = { key, label, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  }
  groups.sort((a, b) => (a.key === 'tbc') - (b.key === 'tbc'));

  const LH = 36;
  const NO_F = font(700, 24);
  const ITEM_F = font(700, 28);
  const BODY_F = font(400, 28);
  const PRICE_F = font(700, 28);
  for (const g of groups) {
    y += 30;
    text(col.no, y + 24, g.label, font(700, 26), C.brand);
    y += 30;
    for (const r of g.rows) {
      const top = y + 22;
      // 인보이스 번호는 한 줄이 되도록 24px에서 20px까지 줄여 보고, 그래도 길면 하이픈 뒤에서 줄바꿈
      const noStr = r.no === null ? '' : String(r.no);
      let noF = NO_F;
      for (let s = 22; s >= 20 && measure(noStr, noF) > width.no; s -= 2) noF = font(700, s);
      const noLines = wrapText(noStr, noF, width.no, measure);
      const itemLines = wrapText(r.fruit || '—', ITEM_F, width.item, measure);
      const specLines = wrapText(r.spec || '—', BODY_F, width.spec, measure);
      const etaText = r.eta ? fmtEn(r.eta) : 'TBC';
      const chip = r.eta && r.status === 'tbc';
      const etaF = r.eta ? BODY_F : font(700, 28);
      const etaH = LH + (chip ? 40 : 0);
      const textH = Math.max(noLines.length, itemLines.length, specLines.length, 1) * LH;
      let rowH = Math.max(textH, etaH);
      // 가격이 길면(NT$1,300.00) ETA 글자와 겹치지 않게 28px에서 22px까지 줄이고, 그래도 겹치면 다음 줄에
      let price = null;
      if (model.showPrice) {
        const p = r.price === null ? 'TBC' : fmtPrice(r.price, model.currency);
        const room = col.priceR - (col.eta + measure(etaText, etaF) + 16);
        let pf = PRICE_F;
        for (let s = 26; s >= 22 && measure(p, pf) > room; s -= 2) pf = font(700, s);
        const below = measure(p, pf) > room;
        price = { p, pf, y: top + 28 + (below ? (chip ? 40 : LH) : 0) };
        if (below) rowH = Math.max(rowH, (chip ? 40 : LH) + LH);
      }

      noLines.forEach((s, i) => text(col.no, top + 28 + i * LH, s, noF, C.text));
      itemLines.forEach((s, i) => text(col.item, top + 28 + i * LH, s, ITEM_F, C.text));
      text(col.ship, top + 28, r.ship || '—', BODY_F, C.text);
      specLines.forEach((s, i) => text(col.spec, top + 28 + i * LH, s, BODY_F, C.text));
      text(col.eta, top + 28, etaText, etaF, r.eta ? C.text : C.tbc);
      if (chip) {
        const cf = font(700, 20);
        const cw = measure('TBC', cf) + 20;
        rect(col.eta, top + LH + 4, cw, 30, C.tbcBg, 8);
        text(col.eta + 10, top + LH + 26, 'TBC', cf, C.tbc);
      }
      if (price) text(col.priceR, price.y, price.p, price.pf, r.price === null ? C.tbc : C.text, 'right');
      y = top + rowH + 22;
      rect(PX, y, W - PX * 2, 2, C.line);
      y += 2;
    }
  }
  if (!model.rows.length) {
    y += 40;
    text(W / 2, y + 30, 'No upcoming shipments.', font(400, 28), C.muted, 'center');
    y += 60;
  }

  // ── 맨 아래 ─────────────────────────────
  y += 40;
  rect(PX, y, W - PX * 2, 2, C.border);
  y += 26;
  const notes = [model.priceLine, 'TBC = to be confirmed'].filter(Boolean);
  notes.forEach((s, i) => text(PX, y + 30 + i * 36, s, font(400, 24), C.muted));
  const footY = y + 30 + (notes.length - 1) * 36;
  if (h.exporter) text(W - PX, footY, `${h.exporter} · Korea`, font(700, 24), C.text, 'right');
  y = footY + 56;

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
  return `${who}_Schedule_${model.header.updated}.jpg`;
}
