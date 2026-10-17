import * as store from './db.js';

/* ---------- Stato ---------- */
const state = {
  tab: 'wardrobe',        // 'wardrobe' | 'outfits'
  categoryId: null,       // categoria aperta nella scheda Armadio
  categories: [],
  items: [],
  outfits: [],
};
const urlCache = new Map(); // itemId -> object URL della foto

const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const ICON = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  gallery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  paste: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h4"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M8 11l4 4 4-4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  hanger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 6.5a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9V10"/><path d="M12 10L3 17.5h18z"/></svg>',
};

/* ---------- Dati ---------- */
async function load() {
  const [c, i, o] = await Promise.all([store.getAll('categories'), store.getAll('items'), store.getAll('outfits')]);
  state.categories = c.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  state.items = i.sort((a, b) => a.createdAt - b.createdAt);
  state.outfits = o.sort((a, b) => b.createdAt - a.createdAt);
  // libera le foto non più usate
  const alive = new Set(state.items.map((x) => x.id));
  for (const [id, url] of urlCache) if (!alive.has(id)) { URL.revokeObjectURL(url); urlCache.delete(id); }
}

const catById = (id) => state.categories.find((c) => c.id === id);
const itemById = (id) => state.items.find((i) => i.id === id);
const itemsOf = (catId) => state.items.filter((i) => i.categoryId === catId);
function imgUrl(item) {
  if (!item) return '';
  if (!urlCache.has(item.id)) urlCache.set(item.id, URL.createObjectURL(item.blob));
  return urlCache.get(item.id);
}
/** Capi di un outfit, nell'ordine delle categorie. */
function outfitItems(o) {
  const list = o.itemIds.map(itemById).filter(Boolean);
  const order = new Map(state.categories.map((c, i) => [c.id, i]));
  return list.sort((a, b) => (order.get(a.categoryId) ?? 99) - (order.get(b.categoryId) ?? 99));
}
const outfitsUsing = (itemIds) => {
  const set = new Set(itemIds);
  return state.outfits.filter((o) => o.itemIds.some((id) => set.has(id)));
};

/* ---------- Rendering ---------- */
function render() {
  document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === state.tab ? 'page' : 'false'));
  const view = $('#view');
  if (state.tab === 'outfits') view.innerHTML = viewOutfits();
  else if (state.categoryId && catById(state.categoryId)) view.innerHTML = viewCategory(catById(state.categoryId));
  else { state.categoryId = null; view.innerHTML = viewWardrobe(); }
}

function thumb(item, cls = '') {
  return `<span class="ph ${cls}"><img src="${imgUrl(item)}" alt="" loading="lazy" decoding="async"></span>`;
}

function viewWardrobe() {
  const n = state.items.length;
  const head = `
    <header class="head">
      <div><h1>Armadio</h1><p class="sub">${plural(n, 'capo', 'capi')} · ${plural(state.categories.length, 'categoria', 'categorie')}</p></div>
      <div class="head-actions">
        <button class="icon-btn" data-act="backup" aria-label="Backup">${ICON.upload}</button>
        <button class="icon-btn primary" data-act="new-category" aria-label="Nuova categoria">${ICON.plus}</button>
      </div>
    </header>`;
  if (!state.categories.length) {
    return head + `
      <div class="empty">
        <span class="empty-icon">${ICON.hanger}</span>
        <h2>Il tuo armadio è vuoto</h2>
        <p>Inizia creando le categorie. Tocca un suggerimento per aggiungerlo subito.</p>
        <div class="chips center">
          ${SUGGESTED.map((s) => `<button class="chip" data-act="quick-category" data-name="${s}">${s}</button>`).join('')}
        </div>
        <button class="btn primary" data-act="new-category">Altra categoria</button>
      </div>`;
  }
  const rows = state.categories.map((c) => {
    const its = itemsOf(c.id);
    const thumbs = its.slice(-3).reverse().map((i) => thumb(i, 'round')).join('') || `<span class="ph round empty-ph">${ICON.plus}</span>`;
    return `
      <button class="cat-row" data-act="open-category" data-id="${c.id}">
        <span class="stack">${thumbs}</span>
        <span class="cat-text"><span class="cat-name">${esc(c.name)}</span><span class="cat-count">${plural(its.length, 'capo', 'capi')}</span></span>
        <span class="chev">${ICON.chevron}</span>
      </button>`;
  }).join('');
  return head + `<div class="list">${rows}<button class="dashed" data-act="new-category">${ICON.plus} Aggiungi categoria</button></div>`;
}

