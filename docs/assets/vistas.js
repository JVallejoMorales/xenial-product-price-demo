import { CATEGORIES, LISTS, SITES, formatTime, identity, money, priceKey, selectProducts } from './modelo.js';

export const ROUTES = {
  catalogo: 'Catálogo de precios',
  plan: 'Plan de cambios',
  historial: 'Historial de lotes',
  proyecto: 'Sobre el proyecto',
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const amount = (value) => value === undefined ? 'Sin regla' : money(value);
const delta = (from, to) => `${to < from ? '−' : '+'}${money(Math.abs(to - from))}`;
const changeCount = (count) => `${count} ${count === 1 ? 'cambio' : 'cambios'}`;

function heading(route, description, actions = '') {
  return `<header class="page-heading">
    <div><h1>${ROUTES[route]}</h1><p>${description}</p></div>${actions}
  </header>`;
}

function table(headers, rows, label, css = '') {
  return `<div class="table-wrap" tabindex="0" role="region" aria-label="${label}">
    <table class="${css}">
      <thead><tr>${headers.map((header) => `<th scope="col">${header}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function priceCell(catalogue, draft, site, product, list) {
  const key = priceKey(site, product.id, list.id);
  const current = catalogue.get(key);
  if (current === undefined) return '<span class="missing">Sin regla</span>';
  const proposal = draft.get(key);
  const label = `Editar ${product.name} · ${list.name} · Vigente ${money(current)}${proposal ? ` · Propuesto ${money(proposal.to)}` : ''}`;
  return `<button class="cell-price${proposal ? ' has-proposal' : ''}" type="button" data-edit="${key}" aria-label="${label}">
    <span>${money(current)}</span>${proposal ? `<small>→ ${money(proposal.to)}</small>` : ''}
  </button>`;
}

function draftAside(draft) {
  const lines = [...draft.values()].slice(0, 4).map((line) => {
    const { product, site, list } = identity(line.key);
    return `<li><strong>${product.name}</strong><span>${site.name} · ${list.name}</span><b>${money(line.from)} <i aria-hidden="true">→</i> ${money(line.to)}</b></li>`;
  });
  return `<aside class="draft-card" aria-labelledby="draft-title">
    <div class="draft-heading"><h2 id="draft-title">Plan de cambios</h2><span>${changeCount(draft.size)}</span></div>
    <p>Selecciona un precio de la matriz para añadir o editar una propuesta.</p>
    ${lines.length ? `<ul>${lines.join('')}</ul>
      ${draft.size > lines.length ? `<p>${draft.size - lines.length} cambios más en el plan.</p>` : ''}
      <a href="#plan" class="button button-highlight">Revisar plan <span aria-hidden="true">→</span></a>`
      : '<button class="button button-highlight" data-action="example" type="button">Cargar ejemplo</button>'}
  </aside>`;
}

export function catalogueView(catalogue, draft, filters) {
  const products = selectProducts(filters);
  const siteName = SITES.find(({ id }) => id === filters.site).name;
  const rows = products.map((product) => [
    `<span class="product-id">${product.id}</span>`, `<strong class="product-name">${product.name}</strong>`, product.type, product.category,
    ...LISTS.map((list) => priceCell(catalogue, draft, filters.site, product, list)),
  ]);
  return `${heading('catalogo', 'Consulta precios por sede y lista. Cada propuesta se prepara sobre una celda de la matriz.')}
    <div class="workspace">
      <section class="card catalog-card" aria-labelledby="matrix-title">
        <div class="card-heading"><div><h2 id="matrix-title">Matriz de precios</h2><p>${siteName} · ${products.length} ${products.length === 1 ? 'producto' : 'productos'}</p></div><span class="currency-label">COP</span></div>
        <form id="scope-form" class="filters" aria-label="Filtros del catálogo">
          <label class="field">Sede<select name="site">${SITES.map(({ id, name }) => `<option value="${id}"${id === filters.site ? ' selected' : ''}>${name}</option>`).join('')}</select></label>
          <label class="field">Categoría<select name="category"><option value="">Todas</option>${CATEGORIES.map((category) => `<option${category === filters.category ? ' selected' : ''}>${category}</option>`).join('')}</select></label>
          <label class="field search-field">Buscar<input type="search" name="search" placeholder="ID o producto" maxlength="80" value="${escapeHtml(filters.search)}"></label>
          <button class="button button-secondary" type="submit">Filtrar</button>
        </form>
        ${rows.length ? table(['ID', 'Producto', 'Tipo', 'Categoría', ...LISTS.map(({ name }) => name)], rows, 'Matriz de precios', 'price-table')
          : '<p class="empty">Ajusta los filtros para ver productos.</p>'}
        <p class="table-note">Las celdas «Sin regla» indican una lista sin precio configurado en el escenario.</p>
      </section>
      ${draftAside(draft)}
    </div>`;
}

function statusNote(notice) {
  return notice ? `<p class="notice${notice.error ? ' notice-error' : ''}" role="status">${escapeHtml(notice.text)}</p>` : '';
}

export function planView(draft, preview, notice) {
  const rows = [...draft.values()].map((line) => {
    const { site, product, list } = identity(line.key);
    const check = preview?.rows.find(({ key }) => key === line.key);
    const status = check ? check.error ? `<span class="tag tag-warning">${check.error}</span>` : '<span class="tag tag-ok">Coincide</span>' : '<span class="tag">Pendiente</span>';
    return [
      `<strong>${product.name}</strong><span class="row-note">${product.id}</span>`, site.name, list.name,
      `<span class="numeric">${amount(line.from)}</span>`, `<span class="numeric">${money(line.to)}</span>`,
      `<span class="numeric">${delta(line.from, line.to)}</span>`, status,
      `<button class="text-button" type="button" data-remove="${line.key}" aria-label="Quitar ${product.name} de ${list.name}">Quitar</button>`,
    ];
  });
  const phase = preview ? preview.ready ? 'Simulación aprobada' : 'Revisión necesaria' : 'Borrador';
  const detail = preview ? preview.ready
    ? 'Los precios de referencia coinciden y el lote se puede aplicar en el catálogo ficticio.'
    : 'Revisa las filas con diferencias antes de aplicar.'
    : 'Simula el lote para comparar cada precio de referencia con el catálogo de esta sesión.';
  return `${heading('plan', 'Revisa las diferencias de cada lista y ejecuta el lote en la demo.')}
    ${statusNote(notice)}
    <section class="card plan-card">
      <div class="card-heading"><div><h2>${changeCount(draft.size)} en el plan</h2><p>${detail}</p></div><span class="tag ${preview?.ready ? 'tag-ok' : ''}">${phase}</span></div>
      ${rows.length ? table(['Producto', 'Sede', 'Lista', 'Referencia', 'Propuesto', 'Diferencia', 'Validación', 'Acción'], rows, 'Plan de cambios')
        : '<p class="empty">Selecciona un precio del catálogo o carga un ejemplo.</p>'}
      <div class="plan-actions">
        <a class="button button-secondary" href="#catalogo">Volver al catálogo</a>
        ${rows.length ? `<button class="button button-secondary" type="button" data-action="csv">↓ Descargar CSV</button>
          <button class="button button-secondary" type="button" data-action="clear">Vaciar plan</button>
          <button class="button button-primary" type="button" data-action="simulate">Simular plan</button>
          <button class="button button-primary" type="button" data-action="apply"${preview?.ready ? '' : ' disabled'}>Aplicar en demo</button>`
          : '<button class="button button-primary" type="button" data-action="example">Cargar ejemplo</button>'}
      </div>
    </section>`;
}

export function historyView(lots, notice) {
  const lastActive = lots.findLast((lot) => !lot.restoration);
  const entries = [...lots].reverse().map((lot, index) => {
    const rows = lot.rows.map((line, rowIndex) => {
      const { site, product, list } = identity(line.key);
      return [
        `<strong>${product.name}</strong><span class="row-note">${product.id}</span>`, site.name, list.name,
        money(line.from), money(line.to), money(line.observed), lot.restoration ? money(lot.restoration.observed[rowIndex]) : '—',
      ];
    });
    return `<details class="card receipt"${index === 0 ? ' open' : ''}>
      <summary><strong>Lote ${lot.id}</strong><span>${changeCount(lot.rows.length)} · ${formatTime(lot.at)}</span><span class="tag tag-ok">${lot.restoration ? 'Restaurado' : 'Verificado'}</span></summary>
      ${table(['Producto', 'Sede', 'Lista', 'Referencia', 'Propuesto', 'Leído', 'Restaurado'], rows, `Comprobante ${lot.id}`)}
      ${lot.restoration ? `<p class="table-note">Restauración verificada · ${formatTime(lot.restoration.at)}</p>` : ''}
      ${lot === lastActive ? `<div class="plan-actions"><button class="button button-secondary" type="button" data-action="restore">Restaurar lote en demo</button></div>` : ''}
    </details>`;
  });
  return `${heading('historial', 'Consulta el precio leído tras cada lote y recupera los valores de referencia de la última aplicación.')}
    ${statusNote(notice)}
    ${entries.length ? `<div class="receipts">${entries.join('')}</div>`
      : '<section class="card"><p class="empty">Aplica un plan en la demo para generar su comprobante.</p><a class="text-link" href="#plan">Abrir plan de cambios ↗</a></section>'}`;
}

export function projectView() {
  return `${heading('proyecto', 'Origen de la demostración y contribución personal.')}
    <div class="about-grid">
      <section class="card"><h2>Xenial Product Price</h2><p>Proyecto de Burger King Colombia para consultar y preparar cambios de precios por producto, sede y lista.</p>
        <h3>Mi aporte</h3><p>Implementé validaciones, simulación y verificación posterior con Python, Excel y la API de Xenial. Probé un cambio y su restauración en laboratorio.</p></section>
      <section class="card"><h2>Mesa de Precios</h2><p>Esta recreación usa una identidad propia y un catálogo ficticio para proteger la información operativa y la identidad visual de la empresa.</p>
        <p>La matriz, los lotes y los comprobantes se calculan en el navegador. Recargar reinicia el escenario.</p>
        <a class="text-link" href="#catalogo">Explorar el catálogo ↗</a></section>
    </div>`;
}
