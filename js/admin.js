const API = '/api';
const tokenKey = 'vitalia_admin_session';
const loginView = document.querySelector('#login-view');
const adminView = document.querySelector('#admin-view');
const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const globalNotice = document.querySelector('#global-notice');
const sections = {
  overview: document.querySelector('#section-overview'),
  leads: document.querySelector('#section-leads'),
  stories: document.querySelector('#section-stories')
};
let leads = [];
let stories = [];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function showNotice(message, error = false) {
  globalNotice.textContent = message;
  globalNotice.className = `notice${error ? ' error' : ''}`;
  globalNotice.hidden = false;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = sessionStorage.getItem(tokenKey);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/admin/login') {
    sessionStorage.removeItem(tokenKey);
    showLogin();
  }
  if (!response.ok) throw new Error(payload.error?.message || 'No fue posible completar la solicitud.');
  return payload;
}

function showLogin(message = '') {
  loginView.hidden = false;
  adminView.hidden = true;
  loginError.textContent = message;
  loginError.hidden = !message;
}

function showAdmin() {
  loginView.hidden = true;
  adminView.hidden = false;
  loadOverview().catch(error => showNotice(error.message, true));
}

function setSection(name) {
  Object.entries(sections).forEach(([key, element]) => { element.hidden = key !== name; });
  document.querySelectorAll('.side-link').forEach(button => button.classList.toggle('selected', button.dataset.section === name));
  document.querySelector('#page-title').textContent = { overview: 'Resumen', leads: 'Formularios', stories: 'Historias' }[name];
  globalNotice.hidden = true;
  if (name === 'leads') loadLeads().catch(error => showNotice(error.message, true));
  if (name === 'stories') loadStories().catch(error => showNotice(error.message, true));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function renderLeadRows(items, compact = false) {
  if (!items.length) return '<p class="empty">Todavía no hay formularios recibidos.</p>';
  const rows = items.map(lead => `<tr><td><strong>${escapeHtml(lead.nombre)}</strong><br><span>${escapeHtml(lead.email)}</span></td><td><span class="status-pill">${lead.type === 'partner' ? 'Alianza' : 'Contacto'}</span></td><td>${escapeHtml(lead.gimnasio || lead.interes || '—')}${lead.ciudad ? `<br>${escapeHtml(lead.ciudad)}` : ''}</td>${compact ? '' : `<td>${escapeHtml(lead.telefono || '—')}</td><td>${escapeHtml(lead.mensaje || '—')}</td>`}<td>${escapeHtml(formatDate(lead.createdAt))}</td></tr>`).join('');
  return `<table><thead><tr><th>Persona</th><th>Tipo</th><th>${compact ? 'Interés' : 'Detalle'}</th>${compact ? '' : '<th>Teléfono</th><th>Mensaje</th>'}<th>Fecha</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadOverview() {
  const data = await request('/admin/overview');
  document.querySelector('#contact-count').textContent = data.contacts;
  document.querySelector('#partner-count').textContent = data.partners;
  document.querySelector('#story-count').textContent = data.stories;
  document.querySelector('#recent-leads').innerHTML = renderLeadRows(data.recentLeads, true);
}

async function loadLeads() {
  const type = document.querySelector('#lead-filter').value;
  const data = await request(`/admin/leads${type === 'all' ? '' : `?type=${type}`}`);
  leads = data.leads;
  document.querySelector('#leads-table').innerHTML = renderLeadRows(leads);
}

function storyCard(story) {
  const image = story.image ? `<img src="${escapeHtml(story.image)}" alt="${escapeHtml(story.person)}" loading="lazy">` : '';
  return `<article class="story-card">${image}<div class="story-body"><h3>${escapeHtml(story.title)}</h3><strong>${escapeHtml(story.person)}</strong><p>${escapeHtml(story.description)}</p>${story.result ? `<span class="status-pill">${escapeHtml(story.result)}</span>` : ''}<div class="story-actions"><button type="button" data-edit="${escapeHtml(story._id)}">Editar</button><button type="button" class="delete" data-delete="${escapeHtml(story._id)}">Eliminar</button></div></div></article>`;
}

async function loadStories() {
  const data = await request('/admin/stories');
  stories = data.stories;
  document.querySelector('#stories-list').innerHTML = stories.length
    ? stories.map(storyCard).join('')
    : '<div class="empty-state"><span class="empty-state-mark" aria-hidden="true">✦</span><h2>Sin historias</h2><p>Aún no has publicado ninguna historia.</p></div>';
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = loginForm.querySelector('button');
  button.disabled = true;
  loginError.hidden = true;
  try {
    const data = await request('/admin/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(loginForm))) });
    sessionStorage.setItem(tokenKey, data.token);
    loginForm.reset();
    showAdmin();
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll('.side-link').forEach(button => button.addEventListener('click', () => setSection(button.dataset.section)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => setSection(button.dataset.go)));
document.querySelector('#lead-filter').addEventListener('change', () => loadLeads().catch(error => showNotice(error.message, true)));
document.querySelector('#logout-button').addEventListener('click', () => {
  sessionStorage.removeItem(tokenKey);
  showLogin();
});

const storyForm = document.querySelector('#story-form');
const storyError = document.querySelector('#story-error');
const cancelEdit = document.querySelector('#cancel-edit');

storyForm.addEventListener('submit', async event => {
  event.preventDefault();
  storyError.hidden = true;
  const button = storyForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const formData = new FormData(storyForm);
    const id = formData.get('id');
    formData.delete('id');
    await request(`/admin/stories${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body: formData });
    storyForm.reset();
    storyForm.elements.id.value = '';
    document.querySelector('#story-form-title').textContent = 'Añadir historia';
    cancelEdit.hidden = true;
    await Promise.all([loadStories(), loadOverview()]);
    showNotice('Caso de éxito guardado.');
  } catch (error) {
    storyError.textContent = error.message;
    storyError.hidden = false;
  } finally {
    button.disabled = false;
  }
});

cancelEdit.addEventListener('click', () => {
  storyForm.reset();
  storyForm.elements.id.value = '';
  document.querySelector('#story-form-title').textContent = 'Añadir historia';
  cancelEdit.hidden = true;
  storyError.hidden = true;
});

document.querySelector('#stories-list').addEventListener('click', async event => {
  const editButton = event.target.closest('[data-edit]');
  const deleteButton = event.target.closest('[data-delete]');
  if (editButton) {
    const story = stories.find(item => item._id === editButton.dataset.edit);
    if (!story) return;
    storyForm.elements.id.value = story._id;
    storyForm.elements.title.value = story.title;
    storyForm.elements.person.value = story.person;
    storyForm.elements.description.value = story.description;
    storyForm.elements.result.value = story.result || '';
    document.querySelector('#story-form-title').textContent = 'Editar historia';
    cancelEdit.hidden = false;
    storyForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (deleteButton) {
    try {
      await request(`/admin/stories/${encodeURIComponent(deleteButton.dataset.delete)}`, { method: 'DELETE' });
      await Promise.all([loadStories(), loadOverview()]);
      showNotice('Caso de éxito eliminado.');
    } catch (error) {
      showNotice(error.message, true);
    }
  }
});

if (sessionStorage.getItem(tokenKey)) showAdmin();
else showLogin();
