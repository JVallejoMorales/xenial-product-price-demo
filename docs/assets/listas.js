import { CATALOG_DATE, PRODUCTS, SITES, count, formatDate, money, parseAmount, priceKey, selectProducts, siteLabel } from './modelo.js';
import { action, esc, option, sectionHeading, table } from './vistas.js';

export const CONDITIONS = {
  source: ['Origen del pedido', ['Mostrador', 'App de la casa', 'Pedido directo']],
  destination: ['Destino del pedido', ['Consumo en el sitio', 'Para llevar', 'Entrega']],
  period: ['Periodos de tiempo', ['Mañana', 'Mediodía', 'Tarde']],
  point: ['Puntos de precio', ['Regular', 'Temporada']],
};

export function newList() {
  const conditions = Object.fromEntries(Object.keys(CONDITIONS).map((key) => [key, { mode: 'pending', values: [] }]));
  return { id: null, name: '', purpose: 'draft', date: '', policy: 'new', notes: '', products: {}, targets: [], conditions };
}

export function listReview(model, catalogue, site, mode) {
  const productIds = Object.keys(model.products);
  const pendingConditions = Object.values(model.conditions).filter(({ mode, values }) => mode === 'pending' || (mode === 'selected' && !values.length)).length;
  const targets = mode === 'single' ? [site] : model.targets;
  return {
    pendingConditions,
    rows: targets.map((target) => {
      const products = productIds.map((id) => {
        const proposed = parseAmount(model.products[id]);
        const base = catalogue.get(priceKey(target, id, 'principal'));
        return { id, base, proposed, state: proposed == null ? 'Pendiente' : base === undefined ? 'Sin referencia' : 'Preparado' };
      });
      return {
        target, products, ready: products.filter(({ state }) => state === 'Preparado').length,
        pending: products.filter(({ state }) => state === 'Pendiente').length,
        blocked: products.filter(({ state }) => state === 'Sin referencia').length,
      };
    }),
  };
}

function scopeButtons(mode) {
  return `<div class="actions list-mode" role="group" aria-label="Alcance de la lista">
    ${[['single', 'Un sitio'], ['multi', 'Varios sitios']].map(([key, label]) =>
      `<button type="button" class="button ${key === mode ? 'primary' : 'secondary'}" data-list-mode="${key}" aria-pressed="${key === mode}">${label}</button>`).join('')}
  </div>`;
}

function sitePanel(state) {
  const site = SITES.find(({ id }) => id === state.site);
  return `<div class="list-context"><p><span class="badge">${state.mode === 'single' ? 'Sitio' : 'Catálogo de referencia'}</span> <strong>${siteLabel(site)}</strong></p>
    <p class="muted">Catálogo guardado del ${formatDate(CATALOG_DATE + 'T15:00:00Z')}</p></div>
    <section class="panel list-site-panel">
      <label class="field">${state.mode === 'single' ? 'Sitio de la lista' : 'Sitio de referencia'}<select name="list-site">${SITES.map((site) =>
        option(site.id, siteLabel(site), state.site)).join('')}</select></label>
      <p class="small muted">Los productos se eligen del catálogo del restaurante seleccionado.</p>
      ${action('list-conditions', 'Consultar condiciones del sitio')}
    </section>`;
}

function versions(saved, selected) {
  if (!saved) return '';
  return `<label class="field versions">Versiones guardadas<select name="list-version">
    ${saved.versions.map((version, index) => option(index, 'Versión ' + (index + 1) + ' · ' + formatDate(version.at), selected)).reverse().join('')}
  </select></label>`;
}

function conditionFields(model) {
  const pending = Object.values(model.conditions).filter(({ mode, values }) => mode === 'pending' || (mode === 'selected' && !values.length)).length;
  const groups = Object.entries(CONDITIONS).map(([key, [label, choices]]) => {
    const state = model.conditions[key];
    const selects = [['pending', 'Por definir'], ['all', 'Todos · este sitio'], ['selected', 'Seleccionar opciones']];
    const options = selects.map(([value, name]) => option(value, name, state.mode)).join('');
    return `<div><label class="field">${label}<select data-condition="${key}">${options}</select></label>
      ${state.mode === 'selected' ? `<div class="check-grid" role="group" aria-label="${label}">${choices.map((choice) =>
        `<label><input type="checkbox" data-condition-value="${key}" value="${esc(choice)}"${state.values.includes(choice) ? ' checked' : ''}>${choice}</label>`).join('')}</div>` : ''}
    </div>`;
  });
  return `<details class="conditions"${Object.values(model.conditions).some(({ mode }) => mode !== 'pending') ? ' open' : ''}>
    <summary>Aplicación de la lista <small>${pending} ${pending === 1 ? 'condición por definir' : 'condiciones por definir'}</small></summary>
    <p class="small muted">Elige las condiciones del borrador. Puedes dejar decisiones por definir.</p>
    <div class="condition-grid">${groups.join('')}</div>
  </details>`;
}

