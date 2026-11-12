import { CATEGORIES, DEFAULT_FILTERS, SITES, applyPlan, createCatalogue, examplePlan, identity, money, planCsv, restoreLot, reviewPlan } from './modelo.js';
import { ROUTES, catalogueView, historyView, planView, projectView } from './vistas.js';

const page = document.querySelector('#contenido');
const dialog = document.querySelector('#price-dialog');
const priceForm = document.querySelector('#price-form');
const input = document.querySelector('#price-input');
const announcement = document.querySelector('#announcement');

let catalogue = createCatalogue();
let draft = examplePlan(catalogue);
let preview = null;
let filters = { ...DEFAULT_FILTERS };
let editingKey = null;
let notice = null;
const lots = [];

function route() {
  const id = location.hash.slice(1);
  return Object.hasOwn(ROUTES, id) ? id : 'catalogo';
}

let activeRoute = route();

function render() {
  for (const link of document.querySelectorAll('.nav a')) {
    if (link.hash === '#' + activeRoute) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const count = document.querySelector('#plan-count');
  count.textContent = draft.size;
  count.hidden = !draft.size;
  if (activeRoute === 'plan') page.innerHTML = planView(draft, preview, notice);
  else if (activeRoute === 'historial') page.innerHTML = historyView(lots, notice);
  else if (activeRoute === 'proyecto') page.innerHTML = projectView();
  else page.innerHTML = catalogueView(catalogue, draft, filters);
  document.title = `${ROUTES[activeRoute]} · Mesa de Precios`;
}

function announce(text, error = false) {
  notice = { text, error };
  announcement.textContent = text;
}

function editPrice(key) {
  const current = catalogue.get(key);
  if (current === undefined) return;
  const { site, product, list } = identity(key);
  editingKey = key;
  document.querySelector('#edit-title').textContent = `Proponer precio · ${product.name}`;
  document.querySelector('#edit-context').textContent = `${product.id} · ${site.name} · ${list.name}`;
  document.querySelector('#edit-original').textContent = money(current);
  input.value = String(draft.get(key)?.to ?? current);
  input.setCustomValidity('');
  dialog.showModal();
  input.select();
}

function downloadPlan() {
  const blob = new Blob([planCsv([...draft.values()])], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mesa-de-precios-plan.csv';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  announcement.textContent = 'CSV del plan preparado.';
}

function applyDraft() {
  const result = applyPlan(catalogue, draft, preview);
  if (result.error) {
    announce(result.error, true);
    preview = null;
    return;
  }
  catalogue = result.catalogue;
  const lot = { id: `MP-${String(lots.length + 1).padStart(3, '0')}`, rows: result.rows, at: new Date().toISOString() };
  lots.push(lot);
  draft.clear();
  preview = null;
  announce(`Lote ${lot.id} aplicado y verificado en el catálogo ficticio.`);
  location.hash = 'historial';
}

function restoreLast() {
  const lot = lots.findLast((item) => !item.restoration);
  const result = restoreLot(catalogue, lot);
  if (result.error) {
    announce(result.error, true);
    return;
  }
  catalogue = result.catalogue;
  lot.restoration = { at: new Date().toISOString(), observed: result.observed };
  preview = null;
  announce(`Lote ${lot.id} restaurado y verificado en el catálogo ficticio.`);
}

input.addEventListener('input', () => input.setCustomValidity(''));
document.querySelector('#cancel-edit').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { editingKey = null; });
priceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const key = editingKey;
  const current = catalogue.get(key);
  const target = input.valueAsNumber;
  if (current === undefined || !Number.isSafeInteger(target) || target <= 0 || target === current) {
    input.setCustomValidity(target === current ? 'Ingresa un precio distinto al vigente.' : 'Ingresa un precio entero positivo.');
    input.reportValidity();
    return;
  }
  draft.set(key, { key, from: current, to: target });
  preview = null;
  notice = null;
  dialog.close();
  render();
  page.querySelector(`[data-edit="${key}"]`)?.focus({ preventScroll: true });
  announcement.textContent = 'Propuesta guardada en el plan.';
});

page.addEventListener('submit', (event) => {
  if (event.target.id !== 'scope-form') return;
  event.preventDefault();
  const fields = new FormData(event.target);
  const site = fields.get('site');
  const category = fields.get('category');
  filters = {
    site: SITES.some(({ id }) => id === site) ? site : DEFAULT_FILTERS.site,
    category: CATEGORIES.includes(category) ? category : '',
    search: String(fields.get('search') ?? '').slice(0, 80),
  };
  render();
  page.querySelector('#scope-form button').focus({ preventScroll: true });
});

page.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const { edit, remove, action } = button.dataset;
  if (edit) {
    editPrice(edit);
    return;
  }
  if (action === 'csv') {
    downloadPlan();
    return;
  }
  notice = null;
  if (remove) {
    draft.delete(remove);
    preview = null;
  } else if (action === 'clear') {
    draft.clear();
    preview = null;
  } else if (action === 'example') {
    draft = examplePlan(catalogue);
    preview = null;
  } else if (action === 'simulate') {
    preview = reviewPlan(catalogue, draft);
    announcement.textContent = preview.ready ? 'Simulación aprobada.' : 'Revisión necesaria.';
  } else if (action === 'apply') {
    applyDraft();
  } else if (action === 'restore') {
    restoreLast();
  } else return;
  render();
  (page.querySelector(`[data-action="${action}"]:enabled`) ?? page).focus({ preventScroll: true });
});

window.addEventListener('hashchange', () => {
  if (location.hash === '#contenido') return;
  if (dialog.open) dialog.close();
  activeRoute = route();
  render();
  window.scrollTo(0, 0);
  page.focus({ preventScroll: true });
});

document.querySelector('#portfolio-return').hidden = !['localhost', '127.0.0.1'].includes(location.hostname);
render();
