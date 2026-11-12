import {
  CATALOG_DATE, LISTS, ORIGINS, PRODUCTS, SITES, STATUSES, applyPlan, createCatalogue, csv, examplePlan,
  formatTime, identity, money, parseAmount, planCsv, priceKey, restoreLot, reviewPlan, seedAudit,
} from './modelo.js';
import { buildWorkbook, compareWorkbook } from './excel.js';
import { ROUTES, auditMatches, catalogueView, excelView, historyView, icon, planView, projectView } from './vistas.js';
import { listReview, listView, newList } from './listas.js';
import { auditDialog, batchDialog, companionDialog, conditionsDialog, listImportDialog, pickerDialog, rulesDialog } from './dialogos.js';

const main = document.querySelector('#contenido');
const view = document.querySelector('#view');
const title = document.querySelector('#page-title');
const navigation = document.querySelector('.nav');
const announcement = document.querySelector('#announcement');
const priceDialog = document.querySelector('#price-dialog');
const priceForm = document.querySelector('#price-form');
const workflow = document.querySelector('#workflow-dialog');
const workflowContent = document.querySelector('#workflow-content');

const catalogueDefaults = { site: SITES[0].id, siteSearch: '', search: '', page: 1, size: 25 };
const auditDefaults = { site: '', siteSearch: '', search: '', start: '', end: '', list: '', origin: '', status: '', page: 1, size: 10 };
let catalogueFilters = { ...catalogueDefaults };
let auditFilters = { ...auditDefaults };
let catalogue = createCatalogue();
const sampleRecords = seedAudit(catalogue);
const lots = [];
let revision = 0;
let draft = new Map();
const pendingPlan = () => ({ ...reviewPlan(catalogue, draft), ready: false });
let planReview = pendingPlan();
let notice;
let auditNotice;
let auditUpdated;
let refreshed;
let book;
let selectedFile;
let fileState;
let batch;
let editing;
let priceTrigger;
let workflowState;
let workflowTrigger;
let listSequence = 1;

const savedSample = {
  ...newList(), id: 'MP-L1', name: 'Carta de temporada',
  products: { [PRODUCTS[0].id]: '14900', [PRODUCTS[5].id]: '' },
};
const lists = {
  mode: 'single', site: SITES[0].id, model: null, version: -1, dirty: false, review: null,
  saved: [{ id: savedSample.id, context: SITES[0].id, versions: [{ model: savedSample, at: CATALOG_DATE + 'T15:00:00Z' }] }],
};
const announce = (message) => { announcement.textContent = message; };
const now = () => new Date().toISOString();
const currentRoute = () => Object.hasOwn(ROUTES, location.hash.slice(1)) ? location.hash.slice(1) : 'excel';
let route = currentRoute();

function auditRecords() {
  const additions = [];
  for (const lot of lots) {
    lot.rows.forEach((line, index) => {
      const id = lot.id + '-' + (index + 1);
      additions.push({ ...line, id, lotId: lot.id, at: lot.at, maker: lot.maker, reason: lot.reason,
        origin: lot.origin, status: 'applied', reversed: Boolean(lot.restoration) });
      if (lot.restoration) {
        additions.push({ key: line.key, id: id + '-R', lotId: lot.id, at: lot.restoration.at, maker: lot.maker,
          reason: 'Restauración del precio de referencia', origin: lot.origin, status: 'reverted',
          from: line.observed, to: line.from, observed: lot.restoration.observed[index] });
      }
    });
  }
  return [...additions, ...sampleRecords];
}

const activeLot = () => lots.findLast((lot) => !lot.restoration);
const listEntry = () => lists.saved.find(({ id }) => id === lists.model?.id);
const listReadOnly = () => {
  const entry = listEntry();
  return entry && lists.version !== entry.versions.length - 1;
};

function replace(container, content, control) {
  const name = control?.name;
  const controlId = control?.id;
  const start = control?.selectionStart;
  const end = control?.selectionEnd;
  const scrollLeft = container.querySelector('.table-wrap')?.scrollLeft ?? 0;
  container.innerHTML = content;
  const table = container.querySelector('.table-wrap');
  if (table) table.scrollLeft = scrollLeft;
  const field = controlId ? container.querySelector('#' + CSS.escape(controlId))
    : name ? container.querySelector('[name="' + CSS.escape(name) + '"]') : null;
  if (field) {
    field.focus({ preventScroll: true });
    if (start != null && end != null) field.setSelectionRange(start, end);
  }
}

