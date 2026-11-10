'use strict';
const DATA = JSON.parse(document.getElementById('project-data').textContent);
const $ = id => document.getElementById(id);
const number = n => Number(n).toLocaleString('fa-IR');
const state = {edition: 'hosting', module: null, file: null, node: null, limit: 24, confidence: 'all'};
const nodeIndex = new Map(DATA.nodes.map(n => [n.id, n]));
const adjacency = new Map();
for (const edge of DATA.edges) {
  for (const id of new Set([edge.source, edge.target])) {
    if (!adjacency.has(id)) adjacency.set(id, []);
    adjacency.get(id).push(edge);
  }
}
const byFile = new Map();
for (const node of DATA.nodes) {
  if (!byFile.has(node.file)) byFile.set(node.file, []);
  byFile.get(node.file).push(node);
}
function element(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function button(text, handler, className) {
  const el = element('button', text, className); el.type = 'button';
  el.addEventListener('click', handler); return el;
}
function activeEdges() {return state.confidence === 'all' ? DATA.edges : DATA.edges.filter(e => e.confidence === state.confidence);}
function matchingNodes() {
  return DATA.nodes.filter(n => (!state.edition || n.module.startsWith(state.edition + '.')) &&
    (!state.module || n.module === state.module) && (!state.file || n.file === state.file));
}
function filesForModule(id) {
  return [...new Set([...DATA.files.filter(f => DATA.fileModules[f] === id),
    ...DATA.nodes.filter(n => n.module === id).map(n => n.file).filter(Boolean)])].sort();
}
function openEdition(id) {Object.assign(state, {edition: id, module: null, file: null, node: null, limit: 24}); render();}
function openModule(id) {Object.assign(state, {edition: DATA.modules[id].edition, module: id, file: null, node: null, limit: 24}); render();}
function openFile(file) {
  const module = DATA.fileModules[file] || (byFile.get(file) || [])[0]?.module;
  if (!module) return;
  Object.assign(state, {edition: DATA.modules[module].edition, module, file, node: null, limit: 24}); render();
}
function openNode(id) {
  const n = nodeIndex.get(id); if (!n) return;
  Object.assign(state, {edition: DATA.modules[n.module].edition, module: n.module, file: n.file || null, node: id, limit: 24});
  $('search').value = ''; $('results').classList.add('hidden'); render();
}
function svgEl(tag, attrs, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text; return el;
}
function renderModules(nodes, edges) {
  const modules = Object.keys(DATA.modules).filter(id => (!state.edition || id.startsWith(state.edition + '.')) &&
    (nodes.some(n => n.module === id) || DATA.files.some(f => DATA.fileModules[f] === id)));
  const columns = window.matchMedia('(max-width:600px)').matches ? 1 : 3;
  const width = columns * 280 + 60, cellWidth = 280, rowHeight = 150;
  const height = Math.max(190, Math.ceil(modules.length / columns) * rowHeight + 45);
  const svg = svgEl('svg', {viewBox: `0 0 ${width} ${height}`, class: 'diagram', role: 'img', 'aria-label': 'بخش‌های پروژه و تعداد روابط ثبت‌شدهٔ میان آن‌ها'});
  const positions = new Map(modules.map((id, i) => [id, {x: 30 + (columns - 1 - i % columns) * cellWidth, y: 28 + Math.floor(i / columns) * rowHeight}]));
  const pairs = new Map();
  for (const edge of edges) {
    const a = nodeIndex.get(edge.source)?.module, b = nodeIndex.get(edge.target)?.module;
    if (a === b || !positions.has(a) || !positions.has(b)) continue;
    const pair = [a, b].sort().join('|'); pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }
  for (const [pair, count] of pairs) {
    const [a, b] = pair.split('|').map(id => positions.get(id));
    svg.append(svgEl('line', {x1: a.x + 120, y1: a.y + 48, x2: b.x + 120, y2: b.y + 48, stroke: '#c8d8ce', 'stroke-width': 1.5}));
    const label = svgEl('text', {x: (a.x+b.x)/2+120, y: (a.y+b.y)/2+44, 'text-anchor': 'middle', class: 'relation-count'}, number(count));
    label.append(svgEl('title', {}, 'تعداد روابط ثبت‌شده میان دو بخش، در هر دو جهت')); svg.append(label);
  }
  for (const id of modules) {
    const pos = positions.get(id), edition = DATA.modules[id].edition;
    const group = svgEl('g', {class: 'module-node', tabindex: 0, role: 'button', 'aria-label': DATA.modules[id].label, 'data-module': id});
    group.append(svgEl('rect', {x: pos.x, y: pos.y, width: 240, height: 100, rx: 14, fill: '#f7faf7', stroke: '#d8e4d9'}));
    group.append(svgEl('circle', {cx: pos.x+218, cy: pos.y+27, r: 4, fill: DATA.editions[edition].color}));
    group.append(svgEl('text', {x: pos.x+205, y: pos.y+33, 'text-anchor': 'start', fill: '#274b3c', 'font-size': 14, direction: 'rtl'}, DATA.modules[id].label));
    const count = nodes.filter(n => n.module === id).length;
    group.append(svgEl('text', {x: pos.x+218, y: pos.y+65, 'text-anchor': 'start', fill: '#687c6d', 'font-size': 12, direction: 'rtl'}, `${number(filesForModule(id).length)} فایل · ${number(count)} گره`));
    group.addEventListener('click', () => openModule(id));
    group.addEventListener('keydown', event => {if (['Enter', ' '].includes(event.key)) {event.preventDefault(); openModule(id);}});
    svg.append(group);
  }
  $('content').append(svg);
  $('visible-count').textContent = number(modules.length) + ' بخش';
  $('board-label').textContent = 'یک بخش را برای دیدن فایل‌ها باز کنید';
}
function renderCards(items, kind) {
  const cards = element('div', undefined, 'cards');
  for (const item of items.slice(0, state.limit)) {
    const isFile = kind === 'file', path = isFile ? item : item.file;
    const card = button('', () => isFile ? openFile(item) : openNode(item.id), 'file-card');
    card.append(element('strong', isFile ? path.split('/').pop() : item.label));
    card.append(element('span', path + (!isFile && item.location ? ' : ' + item.location : ''), 'path'));
    card.append(element('span', isFile ? number((byFile.get(path) || []).length) + ' گرهٔ ثبت‌شده' : 'مشاهدهٔ روابط', 'badge'));
    cards.append(card);
  }
  if (!items.length) cards.append(element('p', 'برای این انتخاب، نمادی در گراف مدل نشده است.', 'empty'));
  $('content').append(cards);
  $('more').style.display = items.length > state.limit ? 'block' : 'none';
  $('visible-count').textContent = `${number(Math.min(items.length, state.limit))} از ${number(items.length)}`;
  $('board-label').textContent = kind === 'file' ? 'فایل‌ها' : 'نمادها و گره‌های فایل';
}
function renderDetail(id) {
  const n = nodeIndex.get(id), box = $('detail');
  const edges = (adjacency.get(id) || []).filter(e => state.confidence === 'all' || e.confidence === state.confidence);
  box.classList.remove('hidden'); box.append(element('h2', n.label));
  box.append(element('p', n.file + (n.location ? ' : ' + n.location : ''), 'path'));
  const table = element('table'), head = element('tr');
  for (const label of ['مبدأ ← مقصد', 'نوع رابطه', 'اطمینان']) head.append(element('th', label));
  table.append(head);
  for (const edge of edges.slice(0, state.limit)) {
    const row = element('tr'), endpoints = element('td');
    for (const [i, key] of ['source', 'target'].entries()) {
      if (i) endpoints.append(document.createTextNode(' → '));
      endpoints.append(button(nodeIndex.get(edge[key])?.label || edge[key], () => openNode(edge[key]), 'node-link'));
    }
    row.append(endpoints, element('td', edge.relation), element('td', edge.confidence));
    table.append(row);
  }
  box.append(table);
  if (!edges.length) box.append(element('p', 'رابطه‌ای با فیلتر فعلی ثبت نشده است.', 'muted'));
  $('more').style.display = edges.length > state.limit ? 'block' : 'none';
  $('board-label').textContent = 'روابط مستقیمِ گرهٔ انتخاب‌شده';
  $('visible-count').textContent = `${number(Math.min(edges.length, state.limit))} از ${number(edges.length)} رابطه`;
  const allowed = n.file && !n.file.startsWith('/') && !n.file.split('/').includes('..');
  if (allowed) {
    const a = element('a', 'باز کردن فایل در GitHub');
    a.href = 'https://github.com/alimsaleh1996-maker/tamiran/blob/main/' + n.file.split('/').map(encodeURIComponent).join('/');
    a.target = '_blank'; a.rel = 'noopener noreferrer'; box.append(a);
  }
}
function render() {
  $('content').replaceChildren(); $('detail').replaceChildren(); $('detail').classList.add('hidden'); $('more').style.display = 'none';
  const nodes = matchingNodes(), ids = new Set(nodes.map(n => n.id));
  const edges = activeEdges().filter(e => ids.has(e.source) && ids.has(e.target));
  const edition = state.edition ? DATA.editions[state.edition].label : 'همهٔ بخش‌های پروژه';
  const module = state.module ? DATA.modules[state.module].label : '';
  $('title').textContent = state.node ? nodeIndex.get(state.node).label : state.file ? state.file.split('/').pop() : module || edition;
  $('crumbs').textContent = [edition, module, state.file].filter(Boolean).join(' / ');
  $('view-note').textContent = state.node ? 'هر رابطه، نوع و درجهٔ اطمینان خودش را دارد.' : state.file ? 'نمادهای مدل‌شده در همین فایل' : state.module ? 'فقط فایل‌های همین بخش؛ جزئیات با انتخاب هر فایل باز می‌شود.' : 'نمای خلاصه؛ جزئیات هر بخش را با کلیک یا کیبورد باز کنید.';
  $('back').style.display = state.module ? 'block' : 'none';
  for (const el of $('editions').querySelectorAll('button')) el.setAttribute('aria-pressed', String(el.dataset.edition === (state.edition || 'all')));
  $('summary').replaceChildren();
  const fileCount = state.file ? 1 : state.module ? filesForModule(state.module).length : DATA.files.filter(f => !state.edition || DATA.fileModules[f].startsWith(state.edition+'.')).length;
  for (const [value, label] of [[fileCount,'فایل در این محدوده'],[nodes.length,'گرهٔ مدل‌شده'],[edges.length,'رابطهٔ داخلی ثبت‌شده']]) {
    const metric = element('div', undefined, 'metric'); metric.append(element('strong', number(value)), document.createTextNode(label)); $('summary').append(metric);
  }
  if (state.node) renderDetail(state.node);
  else if (state.file) renderCards(nodes, 'node');
  else if (state.module) renderCards(filesForModule(state.module), 'file');
  else renderModules(nodes, edges);
  $('status').textContent = `کل دادهٔ گراف: ${number(DATA.nodes.length)} گره و ${number(DATA.edges.length)} رابطه. روابط استنباطی پیش از تصمیم مهم باید با سورس بررسی شوند.`;
  window.projectMapState = {...state};
}
for (const [id, item] of Object.entries(DATA.editions)) {
  if (id === 'external') continue;
  const el = button(item.label, () => openEdition(id)); el.dataset.edition = id;
  el.append(element('small', number(DATA.nodes.filter(n => n.module.startsWith(id+'.')).length)));
  $('editions').append(el);
}
const all = button('همهٔ بخش‌ها', () => openEdition(null)); all.dataset.edition = 'all'; $('editions').append(all);
$('build-source').textContent = DATA.sourceCommit.slice(0, 8);
$('home').addEventListener('click', () => openEdition('hosting'));
$('back').addEventListener('click', () => {
  if (state.node) {state.node=null; state.limit=24; render();}
  else if (state.file) openModule(state.module);
  else openEdition(state.edition);
});
$('more').addEventListener('click', () => {state.limit += 24; render();});
$('confidence').addEventListener('change', e => {state.confidence=e.target.value; state.limit=24; render();});
$('search').addEventListener('input', event => {
  const term = event.target.value.trim().toLocaleLowerCase(); $('results').replaceChildren();
  $('results').classList.toggle('hidden', term.length < 2); if (term.length < 2) return;
  const matches = DATA.nodes.filter(n => (n.label + ' ' + n.file).toLocaleLowerCase().includes(term));
  for (const n of matches.slice(0, 30)) {
    const el = button(n.label, () => openNode(n.id));
    el.append(element('small', DATA.editions[DATA.modules[n.module].edition].label), element('span', n.file, 'path'));
    $('results').append(el);
  }
  const represented = new Set(matches.map(n => n.file));
  for (const file of DATA.files.filter(f => f.toLocaleLowerCase().includes(term) && !represented.has(f)).slice(0, Math.max(0,30-matches.length))) {
    const el = button(file.split('/').pop(), () => {openFile(file); $('results').classList.add('hidden');});
    el.append(element('span', file, 'path')); $('results').append(el);
  }
  if (!$('results').childElementCount) $('results').append(element('p', 'نتیجه‌ای در پروژه پیدا نشد.', 'empty'));
});
document.addEventListener('keydown', event => {if (event.key === 'Escape') $('results').classList.add('hidden');});
document.addEventListener('click', event => {if (!event.target.closest('.search')) $('results').classList.add('hidden');});
let resizeTimer;
window.addEventListener('resize', () => {clearTimeout(resizeTimer); resizeTimer=setTimeout(render,150);});
render();