function destinationFields(model) {
  return `<div class="destination-block"><h3>Destinos de la lista <span class="badge">${model.targets.length} sitios</span></h3>
    <div class="check-grid" role="group" aria-label="Restaurantes de destino">${SITES.map((site) =>
      `<label><input type="checkbox" data-list-target value="${site.id}"${model.targets.includes(site.id) ? ' checked' : ''}>${siteLabel(site)}</label>`).join('')}</div>
  </div>`;
}

function productSection(model, state, catalogue) {
  const selected = PRODUCTS.filter(({ id }) => Object.hasOwn(model.products, id));
  const title = `Productos <span class="badge">${count(selected.length)}</span>`;
  const actions = action('list-import', 'Cargar Excel') + action('list-add-products', '+ Añadir productos');
  return `<section class="panel">${sectionHeading(title, { kicker: 'Precios propuestos · COP', actions })}
    ${selected.length ? table('Productos del borrador', ['Producto / PLU', 'Base guardada', 'Precio propuesto', 'Acción'],
      selected.map((product) => [`${esc(product.name)}<small>${product.id}</small>`, money(catalogue.get(priceKey(state.site, product.id, 'principal'))),
        `<input class="amount-input" type="text" inputmode="numeric" pattern="[0-9]{1,12}" maxlength="12" value="${esc(model.products[product.id])}" data-list-price="${product.id}" aria-label="Precio propuesto de ${esc(product.name)}" placeholder="Por definir">`,
        `<button type="button" class="text-link" data-list-remove="${product.id}">Quitar</button>`]), { className: 'list-grid' })
      : `<div class="feedback"><p>Agrega productos del sitio seleccionado para empezar.</p>${action('list-sample', 'Usar dos productos de ejemplo')}</div>`}
    <p class="small muted table-note">Deja la celda vacía si el precio sigue por definir. Puedes proponer cero.</p>
  </section>`;
}

function reviewSection(state) {
  const review = state.review;
  const title = state.mode === 'single' ? 'Revisión del borrador' : 'Revisión por sitio';
  let body = '<p class="small muted">Puedes guardar el borrador aunque falten precios o condiciones.</p>';
  if (review && !review.rows.length) body = '<p class="feedback error">Selecciona los restaurantes de destino.</p>';
  else if (review) body = `<p class="feedback">${review.pendingConditions} condiciones por definir.</p>${
    table(title, ['Sitio', 'Preparados', 'Pendientes', 'Bloqueados'], review.rows.map(({ target, ready, pending, blocked }) =>
      [siteLabel(SITES.find(({ id }) => id === target)), count(ready), count(pending), count(blocked)]))}`;
  return `<section class="panel">${sectionHeading(title, { actions: action('list-review', state.mode === 'single' ? 'Revisar' : 'Revisar destinos') })}${body}</section>`;
}

