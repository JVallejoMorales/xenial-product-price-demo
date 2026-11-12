export const BRAND = 'Nube y Grano';
export const CATALOG_DATE = '2026-10-14';
export const SITES = [
  { id: 'mirador', code: '410', name: 'Mirador', adjustment: 0 },
  { id: 'patio', code: '421', name: 'Patio Norte', adjustment: 400 },
  { id: 'bosque', code: '436', name: 'Bosque Claro', adjustment: -200 },
  { id: 'alameda', code: '449', name: 'Alameda del Sol', adjustment: 700 },
];

export const LISTS = [
  { id: 'principal', name: 'Principal', adjustment: 0, source: 'Mostrador', destination: 'Consumo en el sitio' },
  { id: 'directo', name: 'Envío directo', adjustment: 1400, source: 'Pedido directo', destination: 'Entrega' },
  { id: 'app', name: 'App móvil', adjustment: 800, source: 'App de la casa', destination: 'Recogida' },
  { id: 'auto', name: 'Autoservicio', adjustment: 300, source: 'Ventanilla', destination: 'Para llevar' },
  { id: 'quiosco', name: 'Quiosco', adjustment: 200, source: 'Quiosco del sitio', destination: 'Todos' },
];

const items = [
  ['Focaccia de tomate', 'Producto', 'Cocina', 'Sándwiches', 14400],
  ['Bowl de avena y pera', 'Producto', 'Desayunos', 'Bowls', 13200],
  ['Latte de panela', 'Producto', 'Bebidas', 'Calientes', 9200],
  ['Caja de panes de masa madre', 'Producto', 'Panadería', 'Panes', 15600],
  ['Tostada de ricota y miel', 'Producto', 'Desayunos', 'Tostadas', 12900],
  ['Limonada con hierbabuena', 'Producto', 'Bebidas', 'Frías', 6800],
  ['Combo de focaccia', 'Combo', 'Cocina', 'Menús', 22700],
  ['Roll de naranja', 'Producto', 'Panadería', 'Dulces', 6100],
  ['Galleta de avena', 'Producto', 'Panadería', 'Dulces', 3900],
  ['Batido de mora', 'Producto', 'Bebidas', 'Frías', 9800],
  ['Pan de queso ahumado', 'Producto', 'Panadería', 'Salados', 5400],
  ['Tazón de granola', 'Producto', 'Desayunos', 'Bowls', 13700],
  ['Café filtrado', 'Producto', 'Bebidas', 'Calientes', 5700],
  ['Tarta de cacao', 'Producto', 'Postres', 'Tartas', 12100],
  ['Wrap de berenjena', 'Producto', 'Cocina', 'Sándwiches', 16100],
  ['Combo del mirador', 'Combo', 'Desayunos', 'Menús', 21900],
  ['Té de jazmín', 'Producto', 'Bebidas', 'Calientes', 7200],
  ['Sopa de calabaza', 'Producto', 'Cocina', 'Sopas', 11800],
  ['Bizcocho de limón', 'Producto', 'Postres', 'Bizcochos', 8700],
  ['Galleta de avena', 'Producto', 'Postres', 'Galletas', 4300],
  ['Vaso de agua', 'Modificador', 'Bebidas', 'Complementos', 0],
  ['Ensalada de lentejas', 'Producto', 'Cocina', 'Ensaladas', 15300],
  ['Cold brew con naranja', 'Producto', 'Bebidas', 'Frías', 9700],
  ['Crutones de la casa', 'Modificador', 'Cocina', 'Complementos', 2300],
  ['Pudín de vainilla', 'Producto', 'Postres', 'Fríos', 8200],
  ['Croissant de almendras', 'Producto', 'Panadería', 'Dulces', 7900],
  ['Huevos con pan tostado', 'Producto', 'Desayunos', 'Platos', 16400],
  ['Tostada con aguacate', 'Producto', 'Desayunos', 'Tostadas', 14900],
  ['Chocolate con canela', 'Producto', 'Bebidas', 'Calientes', 8400],
  ['Combo de sopa y pan', 'Combo', 'Cocina', 'Menús', 19200],
];

