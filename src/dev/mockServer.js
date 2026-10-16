// 개발용 가짜 창구 (npm run dev:mock). apps-script/*.js 를 브라우저에서 그대로 돌리고, 시트는 메모리에 둔다.
// 새로고침하면 처음 예시 데이터로 돌아간다. 배포판에는 들어가지 않는다(api.js가 VITE_MOCK일 때만 불러옴).

const sources = import.meta.glob('../../apps-script/*.js', { query: '?raw', import: 'default', eager: true });

class MockRange {
  constructor(sheet, r, c, nr, nc) {
    Object.assign(this, { sheet, r, c, nr, nc });
  }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const line = [];
      for (let j = 0; j < this.nc; j++) line.push(this.sheet.get(this.r + i, this.c + j));
      out.push(line);
    }
    return out;
  }
  setValues(v) {
    v.forEach((line, i) => line.forEach((x, j) => this.sheet.set(this.r + i, this.c + j, x)));
    return this;
  }
  getValue() { return this.sheet.get(this.r, this.c); }
  setValue(v) { this.sheet.set(this.r, this.c, v); return this; }
}

class MockSheet {
  constructor(name, header) {
    this.name = name;
    this.data = [header.slice()];
    this.maxRows = 1000;
  }
  getName() { return this.name; }
  width() { return this.data.reduce((w, r) => Math.max(w, r.length), 0); }
  getLastRow() {
    for (let i = this.data.length - 1; i >= 0; i--) {
      if (this.data[i].some((v) => v !== '' && v !== null && v !== undefined)) return i + 1;
    }
    return 0;
  }
  getLastColumn() { return this.width(); }
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(_a, n) { this.maxRows += n; }
  getDataRange() { return new MockRange(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.width())); }
  getRange(r, c, nr = 1, nc = 1) { return new MockRange(this, r, c, nr, nc); }
  get(r, c) {
    const row = this.data[r - 1];
    return row && row[c - 1] !== undefined ? row[c - 1] : '';
  }
  set(r, c, v) {
    while (this.data.length < r) this.data.push([]);
    const row = this.data[r - 1];
    while (row.length < c) row.push('');
    row[c - 1] = typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v; // 시트처럼 '로 시작하면 글자로
  }
  deleteRow(r) { this.data.splice(r - 1, 1); }
}

function kst(d) {
  const k = new Date(d.getTime() + 9 * 3600e3);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return { yyyy: p(k.getUTCFullYear(), 4), MM: p(k.getUTCMonth() + 1), dd: p(k.getUTCDate()),
    HH: p(k.getUTCHours()), mm: p(k.getUTCMinutes()), ss: p(k.getUTCSeconds()) };
}

const sheets = {};
const props = new Map();
const cacheMap = new Map();
const ss = {
  getSheetByName: (n) => sheets[n] || null,
  getUrl: () => 'https://docs.google.com/spreadsheets/d/MOCK/edit'
};
const globals = {
  SpreadsheetApp: { getActive: () => ss, getActiveSpreadsheet: () => ss, flush() {}, getUi() { throw new Error('no ui'); } },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    formatDate: (d, _tz, fmt) => {
      const p = kst(d);
      return fmt.replace('yyyy', p.yyyy).replace('MM', p.MM).replace('dd', p.dd)
        .replace('HH', p.HH).replace('mm', p.mm).replace('ss', p.ss);
    },
    computeDigest: () => [...crypto.getRandomValues(new Uint8Array(32))].map((b) => (b > 127 ? b - 256 : b)),
    DigestAlgorithm: { SHA_256: 'sha256' }
  },
  ContentService: {
    createTextOutput: (s) => ({ s, setMimeType() { return this; }, getContent() { return this.s; } }),
    MimeType: { JSON: 'application/json' }
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : null),
      setProperty: (k, v) => props.set(k, v),
      deleteProperty: (k) => props.delete(k)
    })
  },
  CacheService: {
    getScriptCache: () => ({
      get: (k) => (cacheMap.has(k) ? cacheMap.get(k) : null),
      put: (k, v) => cacheMap.set(k, String(v))
    })
  },
  Logger: { log() {} }
};

const names = Object.keys(globals);
const body = Object.keys(sources).sort().map((k) => sources[k]).join('\n;\n') +
  '\nreturn { doPost, seedSample, readTable_, appendRows_, TAB, COLUMNS, DEFAULT_FRUITS };';
// eslint-disable-next-line no-new-func
const gas = new Function(...names, body)(...names.map((n) => globals[n]));

for (const key of Object.keys(gas.TAB)) {
  sheets[gas.TAB[key]] = new MockSheet(gas.TAB[key], gas.COLUMNS[key].map((c) => c[1]));
}
gas.appendRows_(gas.readTable_('fruits'), gas.DEFAULT_FRUITS.map((f, i) => ({
  fruitKo: f[0], fruitEn: f[1], seasonStart: f[0].includes('배') ? 9 : '', sortOrder: i + 1
})));
gas.seedSample();

/** 예시 팀원 코드: [{ name, code }] (코드 넣는 화면에서 개발용 버튼으로 보여 준다) */
export const mockMembers = gas.readTable_('members').rows.map((r) => ({
  name: String(r.name), code: String(r.code)
}));

export async function mockPost(body) {
  await new Promise((r) => setTimeout(r, 250));
  return JSON.parse(gas.doPost({ postData: { contents: body } }).getContent());
}