function renderPage(control) {
  const [name, description] = ROUTES[route];
  const currentNavigation = route === 'plan' ? 'catalogo' : route;
  for (const link of navigation.querySelectorAll('a')) {
    if (link.hash === '#' + currentNavigation) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  title.innerHTML = `<p class="eyebrow">Nube y Grano · Mesa de Precios</p><h1>${name}</h1><p class="lede">${description}</p>`;
  let content;
  if (route === 'catalogo') content = catalogueView(catalogue, draft, catalogueFilters, refreshed, batch);
  else if (route === 'historial') content = historyView(auditRecords(), auditFilters, auditNotice, auditUpdated);
  else if (route === 'listas') content = listView(lists, catalogue);
  else if (route === 'plan') content = planView(draft, planReview, notice);
  else if (route === 'proyecto') content = projectView();
  else {
    if (fileState?.draft && fileState.revision !== revision) {
      fileState.review = reviewPlan(catalogue, fileState.draft);
      fileState.revision = revision;
    }
    content = excelView(fileState, book && { stale: book.revision !== revision }, SITES.length * PRODUCTS.length, selectedFile);
  }
  replace(view, content, control);
  document.title = name + ' · Mesa de Precios';
}

function renderWorkflow(control) {
  const { kind, ...context } = workflowState;
  let content;
  if (kind === 'batch') content = batchDialog(batch, catalogue);
  else if (kind === 'audit') {
    const record = auditRecords().find(({ id }) => id === context.id);
    content = auditDialog(record, record.status === 'applied' && Boolean(record.lotId && record.lotId === activeLot()?.id));
  } else if (kind === 'rules') content = rulesDialog(context.site, context.product, catalogue);
  else if (kind === 'companions') content = companionDialog(context, catalogue);
  else if (kind === 'picker') content = pickerDialog(catalogue, lists, context.search, context.page);
  else if (kind === 'conditions') content = conditionsDialog(lists.site);
  else content = listImportDialog();
  workflow.classList.toggle('wide-dialog', kind === 'batch');
  replace(workflowContent, content, control);
}

function showWorkflow(next, trigger) {
  workflowState = next;
  renderWorkflow();
  if (!workflow.open) {
    workflowTrigger = trigger;
    workflow.showModal();
  }
}

function go(next) {
  if (location.hash === '#' + next) renderPage();
  else location.hash = next;
}

function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadWorkbook() {
  download(book.bytes, 'mesa-de-precios.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

function commit(changes, review, terms, origin) {
  const result = applyPlan(catalogue, changes, review);
  if (result.error) return result;
  catalogue = result.catalogue;
  revision += 1;
  planReview = pendingPlan();
  const id = 'MP-' + String(lots.length + 1).padStart(3, '0');
  lots.push({ ...terms, id, origin, rows: result.rows, at: now() });
  const message = 'Lote ' + id + ' aplicado y verificado en la demo.';
  announce(message);
  auditUpdated = now();
  auditNotice = { text: message };
  return { message };
}

function getTerms(form) {
  const fields = new FormData(form);
  const maker = String(fields.get('maker')).trim();
  const reason = String(fields.get('reason')).trim();
  const empty = !maker ? 'maker' : !reason ? 'reason' : null;
  if (empty) {
    const field = form.elements.namedItem(empty);
    field.setCustomValidity('Completa este campo.');
    field.reportValidity();
    return null;
  }
  return { maker, reason };
}

function openPrice(key, trigger) {
  const current = catalogue.get(key);
  if (current === undefined) return;
  const { product, site, list } = identity(key);
  editing = { key, from: current };
  priceTrigger = trigger;
  priceForm.reset();
  document.querySelector('#edit-context').textContent = product.name + ' · ' + product.id + ' · ' + site.name + ' · ' + list.name;
  document.querySelector('#edit-original').textContent = money(current);
  document.querySelector('#edit-feedback').hidden = true;
  priceDialog.showModal();
}

function applyIndividual(event) {
  event.preventDefault();
  const terms = getTerms(priceForm);
  if (!terms) return;
  const to = parseAmount(priceForm.elements.price.value);
  const changes = new Map([[editing.key, { ...editing, to }]]);
  const review = reviewPlan(catalogue, changes);
  const result = review.ready ? commit(changes, review, terms, ORIGINS[0]) : { error: review.rows[0].error };
  const feedback = document.querySelector('#edit-feedback');
  feedback.textContent = result.error ?? '';
  feedback.hidden = !result.error;
  if (!result.error) {
    draft.delete(editing.key);
    planReview = pendingPlan();
    priceDialog.close();
    renderPage();
  }
}

async function readExcel(file) {
  if (!file || !/\.xlsx$/i.test(file.name) || file.size > 3 * 1024 * 1024) throw new Error('Selecciona un Excel .xlsx exportado desde la demo, de hasta 3 MB.');
  return compareWorkbook(await file.arrayBuffer());
}

async function loadWorkbook() {
  const file = selectedFile;
  const loading = { message: 'Comparando los precios del Excel…', loading: true };
  fileState = loading;
  renderPage();
  try {
    const changes = await readExcel(file);
    if (fileState !== loading || file !== selectedFile) return;
    const review = reviewPlan(catalogue, changes);
    fileState = { draft: changes, review, revision, message: changes.size ? 'Revisa los precios comparados en la matriz.' : 'El Excel no contiene cambios de precio.' };
  } catch (error) {
    if (fileState !== loading || file !== selectedFile) return;
    fileState = { error: true, message: error.message };
  }
  if (route === 'excel') renderPage();
  announce(fileState.message);
}

async function importList(form) {
  const model = lists.model;
  const file = form.elements.workbook.files[0];
  const errorBox = form.querySelector('[data-import-error]');
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const changes = await readExcel(file);
    if (!form.isConnected || !workflow.open || lists.model !== model) return;
    const matched = [...changes.values()].filter(({ key }) => {
      const { site, list } = identity(key);
      return site.id === lists.site && list.id === 'principal';
    });
    if (!matched.length) throw new Error('El Excel no contiene precios nuevos en Principal para el sitio de referencia.');
    for (const line of matched) model.products[identity(line.key).product.id] = String(line.to);
    markListDirty();
    lists.message = matched.length + ' productos cargados del Excel.';
    workflow.close();
    renderPage();
  } catch (error) {
    if (form.isConnected) {
      errorBox.hidden = false;
      errorBox.textContent = error.message;
    }
  } finally {
    if (form.isConnected) button.disabled = false;
  }
}

function markListDirty() {
  lists.dirty = true;
  lists.review = null;
  lists.message = '';
}

function discardListEdits() {
  return !lists.dirty || window.confirm('¿Descartar los cambios sin guardar del borrador?');
}

function loadList(entry, version = entry.versions.length - 1) {
  lists.model = structuredClone(entry.versions[version].model);
  lists.version = version;
  lists.review = null;
  lists.dirty = false;
  lists.message = '';
}

function saveList() {
  if (listReadOnly() || !lists.model) return;
  const model = lists.model;
  model.name = model.name.trim();
  if (!model.name) {
    const field = view.querySelector('input[name="name"]');
    field.setCustomValidity('Escribe un nombre para la lista.');
    field.reportValidity();
    return;
  }
  let entry = listEntry();
  if (!entry) {
    model.id = 'MP-L' + (++listSequence);
    entry = { id: model.id, context: lists.mode === 'single' ? lists.site : 'multi', versions: [] };
    lists.saved.push(entry);
  }
  entry.versions.push({ model: structuredClone(model), at: now() });
  loadList(entry);
  lists.message = 'Borrador guardado · versión ' + entry.versions.length + '.';
  announce(lists.message);
  renderPage();
}

function toggle(values, value, selected) {
  return selected ? [...new Set([...values, value])] : values.filter((item) => item !== value);
}

function updateFilters(control) {
  const form = control.closest('[data-filter]');
  if (!form) return false;
  const filters = form.dataset.filter === 'catalogo' ? catalogueFilters : auditFilters;
  if (Object.hasOwn(filters, control.name)) {
    filters[control.name] = control.value;
    filters.page = 1;
    renderPage(control);
  }
  return true;
}

function changeListControl(control) {
  if (control.name === 'list-site') {
    if (discardListEdits()) {
      lists.site = control.value;
      Object.assign(lists, { model: null, version: -1, review: null, dirty: false, message: '' });
    }
    renderPage(control);
  } else if (control.name === 'list-version') {
    const entry = listEntry();
    if (entry && discardListEdits()) loadList(entry, Number(control.value));
    renderPage(control);
  } else if (control.dataset.condition) {
    const condition = lists.model.conditions[control.dataset.condition];
    condition.mode = control.value;
    markListDirty();
    renderPage();
  } else if (control.dataset.conditionValue) {
    const condition = lists.model.conditions[control.dataset.conditionValue];
    condition.values = toggle(condition.values, control.value, control.checked);
    markListDirty();
  } else if ('listTarget' in control.dataset) {
    lists.model.targets = toggle(lists.model.targets, control.value, control.checked);
    markListDirty();
    renderPage();
  } else if (control.closest('#list-editor') && ['purpose', 'policy', 'date'].includes(control.name)) {
    lists.model[control.name] = control.value;
    markListDirty();
  }
}

function readBatchScope() {
  const sites = new Set(batch.sites);
  const lists = new Set(batch.lists);
  batch.lines = new Map([...batch.lines].filter(([key]) => {
    const { site, product, list } = identity(key);
    return sites.has(site.id) && lists.has(list.id) && batch.products.includes(product.id);
  }));
  batch.phase = 'edit';
  batch.message = '';
  renderWorkflow();
}

function assignBatch() {
  const amounts = [];
  for (const id of batch.products) {
    for (const list of batch.lists) {
      const value = batch.matrix.get(id + '/' + list)?.trim();
      if (!value) continue;
      const amount = parseAmount(value);
      if (amount == null) {
        batch.message = 'Ingresa importes enteros en COP.';
        renderWorkflow();
        return;
      }
      amounts.push([id, list, amount]);
    }
  }
  let assigned = 0;
  for (const [id, list, to] of amounts) {
    for (const site of batch.sites) {
      const key = priceKey(site, id, list);
      const from = catalogue.get(key);
      if (from !== undefined) {
        batch.lines.set(key, { key, from, to });
        assigned += 1;
      }
    }
  }
  batch.message = assigned ? assigned + ' importes asignados.' : 'Escribe al menos un precio para una regla disponible.';
  renderWorkflow();
}

function startBatch(product, trigger) {
  batch ??= { phase: 'scope', products: [], lists: ['principal'], sites: [], matrix: new Map(), lines: new Map() };
  if (!batch.products.includes(product)) {
    batch.products.push(product);
    batch.phase = 'scope';
  }
  showWorkflow({ kind: 'batch' }, trigger);
  renderPage();
  workflowTrigger = view.querySelector('[data-batch-product="' + product + '"]');
}

function restoreSelected() {
  const lot = activeLot();
  const record = auditRecords().find(({ id }) => id === workflowState.id);
  if (!lot || record?.lotId !== lot.id) return;
  const result = restoreLot(catalogue, lot);
  if (result.error) {
    auditNotice = { text: result.error, error: true };
  } else {
    catalogue = result.catalogue;
    revision += 1;
    planReview = pendingPlan();
    lot.restoration = { at: now(), observed: result.observed };
    auditUpdated = now();
    auditNotice = { text: 'Lote ' + lot.id + ' restaurado y verificado.' };
  }
  announce(auditNotice.text);
  workflow.close();
  renderPage();
}

const actions = {
  'export-workbook': () => {
    book = { bytes: buildWorkbook(catalogue), revision };
    downloadWorkbook();
    renderPage();
  },
  'download-workbook': downloadWorkbook,
  'clear-workbook': () => { selectedFile = null; fileState = null; renderPage(); },
  'refresh-catalogue': () => { refreshed = now(); announce('Catálogo actualizado.'); renderPage(); },
  'refresh-sites': () => {
    refreshed = now();
    if (route === 'historial') auditUpdated = refreshed;
    announce('Sitios actualizados.');
    renderPage();
  },
  'clear-catalogue': () => { catalogueFilters = { ...catalogueFilters, search: '', siteSearch: '', page: 1 }; renderPage(); },
  'clear-audit': () => { auditFilters = { ...auditDefaults, site: auditFilters.site, siteSearch: auditFilters.siteSearch, size: auditFilters.size }; renderPage(); },
  'refresh-audit': () => { auditUpdated = now(); announce('Historial actualizado.'); renderPage(); },
  'export-audit': () => {
    const data = auditMatches(auditRecords(), auditFilters).map((record) => {
      const { site, product, list } = identity(record.key);
      return [record.id, formatTime(record.at), product.id, product.name, site.name, list.name,
        record.from, record.to, record.observed, record.maker, record.origin, STATUSES[record.status], record.reason];
    });
    download(csv(['ID', 'Fecha y hora', 'PLU', 'Producto', 'Restaurante', 'Lista', 'Precio anterior', 'Propuesto', 'Verificado', 'Responsable', 'Origen', 'Resultado', 'Motivo'], data),
      'mesa-de-precios-auditoria.csv', 'text/csv;charset=utf-8');
  },
  'export-plan': () => download(planCsv([...draft.values()]), 'mesa-de-precios-plan.csv', 'text/csv;charset=utf-8'),
  example: () => { draft = examplePlan(catalogue); planReview = pendingPlan(); renderPage(); },
  'review-plan': () => { planReview = reviewPlan(catalogue, draft); renderPage(); },
  'continue-batch': (trigger) => showWorkflow({ kind: 'batch' }, trigger),
  'browse-batch': () => { workflow.close(); go('catalogo'); },
  'batch-all-lists': () => { batch.lists = LISTS.map(({ id }) => id); renderWorkflow(); },
  'batch-clear-lists': () => { batch.lists = []; renderWorkflow(); },
  'batch-read': readBatchScope,
  'batch-scope': () => { batch.phase = 'scope'; batch.message = ''; renderWorkflow(); },
  'batch-assign': assignBatch,
  'batch-review': () => {
    batch.review = reviewPlan(catalogue, batch.lines);
    batch.phase = batch.lines.size ? 'review' : 'edit';
    batch.message = batch.lines.size ? '' : 'Asigna al menos un precio para comparar.';
    renderWorkflow();
  },
  'batch-edit': () => { batch.phase = 'edit'; batch.message = ''; renderWorkflow(); },
  'restore-lot': restoreSelected,
  'list-new': () => {
    if (!discardListEdits()) return;
    Object.assign(lists, { model: newList(), dirty: false, review: null, version: -1, message: '' });
    renderPage();
  },
  'list-conditions': (trigger) => showWorkflow({ kind: 'conditions' }, trigger),
  'list-add-products': (trigger) => showWorkflow({ kind: 'picker', search: '', page: 1 }, trigger),
  'list-import': (trigger) => showWorkflow({ kind: 'list-import' }, trigger),
  'list-sample': () => {
    for (const product of PRODUCTS.slice(0, 2)) lists.model.products[product.id] ??= '';
    markListDirty();
    renderPage();
  },
  'list-review': () => { lists.review = listReview(lists.model, catalogue, lists.site, lists.mode); renderPage(); },
  'list-discard': () => {
    if (!discardListEdits()) return;
    const entry = listEntry();
    if (entry) loadList(entry);
    else Object.assign(lists, { model: null, dirty: false, review: null, version: -1, message: '' });
    renderPage();
  },
};

function submitChanges(form) {
  const terms = getTerms(form);
  if (!terms) return;
  const id = form.id;
  if (id === 'apply-batch-form') {
    const result = commit(batch.lines, batch.review, terms, ORIGINS[1]);
    if (result.error) {
      batch.message = result.error;
      renderWorkflow();
    } else {
      batch = null;
      workflow.close();
      auditFilters = { ...auditDefaults };
      go('historial');
    }
  } else if (id === 'apply-workbook-form') {
    const result = commit(fileState.draft, fileState.review, terms, ORIGINS[2]);
    fileState = result.error ? { ...fileState, error: true, message: result.error } : { applied: true, message: result.message };
    if (!result.error) selectedFile = null;
    renderPage();
  } else {
    const result = commit(draft, planReview, terms, ORIGINS[1]);
    if (result.error) {
      notice = { text: result.error, error: true };
      planReview = pendingPlan();
      renderPage();
    } else {
      draft.clear();
      planReview = pendingPlan();
      notice = null;
      auditFilters = { ...auditDefaults };
      go('historial');
    }
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const data = button.dataset;
  if ('close' in data) button.closest('dialog').close();
  else if (data.edit) openPrice(data.edit, button);
  else if (data.batchProduct) startBatch(data.batchProduct, button);
  else if (data.rules || data.companions) {
    const [site, product] = (data.rules || data.companions).split('/');
    showWorkflow({ kind: data.rules ? 'rules' : 'companions', site, product, search: '', component: '', list: 'principal' }, button);
  } else if (data.record) showWorkflow({ kind: 'audit', id: data.record }, button);
  else if ('status' in data) {
    auditFilters.status = data.status;
    auditFilters.page = 1;
    renderPage();
  } else if (data.page) {
    const filters = route === 'historial' ? auditFilters : catalogueFilters;
    filters.page = Number(data.page);
    renderPage();
  } else if (data.remove) {
    draft.delete(data.remove);
    planReview = pendingPlan();
    renderPage();
  } else if (data.batchRemove) {
    batch.products = batch.products.filter((id) => id !== data.batchRemove);
    renderWorkflow();
  } else if (data.listMode) {
    if (lists.mode !== data.listMode && discardListEdits()) {
      Object.assign(lists, { mode: data.listMode, model: null, version: -1, dirty: false, review: null, message: '' });
      renderPage();
    }
  } else if (data.listOpen) {
    const entry = lists.saved.find(({ id }) => id === data.listOpen);
    if (entry && discardListEdits()) { loadList(entry); renderPage(); }
  } else if (data.listRemove) {
    delete lists.model.products[data.listRemove];
    markListDirty();
    renderPage();
  } else if (data.pickerProduct) {
    lists.model.products[data.pickerProduct] = '';
    markListDirty();
    renderPage();
    renderWorkflow();
  } else if (data.pickerPage) {
    workflowState.page = Number(data.pickerPage);
    renderWorkflow();
  } else if (data.action && Object.hasOwn(actions, data.action)) actions[data.action](button);
});

document.addEventListener('input', ({ target }) => {
  target.setCustomValidity?.('');
  if (target.type === 'search' && updateFilters(target)) return;
  if (target.name === 'picker-search') {
    workflowState.search = target.value;
    workflowState.page = 1;
    renderWorkflow(target);
  } else if (target.name === 'companion-search') {
    workflowState.search = target.value;
    renderWorkflow(target);
  } else if (target.dataset.matrix) batch.matrix.set(target.dataset.matrix, target.value);
  else if (target.dataset.linePrice) {
    const key = target.dataset.linePrice;
    if (!target.value.trim()) batch.lines.delete(key);
    else batch.lines.set(key, { key, from: batch.lines.get(key)?.from ?? catalogue.get(key), to: parseAmount(target.value) });
  } else if (target.dataset.listPrice) {
    lists.model.products[target.dataset.listPrice] = target.value;
    markListDirty();
  } else if (target.closest('#list-editor') && ['name', 'notes'].includes(target.name)) {
    lists.model[target.name] = target.value;
    markListDirty();
  }
});

document.addEventListener('change', ({ target }) => {
  if (target.type !== 'search' && updateFilters(target)) return;
  if (target.name === 'size') {
    const filters = route === 'historial' ? auditFilters : catalogueFilters;
    filters.size = Number(target.value);
    filters.page = 1;
    renderPage(target);
  } else if (target.name === 'workbook' && target.form?.id === 'workbook-form') {
    const hadComparison = Boolean(fileState);
    selectedFile = target.files[0];
    fileState = null;
    if (hadComparison) renderPage();
    else target.form.querySelector('[type="submit"]').disabled = !selectedFile;
  } else if (['batch-list', 'batch-site'].includes(target.name)) {
    const field = target.name === 'batch-list' ? 'lists' : 'sites';
    batch[field] = toggle(batch[field], target.value, target.checked);
    renderWorkflow();
  } else if (target.name === 'component' || target.name === 'companion-list') {
    workflowState[target.name === 'component' ? 'component' : 'list'] = target.value;
    renderWorkflow(target);
  } else if (route === 'listas') changeListControl(target);
});

document.addEventListener('submit', (event) => {
  const form = event.target;
  event.preventDefault();
  if (form.id === 'price-form') applyIndividual(event);
  else if (form.id === 'workbook-form' && selectedFile && !fileState?.loading) loadWorkbook();
  else if (form.id === 'list-import-form') importList(form);
  else if (form.id === 'list-editor') saveList();
  else if (['apply-batch-form', 'apply-plan-form', 'apply-workbook-form'].includes(form.id)) submitChanges(form);
});

priceDialog.addEventListener('close', () => {
  if (priceTrigger?.isConnected) priceTrigger.focus({ preventScroll: true });
  else view.querySelector('[data-edit="' + editing?.key + '"]')?.focus({ preventScroll: true });
  editing = null;
});
workflow.addEventListener('close', () => {
  if (workflowTrigger?.isConnected) workflowTrigger.focus({ preventScroll: true });
  workflowState = null;
});
window.addEventListener('hashchange', () => {
  if (location.hash === '#contenido') return;
  if (priceDialog.open) priceDialog.close();
  if (workflow.open) workflow.close();
  route = currentRoute();
  renderPage();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
});

document.querySelector('.skip-link').addEventListener('click', (event) => { event.preventDefault(); main.focus(); });
for (const link of navigation.querySelectorAll('[data-icon]')) link.insertAdjacentHTML('afterbegin', icon(link.dataset.icon));
document.querySelector('#portfolio-return').hidden = !['localhost', '127.0.0.1'].includes(location.hostname);
renderPage();
