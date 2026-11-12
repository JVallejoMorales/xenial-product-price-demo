import { LISTS, PRODUCTS, SITES, parseAmount, priceKey, siteLabel } from './modelo.js';

export const HEADERS = [
  'Product/Modifier Name [en-US]', 'Product/Modifier ID [en-US]', 'Tipo de elemento',
  'Categoría de informe principal', 'Categoría de informes secundarios', 'Restaurante',
  ...LISTS.map(({ name }) => name),
];

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const contentNS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const packageNS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const relationshipNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const sheetNS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const maxWorkbook = 3 * 1024 * 1024;
const maxEntry = 4 * 1024 * 1024;
const xlsxError = 'Carga un archivo .xlsx generado por Mesa de Precios.';
const xmlText = (value) => String(value).replace(/[<>&]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[character]);
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value;
});

function crc32(bytes) {
  let checksum = 0xffffffff;
  for (const byte of bytes) checksum = crcTable[(checksum ^ byte) & 255] ^ (checksum >>> 8);
  return (checksum ^ 0xffffffff) >>> 0;
}

function zipFiles(files) {
  const local = [];
  const directory = [];
  let offset = 0;
  let directorySize = 0;
  for (const [path, value] of files) {
    const name = encoder.encode(path);
    const data = encoder.encode(value);
    const checksum = crc32(data);
    const record = new Uint8Array(30 + name.length);
    const info = new DataView(record.buffer);
    info.setUint32(0, 0x04034b50, true);
    info.setUint16(4, 20, true);
    info.setUint16(12, 33, true);
    info.setUint32(14, checksum, true);
    info.setUint32(18, data.length, true);
    info.setUint32(22, data.length, true);
    info.setUint16(26, name.length, true);
    record.set(name, 30);

    const entry = new Uint8Array(46 + name.length);
    const descriptor = new DataView(entry.buffer);
    descriptor.setUint32(0, 0x02014b50, true);
    descriptor.setUint16(4, 20, true);
    descriptor.setUint16(6, 20, true);
    descriptor.setUint16(14, 33, true);
    descriptor.setUint32(16, checksum, true);
    descriptor.setUint32(20, data.length, true);
    descriptor.setUint32(24, data.length, true);
    descriptor.setUint16(28, name.length, true);
    descriptor.setUint32(42, offset, true);
    entry.set(name, 46);
    directory.push(entry);
    local.push(record, data);
    offset += record.length + data.length;
    directorySize += entry.length;
  }
  const end = new Uint8Array(22);
  const trailer = new DataView(end.buffer);
  trailer.setUint32(0, 0x06054b50, true);
  trailer.setUint16(8, files.length, true);
  trailer.setUint16(10, files.length, true);
  trailer.setUint32(12, directorySize, true);
  trailer.setUint32(16, offset, true);
  const workbook = new Uint8Array(offset + directorySize + end.length);
  let cursor = 0;
  for (const chunk of [...local, ...directory, end]) {
    workbook.set(chunk, cursor);
    cursor += chunk.length;
  }
  return workbook;
}

function worksheet(rows) {
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${sheetNS}"><sheetData>${
    rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, colIndex) => {
      if (cell == null) return '';
      const reference = String.fromCharCode(65 + colIndex) + (rowIndex + 1);
      return typeof cell === 'number'
        ? `<c r="${reference}"><v>${cell}</v></c>`
        : `<c r="${reference}" t="inlineStr"><is><t>${xmlText(cell)}</t></is></c>`;
    }).join('')}</row>`).join('')}</sheetData></worksheet>`;
}

export function buildWorkbook(catalogue) {
  const rows = SITES.flatMap((site) => PRODUCTS.map((product) => [
    product.name, product.id, product.type, product.category, product.subcategory, siteLabel(site),
    ...LISTS.map((list) => catalogue.get(priceKey(site.id, product.id, list.id))),
  ]));
  const sheets = worksheet([HEADERS, ...rows]);
  return zipFiles([
    ['[Content_Types].xml', `<Types xmlns="${contentNS}">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
      <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    </Types>`],
    ['_rels/.rels', `<Relationships xmlns="${packageNS}"><Relationship Id="rId1" Type="${relationshipNS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<workbook xmlns="${sheetNS}" xmlns:r="${relationshipNS}"><sheets>
      <sheet name="Precios" sheetId="1" r:id="rId1"/><sheet name="Referencia" sheetId="2" state="hidden" r:id="rId2"/>
    </sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<Relationships xmlns="${packageNS}">
      <Relationship Id="rId1" Type="${relationshipNS}/worksheet" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="${relationshipNS}/worksheet" Target="worksheets/sheet2.xml"/>
    </Relationships>`],
    ['xl/worksheets/sheet1.xml', sheets],
    ['xl/worksheets/sheet2.xml', sheets],
  ]);
}

