import { createClient } from '@supabase/supabase-js'

const WA = '5581994629486';
let sb = null, produtos = [], adminLogged = false, catAtiva = 'Todos', selectedFiles = [];

function boot() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Supabase URL ou Key não encontradas no .env');
    return;
  }
  sb = createClient(url, key);
  carregar().then(() => route());
}

function route() {
  if (location.hash === '#admin') { adminLogged ? showAdmin() : showLogin() }
  else goPublic();
}

window.addEventListener('hashchange', route);

function goPublic() {
  location.hash = ''; show('view-public');
  const nr = G('nav-right');
  if (nr) {
    nr.innerHTML = `<button class="btn btn-ghost btn-sm" id="btn-goto-admin">🔐 Admin</button>`;
    G('btn-goto-admin').addEventListener('click', () => { location.hash = '#admin'; });
  }
  renderPublic(produtos); buildCats();
}

function showLogin() {
  show('view-login');
  G('nav-right').innerHTML = `<button class="btn btn-ghost btn-sm" id="btn-back">← Voltar</button>`;
  G('btn-back').addEventListener('click', goPublic);
}

function showAdmin() {
  show('view-admin');
  G('nav-right').innerHTML = `<span style="font-size:12px;color:var(--text2);padding:0 4px">● Admin</span>`;
  renderAdmin();
}

function doLogin() {
  const pass = G('login-pass').value;
  const stored = import.meta.env.VITE_ADMIN_PASSWORD;

  if (pass === stored) {
    adminLogged = true; G('login-err').style.display = 'none'; G('login-pass').value = ''; showAdmin();
  } else { G('login-err').style.display = 'block' }
}

function logoutAdmin() { adminLogged = false; goPublic() }

async function carregar() {
  if (!sb) return;
  const { data, error } = await sb.from('produtos').select('*').order('created_at', { ascending: false });
  if (error) { toast('Erro ao carregar: ' + error.message, 'err'); return }
  produtos = data || [];
}

