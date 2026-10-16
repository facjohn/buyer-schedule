import { describe, it, expect } from 'vitest';
import { buildJpg, layoutJpg, wrapText, jpgFileName, JPG_WIDTH, JPG_MIN_HEIGHT } from './jpg.js';
import { BUYER_FIELDS } from './buyerView.js';

// 글자 폭 흉내: 글자 수 × 크기 × 0.55
const measure = (text, font) => String(text).length * Number(/(\d+)px/.exec(font)[1]) * 0.55;
const HANGUL = /[ㄱ-ㆎ가-힣]/;

const data = {
  today: '2026-10-14',
  buyers: [
    { name: '킹고', nameEn: 'Kingo', countryEn: 'Taiwan', currency: 'USD', priceUnit: 'carton', priceTerm: 'FOB', exporter: 'Hyun Nong Fresh' }
  ],
  fruits: [{ fruitKo: '신고배', fruitEn: 'Singo pear' }, { fruitKo: '단감', fruitEn: 'Sweet persimmon' }],
  rows: [
    { id: 'p', buyer: '킹고', no: 'KINGO-26-01', fruit: '신고배', ship: '40ft', specKo: '15kg 18-24', specEn: '15kg, 18-24',
      eta: '2026-10-01', price: 30, cost: 28000, workCost: 12000, status: '확정', origin: '나주', qty: '40ft 1대',
      memo: '비밀 메모', loadDate: '2026-09-20', exporter: 'Hyun Nong Fresh' },
    { id: 'a', buyer: '킹고', no: 'KINGO-26-02', fruit: '신고배', ship: '40ft', specKo: '15kg 18-24', specEn: '15kg, 18-24',
      eta: '2026-10-20', price: 31, cost: 28500, workCost: 12000, status: '확정', origin: '나주', qty: '40ft 1대',
      memo: '비밀 메모', loadDate: '2026-10-08', exporter: 'Hyun Nong Fresh' },
    { id: 'b', buyer: '킹고', no: 'KINGO-26-02', fruit: '신고배', ship: '40ft', specKo: '15kg 26-30', specEn: '15kg, 26-30',
      eta: '2026-10-20', price: 26.5, cost: 23000, workCost: 12000, status: '미정', origin: '상주', qty: '',
      memo: '', loadDate: '2026-10-08', exporter: 'Hyun Nong Fresh' },
    { id: 'c', buyer: '킹고', no: 'KINGO-26-03', fruit: '단감', ship: '항공', specKo: '10kg', specEn: '10kg',
      eta: '', price: null, cost: 17000, workCost: null, status: '미정', origin: '창원', qty: '', memo: '',
      loadDate: '', exporter: 'Hyun Nong Fresh' },
    { id: 'x', buyer: '다른', no: 'X-1', fruit: '신고배', ship: '40ft', specKo: '5kg', specEn: '5kg', eta: '2026-10-30',
      price: 10, cost: 9999, status: '확정', exporter: 'Royal' }
  ]
};

function drawnTexts(model) {
  return layoutJpg(model, measure).ops.filter((o) => o.t === 'text').map((o) => o.text);
}

describe('JPG 모델 (규칙 1: 허용한 칸만)', () => {
  it('오늘 이후와 ETA 미정 줄만, 그 바이어 것만', () => {
    const { model } = buildJpg(data, '킹고');
    expect(model.rows.map((r) => r.no)).toEqual(['KINGO-26-02', 'KINGO-26-02', 'KINGO-26-03']);
  });

  it('줄마다 허용한 일곱 칸만 있다', () => {
    const { model } = buildJpg(data, '킹고');
    for (const r of model.rows) expect(Object.keys(r).sort()).toEqual([...BUYER_FIELDS].sort());
  });

  it('그리는 쪽에 넘기는 모델 어디에도 산지가·작업비·산지·상차일·수량·메모가 없다', () => {
    const s = JSON.stringify(buildJpg(data, '킹고').model);
    for (const v of ['28500', '23000', '17000', '12000', '나주', '상주', '창원', '40ft 1대', '비밀', '2026-10-08', 'cost', 'origin', 'memo', 'qty', 'loadDate']) {
      expect(s).not.toContain(v);
    }
  });

  it('회사가 섞이면 회사별로 따로', () => {
    const mixed = { ...data, rows: [...data.rows, { ...data.rows[1], id: 'r', no: 'KINGO-26-04', exporter: 'Royal' }] };
    const a = buildJpg(mixed, '킹고');
    expect(a.exporters).toEqual(['Hyun Nong Fresh', 'Royal']);
    expect(a.model.rows.every((r) => r.no !== 'KINGO-26-04')).toBe(true);
    const b = buildJpg(mixed, '킹고', { exporter: 'Royal' });
    expect(b.model.rows.map((r) => r.no)).toEqual(['KINGO-26-04']);
    expect(b.model.header.exporter).toBe('Royal');
  });

  it('영어가 비어 있으면 미리보기 경고로 알리고, 한글을 대신 넣지 않는다', () => {
    const noEn = { ...data, rows: [{ ...data.rows[1], specEn: '' }] };
    const { model, warnings } = buildJpg(noEn, '킹고');
    expect(warnings.join(' ')).toContain('15kg 18-24');
    expect(model.rows[0].spec).toBe('');
  });
});