function zipEntries(buffer) {
  const data = new DataView(buffer);
  const u16 = (offset) => data.getUint16(offset, true);
  const u32 = (offset) => data.getUint32(offset, true);
  let end = buffer.byteLength - 22;
  while (end >= 0 && (u32(end) !== 0x06054b50 || end + 22 + u16(end + 20) !== buffer.byteLength)) end -= 1;
  if (end < 0 || u16(end + 4) !== 0 || u16(end + 6) !== 0 || u16(end + 10) > 100) throw new Error(xlsxError);
  const entries = new Map();
  let cursor = u32(end + 16);
  if (cursor + u32(end + 12) !== end) throw new Error(xlsxError);
  for (let index = 0; index < u16(end + 10); index += 1) {
    if (cursor + 46 > end || u32(cursor) !== 0x02014b50) throw new Error(xlsxError);
    const length = u16(cursor + 28);
    const next = cursor + 46 + length + u16(cursor + 30) + u16(cursor + 32);
    if (next > end) throw new Error(xlsxError);
    const name = decoder.decode(new Uint8Array(buffer, cursor + 46, length));
    const start = u32(cursor + 42);
    if (entries.has(name) || start + 30 > end || u32(start) !== 0x04034b50 || (u16(cursor + 8) & 1)) throw new Error(xlsxError);
    const method = u16(cursor + 10);
    const packed = u32(cursor + 20);
    const size = u32(cursor + 24);
    const position = start + 30 + u16(start + 26) + u16(start + 28);
    if (position + packed > end) throw new Error(xlsxError);
    entries.set(name, { method, size, checksum: u32(cursor + 16), bytes: new Uint8Array(buffer, position, packed) });
    cursor = next;
  }
  if (cursor !== end) throw new Error(xlsxError);
  return entries;
}

async function xmlEntry(entry) {
  if (!entry) return null;
  const { method, size, checksum } = entry;
  if (size > maxEntry || ![0, 8].includes(method)) throw new Error(xlsxError);
  let bytes = entry.bytes;
  if (method === 8) {
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    bytes = new Uint8Array(size);
    let offset = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > size) {
        await reader.cancel();
        throw new Error(xlsxError);
      }
      bytes.set(value, offset);
      offset += value.length;
    }
    if (offset !== size) throw new Error(xlsxError);
  }
  if (bytes.length !== size || crc32(bytes) !== checksum) throw new Error(xlsxError);
  const text = decoder.decode(bytes);
  if (/<!DOCTYPE/i.test(text)) throw new Error(xlsxError);
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw new Error(xlsxError);
  return xml;
}

const nodes = (element, tag) => [...element.getElementsByTagNameNS('*', tag)];
const textRuns = (element) => nodes(element, 't').map((node) => node.textContent).join('');

function readRows(xml, strings) {
  if (!xml) throw new Error(xlsxError);
  const rows = nodes(xml, 'row');
  if (rows.length !== SITES.length * PRODUCTS.length + 1) throw new Error('Conserva las filas del Excel exportado.');
  return rows.map((row) => {
    const values = Array(HEADERS.length).fill('');
    const columns = new Set();
    for (const cell of nodes(row, 'c')) {
      const match = /^([A-K])\d+$/.exec(cell.getAttribute('r'));
      if (!match || nodes(cell, 'f').length) throw new Error('Conserva las columnas del Excel y usa importes sin fórmulas.');
      const column = match[1].charCodeAt(0) - 65;
      if (columns.has(column)) throw new Error(xlsxError);
      columns.add(column);
      const value = nodes(cell, 'v')[0]?.textContent ?? '';
      const type = cell.getAttribute('t');
      if (type === 'inlineStr') values[column] = textRuns(cell);
      else if (type === 's') {
        if (!/^\d+$/.test(value) || strings[Number(value)] === undefined) throw new Error(xlsxError);
        values[column] = strings[Number(value)];
      } else if (!type || type === 'n' || type === 'str') values[column] = value;
      else throw new Error('El Excel contiene un tipo de celda que no corresponde a un precio.');
    }
    return values;
  });
}

function workbookRows(rows) {
  const [header, ...data] = rows;
  if (!HEADERS.every((label, index) => header[index] === label)) throw new Error('Conserva los encabezados del Excel exportado.');
  const results = new Map();
  for (const [name, id, type, category, subcategory, restaurant, ...prices] of data) {
    const site = SITES.find((entry) => siteLabel(entry) === restaurant);
    const product = PRODUCTS.find((entry) => entry.id === id);
    if (!site || !product || product.name !== name || product.type !== type || product.category !== category || product.subcategory !== subcategory) {
      throw new Error('Los campos de producto y restaurante deben coincidir con el catálogo exportado.');
    }
    const key = priceKey(site.id, id, '');
    if (results.has(key)) throw new Error('El Excel contiene un producto repetido para el mismo restaurante.');
    const parsed = prices.map((price) => {
      if (price === '') return undefined;
      const amount = parseAmount(price);
      if (amount == null) throw new Error('Los precios deben ser enteros en COP, incluido cero.');
      return amount;
    });
    results.set(key, parsed);
  }
  return results;
}

export async function compareWorkbook(buffer) {
  if (buffer.byteLength < 22 || buffer.byteLength > maxWorkbook) throw new Error(xlsxError);
  const entries = zipEntries(buffer);
  const [data, reference, shared] = await Promise.all([
    xmlEntry(entries.get('xl/worksheets/sheet1.xml')),
    xmlEntry(entries.get('xl/worksheets/sheet2.xml')),
    xmlEntry(entries.get('xl/sharedStrings.xml')),
  ]);
  const strings = shared ? nodes(shared, 'si').map(textRuns) : [];
  const before = workbookRows(readRows(reference, strings));
  const after = workbookRows(readRows(data, strings));
  const draft = new Map();
  for (const [key, prices] of after) {
    const original = before.get(key);
    if (!original) throw new Error('La hoja de referencia no coincide con los productos editados.');
    prices.forEach((to, index) => {
      if (to === undefined || to === original[index]) return;
      const fullKey = key + LISTS[index].id;
      draft.set(fullKey, { key: fullKey, from: original[index], to });
    });
  }
  return draft;
}