function buildCats() {
  const cats = ['Todos', ...new Set(produtos.map(p => p.categoria).filter(Boolean))];
  G('pub-cats').innerHTML = cats.map(c => `<button class="cat-btn${c === catAtiva ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', (e) => setCat(e.target.dataset.cat));
  });
}
function setCat(c) { catAtiva = c; buildCats(); filtrarPublico() }
function filtrarPublico() {
  const q = G('pub-search').value.toLowerCase();
  const lista = produtos.filter(p => {
    const mc = catAtiva === 'Todos' || (p.categoria || '') === catAtiva;
    const mq = p.nome.toLowerCase().includes(q) || (p.descricao || '').toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q);
    return mc && mq;
  });
  renderPublic(lista);
}

function thumb(p, idx = 0) {
  const img = (p.imagens && p.imagens.length > idx) ? p.imagens[idx] : p.imagem_url;
  return img
    ? `<img src="${esc(img)}" alt="${esc(p.nome)}" onerror="this.parentElement.innerHTML='<svg viewBox=\\'0 0 24 24\\'><rect x=\\'2\\' y=\\'3\\' width=\\'20\\' height=\\'14\\' rx=\\'2\\'/><path d=\\'M8 21h8M12 17v4\\'/></svg>'">`
    : `<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
}

window.comprar = function (nome, preco) {
  const msg = encodeURIComponent(`Olá! Me interessei pelo dispositivo: *${nome}* — R$ ${preco}. Poderia me dar mais informações?`);
  window.open(`https://wa.me/${WA}?text=${msg}`, '_blank');
}

window.editarProduto = function (pid) {
  const p = produtos.find(x => x.id === pid); if (!p) return;
  G('edit-id').value = p.id; G('f-nome').value = p.nome; G('f-preco').value = p.preco;
  G('f-desc').value = p.descricao || ''; G('f-cat').value = p.categoria || '';
  selectedFiles = [];
  renderPreviews((p.imagens || []).map(url => ({ url })));
  G('form-title').textContent = 'Editar Produto'; G('f-btn-txt').textContent = 'Atualizar';
  G('cancel-wrap').style.display = 'block'; window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.excluir = async function (pid) {
  if (!confirm('Remover este produto?')) return;
  const { error } = await sb.from('produtos').delete().eq('id', pid);
  if (error) { toast('Erro: ' + error.message, 'err'); return }
  toast('Removido', 'ok'); await carregar(); renderAdmin();
}

function renderPublic(lista) {
  const g = G('pub-grid');
  if (!lista.length) { g.innerHTML = `<div class="empty"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg><p>Nenhum produto encontrado.</p></div>`; return }
  g.innerHTML = lista.map((p, i) => `
    <div class="product-card" style="animation-delay:${i * .05}s" onclick="openProductModal('${p.id}')">
      <div class="card-thumb" style="cursor:pointer">${thumb(p)}</div>
      <div class="card-body">
        <div class="info">
          ${p.categoria ? `<div class="card-cat">${esc(p.categoria)}</div>` : ''}
          <div class="card-name">${esc(p.nome)}</div>
          ${p.descricao ? `<div class="card-desc">${esc(p.descricao)}</div>` : ''}
          <div class="card-row">
            <div class="card-price"><sup>R$</sup>${fmt(p.preco)}</div>
            ${p.imagens && p.imagens.length > 1 ? `<span class="badge">+${p.imagens.length - 1} fotos</span>` : ''}
          </div>
        </div>
        <button class="btn-wa" onclick="event.stopPropagation();comprar('${esc(p.nome)}','${fmt(p.preco)}')">
          Comprar via WhatsApp
        </button>
      </div>
    </div>`).join('');
}

window.openProductModal = function (pid) {
  const p = produtos.find(x => x.id === pid);
  if (!p) return;

  const mod = G('product-modal');
  G('modal-name').textContent = p.nome;
  G('modal-cat').textContent = p.categoria || '';
  G('modal-price').innerHTML = `<sup>R$</sup>${fmt(p.preco)}`;
  G('modal-desc').textContent = p.descricao || 'Sem descrição disponível.';

  const images = p.imagens && p.imagens.length ? p.imagens : [p.imagem_url].filter(Boolean);

  const mainImgWrap = G('modal-main-img');
  const thumbsGrid = G('modal-thumbnails');
  const actionWrap = G('modal-action-wrap');

  if (images.length > 0) {
    mainImgWrap.innerHTML = `<img src="${esc(images[0])}" id="modal-main-img-el">`;
    thumbsGrid.innerHTML = images.map((url, i) => `
      <div class="thumb-item${i === 0 ? ' active' : ''}" onclick="setModalMainImg('${esc(url)}', this)">
        <img src="${esc(url)}">
      </div>
    `).join('');
  } else {
    mainImgWrap.innerHTML = thumb(p);
    thumbsGrid.innerHTML = '';
  }

  actionWrap.innerHTML = `
    <button class="btn-wa" onclick="comprar('${esc(p.nome)}','${fmt(p.preco)}')">
      Comprar via WhatsApp
    </button>
  `;

  mod.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

window.setModalMainImg = function (url, el) {
  G('modal-main-img-el').src = url;
  document.querySelectorAll('.thumb-item').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

window.closeProductModal = function () {
  G('product-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

function renderAdmin() {
  G('adm-count').textContent = produtos.length;
  const l = G('adm-list');
  if (!produtos.length) { l.innerHTML = `<div class="empty"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg><p>Nenhum produto ainda.</p></div>`; return }
  l.innerHTML = produtos.map((p, i) => `
    <div class="admin-item" style="animation-delay:${i * .04}s">
      <div class="admin-thumb">${thumb(p)}</div>
      <div class="admin-info">
        <div class="name">${esc(p.nome)}</div>
        <div class="meta">${p.categoria || 'Sem categoria'}</div>
      </div>
      <div class="admin-price">R$ ${fmt(p.preco)}</div>
      <div class="admin-btns">
        <button class="btn btn-ghost btn-sm" onclick="editarProduto('${p.id}')">✏</button>
        <button class="btn btn-danger btn-sm" onclick="excluir('${p.id}')">✕</button>
      </div>
    </div>`).join('');
}

async function uploadFiles() {
  const urls = [];
  for (const file of selectedFiles) {
    if (file.url && !file.file) { urls.push(file.url); continue; }
    const ext = file.file.name.split('.').pop();
    const name = `${Math.random().toString(36).slice(2)}_${Date.now()}.${ext}`;
    const { data, error } = await sb.storage.from('produtos').upload(name, file.file);
    if (error) throw error;
    const { data: { publicUrl } } = sb.storage.from('produtos').getPublicUrl(name);
    urls.push(publicUrl);
  }
  return urls;
}

async function salvar() {
  const eid = G('edit-id').value, nome = G('f-nome').value.trim(), preco = parseFloat(G('f-preco').value),
    descricao = G('f-desc').value.trim(), categoria = G('f-cat').value.trim();
  if (!nome) { toast('Informe o nome', 'err'); return }
  if (isNaN(preco) || preco < 0) { toast('Preço inválido', 'err'); return }

  try {
    G('btn-save').disabled = true;
    G('f-btn-txt').textContent = 'Enviando fotos...';

    const imagens = await uploadFiles();
    const payload = { nome, preco, descricao, categoria, imagens };

    let error;
    if (eid) { ({ error } = await sb.from('produtos').update(payload).eq('id', eid)) }
    else { ({ error } = await sb.from('produtos').insert(payload)) }

    if (error) throw error;

    toast(eid ? 'Atualizado!' : 'Produto adicionado!', 'ok');
    resetForm(); await carregar(); renderAdmin();
  } catch (err) {
    toast('Erro: ' + err.message, 'err');
  } finally {
    G('btn-save').disabled = false;
    G('f-btn-txt').textContent = eid ? 'Atualizar' : 'Salvar Produto';
  }
}

function resetForm() {
  ['edit-id', 'f-nome', 'f-preco', 'f-desc', 'f-cat', 'f-images'].forEach(x => {
    const el = G(x);
    if (el) el.value = '';
  });
  selectedFiles = [];
  renderPreviews([]);
  G('form-title').textContent = 'Novo Produto'; G('f-btn-txt').textContent = 'Salvar Produto';
  G('cancel-wrap').style.display = 'none';
}

function handleFiles(e) {
  const files = Array.from(e.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      selectedFiles.push({ file, preview: ev.target.result });
      renderPreviews();
    }
    reader.readAsDataURL(file);
  });
}

function renderPreviews(initial = null) {
  if (initial) {
    selectedFiles = initial.map(img => ({ url: img.url, preview: img.url }));
  }
  const grid = G('upload-previews');
  if (!grid) return;
  grid.innerHTML = selectedFiles.map((f, i) => `
    <div class="preview-item${i === 0 ? ' is-cover' : ''}">
      <img src="${f.preview}">
      <div class="preview-actions">
        ${i === 0 ? '<span class="capa-badge">Capa</span>' : `<button class="btn-set-cover" onclick="setCover(${i})">Usar como capa</button>`}
        <button class="preview-remove" onclick="removeFile(${i})">✕</button>
      </div>
    </div>
  `).join('');
}

window.setCover = function (i) {
  const item = selectedFiles.splice(i, 1)[0];
  selectedFiles.unshift(item);
  renderPreviews();
}

window.removeFile = function (i) {
  selectedFiles.splice(i, 1);
  renderPreviews();
}

function show(v) { ['view-public', 'view-login', 'view-admin'].forEach(x => G(x).classList[x === v ? 'remove' : 'add']('hidden')) }
function fmt(v) { return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function G(x) { return document.getElementById(x) }

let _tt;
window.toast = function (msg, type = 'ok') {
  const t = G('toast'); t.textContent = (type === 'ok' ? '✓ ' : '⚠ ') + msg;
  t.className = 'show ' + type; clearTimeout(_tt); _tt = setTimeout(() => t.className = '', 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  boot();
  G('logo-btn').addEventListener('click', goPublic);
  G('pub-search').addEventListener('input', filtrarPublico);
  if (G('login-pass')) G('login-pass').addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());
  G('btn-login').addEventListener('click', doLogin);
  G('btn-logout').addEventListener('click', logoutAdmin);
  G('btn-save').addEventListener('click', salvar);
  G('btn-cancel').addEventListener('click', resetForm);
  if (G('f-images')) G('f-images').addEventListener('change', handleFiles);

  const da = G('drop-area');
  if (da) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(n => da.addEventListener(n, e => { e.preventDefault(); e.stopPropagation() }));
    ['dragenter', 'dragover'].forEach(n => da.addEventListener(n, () => da.classList.add('highlight')));
    ['dragleave', 'drop'].forEach(n => da.addEventListener(n, () => da.classList.remove('highlight')));
    da.addEventListener('drop', e => handleFiles({ target: { files: e.dataTransfer.files } }));
  }
});
