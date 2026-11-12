import { CONDITIONS, pickerRows } from './listas.js';
import { LISTS, PRODUCTS, SITES, count, formatTime, identity, money, priceKey, selectProducts, siteLabel } from './modelo.js';
import { action, esc, option, reviewTable, statusBadge, table, terms } from './vistas.js';

const productsById = new Map(PRODUCTS.map((product) => [product.id, product]));
const sitesById = new Map(SITES.map((site) => [site.id, site]));

function dialog(kicker, title, content) {
  return `<header class="dialog-heading">
    <div><p class="eyebrow">${kicker}</p><h2 id="workflow-title">${title}</h2></div>
    <button type="button" class="icon-button" data-close aria-label="Cerrar ventana">×</button>
  </header><div class="dialog-body">${content}</div>`;
}

const closeButton = '<button type="button" class="button secondary" data-close>Cerrar</button>';

function selection(labels, values, inputName) {
  return `<div class="check-grid">${labels.map(([id, label]) => `<label>
    <input type="checkbox" name="${inputName}" value="${id}"${values.includes(id) ? ' checked' : ''}>${label}</label>`).join('')}</div>`;
}

function batchScope(batch) {
  const entries = batch.products.map((id) => `<li><span><strong>${esc(productsById.get(id).name)}</strong> · ${id}</span>
    <button class="text-link" type="button" data-batch-remove="${id}" aria-label="Quitar ${esc(productsById.get(id).name)}">Quitar</button></li>`);
  const products = entries.length ? `<ul class="batch-products">${entries.join('')}</ul>` : '<p class="muted">Elige productos desde el catálogo.</p>';
  return `<section class="modal-block"><h3>Productos del lote</h3>${products}
    ${action('browse-batch', 'Agregar otro producto desde el catálogo')}
  </section>
  <div class="split-dialog">
    <section class="modal-block"><h3>Listas de precios</h3>
      <div class="actions">${action('batch-all-lists', 'Seleccionar todas las listas')}${action('batch-clear-lists', 'Limpiar listas')}</div>
      ${selection(LISTS.map((list) => [list.id, list.name]), batch.lists, 'batch-list')}</section>
    <section class="modal-block"><h3>Restaurantes</h3>
      ${selection(SITES.map((site) => [site.id, siteLabel(site)]), batch.sites, 'batch-site')}</section>
  </div>
  <div class="actions batch-footer"><p class="small muted">${batch.products.length} productos × ${batch.lists.length} listas × ${batch.sites.length} restaurantes</p>
    ${action('batch-read', 'Consultar precios', { primary: true, disabled: !(batch.products.length && batch.lists.length && batch.sites.length) })}</div>`;
}

function batchMatrix(batch, catalogue) {
  const lists = LISTS.filter(({ id }) => batch.lists.includes(id));
  const rows = batch.products.map((id) => [`${esc(productsById.get(id).name)}<small>${id}</small>`,
    ...lists.map((list) => {
      const key = id + '/' + list.id;
      return `<input class="amount-input" type="text" inputmode="numeric" maxlength="12" pattern="[0-9]{1,12}" data-matrix="${key}"
        value="${esc(batch.matrix.get(key) ?? '')}" placeholder="—" aria-label="Precio ${esc(list.name)} de ${esc(productsById.get(id).name)}">`;
    }),
  ]);
  const lines = batch.products.flatMap((id) => batch.sites.flatMap((site) => lists.map((list) => {
    const key = priceKey(site, id, list.id);
    const current = catalogue.get(key);
    const line = batch.lines.get(key);
    return [
      `${esc(productsById.get(id).name)}<small>${id}</small>`, esc(sitesById.get(site).name), list.name, money(current),
      `<input class="amount-input" type="text" inputmode="numeric" maxlength="12" pattern="[0-9]{1,12}" data-line-price="${key}"
        value="${esc(line?.to ?? '')}" placeholder="—" aria-label="Propuesto ${esc(list.name)} de ${esc(productsById.get(id).name)} en ${esc(sitesById.get(site).name)}"${current === undefined ? ' disabled' : ''}>`,
      current === undefined ? '<span class="missing">Sin regla</span>' : line ? 'Preparado' : 'Por definir',
    ];
  })));
  return `<section class="modal-block"><h3>Precios por producto y lista</h3>
    <p class="small muted">Asigna los importes a los restaurantes seleccionados. Puedes ajustar cada combinación en el detalle.</p>
    ${table('Precios por producto y lista', ['Producto / PLU', ...lists.map(({ name }) => name)], rows, { className: 'batch-matrix' })}
    <div class="actions">${action('batch-assign', 'Asignar a los restaurantes seleccionados')}</div>
  </section><section class="modal-block">
    <h3>Detalle por restaurante</h3>
    ${table('Detalle por restaurante', ['Producto / PLU', 'Restaurante', 'Lista', 'Anterior', 'Propuesto', 'Estado'], lines, { className: 'review-grid' })}
  </section>
  <div class="actions batch-footer">${action('batch-scope', 'Volver a la selección')}${action('batch-review', 'Comparar cambios', { primary: true })}</div>`;
}