describe('검토에서 나온 경우', () => {
  it('바이어 영어 이름이 비어 있거나 바이어 탭에 없으면 한글 이름을 그리지 않고 알린다', () => {
    const noEn = { ...data, buyers: [{ ...data.buyers[0], nameEn: '' }] };
    const a = buildJpg(noEn, '킹고');
    const ta = drawnTexts(a.model).join('\n');
    expect(HANGUL.test(ta)).toBe(false);
    expect(ta).toContain('Shipping Schedule');
    expect(ta).not.toContain('Taiwan');
    expect(a.warnings.join(' ')).toContain('영어 이름');
    const gone = { ...data, buyers: [] };
    const b = buildJpg(gone, '킹고');
    expect(HANGUL.test(drawnTexts(b.model).join('\n'))).toBe(false);
    expect(jpgFileName(b.model)).toBe('Buyer_Schedule_2026-10-14.jpg');
  });

  it('회사 칸이 빈 줄은 다른 회사 사진에 섞지 않고 따로 묶는다', () => {
    const base = data.rows[1];
    const rows = [
      { ...base, id: 'h', no: 'K-1', exporter: 'Hyun Nong Fresh' },
      { ...base, id: 'r', no: 'K-2', exporter: 'Royal' },
      { ...base, id: 'e', no: 'K-3', exporter: '' }
    ];
    const three = buildJpg({ ...data, rows }, '킹고');
    expect(three.exporters).toEqual(['Hyun Nong Fresh', 'Royal', '']);
    expect(three.model.rows.map((r) => r.no)).toEqual(['K-1']);
    expect(three.warnings.join(' ')).toContain('회사가 비어 있는 줄 1개');
    const blank = buildJpg({ ...data, rows }, '킹고', { exporter: '' });
    expect(blank.model.rows.map((r) => r.no)).toEqual(['K-3']);
    expect(blank.model.header.exporter).toBe('');

    const two = buildJpg({ ...data, rows: [rows[1], rows[2]] }, '킹고');
    expect(two.exporters).toEqual(['Royal', '']);
    expect(two.model.rows.map((r) => r.no)).toEqual(['K-2']);

    const onlyBlank = buildJpg({ ...data, rows: [rows[2]] }, '킹고');
    expect(onlyBlank.exporters).toEqual(['']);
    expect(onlyBlank.model.rows.map((r) => r.no)).toEqual(['K-3']);
  });

  it('일정이 없으면 바이어 탭의 기본 회사 이름으로', () => {
    const { model } = buildJpg({ ...data, rows: [] }, '킹고');
    expect(model.rows).toEqual([]);
    expect(model.header.exporter).toBe('Hyun Nong Fresh');
    expect(drawnTexts(model)).toContain('No upcoming shipments.');
  });

  it('긴 가격은 ETA 글자와 겹치지 않는다', () => {
    const twd = { ...data, buyers: [{ ...data.buyers[0], currency: 'TWD' }],
      rows: [{ ...data.rows[1], eta: '2026-09-30', price: 1300 }, { ...data.rows[1], id: 'z', eta: '2026-11-30', price: 1234567.5 }] };
    const today = { ...twd, today: '2026-09-01' };
    const ops = layoutJpg(buildJpg(today, '킹고').model, measure).ops.filter((o) => o.t === 'text');
    for (const p of ops.filter((o) => o.align === 'right' && o.text.startsWith('NT$'))) {
      const eta = ops.find((o) => /^(Sept|Nov) 30$/.test(o.text) && Math.abs(o.y - p.y) < 30);
      if (eta) expect(p.x - measure(p.text, p.font)).toBeGreaterThanOrEqual(eta.x + measure(eta.text, eta.font) + 16);
    }
    expect(ops.some((o) => o.text === 'NT$1,234,567.50')).toBe(true);
  });
});