function viewCategory(c) {
  const its = itemsOf(c.id);
  const grid = its.length
    ? `<div class="grid3">${its.map((i) => `
        <button class="item" data-act="open-item" data-id="${i.id}">
          ${thumb(i)}
          ${i.name ? `<span class="item-name">${esc(i.name)}</span>` : ''}
        </button>`).join('')}</div>`
    : `<div class="empty small"><p>Nessun capo in questa categoria. Tocca <strong>Aggiungi capo</strong> e scatta una foto.</p></div>`;
  return `
    <div class="topbar">
      <button class="link-btn" data-act="back">${ICON.back} Armadio</button>
      <button class="icon-btn ghost" data-act="category-menu" aria-label="Modifica categoria">${ICON.more}</button>
    </div>
    <header class="head tight"><div><h1>${esc(c.name)}</h1><p class="sub">${plural(its.length, 'capo', 'capi')}</p></div></header>
    ${grid}
    <button class="fab" data-act="new-item">${ICON.camera} Aggiungi capo</button>`;
}

function viewOutfits() {
  const head = `
    <header class="head">
      <div><h1>Outfit</h1><p class="sub">${plural(state.outfits.length, 'outfit', 'outfit')}</p></div>
      ${state.items.length ? `<div class="head-actions"><button class="icon-btn primary" data-act="new-outfit" aria-label="Nuovo outfit">${ICON.plus}</button></div>` : ''}
    </header>`;
  if (!state.items.length) {
    return head + `<div class="empty"><span class="empty-icon">${ICON.hanger}</span><h2>Ancora nessun capo</h2><p>Aggiungi qualche capo nell'Armadio, poi torna qui per comporre gli outfit.</p><button class="btn primary" data-act="tab" data-tab="wardrobe">Vai all'Armadio</button></div>`;
  }
  if (!state.outfits.length) {
    return head + `<div class="empty"><span class="empty-icon">${ICON.hanger}</span><h2>Nessun outfit</h2><p>Scegli un capo per categoria: anche solo uno o due.</p><button class="btn primary" data-act="new-outfit">Crea il primo outfit</button></div>`;
  }
  const cards = state.outfits.map((o) => {
    const its = outfitItems(o);
    return `
      <button class="outfit-card" data-act="open-outfit" data-id="${o.id}">
        <span class="collage n${Math.min(its.length, 4)}">${its.slice(0, 6).map((i) => thumb(i)).join('')}</span>
        <span class="outfit-name">${esc(o.name || 'Senza nome')}</span>
        <span class="cat-count">${plural(its.length, 'capo', 'capi')}</span>
      </button>`;
  }).join('');
  return head + `<div class="grid2">${cards}</div>`;
}

