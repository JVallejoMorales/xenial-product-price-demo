import {
  BRAND, CATALOG_DATE, LISTS, ORIGINS, SITES, STATUSES, auditRows, catalogueRows, count,
  formatDate, formatTime, identity, localTime, money, priceKey, selectSites, siteLabel,
} from './modelo.js';
import { HEADERS } from './excel.js';

export const ROUTES = {
  excel: ['Excel de precios', 'Descarga el Excel de precios e importa tus cambios para compararlos.'],
  catalogo: ['Catálogo de precios', 'Consulta las listas de precios del restaurante seleccionado y prepara tus cambios.'],
  listas: ['Listas de precios', 'Prepara tus listas, agrega productos y conserva cada versión del borrador.'],
  historial: ['Auditoría', 'Revisa los cambios y resultados conservados de los restaurantes.'],
  plan: ['Plan de cambios', 'Compara los precios de referencia antes de aplicar el lote en la demo.'],
  proyecto: ['Sobre el proyecto', 'Xenial Product Price · Burger King Colombia'],
};

const paths = {
  file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Zm0 0v5h5M9 12h6M9 16h6',
  grid: 'M3 4h18v16H3zM3 10h18M9 4v16',
  list: 'M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1',
  audit: 'M3 11a9 9 0 1 1 2.6 7M3 5v6h6m3-4v5l3 2',
};