function editor(state, catalogue, saved) {
  const model = state.model;
  const readOnly = saved && state.version !== saved.versions.length - 1;
  return `<form class="list-editor" id="list-editor">
    <section class="panel">
      ${sectionHeading(model.id ? esc(model.name) : state.mode === 'single' ? 'Nueva lista' : 'Nueva lista compartida',
      { kicker: 'Configuración de la lista', actions: `<span class="badge">${readOnly ? 'Versión anterior' : state.dirty || !model.id ? 'Sin guardar' : 'Borrador guardado'}</span>` })}
      ${readOnly ? '<p class="feedback">Estás consultando una versión anterior.</p>' : ''}
      <fieldset${readOnly ? ' disabled' : ''}>
        <div class="list-form-fields">
          <label class="field">Nombre de la lista<input name="name" required maxlength="80" placeholder="Ej. Carta de temporada" value="${esc(model.name)}"></label>
          <label class="field">Uso de la lista<select name="purpose">${option('draft', 'Preparación comercial', model.purpose)}${option('test', 'Prueba en demo', model.purpose)}</select></label>
          <label class="field">Fecha de aplicación<input type="date" name="date" value="${esc(model.date)}"></label>
        </div>
        <label class="field">Tratamiento de las reglas<select name="policy">
          ${option('new', 'Crear reglas nuevas', model.policy)}${option('reuse', 'Reutilizar reglas compatibles', model.policy)}
        </select></label>
        ${conditionFields(model)}
        <label class="field">Notas<textarea name="notes" rows="2" maxlength="500" placeholder="Objetivo de la lista o decisiones por confirmar">${esc(model.notes)}</textarea></label>
        ${state.mode === 'multi' ? destinationFields(model) : ''}
      </fieldset>
    </section>
    <fieldset${readOnly ? ' disabled' : ''}>${productSection(model, state, catalogue)}</fieldset>
    <fieldset${readOnly ? ' disabled' : ''}>${reviewSection(state)}</fieldset>
    <section class="panel list-save">
      <div><strong>${readOnly ? 'Versión guardada' : state.dirty || !model.id ? 'Cambios sin guardar' : 'Borrador guardado'}</strong>
        <p class="small muted">Cada guardado conserva una versión del borrador.</p></div>
      ${readOnly ? '' : `<div class="actions">${action('list-discard', 'Descartar cambios')}
        <button type="submit" class="button primary">Guardar borrador</button></div>`}
    </section>
    ${versions(saved, state.version)}
  </form>`;
}

export function listView(state, catalogue) {
  const key = state.mode === 'single' ? state.site : 'multi';
  const lists = state.saved.filter((item) => item.context === key);
  const current = lists.find(({ id }) => id === state.model?.id);
  const saved = lists.map((list) => {
    const last = list.versions.at(-1);
    return `<button class="saved-list" type="button" data-list-open="${list.id}" aria-pressed="${list === current}">
      <strong>${esc(last.model.name)}</strong><span>${count(Object.keys(last.model.products).length)} productos · ${list.versions.length} ${list.versions.length === 1 ? 'versión' : 'versiones'}</span>
    </button>`;
  }).join('');
  const welcome = `<section class="panel list-welcome">
    ${sectionHeading(state.mode === 'single' ? 'Prepara una lista de precios' : 'Define la lista una sola vez', { kicker: state.mode === 'single' ? 'De la idea a la lista' : 'Preparación masiva' })}
    <p>Elige productos y define un precio por producto. ${state.mode === 'multi' ? 'Selecciona los restaurantes que compartirán la lista.' : 'Puedes dejar importes pendientes.'}</p>
    ${action('list-new', 'Crear una lista', { primary: true })}
    <p class="small muted">Las listas se guardan como borradores de esta sesión.</p>
  </section>`;
  return `${scopeButtons(state.mode)}${sitePanel(state)}
    ${state.message ? `<p class="feedback" role="status">${esc(state.message)}</p>` : ''}
    <div class="list-layout">
      <aside class="panel saved-lists" aria-label="Listas guardadas">
        ${sectionHeading(state.mode === 'single' ? 'Tus listas' : 'Listas compartidas', { actions: `<span class="badge">${lists.length}</span>` })}
        ${action('list-new', state.mode === 'single' ? '+ Nueva lista' : '+ Nueva lista compartida', { primary: true })}
        <div class="saved-list-entries">${saved}</div>
        <p class="small muted sidebar-note">Abre una lista para revisar sus versiones.</p>
      </aside>
      ${state.model ? editor(state, catalogue, current) : welcome}
    </div>`;
}

export function pickerRows(catalogue, site, model, query, page) {
  return selectProducts(query).slice((page - 1) * 25, page * 25).map((product) => [`${esc(product.name)}<small>${product.id}</small>`,
    money(catalogue.get(priceKey(site, product.id, 'principal'))),
    `<button class="button secondary compact" type="button" data-picker-product="${product.id}"${Object.hasOwn(model.products, product.id) ? ' disabled' : ''}>${Object.hasOwn(model.products, product.id) ? 'Añadido' : 'Añadir'}</button>`]);
}