/* ---------- Fogli (bottom sheet) ---------- */
const sheets = [];
function openSheet(html, { onMount, dialog = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap' + (dialog ? ' dialog' : '');
  wrap.innerHTML = `<div class="scrim" data-sheet-close></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(wrap);
  sheets.push(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-sheet-close]')) closeSheet(wrap); });
  onMount && onMount(wrap.querySelector('.sheet'), () => closeSheet(wrap));
  return wrap;
}
function closeSheet(wrap = sheets[sheets.length - 1]) {
  if (!wrap) return;
  const i = sheets.indexOf(wrap);
  if (i >= 0) sheets.splice(i, 1);
  wrap.classList.remove('open');
  setTimeout(() => wrap.remove(), 260);
}
function confirmSheet({ title, body, confirm, danger = true, extra = '' }) {
  return new Promise((resolve) => {
    let answered = false;
    const wrap = openSheet(`
      <div class="confirm">
        <h2>${title}</h2>
        <p>${body}</p>
        ${extra}
        <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${confirm}</button>
        <button class="btn plain" data-no>Annulla</button>
      </div>`, {
      dialog: true,
      onMount: (el, close) => {
        el.querySelector('[data-yes]').onclick = () => { answered = true; resolve(true); close(); };
        el.querySelector('[data-no]').onclick = () => { answered = true; resolve(false); close(); };
      },
    });
    wrap.querySelector('.scrim').addEventListener('click', () => { if (!answered) resolve(false); });
  });
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function sheetHeader(title, saveLabel = 'Salva') {
  return `<div class="sheet-head"><button class="link-btn" data-sheet-close>Annulla</button><h2>${title}</h2><button class="link-btn strong" data-save ${saveLabel ? '' : 'hidden'}>${saveLabel}</button></div>`;
}

/* ---------- Categorie ---------- */
async function addCategory(name) {
  name = name.trim();
  if (!name) return;
  if (state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) { toast(`"${name}" esiste già`); return; }
  const order = state.categories.reduce((m, c) => Math.max(m, c.order), -1) + 1;
  await store.put('categories', { id: uid(), name, order, createdAt: Date.now() });
  await load(); render();
}

const SUGGESTED = ['Magliette', 'Camicie', 'Maglioni', 'Giacche', 'Pantaloni', 'Gonne', 'Vestiti', 'Scarpe', 'Borse', 'Accessori'];
const suggestionChips = () => SUGGESTED
  .filter((s) => !state.categories.some((c) => c.name.toLowerCase() === s.toLowerCase()))
  .map((s) => `<button class="chip" data-suggest="${s}">${ICON.plus.replace('<svg', '<svg class="chip-ic"')} ${s}</button>`).join('');

function newCategorySheet() {
  openSheet(`${sheetHeader('Nuova categoria', 'Crea')}
    <div class="sheet-body">
      <label class="field"><span>Nome</span><input id="catName" placeholder="Es. Magliette" maxlength="40" autocomplete="off"></label>
      <div class="field"><span>Suggerimenti: tocca per aggiungere subito</span><div class="chips" id="suggest">${suggestionChips()}</div></div>
    </div>`, {
    onMount: (el, close) => {
      const input = el.querySelector('#catName');
      const sug = el.querySelector('#suggest');
      sug.onclick = async (e) => {
        const b = e.target.closest('[data-suggest]'); if (!b) return;
        await addCategory(b.dataset.suggest);
        toast(`Aggiunta "${b.dataset.suggest}"`);
        sug.innerHTML = suggestionChips();
      };
      const save = async () => { if (!input.value.trim()) { input.focus(); return; } await addCategory(input.value); close(); };
      el.querySelector('[data-save]').onclick = save;
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    },
  });
}

function categoryMenuSheet(c) {
  const its = itemsOf(c.id);
  const affected = outfitsUsing(its.map((i) => i.id));
  openSheet(`${sheetHeader('Modifica categoria')}
    <div class="sheet-body">
      <label class="field"><span>Nome</span><input id="catName" value="${esc(c.name)}" maxlength="40" autocomplete="off"></label>
      <div class="order-row">
        <span>Posizione</span>
        <div class="seg"><button class="chip" data-move="-1">Su</button><button class="chip" data-move="1">Giù</button></div>
      </div>
      <button class="btn danger-outline" data-delete>Elimina categoria</button>
    </div>`, {
    onMount: (el, close) => {
      el.querySelector('[data-save]').onclick = async () => {
        const name = el.querySelector('#catName').value.trim();
        if (!name) return;
        if (state.categories.some((x) => x.id !== c.id && x.name.toLowerCase() === name.toLowerCase())) { toast(`"${name}" esiste già`); return; }
        await store.put('categories', { ...c, name });
        await load(); render(); close();
      };
      el.querySelectorAll('[data-move]').forEach((b) => b.onclick = async () => {
        const list = [...state.categories];
        const i = list.findIndex((x) => x.id === c.id);
        const j = i + Number(b.dataset.move);
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        for (let k = 0; k < list.length; k++) if (list[k].order !== k) await store.put('categories', { ...list[k], order: k });
        await load(); render();
        toast(`Spostata in posizione ${j + 1} di ${list.length}`);
      });
      el.querySelector('[data-delete]').onclick = async () => {
        const ok = await confirmSheet({
          title: `Eliminare la categoria ${esc(c.name)}?`,
          body: its.length || affected.length
            ? `Verranno eliminati anche ${its.length ? `i suoi <strong>${plural(its.length, 'capo', 'capi')}</strong>` : ''}${its.length && affected.length ? ' e ' : ''}${affected.length ? `<strong>${plural(affected.length, 'outfit', 'outfit')}</strong> che li usano` : ''}. Non si può annullare.`
            : 'La categoria è vuota. Non si può annullare.',
          extra: affectedList(affected),
          confirm: affected.length ? 'Elimina categoria e outfit' : 'Elimina categoria',
        });
        if (!ok) return;
        await store.removeMany({ categoryIds: [c.id], itemIds: its.map((i) => i.id), outfitIds: affected.map((o) => o.id) });
        state.categoryId = null;
        await load(); render(); close();
        toast('Categoria eliminata');
      };
    },
  });
}

function affectedList(outfits) {
  if (!outfits.length) return '';
  return `<div class="affected">${outfits.map((o) => `
    <div class="affected-row"><span class="mini">${outfitItems(o).slice(0, 4).map((i) => thumb(i)).join('')}</span><span>${esc(o.name || 'Senza nome')}</span><em>verrà eliminato</em></div>`).join('')}</div>`;
}

/* ---------- Foto ---------- */
const MAX_SIDE = 1200;
async function processImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Immagine non leggibile'));
      im.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    // Le immagini con trasparenza (es. "Copia soggetto" da Foto) restano PNG, il resto diventa JPEG.
    const transparent = blob.type === 'image/png' && hasAlpha(ctx, w, h);
    return await new Promise((resolve) => canvas.toBlob(resolve, transparent ? 'image/png' : 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}
function hasAlpha(ctx, w, h) {
  const step = Math.max(1, Math.floor(Math.min(w, h) / 40));
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] < 250) return true;
  return false;
}
async function pasteImage() {
  if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('Incolla non disponibile su questo browser');
  const entries = await navigator.clipboard.read();
  for (const e of entries) {
    const type = e.types.find((t) => t.startsWith('image/'));
    if (type) return e.getType(type);
  }
  throw new Error('Negli appunti non c’è un’immagine');
}

/* ---------- Capi ---------- */
function itemSheet({ item = null, categoryId }) {
  const editing = !!item;
  let blob = item ? item.blob : null;
  let catId = item ? item.categoryId : categoryId;
  let previewUrl = item ? imgUrl(item) : '';
  const chips = () => state.categories.map((c) => `<button class="chip ${c.id === catId ? 'on' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('');

  openSheet(`${sheetHeader(editing ? 'Modifica capo' : 'Nuovo capo')}
    <div class="sheet-body">
      <div class="photo ${previewUrl ? '' : 'none'}" id="photo">
        ${previewUrl ? `<img src="${previewUrl}" alt="">` : `<span class="photo-hint">${ICON.camera}<span>Scatta o scegli una foto</span></span>`}
      </div>
      <div class="photo-actions">
        <label class="btn outline">${ICON.camera}<span>${editing ? 'Nuova foto' : 'Scatta'}</span><input type="file" accept="image/*" capture="environment" id="fileCam" hidden></label>
        <label class="btn outline">${ICON.gallery}<span>Galleria</span><input type="file" accept="image/*" id="fileGal" hidden></label>
        <button class="btn outline" id="pasteBtn">${ICON.paste}<span>Incolla</span></button>
      </div>
      <p class="tip">Per avere il capo senza sfondo: in Foto tieni premuto sul capo, scegli <strong>Copia</strong>, poi qui tocca <strong>Incolla</strong>.</p>
      <label class="field"><span>Nome (facoltativo)</span><input id="itemName" value="${esc(item?.name || '')}" maxlength="40" autocomplete="off" placeholder="Es. Jeans chiari"></label>
      <div class="field"><span>Categoria</span><div class="chips" id="catChips">${chips()}</div></div>
      ${editing ? '<button class="btn danger-outline" data-delete>Elimina capo</button>' : ''}
    </div>`, {
    onMount: (el, close) => {
      const photo = el.querySelector('#photo');
      const setBlob = async (b) => {
        if (!b) return;
        photo.classList.add('busy');
        try {
          blob = await processImage(b);
          if (previewUrl && (!item || previewUrl !== imgUrl(item))) URL.revokeObjectURL(previewUrl);
          previewUrl = URL.createObjectURL(blob);
          photo.classList.remove('none');
          photo.innerHTML = `<img src="${previewUrl}" alt="">`;
        } catch (err) { toast(err.message); }
        photo.classList.remove('busy');
      };
      el.querySelector('#fileCam').onchange = (e) => setBlob(e.target.files[0]);
      el.querySelector('#fileGal').onchange = (e) => setBlob(e.target.files[0]);
      el.querySelector('#pasteBtn').onclick = async () => { try { await setBlob(await pasteImage()); } catch (err) { toast(err.message); } };
      el.querySelector('#catChips').onclick = (e) => {
        const b = e.target.closest('[data-cat]'); if (!b) return;
        catId = b.dataset.cat;
        el.querySelector('#catChips').innerHTML = chips();
      };
      el.querySelector('[data-save]').onclick = async () => {
        if (!blob) { toast('Aggiungi una foto del capo'); return; }
        const name = el.querySelector('#itemName').value.trim();
        const record = { id: item?.id || uid(), categoryId: catId, name, blob, createdAt: item?.createdAt || Date.now() };
        if (item && item.blob !== blob && urlCache.has(item.id)) { URL.revokeObjectURL(urlCache.get(item.id)); urlCache.delete(item.id); }
        // Se il capo cambia categoria, gli outfit che hanno già un capo di quella categoria non possono averne due.
        let drop = [];
        if (item && item.categoryId !== catId) {
          drop = state.outfits.filter((o) => o.itemIds.includes(item.id) && o.itemIds.some((id) => id !== item.id && itemById(id)?.categoryId === catId));
          if (drop.length) {
            const ok = await confirmSheet({
              title: 'Spostare il capo?',
              body: `${plural(drop.length, 'outfit ha', 'outfit hanno')} già un capo di quella categoria: ${drop.length === 1 ? 'verrà eliminato' : 'verranno eliminati'}.`,
              extra: affectedList(drop), confirm: 'Sposta ed elimina',
            });
            if (!ok) return;
          }
        }
        await store.put('items', record);
        if (drop.length) await store.removeMany({ outfitIds: drop.map((o) => o.id) });
        await load(); render(); close();
        toast(editing ? 'Capo aggiornato' : 'Capo aggiunto');
      };
      const del = el.querySelector('[data-delete]');
      if (del) del.onclick = async () => {
        const affected = outfitsUsing([item.id]);
        const ok = await confirmSheet({
          title: 'Eliminare questo capo?',
          body: affected.length ? `Verranno eliminati anche <strong>${plural(affected.length, 'outfit', 'outfit')}</strong> che lo usano. Non si può annullare.` : 'Non si può annullare.',
          extra: affectedList(affected),
          confirm: affected.length ? 'Elimina capo e outfit' : 'Elimina capo',
        });
        if (!ok) return;
        await store.removeMany({ itemIds: [item.id], outfitIds: affected.map((o) => o.id) });
        await load(); render(); close();
        toast('Capo eliminato');
      };
    },
  });
}

/* ---------- Outfit ---------- */
function outfitSheet(outfit = null) {
  const picks = new Map(); // categoryId -> itemId
  if (outfit) outfitItems(outfit).forEach((i) => picks.set(i.categoryId, i.id));
  const cats = state.categories.filter((c) => itemsOf(c.id).length);

  const previewHtml = () => {
    const chosen = cats.map((c) => itemById(picks.get(c.id))).filter(Boolean);
    return chosen.length ? chosen.map((i) => thumb(i)).join('') : '<span class="preview-empty">Scegli almeno un capo</span>';
  };
  const rowHtml = (c) => {
    const sel = picks.get(c.id) || null;
    return `<button class="pick none-pick ${sel ? '' : 'on'}" data-cat="${c.id}" data-item="" aria-pressed="${!sel}">Nessuno</button>` +
      itemsOf(c.id).map((i) => `<button class="pick ${sel === i.id ? 'on' : ''}" data-cat="${c.id}" data-item="${i.id}" aria-pressed="${sel === i.id}" aria-label="${esc(i.name || c.name)}">${thumb(i)}</button>`).join('');
  };

  openSheet(`${sheetHeader(outfit ? 'Modifica outfit' : 'Nuovo outfit')}
    <div class="sheet-body outfit-body">
      <div class="preview" id="preview">${previewHtml()}</div>
      <div class="name-row">
        <input id="outfitName" placeholder="Nome outfit" aria-label="Nome outfit" value="${esc(outfit?.name || '')}" maxlength="40" autocomplete="off">
        <span class="count" id="count"></span>
      </div>
      ${cats.map((c) => `
        <section class="pick-group">
          <h3>${esc(c.name)}</h3>
          <div class="pick-row" data-row="${c.id}">${rowHtml(c)}</div>
        </section>`).join('')}
      ${outfit ? '<button class="btn danger-outline" data-delete>Elimina outfit</button>' : ''}
    </div>`, {
    onMount: (el, close) => {
      const saveBtn = el.querySelector('[data-save]');
      const update = () => {
        el.querySelector('#preview').innerHTML = previewHtml();
        el.querySelector('#count').textContent = `${picks.size} di ${cats.length} categorie`;
        saveBtn.disabled = picks.size === 0;
      };
      update();
      el.querySelector('.outfit-body').addEventListener('click', (e) => {
        const b = e.target.closest('.pick'); if (!b) return;
        const catId = b.dataset.cat;
        if (b.dataset.item) picks.set(catId, b.dataset.item); else picks.delete(catId);
        el.querySelector(`[data-row="${catId}"]`).innerHTML = rowHtml(cats.find((c) => c.id === catId));
        update();
      });
      saveBtn.onclick = async () => {
        if (!picks.size) return;
        const name = el.querySelector('#outfitName').value.trim();
        await store.put('outfits', { id: outfit?.id || uid(), name, itemIds: [...picks.values()], createdAt: outfit?.createdAt || Date.now() });
        await load(); render(); close();
        toast(outfit ? 'Outfit aggiornato' : 'Outfit salvato');
      };
      const del = el.querySelector('[data-delete]');
      if (del) del.onclick = async () => {
        const ok = await confirmSheet({ title: 'Eliminare questo outfit?', body: 'I capi restano nell’armadio.', confirm: 'Elimina outfit' });
        if (!ok) return;
        await store.removeMany({ outfitIds: [outfit.id] });
        await load(); render(); close();
        toast('Outfit eliminato');
      };
    },
  });
}

/* ---------- Backup ---------- */
const blobToDataUrl = (b) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(b); });
const fmtDate = (ts) => new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtSize = (bytes) => bytes > 1e6 ? `${(bytes / 1e6).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;

async function backupSheet() {
  const last = await store.getMeta('lastBackup');
  const bytes = state.items.reduce((s, i) => s + (i.blob?.size || 0), 0);
  const days = last ? Math.floor((Date.now() - last) / 86400000) : null;
  openSheet(`${sheetHeader('Backup', '')}
    <div class="sheet-body">
      <div class="stats">
        <div><b>${state.items.length}</b><span>capi</span></div>
        <div><b>${state.outfits.length}</b><span>outfit</span></div>
        <div><b>${fmtSize(bytes)}</b><span>foto</span></div>
      </div>
      <p class="note ${last && days < 30 ? 'ok' : 'warn'}">${last ? `Ultimo backup: ${fmtDate(last)}${days > 0 ? `, ${plural(days, 'giorno', 'giorni')} fa` : ', oggi'}` : 'Non hai ancora fatto un backup'}</p>
      <button class="btn primary" id="exportBtn">${ICON.upload}<span>Esporta backup</span></button>
      <p class="tip">Crea un file con foto, categorie e outfit. Salvalo in <strong>File › iCloud Drive</strong>.</p>
      <hr>
      <label class="btn outline">${ICON.download}<span>Importa backup</span><input type="file" accept=".json,application/json" id="importFile" hidden></label>
      <p class="tip">Sostituisce l’armadio attuale con quello del file. Prima ti chiediamo conferma.</p>
    </div>`, {
    onMount: (el, close) => {
      el.querySelector('#exportBtn').onclick = async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try { await exportBackup(); close(); } catch (err) { if (err?.name !== 'AbortError') toast('Esportazione non riuscita'); }
        btn.disabled = false;
      };
      el.querySelector('#importFile').onchange = async (e) => {
        const file = e.target.files[0]; e.target.value = '';
        if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          if (data.app !== 'armadio' || !Array.isArray(data.items)) throw new Error();
          const ok = await confirmSheet({
            title: 'Importare questo backup?',
            body: `Contiene ${plural(data.items.length, 'capo', 'capi')} e ${plural(data.outfits.length, 'outfit', 'outfit')}${data.exportedAt ? ` (del ${fmtDate(data.exportedAt)})` : ''}. L’armadio attuale verrà sostituito.`,
            confirm: 'Sostituisci armadio',
          });
          if (!ok) return;
          const items = await Promise.all(data.items.map(async ({ image, ...rest }) => ({ ...rest, blob: await (await fetch(image)).blob() })));
          await store.replaceAll({ categories: data.categories, items, outfits: data.outfits });
          for (const url of urlCache.values()) URL.revokeObjectURL(url);
          urlCache.clear();
          state.categoryId = null;
          await load(); render(); close();
          toast('Backup importato');
        } catch {
          toast('Il file non è un backup valido');
        }
      };
    },
  });
}

async function exportBackup() {
  const items = await Promise.all(state.items.map(async ({ blob, ...rest }) => ({ ...rest, image: await blobToDataUrl(blob) })));
  const data = { app: 'armadio', version: 1, exportedAt: Date.now(), categories: state.categories, items, outfits: state.outfits };
  const name = `armadio-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Backup Armadio' });
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  await store.setMeta('lastBackup', Date.now());
  toast('Backup esportato');
}

/* ---------- Eventi ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const id = el.dataset.id;
  switch (el.dataset.act) {
    case 'tab': state.tab = el.dataset.tab; if (state.tab === 'wardrobe' && el.classList.contains('tab')) state.categoryId = null; render(); window.scrollTo(0, 0); break;
    case 'new-category': newCategorySheet(); break;
    case 'quick-category': addCategory(el.dataset.name); break;
    case 'open-category': state.categoryId = id; render(); window.scrollTo(0, 0); break;
    case 'back': state.categoryId = null; render(); break;
    case 'category-menu': categoryMenuSheet(catById(state.categoryId)); break;
    case 'new-item': itemSheet({ categoryId: state.categoryId }); break;
    case 'open-item': itemSheet({ item: itemById(id) }); break;
    case 'new-outfit': outfitSheet(); break;
    case 'open-outfit': outfitSheet(state.outfits.find((o) => o.id === id)); break;
    case 'backup': backupSheet(); break;
  }
});

/* ---------- Avvio ---------- */
(async function start() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch {}
  await load();
  render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