export const icon = (name) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
export const option = (value, label, selected) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`;
export const action = (name, text, { primary = false, disabled = false } = {}) =>
  `<button type="button" class="button ${primary ? 'primary' : 'secondary'}" data-action="${name}"${disabled ? ' disabled' : ''}>${text}</button>`;

export function sectionHeading(title, { kicker = '', description = '', actions = '' } = {}) {
  return `<div class="section-heading">
    <div>${kicker ? `<p class="eyebrow">${kicker}</p>` : ''}<h2>${title}</h2>${description ? `<p class="section-description">${description}</p>` : ''}</div>
    ${actions ? `<div class="actions">${actions}</div>` : ''}
  </div>`;
}

export function table(label, headers, rows, { className = '', empty = 'No hay resultados para estos filtros.' } = {}) {
  return `<div class="table-wrap ${className}" tabindex="0" role="region" aria-label="${esc(label)}">
    <table aria-label="${esc(label)}"><thead><tr>${headers.map((header) => `<th scope="col">${header}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([first, ...rest]) => `<tr><th scope="row">${first}</th>${rest.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>
    ${rows.length ? '' : `<p class="empty">${empty}</p>`}
  </div>`;
}

export function siteSelect(value, search = '') {
  const matches = selectSites(search);
  const options = SITES.filter((site) => matches.includes(site) || site.id === value);
  return `<label class="field site-field">Sitio<select name="site">
    ${option('', 'Todos los sitios', value)}${options.map((site) => option(site.id, siteLabel(site), value)).join('')}
  </select></label>`;
}

function searchField(label, name, value, placeholder) {
  return `<label class="field">${label}<input type="search" name="${name}" value="${esc(value)}" maxlength="100" placeholder="${placeholder}"></label>`;
}

function pagesFor(total, filters) {
  const pages = Math.max(1, Math.ceil(total / filters.size));
  const page = Math.min(pages, filters.page);
  const start = (page - 1) * filters.size;
  return { pages, page, start };
}

function pagination(scope, total, filters, sizes) {
  const { page, pages, start } = pagesFor(total, filters);
  return `<div class="pagination" data-scope="${scope}">
    <span class="small muted">${total ? `Mostrando ${count(start + 1)} a ${count(Math.min(total, start + filters.size))} de ${count(total)}` : '0 resultados'}</span>
    <div class="actions page-controls">
      <label>Filas por página <select name="size" aria-label="Filas por página">${sizes.map((size) => option(size, size, filters.size)).join('')}</select></label>
      <button type="button" class="button secondary" data-page="${page - 1}"${page === 1 ? ' disabled' : ''}>Anterior</button>
      <span>Página ${page} de ${pages}</span>
      <button type="button" class="button secondary" data-page="${page + 1}"${page === pages ? ' disabled' : ''}>Siguiente</button>
    </div>
  </div>`;
}

function summaryMetrics(rows, catalogue) {
  const distinct = new Map(rows.map(({ product }) => [product.id, product.name]));
  const frequency = new Map();
  for (const name of distinct.values()) frequency.set(name, (frequency.get(name) ?? 0) + 1);
  const prices = rows.map(({ site, product }) => catalogue.get(priceKey(site.id, product.id, 'principal')));
  const cards = [
    ['Resultados', rows.length, 'Filas del filtro actual'],
    ['Con precio', prices.filter((price) => price > 0).length, 'Precio principal mayor que cero'],
    ['Precio cero', prices.filter((price) => price === 0).length, 'Cero registrado en Principal'],
    ['Precio vacío', prices.filter((price) => price === undefined).length, 'Sin regla en Principal'],
    ['Nombre repetido', [...frequency.values()].filter((value) => value > 1).length, 'Nombres con distintos PLU'],
  ];
  return `<section class="metrics" aria-label="Resumen del catálogo">${cards.map(([label, value, note], index) =>
    `<article class="metric metric-${index}"><span>${label}</span><strong>${count(value)}</strong><small>${note}</small></article>`).join('')}</section>`;
}

function priceCell(catalogue, draft, site, product, list, editable) {
  const key = priceKey(site.id, product.id, list.id);
  const price = catalogue.get(key);
  if (price === undefined) return '<span class="missing">Sin regla</span>';
  const line = draft.get(key);
  const controls = editable ? `<div class="price-actions">
    <button type="button" class="button secondary compact" data-edit="${key}" aria-label="Cambiar precio ${esc(list.name)} de ${esc(product.name)}">Cambiar precio</button>
    ${list.id === 'principal' ? '' : `<details class="rule-conditions"><summary>Ver condiciones</summary><dl>
      <div><dt>Origen</dt><dd>${list.source}</dd></div><div><dt>Destino</dt><dd>${list.destination}</dd></div>
      <div><dt>Vigencia</dt><dd>Desde ${formatDate(CATALOG_DATE + 'T15:00:00Z')}</dd></div>
    </dl></details>`}
  </div>` : '';
  return `<div class="price-cell"><strong>${money(price)}</strong>${line ? `<small class="change-amount">Propuesto ${money(line.to)}</small>` : ''}${controls}</div>`;
}

export function catalogueView(catalogue, draft, filters, refreshed, batch) {
  const rows = catalogueRows(filters);
  const { start } = pagesFor(rows.length, filters);
  const siteCount = selectSites(filters.siteSearch).length;
  const actions = `${draft.size ? `<a class="button secondary" href="#plan">Revisar plan (${count(draft.size)})</a>` : ''}
    ${batch ? action('continue-batch', 'Continuar lote') : ''}
    ${action('refresh-catalogue', filters.site ? 'Actualizar catálogo' : 'Actualizar vista guardada')}`;
  const values = rows.slice(start, start + filters.size).map(({ site, product }) => {
    const relation = `${filters.site ? `<button type="button" class="button secondary compact" data-rules="${site.id}/${product.id}">Reglas en combos</button>` : ''}
      ${product.type === 'Combo' ? `<button type="button" class="button secondary compact" data-companions="${site.id}/${product.id}">Ver acompañantes</button>` : ''}`;
    return [
      `<strong>${esc(product.name)}</strong><div class="row-actions">
        <button type="button" class="button secondary compact" data-batch-product="${product.id}">${batch ? 'Agregar al lote' : 'Cambiar precios'}</button>
        ${relation}</div>`,
      product.id, product.type, product.category, product.subcategory, esc(siteLabel(site)),
      ...LISTS.map((list) => priceCell(catalogue, draft, site, product, list, Boolean(filters.site))),
    ];
  });
  return `${summaryMetrics(rows, catalogue)}
  <section class="panel">
    ${sectionHeading(filters.site ? 'Productos y precios del sitio' : 'Productos y precios de todos los sitios',
      { kicker: 'Consulta del catálogo', actions })}
    <form class="filter-box" data-filter="catalogo">
      <div class="catalogue-filters">
        ${searchField('Buscar sitio', 'siteSearch', filters.siteSearch, 'Nombre o código')}
        ${searchField('Buscar producto', 'search', filters.search, 'Nombre o PLU')}
        ${siteSelect(filters.site, filters.siteSearch)}
        <div class="actions">
          ${action('clear-catalogue', 'Limpiar', { disabled: !filters.siteSearch && !filters.search })}
          ${action('refresh-sites', 'Actualizar sitios', { primary: true })}
        </div>
      </div>
      <p class="small muted">${count(siteCount)} ${siteCount === 1 ? 'sitio disponible' : 'sitios disponibles'} · ${refreshed ? 'Vista guardada actualizada ' + formatTime(refreshed) : 'Catálogo de ejemplo del ' + formatDate(CATALOG_DATE + 'T15:00:00Z')}</p>
    </form>
    <p class="small muted table-note">${count(rows.length)} resultados · Precios configurados por lista. Las celdas sin regla conservan su estado.</p>
    ${table('Productos y precios', HEADERS, values, { className: 'catalogue-grid', empty: 'No hay productos que coincidan con los filtros.' })}
    ${pagination('catalogo', rows.length, filters, [25, 50, 100, 200])}
  </section>`;
}

function groupedPrices(rows) {
  const groups = new Map();
  for (const entry of rows) {
    const { site, product, list } = identity(entry.key);
    const key = site.id + '/' + product.id;
    if (!groups.has(key)) groups.set(key, { site, product, prices: new Map() });
    groups.get(key).prices.set(list.id, entry);
  }
  return [...groups.values()].map(({ site, product, prices }) => [
    esc(product.name), product.id, product.type, product.category, product.subcategory, esc(siteLabel(site)),
    ...LISTS.map((list) => {
      const line = prices.get(list.id);
      if (!line) return '<span class="muted">—</span>';
      return `<span class="change-pair"><span>${money(line.from)}</span><strong>${money(line.to)}</strong>
        <small class="${line.error ? 'bad-text' : 'good-text'}">${line.error ? esc(line.error) : 'Coincide'}</small></span>`;
    }),
  ]);
}

export function terms() {
  return `<div class="term-fields">
    <label class="field">Responsable<input name="maker" maxlength="80" placeholder="Responsable del cambio" required></label>
    <label class="field">Motivo del cambio<input name="reason" maxlength="240" placeholder="Motivo del cambio" required></label>
  </div>`;
}

export function excelView(fileState, book, recordCount, selectedFile) {
  const comparison = fileState?.review;
  const exportState = book ? `<strong>Excel generado.</strong> ${SITES.length} sitios y ${count(recordCount)} filas de producto.
    ${book.stale ? '<span class="bad-text">Hay cambios posteriores a esta descarga.</span>' : ''}` : '<strong>Listo para generar el catálogo de todos los sitios.</strong>';
  return `<section class="panel">
    ${sectionHeading('Excel de precios de todos los sitios', {
      kicker: 'Exportación global', description: 'Incluye todos los productos y listas de precios.',
      actions: action('export-workbook', 'Generar Excel actualizado', { primary: true })
        + (book ? action('download-workbook', 'Descargar Excel generado') : ''),
    })}
    <p class="feedback" role="status">${exportState}</p>
  </section>
  <section class="panel">
    ${sectionHeading('Cambiar precios desde Excel', { kicker: 'Importar cambios' })}
    <form id="workbook-form" class="upload-box">
      <label class="field">Excel modificado (.xlsx)<input name="workbook" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
      <button class="button primary" type="submit"${selectedFile && !fileState?.loading ? '' : ' disabled'}>Cargar y comparar</button>
    </form>
    ${selectedFile ? `<p class="small muted workbook-name">Archivo seleccionado · ${esc(selectedFile.name)}</p>` : ''}
    <p class="upload-status${fileState?.error ? ' bad-text' : ''}" role="status">${fileState?.message ? esc(fileState.message)
      : 'Edita los importes en la hoja Precios del Excel generado y vuelve a cargarlo.'}</p>
    ${comparison?.rows.length ? `<div class="workbook-review">
      <p class="feedback${comparison.ready ? ' success' : ' error'}">${count(comparison.rows.length)} cambios · ${comparison.ready ? 'Comparación lista para confirmar.' : 'Revisa las diferencias antes de aplicar.'}</p>
      ${table('Cambios del Excel por producto y lista', HEADERS, groupedPrices(comparison.rows), { className: 'catalogue-grid' })}
      <form id="apply-workbook-form">${terms()}
        <div class="actions">
          ${action('clear-workbook', 'Vaciar lista')}
          <button type="submit" class="button primary"${comparison.ready ? '' : ' disabled'}>Aplicar lote en demo</button>
        </div>
      </form>
    </div>` : ''}
    ${fileState?.applied ? '<a class="text-link" href="#historial">Ver el lote en Auditoría</a>' : ''}
  </section>`;
}

const statusFilters = [['', 'Todos'], ['applied', 'Aplicados'], ['reverted', 'Revertidos'], ['unapplied', 'Sin aplicar'], ['unknown', 'Por revisar'], ['pending', 'Pendientes']];
export function auditMatches(records, filters) {
  return auditRows(records, filters).filter((record) => !filters.status || record.status === filters.status);
}
export const statusBadge = (status) => `<span class="status-badge ${status}">${STATUSES[status]}</span>`;

export function historyView(records, filters, notice, updated) {
  const all = auditRows(records, filters);
  const matches = all.filter((record) => !filters.status || record.status === filters.status);
  const { start } = pagesFor(matches.length, filters);
  const rows = matches.slice(start, start + filters.size).map((record) => {
    const { product, site, list } = identity(record.key);
    return [
      `${formatDate(record.at)}<small>${localTime(record.at)}</small>`,
      `<strong>${esc(product.name)}</strong><small>PLU ${product.id}</small>`,
      `<strong>${esc(site.name)}</strong><small>Tienda ${site.code}</small>`,
      list.name, money(record.from), `<strong>${money(record.observed ?? record.to)}</strong>`,
      esc(record.maker), esc(record.origin),
      statusBadge(record.status) + (record.reversed ? '<small>Revertido posteriormente</small>' : ''),
      `<button class="text-link" type="button" data-record="${record.id}" aria-label="Ver detalle de ${esc(product.name)}, ${list.name}">Ver</button>`,
    ];
  });
  const statusButtons = statusFilters.map(([id, label]) => `<button class="status-filter" type="button" data-status="${id}" aria-pressed="${id === filters.status}">
    ${label}<b>${count(all.filter((record) => !id || id === record.status).length)}</b></button>`).join('');
  return `<section class="panel">
    ${sectionHeading('Auditoría de precios', {
      kicker: 'Historial de la herramienta', description: 'Consulta los precios, el responsable y el resultado de cada movimiento.',
      actions: action('refresh-audit', 'Actualizar historial', { primary: true })
        + action('export-audit', '↓ Exportar historial', { disabled: !matches.length }),
    })}
    <form class="filter-box audit-filter-box" data-filter="historial">
      <div class="audit-site-filters">
        ${searchField('Buscar sitio', 'siteSearch', filters.siteSearch, 'Nombre o código')}
        ${siteSelect(filters.site, filters.siteSearch)}
        ${action('refresh-sites', 'Actualizar sitios', { primary: true })}
      </div>
      <p class="small muted">${count(selectSites(filters.siteSearch).length)} sitios disponibles</p>
      <div class="audit-filters">
        ${searchField('Buscar', 'search', filters.search, 'Producto, PLU, responsable o ID')}
        <label class="field">Desde<input type="date" name="start" value="${filters.start}"></label>
        <label class="field">Hasta<input type="date" name="end" value="${filters.end}"></label>
        <label class="field">Lista de precios<select name="list">${option('', 'Todas las listas', filters.list)}${LISTS.map((list) => option(list.id, list.name, filters.list)).join('')}</select></label>
        <label class="field">Origen<select name="origin">${option('', 'Todos', filters.origin)}${ORIGINS.map((origin) => option(origin, origin, filters.origin)).join('')}</select></label>
        ${action('clear-audit', 'Limpiar')}
      </div>
    </form>
    <p class="feedback">${updated ? 'Historial actualizado · ' + formatTime(updated) : 'Historial ficticio de Nube y Grano'}</p>
    ${notice ? `<p class="feedback${notice.error ? ' error' : ' success'}" role="status">${esc(notice.text)}</p>` : ''}
    ${filters.start && filters.end && filters.start > filters.end ? '<p class="feedback error" role="alert">La fecha inicial debe ser anterior o igual a la final.</p>' : ''}
    <div class="audit-toolbar"><div class="status-filters" role="group" aria-label="Filtrar por resultado">${statusButtons}</div><p class="small muted">${count(matches.length)} ${matches.length === 1 ? 'movimiento' : 'movimientos'}</p></div>
    ${table('Tabla de auditoría', ['Fecha y hora ↓', 'Producto / PLU', 'Restaurante', 'Lista', 'Precio anterior', 'Precio nuevo', 'Responsable', 'Origen', 'Resultado', 'Detalle'],
      rows, { className: 'audit-grid', empty: 'No hay movimientos para estos filtros.' })}
    ${pagination('historial', matches.length, filters, [10, 25, 50])}
  </section>`;
}

export function reviewTable(lines, editable = false) {
  const rows = lines.map((line) => {
    const { product, site, list } = identity(line.key);
    return [
      `<strong>${esc(product.name)}</strong><small>${product.id}</small>`, esc(site.name), list.name, money(line.from), money(line.to),
      line.error ? `<span class="bad-text">${esc(line.error)}</span>` : 'Coincide',
      ...(editable ? [`<button type="button" class="text-link" data-remove="${line.key}">Quitar</button>`] : []),
    ];
  });
  return table('Comparación de precios', ['Producto / PLU', 'Restaurante', 'Lista', 'Precio anterior', 'Precio nuevo', 'Resultado', ...(editable ? ['Acción'] : [])], rows,
    { className: 'review-grid', empty: 'Selecciona productos o carga el ejemplo para comparar precios.' });
}

export function planView(draft, review, notice) {
  const actions = action('example', 'Cargar ejemplo') + action('review-plan', 'Comparar plan', { primary: true, disabled: !draft.size });
  return `<section class="panel">
    ${sectionHeading('Cambios preparados', { actions })}
    ${reviewTable(review.rows, true)}
    ${notice ? `<p class="feedback${notice.error ? ' error' : ' success'}" role="status">${esc(notice.text)}</p>` : ''}
    <form id="apply-plan-form">${terms()}
      <div class="actions"><a class="button secondary" href="#catalogo">Volver al catálogo</a>
        ${action('export-plan', '↓ Descargar CSV', { disabled: !draft.size })}
        <button type="submit" class="button primary"${review.ready ? '' : ' disabled'}>Aplicar en demo</button>
      </div>
    </form>
  </section>`;
}

export function projectView() {
  return `<div class="project-grid">
    <section class="panel">${sectionHeading('Xenial Product Price')}
      <p>Proyecto de Burger King Colombia para consultar y preparar cambios de precios por producto, sede y lista.</p>
      <h3>Mi aporte</h3><p>Implementé validaciones, simulación y verificación posterior con Python, Excel y la API de Xenial. Probé un cambio y su restauración en laboratorio.</p></section>
    <section class="panel">${sectionHeading('Mesa de Precios')}
      <p>La demo reproduce las pantallas de Excel, Catálogo, Listas y Auditoría con la identidad y los datos ficticios de ${BRAND}.</p>
      <p>Los precios y borradores se guardan en esta sesión del navegador.</p>
      <a class="text-link" href="#catalogo">Explorar el catálogo ↗</a></section>
  </div>`;
}