export function batchDialog(batch, catalogue) {
  let content;
  if (batch.phase === 'edit') content = batchMatrix(batch, catalogue);
  else if (batch.phase === 'review') content = `<p class="feedback${batch.review.ready ? ' success' : ' error'}">
    ${batch.review.ready ? 'Comparación lista para confirmar.' : 'Revisa las diferencias antes de aplicar.'}</p>
    ${reviewTable(batch.review.rows)}
    <form id="apply-batch-form">${terms()}<div class="actions">
      ${action('batch-edit', 'Volver al detalle')}
      <button type="submit" class="button primary"${batch.review.ready ? '' : ' disabled'}>Aplicar lote en demo</button></div></form>`;
  else content = batchScope(batch);
  return dialog('Catálogo · Varios restaurantes', 'Cambiar precios en varios restaurantes',
    (batch.message ? `<p class="feedback" role="status">${esc(batch.message)}</p>` : '') + content);
}

const bundles = {
  'MP-4807': { principal: ['MP-4801', 'MP-4815'], bebida: ['MP-4806', 'MP-4810'], acompañamiento: ['MP-4808', 'MP-4824'] },
  'MP-4816': { principal: ['MP-4805', 'MP-4827'], bebida: ['MP-4803', 'MP-4813'], acompañamiento: ['MP-4811', 'MP-4826'] },
  'MP-4830': { principal: ['MP-4818'], bebida: ['MP-4806', 'MP-4817'], acompañamiento: ['MP-4804', 'MP-4824'] },
};

export function rulesDialog(siteId, productId, catalogue) {
  const site = sitesById.get(siteId);
  const product = productsById.get(productId);
  const links = Object.entries(bundles).filter(([, groups]) => Object.values(groups).flat().includes(productId));
  const rows = LISTS.map((list) => {
    const value = catalogue.get(priceKey(siteId, productId, list.id));
    return [list.name, money(value), value === undefined ? 'Sin regla' : 'Reemplazo', list.source, list.destination];
  });
  return dialog('Catálogo del sitio', 'Reglas en combos', `<p class="muted">${esc(product.name)} · ${product.id} · ${esc(siteLabel(site))}</p>
    <section class="modal-block"><h3>Reglas de precio</h3>${table('Reglas de precio', ['Lista', 'Precio', 'Tipo de ajuste', 'Origen', 'Destino'], rows)}</section>
    <section class="modal-block"><h3>Combos relacionados</h3>${links.length ?
      `<ul class="related-list">${links.map(([id]) => `<li><button class="text-link" type="button" data-companions="${siteId}/${id}">${esc(productsById.get(id).name)} · ${id}</button></li>`).join('')}</ul>`
      : '<p class="muted">Este producto no aparece como opción en los combos del ejemplo.</p>'}</section>
    <div class="actions">${closeButton}</div>`);
}

export function companionDialog(context, catalogue) {
  const { site, product, search, component, list } = context;
  const options = bundles[product] ?? {};
  const components = Object.entries(options);
  const matches = new Set(selectProducts(search).map(({ id }) => id));
  const values = components.filter(([name]) => !component || name === component)
    .flatMap(([name, ids]) => ids.filter((id) => matches.has(id)).map((id) => {
      const item = productsById.get(id);
      const amount = catalogue.get(priceKey(site, id, list));
      return [`${esc(item.name)}<small>PLU ${id}</small>`, name, amount === undefined ? 'Sin regla' : 'Disponible',
        money(amount), amount === undefined ? 'Sin valor guardado' : LISTS.find(({ id }) => id === list).source];
    }));
  return dialog('Catálogo del sitio', 'Acompañantes del combo', `<p class="muted">${esc(productsById.get(product).name)} · ${esc(siteLabel(sitesById.get(site)))}</p>
    <div class="filter-box three-fields">
      <label class="field">Buscar opción<input name="companion-search" type="search" value="${esc(search)}" placeholder="Nombre o PLU"></label>
      <label class="field">Componente<select name="component">${option('', 'Todos', component)}${components.map(([name]) => option(name, name, component)).join('')}</select></label>
      <label class="field">Canal de referencia<select name="companion-list">${LISTS.map((entry) => option(entry.id, entry.name, list)).join('')}</select></label>
    </div>
    ${table('Opciones del combo', ['Producto / PLU', 'Componente', 'Estado', 'Precio guardado', 'Origen de la regla'], values)}
    <div class="actions">${closeButton}</div>`);
}