export const PRODUCTS = items.map(([name, type, category, subcategory, base], index) => ({
  id: 'MP-' + (4801 + index), name, type, category, subcategory, base,
}));

const sitesById = new Map(SITES.map((site) => [site.id, site]));
const productsById = new Map(PRODUCTS.map((product) => [product.id, product]));
const listsById = new Map(LISTS.map((list) => [list.id, list]));
const local = { timeZone: 'America/Bogota' };
const dateFormat = new Intl.DateTimeFormat('es-CO', { ...local, dateStyle: 'short' });
const timeFormat = new Intl.DateTimeFormat('es-CO', { ...local, timeStyle: 'short' });
const dateKey = new Intl.DateTimeFormat('en-CA', { ...local, year: 'numeric', month: '2-digit', day: '2-digit' });
const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat('es-CO');
const validAmount = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 999999999999;
export const parseAmount = (value) => /^\d{1,12}$/.test(String(value).trim()) ? Number(value) : null;
export const normalized = (value) => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
export const money = (value) => validAmount(value) ? currency.format(value) : 'Sin regla';
export const count = (value) => integer.format(value);
export const formatDate = (at) => dateFormat.format(new Date(at));
export const localTime = (at) => timeFormat.format(new Date(at));
export const formatTime = (at) => formatDate(at) + ' · ' + localTime(at);
export const localDay = (at) => dateKey.format(new Date(at));
export const siteLabel = (site) => site.code + ' · ' + site.name;
export const priceKey = (site, product, list) => [site, product, list].join('/');

export function identity(key) {
  const [site, product, list] = key.split('/');
  return { site: sitesById.get(site), product: productsById.get(product), list: listsById.get(list) };
}

export function createCatalogue() {
  const catalogue = new Map();
  for (const site of SITES) {
    for (const product of PRODUCTS) {
      for (const list of LISTS) {
        const missing = (product.id === 'MP-4804' && site.id === 'mirador' && list.id === 'app')
          || (site.id === 'bosque' && product.type === 'Combo' && list.id === 'quiosco')
          || (product.id === 'MP-4824' && list.id === 'principal');
        if (!missing) {
          const amount = product.base === 0 ? 0 : product.base + site.adjustment + list.adjustment;
          catalogue.set(priceKey(site.id, product.id, list.id), amount);
        }
      }
    }
  }
  return catalogue;
}

export function selectProducts(query = '') {
  const search = normalized(query);
  return PRODUCTS.filter((product) => normalized(product.name + ' ' + product.id).includes(search));
}

export function selectSites(query = '') {
  const search = normalized(query);
  return SITES.filter((site) => normalized(siteLabel(site)).includes(search));
}

export function catalogueRows(filters) {
  const sites = selectSites(filters.siteSearch).filter((site) => !filters.site || site.id === filters.site);
  const products = selectProducts(filters.search);
  return sites.flatMap((site) => products.map((product) => ({ site, product })));
}

export function examplePlan(catalogue) {
  const keys = LISTS.slice(0, 2).map((list) => priceKey(SITES[0].id, PRODUCTS[0].id, list.id));
  return new Map(keys.map((key) => {
    const from = catalogue.get(key);
    return [key, { key, from, to: from + 400 }];
  }));
}

function signature(draft) {
  return JSON.stringify([...draft.values()].sort((a, b) => a.key.localeCompare(b.key)).map(({ key, from, to }) => [key, from, to]));
}

export function reviewPlan(catalogue, draft) {
  const rows = [...draft.values()].map((line) => {
    const current = catalogue.get(line.key);
    let error = '';
    if (current === undefined) error = 'Sin regla para esta lista';
    else if (current !== line.from) error = 'Cambió el precio de referencia';
    else if (!validAmount(line.to)) error = 'Ingresa un entero en COP mayor o igual a cero';
    else if (line.to === current) error = 'El precio propuesto ya está vigente';
    return { ...line, current, error };
  });
  return { rows, signature: signature(draft), ready: rows.length > 0 && rows.every(({ error }) => !error) };
}

