export const SITES = [
  { id: 'alameda', name: 'Alameda', adjustment: 0 },
  { id: 'olmo', name: 'Estación Olmo', adjustment: 400 },
  { id: 'luna', name: 'Pasaje Luna', adjustment: -200 },
];

export const LISTS = [
  { id: 'base', name: 'Base', adjustment: 0 },
  { id: 'salon', name: 'Salón', adjustment: 300 },
  { id: 'web', name: 'Web', adjustment: 600 },
  { id: 'entrega', name: 'Entrega', adjustment: 1400 },
  { id: 'quiosco', name: 'Quiosco', adjustment: 200 },
];

export const PRODUCTS = [
  { id: 'PX-101', name: 'Café de origen', type: 'Individual', category: 'Bebidas', base: 6500 },
  { id: 'PX-102', name: 'Pan de cacao', type: 'Individual', category: 'Panadería', base: 5400 },
  { id: 'PX-103', name: 'Desayuno de la casa', type: 'Combo', category: 'Desayunos', base: 18700 },
  { id: 'PX-104', name: 'Té de durazno', type: 'Individual', category: 'Bebidas', base: 7600 },
  { id: 'PX-105', name: 'Sándwich de huerta', type: 'Individual', category: 'Cocina', base: 16200 },
  { id: 'PX-106', name: 'Rollo de canela', type: 'Individual', category: 'Panadería', base: 7100 },
  { id: 'PX-107', name: 'Tostada con café', type: 'Combo', category: 'Desayunos', base: 14500 },
  { id: 'PX-108', name: 'Bowl de temporada', type: 'Individual', category: 'Cocina', base: 21500 },
  { id: 'PX-109', name: 'Infusión fría', type: 'Individual', category: 'Bebidas', base: 8200 },
  { id: 'PX-110', name: 'Galleta de avena', type: 'Individual', category: 'Panadería', base: 4400 },
  { id: 'PX-111', name: 'Menú de huerta', type: 'Combo', category: 'Cocina', base: 25900 },
  { id: 'PX-112', name: 'Chocolate de mesa', type: 'Individual', category: 'Bebidas', base: 9000 },
];

export const CATEGORIES = [...new Set(PRODUCTS.map(({ category }) => category))];
export const DEFAULT_FILTERS = { site: SITES[0].id, category: '', search: '' };
const currency = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const timestamp = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'UTC', hourCycle: 'h23',
});

export const money = (value) => currency.format(value);
export const formatTime = (value) => `${timestamp.format(new Date(value))} UTC`;
export const priceKey = (site, product, list) => `${site}/${product}/${list}`;

export function identity(key) {
  const [siteId, productId, listId] = key.split('/');
  return {
    site: SITES.find(({ id }) => id === siteId),
    product: PRODUCTS.find(({ id }) => id === productId),
    list: LISTS.find(({ id }) => id === listId),
  };
}

export function createCatalogue() {
  const catalogue = new Map();
  for (const site of SITES) {
    for (const product of PRODUCTS) {
      for (const list of LISTS) {
        const absent = (product.id === 'PX-104' && site.id === 'alameda' && list.id === 'web')
          || (site.id === 'luna' && product.type === 'Combo' && list.id === 'quiosco');
        if (absent) continue;
        catalogue.set(priceKey(site.id, product.id, list.id), product.base + site.adjustment + list.adjustment);
      }
    }
  }
  return catalogue;
}

export function examplePlan(catalogue) {
  const example = [
    priceKey('alameda', 'PX-101', 'salon'),
    priceKey('alameda', 'PX-101', 'web'),
  ];
  return new Map(example.flatMap((key) => {
    const from = catalogue.get(key);
    if (from === undefined) return [];
    const to = Number.isSafeInteger(from + 400) ? from + 400 : from - 400;
    return [[key, { key, from, to }]];
  }));
}

function normalized(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
}

export function selectProducts(filters) {
  const search = normalized(filters.search);
  return PRODUCTS.filter((product) => (!filters.category || product.category === filters.category)
    && (!search || normalized(`${product.id} ${product.name}`).includes(search)));
}

function signature(draft) {
  return JSON.stringify([...draft.values()]
    .sort((first, second) => first.key.localeCompare(second.key))
    .map(({ key, from, to }) => [key, from, to]));
}

export function reviewPlan(catalogue, draft) {
  const rows = [...draft.values()].map((line) => {
    const current = catalogue.get(line.key);
    let error = '';
    if (current === undefined) error = 'Sin regla para esta lista';
    else if (current !== line.from) error = 'Cambió el precio de referencia';
    else if (!Number.isSafeInteger(line.to) || line.to <= 0) error = 'El precio debe ser un entero positivo';
    else if (line.to === current) error = 'El precio propuesto ya está vigente';
    return { ...line, current, error };
  });
  return { rows, signature: signature(draft), ready: rows.length > 0 && rows.every(({ error }) => !error) };
}

export function applyPlan(catalogue, draft, preview) {
  if (!preview?.ready || preview.signature !== signature(draft)) return { error: 'Simula el plan vigente antes de aplicarlo.' };
  const review = reviewPlan(catalogue, draft);
  if (!review.ready) return { error: 'La referencia cambió. Revisa las filas y vuelve a simular.' };
  const next = new Map(catalogue);
  for (const { key, to } of review.rows) next.set(key, to);
  const rows = review.rows.map(({ key, from, to }) => ({ key, from, to, observed: next.get(key) }));
  return { catalogue: next, rows };
}

export function restoreLot(catalogue, lot) {
  if (!lot || lot.restoration) return { error: 'El lote ya está restaurado o no existe.' };
  if (lot.rows.some(({ key, observed }) => catalogue.get(key) !== observed)) {
    return { error: 'Hay precios distintos al comprobante. Revisa la referencia del lote.' };
  }
  const next = new Map(catalogue);
  for (const { key, from } of lot.rows) next.set(key, from);
  return { catalogue: next, observed: lot.rows.map(({ key }) => next.get(key)) };
}

export function planCsv(rows) {
  const quote = (value) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
  const records = rows.map(({ key, from, to }) => {
    const { site, product, list } = identity(key);
    return [site.name, product.id, product.name, list.name, from, to, to - from];
  });
  const headers = ['Sede', 'ID producto', 'Producto', 'Lista', 'Referencia COP', 'Propuesto COP', 'Diferencia COP'];
  return '\uFEFF' + [headers, ...records].map((row) => row.map(quote).join(';')).join('\r\n') + '\r\n';
}