describe('JPG 그리기', () => {
  it('폭 1080px, 높이는 최소 1350px', () => {
    const l = layoutJpg(buildJpg(data, '킹고').model, measure);
    expect(l.width).toBe(JPG_WIDTH);
    expect(l.height).toBeGreaterThanOrEqual(JPG_MIN_HEIGHT);
  });

  it('그린 글자에 ₩·한글·산지가 숫자가 하나도 없다', () => {
    const all = drawnTexts(buildJpg(data, '킹고').model).join('\n');
    expect(all).not.toContain('₩');
    expect(HANGUL.test(all)).toBe(false);
    for (const v of ['28,500', '23,000', '17,000', '12,000', '28500']) expect(all).not.toContain(v);
  });

  it('영어 표: 제목 Kingo Schedule, 인보이스 번호, Singo pear, Oct 20, $31.00, 미정은 TBC, ETA 미정은 맨 아래', () => {
    const t = drawnTexts(buildJpg(data, '킹고').model);
    for (const v of ['Kingo Schedule', 'KINGO-26-02', 'Singo pear', 'Oct 20',
      '$31.00', '$26.50', 'TBC', 'Prices in USD per carton, FOB', 'Hyun Nong Fresh · Korea']) {
      expect(t.join('\n')).toContain(v);
    }
    expect(t.indexOf('KINGO-26-03')).toBeGreaterThan(t.lastIndexOf('KINGO-26-02'));
  });

  it('월 제목·바이어 나라·From·Updated 줄은 그리지 않는다(2026-10-16 사용자 요청)', () => {
    const all = drawnTexts(buildJpg(data, '킹고').model).join('\n');
    for (const v of ['October', 'Taiwan', 'From', 'Updated', 'Shipping Schedule', 'ETA to be confirmed', 'Kingo ·']) {
      expect(all).not.toContain(v);
    }
  });

  it('제목이 길면 글자를 줄이고, 그래도 길면 두 줄로', () => {
    const long = { ...data, buyers: [{ ...data.buyers[0], nameEn: 'Pomina International Fresh Fruit Trading Company Limited' }] };
    const ops = layoutJpg(buildJpg(long, '킹고').model, measure).ops.filter((o) => o.t === 'text' && /700 (4|5|6)\dpx/.test(o.font));
    expect(ops.length).toBeGreaterThan(1);
    for (const o of ops) expect(measure(o.text, o.font)).toBeLessThanOrEqual(1080 - 112);
  });

  it('바이어가를 빼면 가격과 가격 줄이 없다', () => {
    const t = drawnTexts(buildJpg(data, '킹고', { showPrice: false }).model).join('\n');
    expect(t).not.toContain('$');
    expect(t).not.toContain('Prices in');
    expect(t).not.toContain('Price');
  });

  it('조금 긴 인보이스 번호는 글자를 줄여 한 줄로', () => {
    const d = { ...data, rows: [{ ...data.rows[1], no: 'HONGKONG-26-01' }] };
    const op = layoutJpg(buildJpg(d, '킹고').model, measure).ops.find((o) => o.text === 'HONGKONG-26-01');
    expect(op).toBeTruthy();
    expect(op.font).toContain('22px');
  });

  it('올해가 아닌 ETA는 해까지', () => {
    const d = { ...data, rows: [data.rows[1], { ...data.rows[1], id: 'n', no: 'KINGO-26-09', eta: '2027-01-05' }] };
    const t = drawnTexts(buildJpg(d, '킹고').model);
    expect(t).toContain('Oct 20');
    expect(t).toContain('Jan 5, 2027');
  });

  it('줄이 많아도 높이가 줄 수만큼 늘어난다', () => {
    const many = { ...data, rows: Array.from({ length: 40 }, (_, i) => ({ ...data.rows[1], id: 'm' + i, no: 'KINGO-26-' + String(i + 10) })) };
    const l = layoutJpg(buildJpg(many, '킹고').model, measure);
    expect(l.height).toBeGreaterThan(3000);
  });
});

describe('도움 함수', () => {
  it('긴 글은 폭에 맞게 줄바꿈', () => {
    const lines = wrapText('Sweet persimmon', 'bold 28px X', 150, measure);
    expect(lines).toEqual(['Sweet', 'persimmon']);
  });
  it('긴 인보이스 번호는 하이픈 뒤에서 자른다', () => {
    expect(wrapText('HONGKONG-26-01', 'bold 24px X', 150, measure)).toEqual(['HONGKONG-', '26-01']);
    expect(wrapText('KINGO-26-01', 'bold 24px X', 176, measure)).toEqual(['KINGO-26-01']);
  });
  it('하이픈이 없는 아주 긴 글은 글자 단위로', () => {
    const lines = wrapText('ABCDEFGHIJKLMNOP', 'bold 20px X', 66, measure);
    expect(lines.join('')).toBe('ABCDEFGHIJKLMNOP');
    for (const l of lines) expect(measure(l, 'bold 20px X')).toBeLessThanOrEqual(66);
  });
  it('파일 이름은 영어 바이어 이름과 날짜', () => {
    expect(jpgFileName(buildJpg(data, '킹고').model)).toBe('Kingo_Schedule_2026-10-14.jpg');
  });
});

describe('홈 바둑판 색', async () => {
  const { buyerColor, BUYER_COLORS } = await import('./buyerColor.js');
  it('바이어 탭 앞의 10명은 서로 다른 색, 같은 바이어는 늘 같은 색', () => {
    const buyers = Array.from({ length: 10 }, (_, i) => ({ name: 'B' + i }));
    const bgs = buyers.map((b) => buyerColor(buyers, b.name).bg);
    expect(new Set(bgs).size).toBe(10);
    expect(buyerColor(buyers, 'B3')).toBe(buyerColor(buyers, 'B3'));
    expect(BUYER_COLORS).toContain(buyerColor(buyers, '탭에 없는 바이어'));
  });
});