export function applyPlan(catalogue, draft, preview) {
  if (!preview?.ready || preview.signature !== signature(draft)) return { error: 'Compara el plan vigente antes de aplicarlo.' };
  const review = reviewPlan(catalogue, draft);
  if (!review.ready) return { error: 'La referencia cambió. Vuelve a comparar el plan.' };
  const next = new Map(catalogue);
  for (const { key, to } of review.rows) next.set(key, to);
  return { catalogue: next, rows: review.rows.map(({ key, from, to }) => ({ key, from, to, observed: next.get(key) })) };
}

export function restoreLot(catalogue, lot) {
  if (!lot || lot.restoration) return { error: 'El lote ya está restaurado o no existe.' };
  if (lot.rows.some(({ key, observed }) => catalogue.get(key) !== observed)) {
    return { error: 'El precio vigente difiere del comprobante. Revisa el movimiento más reciente.' };
  }
  const next = new Map(catalogue);
  for (const { key, from } of lot.rows) next.set(key, from);
  return { catalogue: next, observed: lot.rows.map(({ key }) => next.get(key)) };
}

export const STATUSES = { applied: 'Aplicado', reverted: 'Revertido', unapplied: 'Sin aplicar', unknown: 'Por revisar', pending: 'Pendiente' };
export const ORIGINS = ['Individual', 'Selección múltiple', 'Excel', 'Histórico'];

export function seedAudit(catalogue) {
  const history = [
    [0, 0, 0, 'applied', 800, 'Ajuste del menú de temporada'],
    [1, 2, 1, 'applied', 600, 'Actualización del canal de entrega'],
    [0, 4, 0, 'reverted', 400, 'Retorno al precio del desayuno'],
    [2, 6, 2, 'applied', 1100, 'Revisión del combo en la app'],
    [3, 5, 0, 'unapplied', 500, 'Propuesta retirada durante la comparación'],
    [1, 11, 0, 'pending', 600, 'Revisión de precios del desayuno'],
  ];
  return history.map(([site, product, list, status, difference, reason], index) => {
    const key = priceKey(SITES[site].id, PRODUCTS[product].id, LISTS[list].id);
    const current = catalogue.get(key);
    const from = status === 'applied' ? current - difference : current;
    const to = from + difference;
    const observed = ['applied', 'reverted'].includes(status) ? current : null;
    return { key, from, to, observed, reason, status, origin: ORIGINS[index % ORIGINS.length],
      maker: index % 2 ? 'Equipo Patio' : 'Equipo Mirador',
      id: 'MP-H' + (31 - index), at: '2026-10-' + String(14 - index).padStart(2, '0') + 'T15:18:00Z' };
  });
}

export function auditRows(records, filters) {
  const needle = normalized(filters.search);
  const matchingSites = new Set(selectSites(filters.siteSearch).map(({ id }) => id));
  return records.filter((record) => {
    const { site, product, list } = identity(record.key);
    const day = localDay(record.at);
    return (!filters.site || filters.site === site.id)
      && matchingSites.has(site.id)
      && (!filters.start || day >= filters.start) && (!filters.end || day <= filters.end)
      && (!filters.list || filters.list === list.id) && (!filters.origin || filters.origin === record.origin)
      && normalized([record.id, product.name, product.id, record.maker].join(' ')).includes(needle);
  }).sort((a, b) => b.at.localeCompare(a.at));
}

export function csv(headers, rows) {
  const quote = (value) => {
    const safe = typeof value === 'string' && /^[\s\uFEFF]*[=+@-]/.test(value) ? "'" + value : String(value ?? '');
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(quote).join(';')).join('\r\n') + '\r\n';
}

export function planCsv(rows) {
  return csv(['Sede', 'ID producto', 'Producto', 'Lista', 'Referencia COP', 'Propuesto COP', 'Diferencia COP'],
    rows.map(({ key, from, to }) => {
      const { site, product, list } = identity(key);
      return [site.name, product.id, product.name, list.name, from, to, from === undefined ? '' : to - from];
    }));
}
