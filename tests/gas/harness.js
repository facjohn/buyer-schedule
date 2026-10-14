// Apps Script 창구를 컴퓨터에서 시험하려고, 쓰는 만큼만 흉내 낸 가짜 시트.
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

process.env.TZ = 'Asia/Seoul';

const GAS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps-script');

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
  setValues(values) {
    values.forEach((line, i) => line.forEach((v, j) => this.sheet.set(this.r + i, this.c + j, v)));
    return this;
  }
  getValue() {
    return this.sheet.get(this.r, this.c);
  }
  setValue(v) {
    this.sheet.set(this.r, this.c, v);
    return this;
  }
}

export class MockSheet {
  constructor(name, data) {
    this.name = name;
    this.data = data.map((r) => r.slice());
    this.maxRows = Math.max(1000, this.data.length);
    this.cellWrites = [];
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
  insertRowsAfter(_after, n) { this.maxRows += n; }
  getDataRange() { return new MockRange(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.width())); }
  getRange(r, c, nr = 1, nc = 1) {
    if (r + nr - 1 > this.maxRows) throw new Error('범위가 시트 밖이에요');
    return new MockRange(this, r, c, nr, nc);
  }
  get(r, c) {
    const row = this.data[r - 1];
    return row && row[c - 1] !== undefined ? row[c - 1] : '';
  }
  set(r, c, v) {
    while (this.data.length < r) this.data.push([]);
    const row = this.data[r - 1];
    while (row.length < c) row.push('');
    row[c - 1] = v;
    this.cellWrites.push([r, c]);
  }
  deleteRow(r) { this.data.splice(r - 1, 1); }
}

function kstParts(d) {
  const k = new Date(d.getTime() + 9 * 3600e3);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return {
    yyyy: p(k.getUTCFullYear(), 4), MM: p(k.getUTCMonth() + 1), dd: p(k.getUTCDate()),
    HH: p(k.getUTCHours()), mm: p(k.getUTCMinutes()), ss: p(k.getUTCSeconds())
  };
}

/** apps-script/*.js 를 불러온 시험장. sheets: { 탭키: [객체...] } */
export function makeWorld(sheets = {}) {
  const props = new Map();
  const cacheMap = new Map();
  const book = { sheets: {} };
  const ss = {
    getSheetByName: (name) => book.sheets[name] || null,
    getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST_SHEET/edit'
  };
  const ctx = vm.createContext({
    console,
    SpreadsheetApp: { getActive: () => ss, getActiveSpreadsheet: () => ss, flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, _tz, fmt) => {
        const p = kstParts(d);
        return fmt.replace('yyyy', p.yyyy).replace('MM', p.MM).replace('dd', p.dd)
          .replace('HH', p.HH).replace('mm', p.mm).replace('ss', p.ss);
      },
      computeDigest: (_alg, s) => [...crypto.createHash('sha256').update(s).digest()].map((b) => (b > 127 ? b - 256 : b)),
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
  });
  for (const f of fs.readdirSync(GAS_DIR).filter((f) => f.endsWith('.js')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(GAS_DIR, f), 'utf8'), ctx, { filename: f });
  }

  for (const key of Object.keys(ctx.TAB)) {
    const cols = ctx.COLUMNS[key];
    const header = cols.map((c) => c[1]);
    const rows = (sheets[key] || []).map((o) => cols.map((c) => (o[c[0]] === undefined ? '' : o[c[0]])));
    book.sheets[ctx.TAB[key]] = new MockSheet(ctx.TAB[key], [header, ...rows]);
  }

  return {
    ctx,
    sheet: (key) => book.sheets[ctx.TAB[key]],
    /** 탭을 객체 배열로 다시 읽는다(시트 행 번호 _row 포함). */
    read: (key) => {
      const sh = book.sheets[ctx.TAB[key]];
      const cols = ctx.COLUMNS[key];
      return sh.data.slice(1).map((line, i) => {
        const o = { _row: i + 2 };
        cols.forEach((c, j) => { o[c[0]] = line[j] === undefined ? '' : line[j]; });
        return o;
      });
    },
    call: (req) => JSON.parse(ctx.doPost({ postData: { contents: typeof req === 'string' ? req : JSON.stringify(req) } }).getContent())
  };
}

/** 'yyyy-MM-dd' → 서울 0시 Date */
export function d(iso) {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export function randomCode(len = 16) {
  return crypto.randomBytes(len).toString('base64url').slice(0, len);
}
