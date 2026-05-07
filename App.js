/* ═══════════════════════════════════════════════════════
   UniFind — shared utilities
   app.js  (include on every page)
═══════════════════════════════════════════════════════ */

const API_BASE = 'http://localhost:3000/api';   // ← change to your backend URL in production

/* ─── AUTH ───────────────────────────────────────────── */
const Auth = {
  getToken:   () => localStorage.getItem('uf_token'),
  getUser:    () => { try { return JSON.parse(localStorage.getItem('uf_user')); } catch { return null; } },
  isLoggedIn: () => !!localStorage.getItem('uf_token'),
  hasRole:    (role) => { const u = Auth.getUser(); return u && (u.role === role || u.role === 'admin'); },
  save(token, user) { localStorage.setItem('uf_token', token); localStorage.setItem('uf_user', JSON.stringify(user)); },
  clear() { localStorage.removeItem('uf_token'); localStorage.removeItem('uf_user'); },
  requireLogin() { if (!Auth.isLoggedIn()) { window.location.href = '/auth.html'; return false; } return true; },
};

/* ─── API ─────────────────────────────────────────────── */
const API = {
  async request(method, path, body = null, isForm = false) {
    const headers = {};
    if (Auth.getToken()) headers['Authorization'] = 'Bearer ' + Auth.getToken();
    if (body && !isForm) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isForm ? body : JSON.stringify(body);

    const res = await fetch(API_BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  },
  get:    (path)         => API.request('GET',    path),
  post:   (path, body)   => API.request('POST',   path, body),
  patch:  (path, body)   => API.request('PATCH',  path, body),
  delete: (path)         => API.request('DELETE', path),
  upload: (path, form)   => API.request('POST',   path, form, true),
};

/* ─── TOAST ───────────────────────────────────────────── */
function ensureToastContainer() {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  return c;
}
function showToast(msg, type = 'info', duration = 3500) {
  const c = ensureToastContainer();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, duration);
}

/* ─── NAVBAR RENDERER ─────────────────────────────────── */
function renderNavbar(activePage = '') {
  const user = Auth.getUser();
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const links = [
    { href: '/index.html',        label: 'Browse',      key: 'browse' },
    { href: 'Report lost.html', label: '+ Report Lost', key: 'lost' },
    { href: 'Report found.html',label: '+ Report Found',key: 'found' },
  ];

  const linksHtml = links.map(l =>
    `<a href="${l.href}" class="nav-link ${activePage === l.key ? 'active' : ''}">${l.label}</a>`
  ).join('');

  let rightHtml = '';
  if (user) {
    const initials = user.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) : '?';
    rightHtml = `
      <span class="nav-role-badge">${user.role}</span>
      <a href="Notifications.html" style="font-size:1.1rem;position:relative" title="Notifications">
        🔔<span id="notif-dot" style="display:none;position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:var(--accent)"></span>
      </a>
      <a href="Dashboard.html" class="nav-avatar" title="${user.name}">${initials}</a>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Logout</button>
    `;
  } else {
    rightHtml = `<a href="/auth.html" class="nav-btn">Sign In</a>`;
  }

  nav.innerHTML = `
    <a class="nav-logo" href="/index.html">🔍 Uni<span>Find</span></a>
    ${linksHtml}
    ${rightHtml}
  `;

  // check unread notifications
  if (user) checkNotifDot();
}

async function checkNotifDot() {
  try {
    const data = await API.get('/notifications?unread=true');
    const dot = document.getElementById('notif-dot');
    if (dot && data.count > 0) dot.style.display = 'block';
  } catch {}
}

function logout() {
  Auth.clear();
  showToast('Logged out', 'info');
  setTimeout(() => window.location.href = '/auth.html', 600);
}

/* ─── ITEM CARD RENDERER ──────────────────────────────── */
function renderItemCard(item, type) {
  const badgeClass  = type === 'lost' ? 'badge-lost' : 'badge-found';
  const badgeLabel  = type === 'lost' ? '😟 Lost' : '✅ Found';
  const statusClass = { open:'badge-open', matched:'badge-match', resolved:'badge-resolved', claimed:'badge-match' }[item.status] || 'badge-open';
  const img = item.image_url
    ? `<img src="${item.image_url}" alt="${item.title}" style="width:100%;height:180px;object-fit:cover;">`
    : `<div class="card-img">📦 No image</div>`;
  const date = item.lost_at || item.found_at || item.created_at;
  const timeAgo = date ? formatTimeAgo(date) : '';

  return `
    <div class="card" onclick="window.location.href='Item.html?type=${type}&id=${item.id}'" style="cursor:pointer">
      ${img}
      <div class="card-body">
        <div class="flex items-center justify-between mb-2">
          <span class="badge ${badgeClass}">${badgeLabel}</span>
          <span class="badge ${statusClass}">${item.status}</span>
        </div>
        <h3 style="font-size:.95rem;font-weight:700;margin-bottom:4px">${escHtml(item.title)}</h3>
        <p class="text-sm text-muted" style="margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escHtml(item.description)}</p>
        <div class="flex gap-2" style="flex-wrap:wrap">
          ${item.category ? `<span class="tag">📂 ${escHtml(item.category)}</span>` : ''}
          ${item.location ? `<span class="tag">📍 ${escHtml(item.location)}</span>` : ''}
        </div>
        <p class="text-xs text-muted mt-2">${timeAgo}</p>
      </div>
    </div>
  `;
}

/* ─── HELPERS ─────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function setupImageUpload(zoneId, previewId, inputId) {
  const zone    = document.getElementById(zoneId);
  const preview = document.getElementById(previewId);
  const input   = document.getElementById(inputId);
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) { input.files = e.dataTransfer.files; showPreview(input.files[0]); }
  });
  input.addEventListener('change', () => { if (input.files[0]) showPreview(input.files[0]); });

  function showPreview(file) {
    if (!preview) return;
    const reader = new FileReader();
    reader.onload = e => { preview.src = e.target.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);
  }
}

/* ─── MODAL HELPERS ───────────────────────────────────── */
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

/* ─── TABS ────────────────────────────────────────────── */
function initTabs(containerSelector) {
  document.querySelectorAll(containerSelector + ' .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest(containerSelector);
      parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      parent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const pane = parent.querySelector('#' + btn.dataset.tab);
      if (pane) pane.classList.add('active');
    });
  });
}