export function auditDialog(record, canRestore) {
  const { site, product, list } = identity(record.key);
  const observed = record.observed == null ? '—' : money(record.observed);
  const timeline = [['Propuesta registrada', money(record.to)]];
  if (record.status !== 'pending') timeline.push(['Comparación', 'Referencia de ' + money(record.from)]);
  if (record.status === 'applied') timeline.push(['Precio aplicado y verificado', observed]);
  if (record.status === 'reverted') timeline.push(['Precio original recuperado', observed]);
  if (record.status === 'unapplied') timeline.push(['Cambio cerrado sin aplicar', 'Se conservó el precio de referencia.']);
  return dialog('Detalle del movimiento', esc(product.name), `<p class="muted">PLU ${product.id} · ${esc(siteLabel(site))} · ${list.name}</p>
    <div>${statusBadge(record.status)} ${record.reversed ? '<span class="small muted">Revertido posteriormente</span>' : ''}</div>
    <div class="audit-comparison">${[['Precio anterior', money(record.from)], ['Precio propuesto', money(record.to)], ['Precio verificado', observed]]
      .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>
    <dl class="detail-fields"><div><dt>Responsable</dt><dd>${esc(record.maker)}</dd></div><div><dt>Origen</dt><dd>${esc(record.origin)}</dd></div>
      <div><dt>Fecha y hora</dt><dd>${formatTime(record.at)}</dd></div></dl>
    <section class="modal-block"><h3>Motivo del cambio</h3><p>${esc(record.reason)}</p></section>
    <section class="modal-block"><h3>Recorrido del movimiento</h3><ol class="timeline">${timeline.map(([label, value]) =>
      `<li><strong>${label}</strong><span>${value}</span></li>`).join('')}</ol></section>
    <details class="conditions"><summary>Identificación y trazabilidad</summary><dl class="detail-fields">
      <div><dt>ID del movimiento</dt><dd>${record.id}</dd></div><div><dt>Lote</dt><dd>${record.lotId ?? 'Histórico ficticio'}</dd></div></dl></details>
    <div class="actions">${canRestore ? action('restore-lot', 'Restaurar lote en demo') : ''}${closeButton}</div>`);
}

export function pickerDialog(catalogue, state, query, page) {
  const matches = selectProducts(query);
  const pages = Math.max(1, Math.ceil(matches.length / 25));
  const rows = pickerRows(catalogue, state.site, state.model, query, page);
  return dialog('Catálogo guardado del sitio', 'Añadir productos', `<label class="field">Buscar producto por nombre o PLU
    <input name="picker-search" type="search" value="${esc(query)}" placeholder="Nombre o PLU"></label>
    <p class="small muted">${count(matches.length)} productos</p>
    ${table('Productos del catálogo', ['Producto / PLU', 'Base', 'Selección'], rows)}
    <div class="actions"><button type="button" class="button secondary" data-picker-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>Anterior</button>
      <span>Página ${page} de ${pages}</span>
      <button type="button" class="button secondary" data-picker-page="${page + 1}"${page >= pages ? ' disabled' : ''}>Siguiente</button>${closeButton}</div>`);
}

export function conditionsDialog(site) {
  const rows = Object.values(CONDITIONS).map(([label, values]) => [label, esc(values.join(', '))]);
  return dialog('Catálogo guardado del sitio', 'Condiciones del sitio', `<p class="muted">${esc(siteLabel(sitesById.get(site)))}</p>
    ${table('Condiciones guardadas', ['Condición', 'Opciones del ejemplo'], rows)}<div class="actions">${closeButton}</div>`);
}

export function listImportDialog() {
  return dialog('Precios propuestos', 'Cargar Excel', `<form id="list-import-form">
    <p class="muted">Usa el Excel de la demo y modifica la columna Principal del restaurante de referencia.</p>
    <div class="upload-box"><label class="field">Excel modificado (.xlsx)<input name="workbook" type="file" accept=".xlsx" required></label>
      <button type="submit" class="button primary">Cargar productos</button></div>
    <p class="feedback error" role="alert" data-import-error hidden></p></form>`);
}
