/* ══════════════════════════════════════════════════════════════
   VFX HOURS TRACKER — app.js
   ══════════════════════════════════════════════════════════════ */

// Tarifas diarias VFX (1 día = 8 horas)
const DAILY_RATES = [200, 250, 300, 350, 400, 450];

function dailyRateSelect(id, currentHourlyRate) {
  const daily = currentHourlyRate ? Math.round(currentHourlyRate * 8) : '';
  const options = DAILY_RATES.map(r =>
    `<option value="${r}" ${daily == r ? 'selected' : ''}>${r} €/día</option>`
  ).join('');
  return `
    <select id="${id}" onchange="document.getElementById('${id}-custom').style.display=this.value==='custom'?'block':'none'">
      <option value="" ${!daily ? 'selected' : ''}>— Selecciona tarifa —</option>
      ${options}
      <option value="custom" ${daily && !DAILY_RATES.includes(daily) ? 'selected' : ''}>Personalizada...</option>
    </select>
    <input type="number" id="${id}-custom" placeholder="Tarifa personalizada €/día" step="0.5" min="0"
      style="margin-top:6px;display:${daily && !DAILY_RATES.includes(daily) ? 'block' : 'none'}"
      value="${daily && !DAILY_RATES.includes(daily) ? daily : ''}">
  `;
}

function getDailyRateValue(id) {
  const sel = document.getElementById(id);
  if (!sel) return 0;
  if (sel.value === 'custom') return parseFloat(document.getElementById(id + '-custom')?.value) || 0;
  return parseFloat(sel.value) || 0;
}

const VFX = {

  // ── STATE ──────────────────────────────────────────────────
  state: {
    view: 'dashboard',
    statsView: 'general',
    statsPeriod: '1y',
    statsCustomFrom: '',
    statsCustomTo: '',
    statsProjectId: null,
    dashboardFilter: 'all',
    currentProjectId: null,
    slots: [],
    projects: [],
    companies: [],
    entries: [],
    invoices: [],
    user: {},
    stats: { periodic: [], heatmap: [], clients: [], summary: {} },
    treasury: []
  },

  charts: {},
  _modalDragFromInside: false,

  // ── PRIVACY ────────────────────────────────────────────────
  privacy: {
    on: false,
    load() {
      const def = localStorage.getItem('vfx_privacy_default') === 'true';
      const saved = localStorage.getItem('vfx_privacy_on');
      this.on = saved !== null ? saved === 'true' : def;
    },
    save() { localStorage.setItem('vfx_privacy_on', this.on); },
    async checkLocation() {
      if (localStorage.getItem('vfx_privacy_location') !== 'true') return;
      const homeLat = parseFloat(localStorage.getItem('vfx_home_lat'));
      const homeLng = parseFloat(localStorage.getItem('vfx_home_lng'));
      if (!homeLat || !homeLng) return;
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 6000 })
        );
        const dist = this._dist(pos.coords.latitude, pos.coords.longitude, homeLat, homeLng);
        const radius = parseFloat(localStorage.getItem('vfx_home_radius') || '500');
        this.on = dist > radius;
        this.save();
      } catch(_) { /* sin permiso o sin GPS, dejar estado actual */ }
    },
    _dist(a1, b1, a2, b2) {
      const R = 6371000, r = Math.PI / 180;
      const dA = (a2 - a1) * r, dB = (b2 - b1) * r;
      const x = Math.sin(dA/2)**2 + Math.cos(a1*r) * Math.cos(a2*r) * Math.sin(dB/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }
  },

  togglePrivacy() {
    this.privacy.on = !this.privacy.on;
    this.privacy.save();
    this.applyPrivacy();
  },

  applyPrivacy() {
    document.body.classList.toggle('privacy-mode', this.privacy.on);
    const eyeOn = document.getElementById('privacy-icon-eye');
    const eyeOff = document.getElementById('privacy-icon-off');
    const btn = document.getElementById('privacy-toggle');
    if (eyeOn) eyeOn.style.display = this.privacy.on ? 'none' : 'block';
    if (eyeOff) eyeOff.style.display = this.privacy.on ? 'block' : 'none';
    if (btn) {
      btn.classList.toggle('active', this.privacy.on);
      btn.title = this.privacy.on ? 'Mostrar cifras' : 'Ocultar cifras (modo privacidad)';
    }
  },

  // ── SLOTS (un panel por proyecto) ─────────────────────────
  // state.slots = [{ projectId, entries, timer: { active, paused, startTime, accumulated, interval } }]

  _slotsLoad() {
    try {
      const saved = localStorage.getItem('vfx_slots');
      if (saved) {
        this.state.slots = JSON.parse(saved).map(s => ({
          projectId: s.projectId || null,
          timerProjectId: s.timerProjectId || s.projectId || null,
          entries: [],
          timer: { active: s.timer?.active||false, paused: s.timer?.paused||false,
                   startTime: s.timer?.startTime||null, accumulated: s.timer?.accumulated||0, interval: null }
        }));
        return;
      }
      const old = localStorage.getItem('vfx_timer');
      const pid = localStorage.getItem('vfx_current_project');
      if (old && pid) {
        const t = JSON.parse(old);
        this.state.slots = [{ projectId: parseInt(pid), timerProjectId: parseInt(pid), entries: [],
          timer: { active: t.active||false, paused: t.paused||false,
                   startTime: t.startTime||null, accumulated: t.accumulated||0, interval: null } }];
        return;
      }
    } catch(_) {}
    this.state.slots = [{ projectId: null, timerProjectId: null, entries: [], timer: { active: false, paused: false, startTime: null, accumulated: 0, interval: null } }];
  },

  _slotsSave() {
    localStorage.setItem('vfx_slots', JSON.stringify(
      this.state.slots.map(s => ({
        projectId: s.projectId,
        timerProjectId: s.timerProjectId,
        timer: { active: s.timer.active, paused: s.timer.paused, startTime: s.timer.startTime, accumulated: s.timer.accumulated }
      }))
    ));
  },

  _slotElapsed(idx) {
    const t = this.state.slots[idx]?.timer;
    if (!t?.active) return 0;
    if (t.paused) return t.accumulated;
    return t.accumulated + (t.startTime ? (Date.now() - new Date(t.startTime).getTime()) / 1000 : 0);
  },

  _slotFmt(idx) {
    const s = Math.floor(this._slotElapsed(idx));
    return [Math.floor(s/3600), Math.floor((s%3600)/60), s%60].map(n => String(n).padStart(2,'0')).join(':');
  },

  _startSlotInterval(idx) {
    const slot = this.state.slots[idx];
    if (!slot) return;
    if (slot.timer.interval) clearInterval(slot.timer.interval);
    slot.timer.interval = setInterval(() => {
      const el = document.getElementById(`timer-display-${idx}`);
      if (el) el.textContent = this._slotFmt(idx);
    }, 1000);
  },

  addSlot() {
    this.state.slots.push({ projectId: null, entries: [], timer: { active: false, paused: false, startTime: null, accumulated: 0, interval: null } });
    this._slotsSave();
    this.renderProyecto();
  },

  removeSlot(idx) {
    const slot = this.state.slots[idx];
    if (slot?.timer.interval) clearInterval(slot.timer.interval);
    this.state.slots.splice(idx, 1);
    if (this.state.slots.length === 0)
      this.state.slots = [{ projectId: null, entries: [], timer: { active: false, paused: false, startTime: null, accumulated: 0, interval: null } }];
    this._slotsSave();
    this.renderProyecto();
  },

  async selectSlotProject(idx, projectId) {
    const slot = this.state.slots[idx];
    if (!slot) return;
    slot.projectId = projectId ? parseInt(projectId) : null;
    slot.entries   = projectId ? await this.api.get(`/api/projects/${projectId}/entries`) : [];
    this._slotsSave();
    if (projectId) { this.state.currentProjectId = parseInt(projectId); this.refreshCockpit(); }
    this.renderProyecto();
  },

  // ── API ────────────────────────────────────────────────────
  api: {
    async get(url) {
      const r = await fetch(url);
      return r.json();
    },
    async post(url, data) {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      return r.json();
    },
    async put(url, data) {
      const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      return r.json();
    },
    async del(url) {
      const r = await fetch(url, { method: 'DELETE' });
      return r.json();
    }
  },

  // ── UTILS ──────────────────────────────────────────────────
  fmt: {
    currency(n) {
      return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
    },
    hours(h) {
      return `${parseFloat(h || 0).toFixed(1)} h`;
    },
    days(h) {
      const d = parseFloat(h || 0) / 8;
      return `${d.toFixed(2)} días`;
    },
    date(d) {
      if (!d) return '—';
      return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    },
    month(ym) {
      const [y, m] = ym.split('-');
      const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      return `${names[parseInt(m)-1]} ${y}`;
    }
  },

  animateValue(el, target, isCurrency = false) {
    if (!el) return;
    const start = parseFloat(el.dataset.val || '0');
    const duration = 400;
    const startTime = performance.now();
    const step = (now) => {
      const p = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      const val = start + (target - start) * ease;
      el.textContent = isCurrency ? VFX.fmt.currency(val) : VFX.fmt.hours(val);
      el.dataset.val = val;
      if (p < 1) requestAnimationFrame(step);
      else { el.dataset.val = target; el.textContent = isCurrency ? VFX.fmt.currency(target) : VFX.fmt.hours(target); }
    };
    requestAnimationFrame(step);
  },

  savePrivacyDefault(val) {
    localStorage.setItem('vfx_privacy_default', val);
  },

  toggleLocationPrivacy(enabled) {
    localStorage.setItem('vfx_privacy_location', enabled);
    const block = document.getElementById('location-settings-block');
    if (block) block.style.display = enabled ? 'block' : 'none';
  },

  saveHomeLocation() {
    if (!navigator.geolocation) return alert('Tu navegador no soporta geolocalización');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        localStorage.setItem('vfx_home_lat', pos.coords.latitude);
        localStorage.setItem('vfx_home_lng', pos.coords.longitude);
        const el = document.getElementById('home-location-display');
        if (el) el.textContent = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
        alert('✓ Ubicación de casa guardada correctamente');
      },
      () => alert('No se pudo obtener tu ubicación. Comprueba los permisos del navegador.')
    );
  },

  // ── INIT ───────────────────────────────────────────────────
  async init() {
    // Comprobar auth (redirige a login si hace falta)
    const authRes = await fetch('/api/auth/me');
    if (authRes.status === 401) { window.location.href = '/login.html'; return; }
    const authData = await authRes.json();
    this.state.requireAuth = authData.requireAuth;

    this.privacy.load();
    await this.privacy.checkLocation();
    this.applyPrivacy();
    this._slotsLoad();
    await this.loadAll();

    // Restaurar proyecto activo desde localStorage
    const savedId = localStorage.getItem('vfx_current_project');
    if (savedId) {
      const exists = this.state.projects.find(p => p.id === parseInt(savedId));
      if (exists) {
        this.state.currentProjectId = parseInt(savedId);
        const entries = await this.api.get(`/api/projects/${savedId}/entries`);
        this.state.entries = entries;
      }
    }

    const hasActive = this.state.slots.some(s => s.timer.active);
    if (hasActive) {
      this.navigate('proyecto');
      this.state.slots.forEach((s, i) => { if (s.timer.active && !s.timer.paused) this._startSlotInterval(i); });
    } else {
      this.navigate('dashboard');
    }

    document.addEventListener('click', () => {
      document.querySelectorAll('[id^="status-dd-"]').forEach(d => d.style.display = 'none');
    });

    if (!this.state.user.name) {
      setTimeout(() => this.modals.settings(), 300);
    }
  },

  async loadAll() {
    const [user, projects, companies] = await Promise.all([
      this.api.get('/api/user'),
      this.api.get('/api/projects'),
      this.api.get('/api/companies')
    ]);
    this.state.user = user;
    this.state.projects = projects;
    this.state.companies = companies;
    this.updateSidebarUser();
  },

  async loadStats() {
    return this.loadStatsRange(this.state.statsPeriod);
  },

  periodDates(period) {
    const today = new Date().toISOString().split('T')[0];
    const ago = (days) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split('T')[0]; };
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const twoYearsAgo = `${new Date().getFullYear() - 2}-01-01`;
    if (period === 'custom') {
      const from = this.state.statsCustomFrom || yearStart;
      const to   = this.state.statsCustomTo   || today;
      const days = (new Date(to) - new Date(from)) / 86400000;
      const group = days <= 60 ? 'day' : days <= 180 ? 'week' : 'month';
      return { from, to, group };
    }
    switch (period) {
      case '7d':  return { from: ago(7),   to: today, group: 'day' };
      case '1m':  return { from: ago(30),  to: today, group: 'day' };
      case '3m':  return { from: ago(90),  to: today, group: 'week' };
      case '6m':  return { from: ago(180), to: today, group: 'week' };
      case '2y':  return { from: twoYearsAgo, to: today, group: 'month' };
      case 'all': return { from: '2000-01-01', to: today, group: 'month' };
      default:    return { from: yearStart, to: today, group: 'month' }; // '1y'
    }
  },

  async loadStatsRange(period) {
    const { from, to, group } = this.periodDates(period);
    const [periodic, heatmap, clients, summary] = await Promise.all([
      this.api.get(`/api/stats/monthly?from=${from}&to=${to}&group=${group}`),
      this.api.get('/api/stats/heatmap'),
      this.api.get(`/api/stats/clients?from=${from}&to=${to}`),
      this.api.get(`/api/stats/summary?from=${from}&to=${to}`)
    ]);
    this.state.stats = { periodic, heatmap, clients, summary };
  },

  async loadTreasury() {
    try {
      const data = await this.api.get('/api/stats/treasury');
      this.state.treasury = Array.isArray(data) ? data : [];
    } catch(_) {
      // Fallback: usar proyectos ya cargados con datos básicos
      this.state.treasury = this.state.projects.map(p => ({
        ...p, total_hours: p.total_hours || 0,
        total_amount: p.total_amount || 0, forecast_date: null
      }));
    }
  },

  updateSidebarUser() {
    const u = this.state.user;
    const name = u.name || 'Sin configurar';
    document.getElementById('sidebar-name').textContent = name;
    document.getElementById('sidebar-profession').textContent = u.profession || 'VFX Compositor';
    document.getElementById('sidebar-avatar').textContent = name[0]?.toUpperCase() || '?';
    // Mostrar logout solo si auth está activa
    const logoutBtn = document.getElementById('sidebar-logout');
    if (logoutBtn) logoutBtn.style.display = this.state.requireAuth ? 'flex' : 'none';
  },

  async logout() {
    await this.api.post('/api/auth/logout', {});
    window.location.href = '/login.html';
  },

  // ── NAVIGATION ─────────────────────────────────────────────
  navigate(view) {
    this.state.view = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');
    document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');

    if (view === 'dashboard') this.renderDashboard();
    if (view === 'proyecto') this.renderProyecto();
    if (view === 'stats') this.renderStats();
    if (view === 'facturas') this.renderFacturas();
    if (view === 'companies') this.renderCompanies();
    if (view === 'settings') this.renderSettings();
  },

  // ── DASHBOARD (overview facturación) ──────────────────────
  async renderDashboard() {
    const el = document.getElementById('view-dashboard');
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Cargando...</div>`;
    await this.loadTreasury();
    const all = this.state.treasury;
    const filter = this.state.dashboardFilter;

    const pending = all.filter(p => p.status === 'pending');
    const sent    = all.filter(p => p.status === 'sent');
    const paid    = all.filter(p => p.status === 'paid');

    const sumAmount = (arr) => arr.reduce((s, p) => s + (p.budget_type === 'fixed' && p.fixed_budget ? p.fixed_budget : p.total_amount), 0);

    const totalPendiente = sumAmount(pending) + sumAmount(sent);
    const totalEspera    = sumAmount(sent);
    const totalCobrado   = sumAmount(paid);

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    const previsionMes = sent
      .filter(p => p.forecast_date && p.forecast_date >= monthStart && p.forecast_date <= monthEnd)
      .reduce((s, p) => s + (p.budget_type === 'fixed' && p.fixed_budget ? p.fixed_budget : p.total_amount), 0);

    const filtered = filter === 'all' ? all
      : filter === 'open' ? all.filter(p => p.status !== 'paid')
      : all.filter(p => p.status === filter);

    const rows = filtered.map(p => this._dashboardRow(p)).join('');

    const btnCls = (f) => `btn btn-sm ${this.state.dashboardFilter === f ? 'btn-primary' : 'btn-ghost'}`;

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Dashboard</div>
          <div class="page-subtitle">${today.toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="VFX.modals.newProject()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Nuevo proyecto
          </button>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Por cobrar (total)</div>
          <div class="metric-value" style="color:var(--gold)" data-private>${this.fmt.currency(totalPendiente)}</div>
          <div class="metric-sub">${pending.length + sent.length} proyecto${pending.length + sent.length !== 1 ? 's' : ''} abiertos</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Facturas en espera</div>
          <div class="metric-value" style="color:var(--cyan)" data-private>${this.fmt.currency(totalEspera)}</div>
          <div class="metric-sub">${sent.length} enviada${sent.length !== 1 ? 's' : ''}, pendiente de cobro</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Previsión este mes</div>
          <div class="metric-value" style="color:var(--green)" data-private>${this.fmt.currency(previsionMes)}</div>
          <div class="metric-sub">facturas previstas en ${today.toLocaleDateString('es-ES',{month:'long'})}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Cobrado este año</div>
          <div class="metric-value" style="color:var(--text)" data-private>${this.fmt.currency(totalCobrado)}</div>
          <div class="metric-sub">${paid.length} proyecto${paid.length !== 1 ? 's' : ''} cobrados</div>
        </div>
      </div>

      <div class="table-container">
        <div class="table-header">
          <span class="table-title">PROYECTOS</span>
          <div style="display:flex;gap:6px">
            <button class="${btnCls('all')}" onclick="VFX.filterDashboard('all')">Todos</button>
            <button class="${btnCls('pending')}" onclick="VFX.filterDashboard('pending')">En curso</button>
            <button class="${btnCls('sent')}" onclick="VFX.filterDashboard('sent')">En espera</button>
            <button class="${btnCls('paid')}" onclick="VFX.filterDashboard('paid')">Cobradas</button>
          </div>
        </div>
        ${filtered.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th>Proyecto / Empresa</th>
                <th>Estado</th>
                <th>Horas</th>
                <th>Importe</th>
                <th>Previsión cobro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        ` : `<div class="empty-table"><p>No hay proyectos en esta categoría.</p></div>`}
      </div>
    `;
  },

  _dashboardRow(p) {
    const amount = (p.budget_type === 'fixed' && p.fixed_budget) ? p.fixed_budget : p.total_amount;
    const calIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
    const forecastHtml = p.forecast_date
      ? `<span style="display:inline-flex;align-items:center;gap:5px;color:#fff;font-size:13px;font-weight:500">${calIcon}${this.fmt.date(p.forecast_date)}</span>`
      : (p.status === 'sent' ? `<span style="display:inline-flex;align-items:center;gap:5px;color:var(--text3);font-size:13px">${calIcon}Sin fecha</span>` : '<span style="color:var(--text3)">—</span>');
    const completedBadge = p.is_completed
      ? `<span style="font-size:10px;background:rgba(78,205,196,0.12);color:var(--cyan);padding:2px 6px;border-radius:4px;margin-left:6px">Finalizado</span>`
      : '';
    const budgetBadge = p.budget_type === 'fixed'
      ? `<span style="font-size:10px;background:rgba(245,200,66,0.12);color:var(--gold);padding:2px 6px;border-radius:4px;margin-left:4px">Fijo</span>`
      : '';
    const isSelected = this.state.currentProjectId === p.id;
    return `
      <tr data-project-id="${p.id}"
        onclick="VFX.selectForCockpit(${p.id})"
        style="cursor:pointer;transition:background 0.15s${isSelected ? ';background:var(--card2)' : ''}">
        <td>
          <div style="font-weight:500">${p.name}${completedBadge}${budgetBadge}</div>
          <div style="font-size:11px;color:var(--text3)">${p.company_name}</div>
        </td>
        <td onclick="event.stopPropagation()">${this.renderStatusDropdown(p.id, p.status)}</td>
        <td class="mono">${this.fmt.hours(p.total_hours)}</td>
        <td class="gold mono" data-private>${this.fmt.currency(amount)}</td>
        <td>${forecastHtml}</td>
        <td class="actions" onclick="event.stopPropagation()">
          <button class="btn-icon" onclick="VFX.goToProject(${p.id})" data-tip="Ir a proyecto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button class="btn-icon" onclick="VFX.modals.editProject(${p.id})" data-tip="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </td>
      </tr>
    `;
  },

  async selectForCockpit(id) {
    this.state.currentProjectId = id;
    this.state.entries = await this.api.get(`/api/projects/${id}/entries`);
    this.refreshCockpit();
    // Resaltar fila activa
    document.querySelectorAll('tr[data-project-id]').forEach(r => r.classList.remove('row-active'));
    const row = document.querySelector(`tr[data-project-id="${id}"]`);
    if (row) row.classList.add('row-active');
  },

  filterDashboard(filter) {
    this.state.dashboardFilter = filter;
    this.renderDashboard();
  },

  async goToProject(id) {
    this.state.currentProjectId = id;
    localStorage.setItem('vfx_current_project', id);
    const entries = await this.api.get(`/api/projects/${id}/entries`);
    this.state.entries = entries;
    this.navigate('proyecto');
  },

  // ── PROYECTO EN CURSO ──────────────────────────────────────
  async renderProyecto() {
    // Cargar entradas de slots que tienen proyecto pero entries vacío
    await Promise.all(this.state.slots.map(async (slot, idx) => {
      if (slot.projectId && slot.entries.length === 0) {
        slot.entries = await this.api.get(`/api/projects/${slot.projectId}/entries`);
      }
    }));

    const el = document.getElementById('view-proyecto');
    const slotsHtml = this.state.slots.map((_, idx) => this._renderSlot(idx)).join('');

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Proyecto en curso</div>
          <div class="page-subtitle">${new Date().toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="VFX.modals.newProject()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Nuevo proyecto
          </button>
        </div>
      </div>

      ${slotsHtml}

      <button class="btn btn-ghost" onclick="VFX.addSlot()" style="margin-top:6px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
        Visualizar otro proyecto
      </button>
    `;

    // Reiniciar intervalos tras re-render
    this.state.slots.forEach((s, i) => {
      if (s.timer.active && !s.timer.paused) this._startSlotInterval(i);
    });

    if (this.state.currentProjectId) this.refreshCockpit();
  },

  _renderSlot(idx) {
    const slot    = this.state.slots[idx];
    const project = slot.projectId ? this.state.projects.find(p => p.id === slot.projectId) : null;
    const timerProject = slot.timerProjectId ? this.state.projects.find(p => p.id === slot.timerProjectId) : project;
    const t       = slot.timer;
    const isRunning = t.active && !t.paused;
    const canRemove = this.state.slots.length > 1;
    const timerIsForOtherProject = t.active && slot.timerProjectId && slot.timerProjectId !== slot.projectId;

    const projectOptions = this.state.projects.map(p =>
      `<option value="${p.id}" ${p.id === slot.projectId ? 'selected' : ''}>${p.name} — ${p.company_name}</option>`
    ).join('');

    const timerHtml = `
      <div class="timer-card ${isRunning ? 'active' : ''}" id="timer-card-${idx}" style="margin-top:14px">
        <div>
          <div class="timer-label">
            SESIÓN DE TRABAJO${t.active ? (t.paused ? ' — PAUSADA' : ' — EN CURSO') : ''}
            ${timerIsForOtherProject ? `<span style="color:var(--gold);margin-left:6px">· ${timerProject?.name || ''}</span>` : ''}
          </div>
          <div class="timer-display ${isRunning ? 'running' : ''}" id="timer-display-${idx}">
            ${t.active ? this._slotFmt(idx) : '00:00:00'}
          </div>
          ${!slot.projectId && !t.active ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">Selecciona un proyecto para iniciar</div>` : ''}
          ${timerIsForOtherProject ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">Viendo entradas de: ${project?.name || '—'}</div>` : ''}
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          ${!t.active ? `
            <button class="btn btn-primary" onclick="VFX.startTimer(${idx})" ${!slot.projectId ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Iniciar
            </button>
          ` : t.paused ? `
            <button class="btn btn-primary" onclick="VFX.resumeTimer(${idx})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Reanudar
            </button>
            <button class="btn btn-danger" onclick="VFX.stopTimer(${idx})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"/></svg>
              Finalizar
            </button>
          ` : `
            <button class="btn btn-ghost" onclick="VFX.pauseTimer(${idx})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              Pausar
            </button>
            <button class="btn btn-danger" onclick="VFX.stopTimer(${idx})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"/></svg>
              Finalizar
            </button>
          `}
        </div>
      </div>
    `;

    const entriesHtml = slot.projectId && slot.entries
      ? this.renderEntriesTable(slot.entries, slot.projectId, idx)
      : '';

    return `
      <div style="border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;background:var(--card)">
        <div class="project-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16" style="color:var(--text3);flex-shrink:0"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
          <select onchange="VFX.selectSlotProject(${idx}, this.value)">
            <option value="">— Selecciona un proyecto —</option>
            ${projectOptions}
          </select>
          ${slot.projectId ? `
            <button class="btn btn-ghost btn-sm" onclick="VFX.modals.editProject(${slot.projectId})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          ` : ''}
          ${canRemove ? `
            <button class="btn btn-ghost btn-sm" onclick="VFX.removeSlot(${idx})" style="color:var(--red);margin-left:auto" title="Dejar de visualizar este proyecto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ` : ''}
        </div>
        ${timerHtml}
        ${entriesHtml}
      </div>
    `;
  },

  renderNoProjectHint() {
    const hasProjects = this.state.projects.length > 0;
    return `
      <div class="no-project-hint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
        <h3>${hasProjects ? 'Selecciona un proyecto' : 'Comienza aquí'}</h3>
        <p>${hasProjects ? 'Elige un proyecto en el selector de arriba para ver sus entradas.' : 'Aún no tienes proyectos. Crea el primero para empezar a registrar tus horas.'}</p>
        ${!hasProjects ? `<button class="btn btn-primary btn-lg" onclick="VFX.modals.newProject()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Crear primer proyecto
        </button>` : ''}
      </div>
    `;
  },

  renderTimerCard(project) {
    const id = project.id;
    const t = this.timers.get(id);
    const isRunning = t.active && !t.paused;
    return `
      <div class="timer-card ${isRunning ? 'active' : ''}" id="timer-card-${id}">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <div class="timer-label">${project.name}</div>
            <div style="font-size:11px;color:var(--text3)">${project.company_name}</div>
          </div>
          <div class="timer-label" style="margin-bottom:6px">${t.paused ? 'PAUSADA' : 'EN CURSO'}</div>
          <div class="timer-display ${isRunning ? 'running' : ''}" id="timer-display-${id}">
            ${this.timers.fmt(id)}
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          ${t.paused ? `
            <button class="btn btn-primary" onclick="VFX.resumeTimer(${id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Reanudar
            </button>
          ` : `
            <button class="btn btn-ghost" onclick="VFX.pauseTimer(${id})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              Pausar
            </button>
          `}
          <button class="btn btn-danger" onclick="VFX.stopTimer(${id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"/></svg>
            Finalizar
          </button>
        </div>
      </div>
    `;
  },

  renderEntriesTable(entries = this.state.entries, projectId = this.state.currentProjectId, slotIdx = null) {
    const project = this.state.projects.find(p => p.id === projectId);
    const hourlyRate = project?.hourly_rate || 0;

    const rows = entries.map(e => {
      const effectiveHourly = e.hourly_rate_override || hourlyRate;
      const effectiveDaily = effectiveHourly * 8;
      const total = e.hours * effectiveHourly;
      const days = e.hours / 8;
      return `
        <tr>
          <td style="width:28px;padding-right:0"><input type="checkbox" class="entry-cb" data-id="${e.id}" onchange="VFX._onEntryCbChange()"></td>
          <td class="dim">${this.fmt.date(e.date)}</td>
          <td>${e.description || '<span style="color:var(--text3)">Sin descripción</span>'}</td>
          <td class="mono">${this.fmt.hours(e.hours)}<span style="font-size:10px;color:var(--text3);margin-left:4px">(${days.toFixed(2)}d)</span></td>
          <td class="mono dim" data-private>${this.fmt.currency(effectiveDaily)}/día</td>
          <td class="gold" data-private>${this.fmt.currency(total)}</td>
          <td class="actions">
            <button class="btn-icon" onclick="VFX.modals.editEntry(${e.id})" data-tip="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon" style="color:var(--red)" onclick="VFX.deleteEntry(${e.id})" data-tip="Eliminar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="table-container">
        <div class="table-header">
          <span class="table-title">ENTRADAS DE TIEMPO — ${entries.length} registro${entries.length !== 1 ? 's' : ''}</span>
          <div style="display:flex;gap:6px;align-items:center">
            <span id="bulk-rate-btn" style="display:none">
              <button class="btn btn-ghost btn-sm" onclick="VFX.openBulkRateModal(${projectId})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Cambiar tarifa seleccionadas
              </button>
            </span>
            <button class="btn btn-ghost btn-sm" onclick="VFX.state.currentProjectId=${projectId};${slotIdx!==null?`VFX._pendingSlotIdx=${slotIdx};`:``}VFX.modals.addEntry()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Añadir entrada
            </button>
          </div>
        </div>
        ${entries.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width:28px;padding-right:0"><input type="checkbox" id="entry-cb-all" onchange="VFX._toggleAllEntries(this.checked)"></th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Horas / Días</th>
                <th>€/día</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        ` : `
          <div class="empty-table">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <p>Aún no hay entradas en este proyecto.<br>Pulsa "Añadir entrada" o usa el cronómetro.</p>
          </div>
        `}
      </div>
    `;
  },

  _toggleAllEntries(checked) {
    document.querySelectorAll('.entry-cb').forEach(cb => { cb.checked = checked; });
    this._onEntryCbChange();
  },

  _onEntryCbChange() {
    const any = document.querySelectorAll('.entry-cb:checked').length > 0;
    const btn = document.getElementById('bulk-rate-btn');
    if (btn) btn.style.display = any ? 'inline' : 'none';
    const cbAll = document.getElementById('entry-cb-all');
    if (cbAll) {
      const total = document.querySelectorAll('.entry-cb').length;
      const checked = document.querySelectorAll('.entry-cb:checked').length;
      cbAll.indeterminate = checked > 0 && checked < total;
      cbAll.checked = checked === total;
    }
  },

  openBulkRateModal(projectId) {
    const proj = this.state.projects.find(p => p.id === projectId);
    const defaultDaily = proj ? Math.round(proj.hourly_rate * 8) : 0;
    const ids = [...document.querySelectorAll('.entry-cb:checked')].map(cb => parseInt(cb.dataset.id));
    if (!ids.length) return;
    this.openModal(`
      <p style="color:var(--text2);margin-bottom:16px">Cambiando tarifa de <strong style="color:var(--text)">${ids.length} entrada${ids.length !== 1 ? 's' : ''}</strong>.</p>
      <div class="form-group">
        <label>Nueva tarifa (€/día)</label>
        ${dailyRateSelect('bulk-rate', defaultDaily)}
      </div>
      <p style="font-size:11px;color:var(--text3);margin-top:8px">Selecciona "— Selecciona tarifa —" para eliminar la tarifa personalizada y usar la del proyecto.</p>
      <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:20px">
        <button class="btn btn-ghost" onclick="VFX.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="VFX.applyBulkRate(${JSON.stringify(ids)}, ${projectId})">Aplicar</button>
      </div>
    `, 'Cambiar tarifa en masa');
  },

  async applyBulkRate(ids, projectId) {
    const dailyVal = getDailyRateValue('bulk-rate');
    const rateOverride = dailyVal > 0 ? dailyVal / 8 : null;
    await Promise.all(ids.map(id => {
      const entry = this.state.entries.find(e => e.id === id);
      if (!entry) return;
      return this.api.put(`/api/entries/${id}`, {
        date: entry.date, hours: entry.hours,
        description: entry.description || '',
        hourly_rate_override: rateOverride
      });
    }));
    const fresh = await this.api.get(`/api/projects/${projectId}/entries`);
    this.state.entries = fresh;
    const slot = this.state.slots.find(s => s.projectId === projectId);
    if (slot) slot.entries = fresh;
    await this.loadAll();
    this.closeModal();
    this.renderProyecto();
  },

  async selectProject(id) {
    this.state.currentProjectId = id ? parseInt(id) : null;
    if (this.state.currentProjectId) {
      localStorage.setItem('vfx_current_project', this.state.currentProjectId);
      const entries = await this.api.get(`/api/projects/${this.state.currentProjectId}/entries`);
      this.state.entries = entries;
    } else {
      localStorage.removeItem('vfx_current_project');
      this.state.entries = [];
    }
    this.renderProyecto();
  },

  // ── COCKPIT ────────────────────────────────────────────────
  refreshCockpit() {
    const project = this.state.projects.find(p => p.id === this.state.currentProjectId);
    if (!project) {
      document.getElementById('cockpit-body').innerHTML = `
        <div class="cockpit-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
          <p>Selecciona un<br>proyecto</p>
        </div>
      `;
      document.querySelector('.cockpit-signal').classList.remove('live');
      return;
    }

    document.querySelector('.cockpit-signal').classList.add('live');

    const entries = this.state.entries;
    const hourlyRate = project.hourly_rate || 0;
    const dailyRate = hourlyRate * 8;
    const totalHours = entries.reduce((s, e) => s + e.hours, 0);
    const totalDays = totalHours / 8;
    const subtotal = entries.reduce((s, e) => s + e.hours * (e.hourly_rate_override || hourlyRate), 0);
    const iva = (this.state.user.iva_rate || 21) / 100;
    const irpf = (this.state.user.irpf_rate || 15) / 100;
    const ivaAmount = subtotal * iva;
    const irpfAmount = subtotal * irpf;
    const total = subtotal + ivaAmount - irpfAmount;

    // IRPF semáforo
    const yearEarnings = this.state.stats.summary?.total_earnings || subtotal;
    const meterPct = Math.min((yearEarnings / 30000) * 100, 100);
    const meterClass = meterPct < 33 ? 'low' : meterPct < 66 ? 'mid' : 'high';

    document.getElementById('cockpit-body').innerHTML = `
      <div class="cockpit-project">
        <div class="cockpit-project-name">${project.name}</div>
        <div class="cockpit-company">${project.company_name}</div>
        <div style="margin-top:8px">${this.renderBadge(project.status)}</div>
      </div>

      <div class="cockpit-section">
        <div class="cockpit-section-label">Resumen</div>
        <div class="cockpit-row">
          <span class="cockpit-row-label">Total horas</span>
          <span class="cockpit-row-value cyan">${this.fmt.hours(totalHours)}</span>
        </div>
        <div class="cockpit-row">
          <span class="cockpit-row-label">Total días</span>
          <span class="cockpit-row-value cyan">${totalDays.toFixed(2)} días</span>
        </div>
        <div class="cockpit-row">
          <span class="cockpit-row-label">Tarifa/día</span>
          <span class="cockpit-row-value" data-private>${this.fmt.currency(dailyRate)}</span>
        </div>
        <div class="cockpit-row">
          <span class="cockpit-row-label">Entradas</span>
          <span class="cockpit-row-value">${entries.length}</span>
        </div>
      </div>

      <div class="cockpit-section">
        <div class="cockpit-section-label">Desglose fiscal</div>
        <div class="cockpit-row">
          <span class="cockpit-row-label">Subtotal</span>
          <span class="cockpit-row-value" id="cp-subtotal" data-private>${this.fmt.currency(subtotal)}</span>
        </div>
        <div class="cockpit-row">
          <span class="cockpit-row-label">+ IVA (${this.state.user.iva_rate || 21}%)</span>
          <span class="cockpit-row-value green" id="cp-iva" data-private>+${this.fmt.currency(ivaAmount)}</span>
        </div>
        <div class="cockpit-row">
          <span class="cockpit-row-label">− IRPF (${this.state.user.irpf_rate || 15}%)</span>
          <span class="cockpit-row-value red" id="cp-irpf" data-private>−${this.fmt.currency(irpfAmount)}</span>
        </div>
      </div>

      <div class="cockpit-total">
        <div class="cockpit-total-label">Total neto a cobrar</div>
        <div class="cockpit-total-value" id="cp-total" data-private>${this.fmt.currency(total)}</div>
      </div>

      <div class="cockpit-irpf-meter">
        <div class="cockpit-section-label">Barómetro anual</div>
        <div class="meter-bar-bg">
          <div class="meter-bar-fill ${meterClass}" style="width:${meterPct}%"></div>
        </div>
        <div class="meter-label-row">
          <span class="meter-label-text" data-private>${this.fmt.currency(yearEarnings)}</span>
          <span class="meter-label-text">30.000 €</span>
        </div>
      </div>

      ${project.budget_type === 'fixed' && project.fixed_budget ? `
        <div class="cockpit-section">
          <div class="cockpit-section-label">Presupuesto cerrado</div>
          <div class="cockpit-row">
            <span class="cockpit-row-label">Presupuesto acordado</span>
            <span class="cockpit-row-value gold" data-private>${this.fmt.currency(project.fixed_budget)}</span>
          </div>
          <div class="cockpit-row">
            <span class="cockpit-row-label">Coste real (×tarifa)</span>
            <span class="cockpit-row-value" data-private>${this.fmt.currency(subtotal)}</span>
          </div>
          <div class="cockpit-row">
            <span class="cockpit-row-label">Balance cliente</span>
            <span class="cockpit-row-value ${project.fixed_budget - subtotal >= 0 ? 'green' : 'red'}" data-private>
              ${project.fixed_budget - subtotal >= 0 ? '+' : ''}${this.fmt.currency(project.fixed_budget - subtotal)}
            </span>
          </div>
        </div>
      ` : ''}

      <div class="cockpit-status">
        <div class="cockpit-section-label" style="margin-bottom:8px">Trabajo</div>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2);cursor:pointer;margin-bottom:10px">
          <input type="checkbox" ${project.is_completed ? 'checked' : ''} onchange="VFX.setProjectCompleted(${project.id}, this.checked)" style="width:14px;height:14px">
          Trabajo finalizado
        </label>
        <div class="cockpit-section-label" style="margin-bottom:8px">Facturación</div>
        <select onchange="VFX.updateProjectStatus(${project.id}, this.value)">
          <option value="pending" ${project.status === 'pending' ? 'selected' : ''}>⏳ Pendiente de envío</option>
          <option value="sent" ${project.status === 'sent' ? 'selected' : ''}>📤 Enviada / En espera</option>
          <option value="paid" ${project.status === 'paid' ? 'selected' : ''}>✅ Cobrada</option>
        </select>
        ${project.status === 'sent' || project.status === 'paid' ? `
          <div style="margin-top:10px">
            <label style="font-size:11px;color:var(--text3)">Fecha de envío de factura</label>
            <input type="date" value="${project.invoiced_at || ''}" style="margin-top:4px"
              onchange="VFX.updateInvoiceDate(${project.id}, this.value)">
          </div>
          <div style="margin-top:8px">
            <label style="font-size:11px;color:var(--text3)">Fecha de cobro esperada <span style="opacity:0.6">(manual)</span></label>
            <input type="date" value="${project.expected_payment_date || ''}" style="margin-top:4px"
              onchange="VFX.updateExpectedPayment(${project.id}, this.value)">
          </div>
        ` : ''}
      </div>

      <div class="cockpit-actions">
        <button class="btn btn-ghost w-full" onclick="VFX.exportProject(${project.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar datos (JSON)
        </button>
        <button class="btn btn-ghost w-full" onclick="VFX.printInvoice(${project.id})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir / PDF
        </button>
      </div>
    `;
  },

  renderBadge(status) {
    return `<span class="badge badge-${status}">${{pending:'Pendiente',sent:'Enviada',paid:'Cobrada'}[status]||status}</span>`;
  },

  renderStatusDropdown(projectId, status) {
    const labels = { pending:'⏳ Pendiente', sent:'📤 Enviada', paid:'✅ Cobrada' };
    const options = Object.entries(labels)
      .filter(([k]) => k !== status)
      .map(([k, v]) => `
        <div class="status-dd-option status-dd-${k}"
          onclick="VFX.quickSetStatus(${projectId},'${k}',event)">
          ${v}
        </div>
      `).join('');
    return `
      <div class="status-dd-wrap" style="position:relative;display:inline-block">
        <span class="badge badge-${status}" style="cursor:pointer;user-select:none"
          onclick="VFX.toggleStatusDropdown(${projectId},event)">
          ${labels[status]||status}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            width="10" height="10" style="margin-left:3px;vertical-align:middle">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </span>
        <div id="status-dd-${projectId}" style="display:none;
          background:var(--bg2);border:1px solid var(--border);border-radius:8px;
          min-width:150px;z-index:9999;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.4)">
          ${options}
        </div>
      </div>
    `;
  },

  toggleStatusDropdown(projectId, e) {
    e.stopPropagation();
    const dd = document.getElementById(`status-dd-${projectId}`);
    const isOpen = dd.style.display !== 'none';
    document.querySelectorAll('[id^="status-dd-"]').forEach(d => d.style.display = 'none');
    if (!isOpen) {
      const rect = e.currentTarget.getBoundingClientRect();
      dd.style.position = 'fixed';
      dd.style.top  = (rect.bottom + 4) + 'px';
      dd.style.left = rect.left + 'px';
      dd.style.display = 'block';
    }
  },

  async quickSetStatus(projectId, status, e) {
    e.stopPropagation();
    document.querySelectorAll('[id^="status-dd-"]').forEach(d => d.style.display = 'none');
    await this.updateProjectStatus(projectId, status);
    this.renderDashboard();
  },

  // ── STATS ──────────────────────────────────────────────────
  async renderStats() {
    const el = document.getElementById('view-stats');
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Cargando estadísticas...</div>`;

    await this.loadStats();

    const period = this.state.statsPeriod;
    const statsView = this.state.statsView;

    const PERIOD_LABELS = { '7d':'7 días','1m':'1 mes','3m':'3 meses','6m':'6 meses','1y':'Este año','2y':'2 años','all':'Todo' };
    const periodBtns = Object.entries(PERIOD_LABELS).map(([k, label]) =>
      `<button class="btn btn-sm ${period === k ? 'btn-primary' : 'btn-ghost'}" onclick="VFX.changeStatsPeriod('${k}')">${label}</button>`
    ).join('');

    const today = new Date().toISOString().split('T')[0];
    const customFrom = this.state.statsCustomFrom || `${new Date().getFullYear()}-01-01`;
    const customTo   = this.state.statsCustomTo   || today;

    const tabBtnCls = (v) => `btn btn-sm ${statsView === v ? 'btn-primary' : 'btn-ghost'}`;
    const projectOptions = this.state.projects.map(p =>
      `<option value="${p.id}" ${p.id === this.state.statsProjectId ? 'selected' : ''}>${p.name} — ${p.company_name}</option>`
    ).join('');

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Estadísticas</div>
          <div class="page-subtitle">Análisis de tu actividad freelance</div>
        </div>
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center">
        ${periodBtns}
        <button class="btn btn-sm ${period === 'custom' ? 'btn-primary' : 'btn-ghost'}" onclick="VFX.changeStatsPeriod('custom')">Rango</button>
        <div style="flex:1"></div>
        <button class="${tabBtnCls('general')}" onclick="VFX.changeStatsView('general')">General</button>
        <button class="${tabBtnCls('project')}" onclick="VFX.changeStatsView('project')">Por proyecto</button>
      </div>

      <div id="stats-custom-range" style="display:${period==='custom'?'flex':'none'};gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;background:var(--card);border:1px solid var(--border);border-radius:8px">
        <label style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px">Desde</label>
        <input type="date" id="stats-from" value="${customFrom}" style="background:var(--bg);border:1px solid var(--border2);border-radius:6px;color:var(--text);padding:6px 10px;font-size:13px;font-family:inherit">
        <label style="font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px">Hasta</label>
        <input type="date" id="stats-to" value="${customTo}" style="background:var(--bg);border:1px solid var(--border2);border-radius:6px;color:var(--text);padding:6px 10px;font-size:13px;font-family:inherit">
        <button class="btn btn-primary btn-sm" onclick="VFX.applyCustomRange()">Aplicar</button>
      </div>

      ${statsView === 'project' ? `
        <div style="margin-bottom:20px">
          <select style="max-width:400px" onchange="VFX.changeStatsProject(parseInt(this.value))">
            <option value="">— Selecciona un proyecto —</option>
            ${projectOptions}
          </select>
        </div>
      ` : ''}

      <div id="stats-content"></div>
    `;

    if (statsView === 'general') {
      this._renderStatsGeneral();
    } else {
      this._renderStatsProject(this.state.statsProjectId);
    }
  },

  _renderStatsGeneral() {
    const { periodic, heatmap, clients, summary } = this.state.stats;
    const { group } = this.periodDates(this.state.statsPeriod);

    const totalEarnings = summary?.total_earnings || 0;
    const totalHours    = summary?.total_hours || 0;
    const avgRate       = summary?.avg_rate || 0;
    const totalProjects = summary?.total_projects || 0;
    const totalClients  = summary?.total_clients || 0;

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth  = now.getDate();
    const thisMonth   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const thisMonthData  = periodic.find(m => m.period === thisMonth);
    const monthEarnings  = thisMonthData?.earnings || 0;
    const projectedMonth = dayOfMonth > 0 ? (monthEarnings / dayOfMonth) * daysInMonth : 0;
    const projPct        = Math.min(Math.round((dayOfMonth / daysInMonth) * 100), 100);
    const circumference  = 2 * Math.PI * 30;

    document.getElementById('stats-content').innerHTML = `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Ingresos (período)</div>
          <div class="metric-value" style="color:var(--gold)" data-private>${this.fmt.currency(totalEarnings)}</div>
          <div class="metric-sub">bruto antes de IRPF</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Horas trabajadas</div>
          <div class="metric-value" style="color:var(--cyan)">${this.fmt.hours(totalHours)}</div>
          <div class="metric-sub">${(totalHours/8).toFixed(1)} días</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Tarifa media</div>
          <div class="metric-value" data-private>${this.fmt.currency(avgRate * 8)}/día</div>
          <div class="metric-sub">media entre proyectos</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Proyectos</div>
          <div class="metric-value" style="color:var(--green)">${totalProjects}</div>
          <div class="metric-sub">${totalClients} cliente${totalClients !== 1 ? 's' : ''} distintos</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="chart-card full">
          <div class="chart-title">Ingresos y horas por período</div>
          <div class="chart-wrap" style="height:200px">
            <canvas id="chart-monthly"></canvas>
          </div>
        </div>
        <div class="chart-card full">
          <div class="chart-title">Actividad diaria — últimos 365 días</div>
          <div class="heatmap-scroll">
            <div class="heatmap-grid" id="heatmap-grid"></div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;margin-top:10px;font-size:11px;color:var(--text3)">
            <span>Menos</span>
            <div style="width:13px;height:13px;border-radius:3px;background:var(--border)"></div>
            <div style="width:13px;height:13px;border-radius:3px;background:#3d2e06"></div>
            <div style="width:13px;height:13px;border-radius:3px;background:#7a5c0d"></div>
            <div style="width:13px;height:13px;border-radius:3px;background:#ba8f14"></div>
            <div style="width:13px;height:13px;border-radius:3px;background:var(--gold)"></div>
            <span>Más</span>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Ranking de clientes</div>
          ${clients.length > 0 ? `<div class="client-bars" id="client-bars"></div>` : `<p style="color:var(--text3);font-size:13px">Sin datos en este período</p>`}
        </div>
        <div class="chart-card">
          <div class="chart-title">Proyección del mes actual</div>
          <div class="projection-body">
            <div class="projection-ring">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle class="projection-ring-bg" cx="40" cy="40" r="30"/>
                <circle class="projection-ring-fill" cx="40" cy="40" r="30"
                  stroke-dasharray="${circumference}"
                  stroke-dashoffset="${circumference - (circumference * projPct / 100)}"/>
              </svg>
              <div class="projection-pct">${projPct}%</div>
            </div>
            <div style="flex:1">
              <div style="font-size:11px;color:var(--text3);margin-bottom:4px">Mes actual</div>
              <div style="font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:var(--gold)">${this.fmt.currency(monthEarnings)}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:8px;margin-bottom:2px">Proyección final</div>
              <div style="font-family:'Space Mono',monospace;font-size:16px;font-weight:700;color:var(--text)">${this.fmt.currency(projectedMonth)}</div>
              <div style="font-size:11px;color:var(--text3);margin-top:6px">Día ${dayOfMonth} de ${daysInMonth}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    if (this.applyPrivacy) this.applyPrivacy();
    this.renderPeriodicChart(periodic, group);
    this.renderHeatmap(heatmap);
    this.renderClientBars(clients);
  },

  async _renderStatsProject(projectId) {
    const el = document.getElementById('stats-content');
    if (!projectId) {
      el.innerHTML = `<div style="padding:60px;text-align:center;color:var(--text3)">Selecciona un proyecto arriba para ver sus estadísticas.</div>`;
      return;
    }
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Cargando...</div>`;
    const { summary, monthly } = await this.api.get(`/api/stats/project/${projectId}`);
    const project = this.state.projects.find(p => p.id === projectId) || {};
    const iva = (this.state.user.iva_rate || 21) / 100;
    const irpf = (this.state.user.irpf_rate || 15) / 100;
    const subtotal = summary?.total_amount || 0;
    const neto = subtotal * (1 + iva - irpf);
    const fixedBudget = project.fixed_budget;

    el.innerHTML = `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Horas totales</div>
          <div class="metric-value" style="color:var(--cyan)">${this.fmt.hours(summary?.total_hours || 0)}</div>
          <div class="metric-sub">${((summary?.total_hours || 0)/8).toFixed(2)} días · ${summary?.entry_count || 0} entradas</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Importe bruto</div>
          <div class="metric-value" style="color:var(--gold)" data-private>${this.fmt.currency(subtotal)}</div>
          <div class="metric-sub">antes de impuestos</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total neto estimado</div>
          <div class="metric-value" data-private>${this.fmt.currency(neto)}</div>
          <div class="metric-sub">+IVA ${this.state.user.iva_rate||21}% −IRPF ${this.state.user.irpf_rate||15}%</div>
        </div>
        ${fixedBudget ? `
        <div class="metric-card">
          <div class="metric-label">Presupuesto cerrado</div>
          <div class="metric-value" style="color:${fixedBudget - subtotal >= 0 ? 'var(--green)' : 'var(--red)'}" data-private>${this.fmt.currency(fixedBudget)}</div>
          <div class="metric-sub">Balance: ${fixedBudget - subtotal >= 0 ? '+' : ''}${this.fmt.currency(fixedBudget - subtotal)}</div>
        </div>` : `
        <div class="metric-card">
          <div class="metric-label">Período</div>
          <div class="metric-value" style="font-size:14px">${summary?.first_date ? this.fmt.date(summary.first_date) : '—'}</div>
          <div class="metric-sub">→ ${summary?.last_date ? this.fmt.date(summary.last_date) : '—'}</div>
        </div>`}
      </div>
      <div class="stats-grid">
        <div class="chart-card full">
          <div class="chart-title">Horas e ingresos por mes — ${project.name || ''}</div>
          <div class="chart-wrap" style="height:200px">
            <canvas id="chart-monthly"></canvas>
          </div>
        </div>
      </div>
    `;
    if (this.applyPrivacy) this.applyPrivacy();
    this.renderPeriodicChart(monthly, 'month');
  },

  async changeStatsPeriod(period) {
    this.state.statsPeriod = period;
    if (period === 'custom') {
      const rangeEl = document.getElementById('stats-custom-range');
      if (rangeEl) rangeEl.style.display = 'flex';
      return;
    }
    this.renderStats();
  },

  async applyCustomRange() {
    const from = document.getElementById('stats-from')?.value;
    const to   = document.getElementById('stats-to')?.value;
    if (!from || !to || from > to) return alert('Selecciona un rango de fechas válido');
    this.state.statsCustomFrom = from;
    this.state.statsCustomTo   = to;
    this.state.statsPeriod = 'custom';
    this.renderStats();
  },

  async changeStatsView(view) {
    this.state.statsView = view;
    this.renderStats();
  },

  async changeStatsProject(id) {
    this.state.statsProjectId = id || null;
    this._renderStatsProject(this.state.statsProjectId);
  },

  renderPeriodicChart(data, group) {
    const ctx = document.getElementById('chart-monthly');
    if (!ctx) return;
    if (this.charts.monthly) this.charts.monthly.destroy();

    const fmtLabel = (p) => {
      if (group === 'day') {
        const d = new Date(p + 'T00:00:00');
        return d.toLocaleDateString('es-ES', { day:'2-digit', month:'short' });
      }
      if (group === 'week') {
        const [y, w] = p.split('-');
        return `S${w}/${y.slice(2)}`;
      }
      return this.fmt.month(p);
    };
    const labels = data.map(m => fmtLabel(m.period));
    const earningsData = data.map(m => m.earnings || 0);
    const hoursData = data.map(m => m.hours || 0);

    this.charts.monthly = new Chart(ctx, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Ingresos (€)',
            data: earningsData,
            backgroundColor: 'rgba(245, 200, 66, 0.25)',
            borderColor: 'rgba(245, 200, 66, 0.8)',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y'
          },
          {
            type: 'line',
            label: 'Horas',
            data: hoursData,
            borderColor: 'rgba(78, 205, 196, 0.8)',
            backgroundColor: 'rgba(78, 205, 196, 0.08)',
            borderWidth: 2,
            pointBackgroundColor: 'var(--cyan)',
            pointRadius: 4,
            tension: 0.35,
            fill: true,
            yAxisID: 'y2'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#9090b8', font: { family: 'Space Grotesk' }, boxWidth: 12 } },
          tooltip: {
            backgroundColor: '#13132a',
            borderColor: '#242445',
            borderWidth: 1,
            titleColor: '#dde0f5',
            bodyColor: '#9090b8'
          }
        },
        scales: {
          x: { grid: { color: '#1a1a35' }, ticks: { color: '#555580', font: { family: 'Space Grotesk', size: 11 } } },
          y: {
            position: 'left',
            grid: { color: '#1a1a35' },
            ticks: { color: '#9090b8', font: { family: 'Space Mono', size: 10 }, callback: v => `${v}€` }
          },
          y2: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#4ecdc4', font: { family: 'Space Mono', size: 10 }, callback: v => `${v}h` }
          }
        }
      }
    });
  },

  renderHeatmap(heatmap) {
    const grid = document.getElementById('heatmap-grid');
    if (!grid) return;

    const hoursMap = {};
    heatmap.forEach(d => { hoursMap[d.date] = d.hours; });

    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    // Go back to last Sunday
    start.setDate(start.getDate() - start.getDay());

    const weeks = [];
    let d = new Date(start);
    while (d <= today) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const dateStr = d.toISOString().split('T')[0];
        const hours = hoursMap[dateStr] || 0;
        let level = 0;
        if (hours > 0 && hours <= 2) level = 1;
        else if (hours > 2 && hours <= 4) level = 2;
        else if (hours > 4 && hours <= 6) level = 3;
        else if (hours > 6) level = 4;
        week.push({ date: dateStr, hours, level, future: d > today });
        d.setDate(d.getDate() + 1);
      }
      weeks.push(week);
    }

    grid.innerHTML = weeks.map(week => `
      <div class="heatmap-col">
        ${week.map(day => `
          <div class="heatmap-cell"
            data-hours="${day.hours}"
            data-level="${day.future ? -1 : day.level}"
            style="${day.future ? 'opacity:0.2' : ''}"
            data-tip="${day.date}: ${day.hours > 0 ? day.hours + 'h' : 'sin trabajo'}">
          </div>
        `).join('')}
      </div>
    `).join('');
  },

  renderClientBars(clients) {
    const el = document.getElementById('client-bars');
    if (!el || !clients.length) return;
    const max = Math.max(...clients.map(c => c.earnings));
    el.innerHTML = clients.map(c => `
      <div class="client-bar-row">
        <div class="client-bar-info">
          <span class="client-bar-name">${c.company}</span>
          <span class="client-bar-value" data-private>${this.fmt.currency(c.earnings)}</span>
        </div>
        <div class="client-bar-bg">
          <div class="client-bar-fill" style="width:${max > 0 ? (c.earnings/max*100) : 0}%"></div>
        </div>
        <div style="font-size:11px;color:var(--text3)">${this.fmt.hours(c.hours)} · ${c.projects} proyecto${c.projects !== 1 ? 's' : ''}</div>
      </div>
    `).join('');
  },

  // ── COMPANIES ──────────────────────────────────────────────
  renderCompanies() {
    const companies = this.state.companies;
    const el = document.getElementById('view-companies');

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Empresas</div>
          <div class="page-subtitle">${companies.length} empresa${companies.length !== 1 ? 's' : ''} registrada${companies.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="VFX.modals.editCompany()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Nueva empresa
          </button>
        </div>
      </div>

      ${companies.length === 0 ? `
        <div class="no-project-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M3 21h18M9 21V7l6-4v18M9 11h6M13 21v-4h-2v4"/></svg>
          <h3>Sin empresas</h3>
          <p>Añade las empresas con las que trabajas como freelance.</p>
          <button class="btn btn-primary btn-lg" onclick="VFX.modals.editCompany()">Añadir primera empresa</button>
        </div>
      ` : `
        <div class="companies-grid">
          ${companies.map(c => `
            <div class="company-card">
              <div class="company-card-name">${c.name}</div>
              <div class="company-card-cif">${c.cif || 'CIF no especificado'}</div>
              <div class="company-card-info">
                ${c.address ? `<div class="company-card-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${c.address}${c.city ? ', ' + c.city : ''}</div>` : ''}
                ${c.email ? `<div class="company-card-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>${c.email}</div>` : ''}
                ${c.phone ? `<div class="company-card-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.13a16 16 0 006 6l.5-.5a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>${c.phone}</div>` : ''}
                ${c.contact_person ? `<div class="company-card-info-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${c.contact_person}</div>` : ''}
              </div>
              <div class="company-card-actions">
                <button class="btn btn-ghost btn-sm" onclick="VFX.modals.editCompany(${c.id})">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="VFX.deleteCompany(${c.id})">Eliminar</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  },

  // ── SETTINGS ───────────────────────────────────────────────
  renderSettings() {
    const u = this.state.user;
    document.getElementById('view-settings').innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Ajustes</div>
          <div class="page-subtitle">Tus datos personales y configuración fiscal</div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Datos personales</div>
        <div class="settings-card">
          <form id="settings-form" onsubmit="VFX.saveSettings(event)">
            <div class="form-grid">
              <div class="form-group">
                <label>Nombre completo *</label>
                <input type="text" name="name" value="${u.name||''}" placeholder="Tu nombre completo" required>
              </div>
              <div class="form-group">
                <label>Profesión</label>
                <input type="text" name="profession" value="${u.profession||'VFX Compositor'}" placeholder="VFX Compositor">
              </div>
              <div class="form-group">
                <label>NIF / DNI</label>
                <input type="text" name="nif" value="${u.nif||''}" placeholder="12345678A">
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" name="email" value="${u.email||''}" placeholder="tu@email.com">
              </div>
              <div class="form-group">
                <label>Teléfono</label>
                <input type="text" name="phone" value="${u.phone||''}" placeholder="+34 600 000 000">
              </div>
              <div class="form-group span2">
                <label>Dirección</label>
                <input type="text" name="address" value="${u.address||''}" placeholder="Calle, número, piso">
              </div>
              <div class="form-group">
                <label>Ciudad</label>
                <input type="text" name="city" value="${u.city||''}" placeholder="Madrid">
              </div>
              <div class="form-group">
                <label>Código postal</label>
                <input type="text" name="postal_code" value="${u.postal_code||''}" placeholder="28001">
              </div>
            </div>

            <div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
              <div class="settings-section-title">Tipos impositivos</div>
              <div class="form-grid" style="max-width:400px">
                <div class="form-group">
                  <label>IVA (%)</label>
                  <input type="number" name="iva_rate" value="${u.iva_rate||21}" step="0.1" min="0" max="100">
                </div>
                <div class="form-group">
                  <label>IRPF (%)</label>
                  <input type="number" name="irpf_rate" value="${u.irpf_rate||15}" step="0.1" min="0" max="100">
                </div>
              </div>
            </div>

            <div style="margin-top:20px;padding-top:20px;border-top:1px solid var(--border)">
              <div class="settings-section-title">Privacidad</div>
              <div class="toggle-row">
                <div>
                  <div class="toggle-row-label">Iniciar en modo privado</div>
                  <div class="toggle-row-sub">Las cifras aparecerán borrosas al abrir la aplicación</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="privacy-default-toggle" ${localStorage.getItem('vfx_privacy_default') === 'true' ? 'checked' : ''} onchange="VFX.savePrivacyDefault(this.checked)">
                  <div class="toggle-switch-track"></div>
                </label>
              </div>
              <div class="toggle-row">
                <div>
                  <div class="toggle-row-label">Privacidad automática por ubicación</div>
                  <div class="toggle-row-sub">Oculta las cifras cuando estás fuera de casa</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="location-privacy-toggle" ${localStorage.getItem('vfx_privacy_location') === 'true' ? 'checked' : ''} onchange="VFX.toggleLocationPrivacy(this.checked)">
                  <div class="toggle-switch-track"></div>
                </label>
              </div>
              <div id="location-settings-block" style="margin-top:14px;padding:14px;background:var(--bg2);border-radius:8px;border:1px solid var(--border);display:${localStorage.getItem('vfx_privacy_location') === 'true' ? 'block' : 'none'}">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
                  <div>
                    <div style="font-size:12px;color:var(--text2)">Ubicación de casa guardada:</div>
                    <div style="font-size:11px;color:var(--text3);margin-top:2px" id="home-location-display">
                      ${localStorage.getItem('vfx_home_lat') ? `${parseFloat(localStorage.getItem('vfx_home_lat')).toFixed(4)}, ${parseFloat(localStorage.getItem('vfx_home_lng')).toFixed(4)}` : 'No configurada'}
                    </div>
                  </div>
                  <button class="btn btn-ghost btn-sm" onclick="VFX.saveHomeLocation()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    Guardar ubicación actual
                  </button>
                </div>
                <div style="margin-top:12px">
                  <label style="font-size:11px">Radio de casa</label>
                  <select style="margin-top:6px" onchange="localStorage.setItem('vfx_home_radius',this.value)" id="home-radius-select">
                    <option value="100" ${localStorage.getItem('vfx_home_radius')==='100'?'selected':''}>100 metros</option>
                    <option value="500" ${!localStorage.getItem('vfx_home_radius')||localStorage.getItem('vfx_home_radius')==='500'?'selected':''}>500 metros</option>
                    <option value="1000" ${localStorage.getItem('vfx_home_radius')==='1000'?'selected':''}>1 kilómetro</option>
                    <option value="5000" ${localStorage.getItem('vfx_home_radius')==='5000'?'selected':''}>5 kilómetros</option>
                  </select>
                </div>
              </div>
            </div>

            <div style="margin-top:20px">
              <button type="submit" class="btn btn-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  // ── MODALS ─────────────────────────────────────────────────
  modals: {
    settings() {
      VFX.openModal(`
        <div class="welcome-header">
          <div class="welcome-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="welcome-title">Bienvenido a VFX Hours</div>
          <div class="welcome-sub">Configura tus datos para que aparezcan en las facturas</div>
        </div>
        <form onsubmit="VFX.saveSettings(event)">
          <div class="form-grid">
            <div class="form-group">
              <label>Tu nombre *</label>
              <input type="text" name="name" value="${VFX.state.user.name||''}" placeholder="Carlos García" required autofocus>
            </div>
            <div class="form-group">
              <label>NIF / DNI</label>
              <input type="text" name="nif" value="${VFX.state.user.nif||''}" placeholder="12345678A">
            </div>
            <div class="form-group span2">
              <label>Email</label>
              <input type="email" name="email" value="${VFX.state.user.email||''}" placeholder="tu@email.com">
            </div>
          </div>
          <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:20px">
            <button type="button" class="btn btn-ghost" onclick="VFX.closeModal()">Ahora no</button>
            <button type="submit" class="btn btn-primary">Guardar y continuar</button>
          </div>
        </form>
      `, 'Configuración inicial');
    },

    newProject() {
      const companies = VFX.state.companies;
      const companyOptions = companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

      VFX.openModal(`
        <div id="modal-project-content">
          <div class="modal-tabs">
            <button class="modal-tab active" id="tab-existing" onclick="VFX.modals._projectTabExisting()" ${companies.length === 0 ? 'disabled style="opacity:0.4"' : ''}>
              Empresa existente (${companies.length})
            </button>
            <button class="modal-tab ${companies.length === 0 ? 'active' : ''}" id="tab-new" onclick="VFX.modals._projectTabNew()">
              Nueva empresa
            </button>
          </div>

          <div id="tab-content-existing" ${companies.length === 0 ? 'style="display:none"' : ''}>
            <div class="form-grid full">
              <div class="form-group">
                <label>Nombre del proyecto *</label>
                <input type="text" id="proj-name" placeholder="Ej: Compositing Serie TV" autofocus>
              </div>
              <div class="form-group">
                <label>Empresa *</label>
                <select id="proj-company-select">
                  <option value="">— Selecciona empresa —</option>
                  ${companyOptions}
                </select>
              </div>
              <div class="form-group span2">
                <label>Tipo de presupuesto</label>
                <div style="display:flex;gap:16px;margin-top:6px">
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                    <input type="radio" name="new-budget-type" value="hourly" checked
                      onchange="document.getElementById('new-fixed-budget-row').style.display='none'">
                    Por horas
                  </label>
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                    <input type="radio" name="new-budget-type" value="fixed"
                      onchange="document.getElementById('new-fixed-budget-row').style.display=''">
                    Presupuesto cerrado
                  </label>
                </div>
              </div>
              <div class="form-group" id="new-fixed-budget-row" style="display:none">
                <label>Presupuesto acordado (€)</label>
                <input type="number" id="proj-fixed-budget" placeholder="1500" step="0.01" min="0">
              </div>
              <div class="form-group">
                <label>Tarifa por día (€) *</label>
                ${dailyRateSelect('proj-rate', 0)}
              </div>
            </div>
          </div>

          <div id="tab-content-new" ${companies.length > 0 ? 'style="display:none"' : ''}>
            <div class="form-grid">
              <div class="form-group">
                <label>Nombre del proyecto *</label>
                <input type="text" id="proj-name-new" placeholder="Ej: Compositing Serie TV">
              </div>
              <div class="form-group">
                <label>Tarifa por día (€) *</label>
                ${dailyRateSelect('proj-rate-new', 0)}
              </div>
              <div class="form-group span2">
                <label>Tipo de presupuesto</label>
                <div style="display:flex;gap:16px;margin-top:6px">
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                    <input type="radio" name="new-budget-type-b" value="hourly" checked
                      onchange="document.getElementById('new-fixed-budget-row-b').style.display='none'">
                    Por horas
                  </label>
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                    <input type="radio" name="new-budget-type-b" value="fixed"
                      onchange="document.getElementById('new-fixed-budget-row-b').style.display=''">
                    Presupuesto cerrado
                  </label>
                </div>
              </div>
              <div class="form-group" id="new-fixed-budget-row-b" style="display:none">
                <label>Presupuesto acordado (€)</label>
                <input type="number" id="proj-fixed-budget-new" placeholder="1500" step="0.01" min="0">
              </div>
              <div style="grid-column:1/-1;height:1px;background:var(--border);margin:4px 0"></div>
              <div class="form-group span2" style="font-size:11px;font-weight:700;letter-spacing:2px;color:var(--text3);text-transform:uppercase">Datos de la empresa</div>
              <div class="form-group span2">
                <label>Nombre de la empresa *</label>
                <input type="text" id="comp-name" placeholder="Productora S.L.">
              </div>
              <div class="form-group">
                <label>CIF / NIF</label>
                <input type="text" id="comp-cif" placeholder="B12345678">
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" id="comp-email" placeholder="facturacion@empresa.com">
              </div>
              <div class="form-group span2">
                <label>Dirección</label>
                <input type="text" id="comp-address" placeholder="Calle Mayor 1, 28001 Madrid">
              </div>
              <div class="form-group">
                <label>Ciudad</label>
                <input type="text" id="comp-city" placeholder="Madrid">
              </div>
              <div class="form-group">
                <label>Teléfono</label>
                <input type="text" id="comp-phone" placeholder="+34 91 000 0000">
              </div>
              <div class="form-group span2">
                <label>Persona de contacto</label>
                <input type="text" id="comp-contact" placeholder="María Productora">
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:20px">
          <button class="btn btn-ghost" onclick="VFX.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="VFX.createProject()">Crear proyecto</button>
        </div>
      `, 'Nuevo proyecto');
    },

    _projectTabExisting() {
      document.getElementById('tab-existing').classList.add('active');
      document.getElementById('tab-new').classList.remove('active');
      document.getElementById('tab-content-existing').style.display = '';
      document.getElementById('tab-content-new').style.display = 'none';
    },

    _projectTabNew() {
      document.getElementById('tab-new').classList.add('active');
      document.getElementById('tab-existing').classList.remove('active');
      document.getElementById('tab-content-new').style.display = '';
      document.getElementById('tab-content-existing').style.display = 'none';
    },

    editProject(id) {
      const project = VFX.state.projects.find(p => p.id === id);
      if (!project) return;
      const companies = VFX.state.companies;
      const companyOptions = companies.map(c =>
        `<option value="${c.id}" ${c.id === project.company_id ? 'selected' : ''}>${c.name}</option>`
      ).join('');
      const isFixed = project.budget_type === 'fixed';

      VFX.openModal(`
        <div class="form-grid full">
          <div class="form-group">
            <label>Nombre del proyecto</label>
            <input type="text" id="edit-proj-name" value="${project.name}">
          </div>
          <div class="form-group">
            <label>Empresa</label>
            <select id="edit-proj-company">${companyOptions}</select>
          </div>
          <div class="form-group span2">
            <label>Tipo de presupuesto</label>
            <div style="display:flex;gap:16px;margin-top:6px">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="radio" name="edit-budget-type" value="hourly" ${!isFixed ? 'checked' : ''}
                  onchange="document.getElementById('edit-fixed-budget-row').style.display='none'">
                Por horas
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="radio" name="edit-budget-type" value="fixed" ${isFixed ? 'checked' : ''}
                  onchange="document.getElementById('edit-fixed-budget-row').style.display=''">
                Presupuesto cerrado
              </label>
            </div>
          </div>
          <div class="form-group" id="edit-fixed-budget-row" style="${isFixed ? '' : 'display:none'}">
            <label>Presupuesto acordado (€)</label>
            <input type="number" id="edit-proj-fixed-budget" value="${project.fixed_budget||''}" placeholder="1500" step="0.01" min="0">
          </div>
          <div class="form-group">
            <label>Tarifa por día (€) <span style="color:var(--text3);font-weight:400">(para comparativa)</span></label>
            ${dailyRateSelect('edit-proj-rate', project.hourly_rate)}
          </div>
          <div class="form-group">
            <label>Número de factura</label>
            <input type="text" id="edit-proj-invoice" value="${project.invoice_number||''}" placeholder="Ej: 2026-001">
          </div>
          <div class="form-group">
            <label>Fecha de envío de factura</label>
            <input type="date" id="edit-proj-invoiced-at" value="${project.invoiced_at||''}">
          </div>
          <div class="form-group">
            <label>Fecha de cobro esperada</label>
            <input type="date" id="edit-proj-expected-payment" value="${project.expected_payment_date||''}">
          </div>
          <div class="form-group span2">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="edit-proj-completed" ${project.is_completed ? 'checked' : ''}>
              Trabajo finalizado
            </label>
          </div>
          <div class="form-group span2">
            <label>Notas</label>
            <textarea id="edit-proj-notes">${project.notes||''}</textarea>
          </div>
        </div>
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:20px;justify-content:space-between">
          <button class="btn btn-danger" onclick="VFX.deleteProject(${id})">Eliminar proyecto</button>
          <div style="display:flex;gap:10px">
            <button class="btn btn-ghost" onclick="VFX.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="VFX.updateProject(${id})">Guardar</button>
          </div>
        </div>
      `, 'Editar proyecto');
    },

    addEntry() {
      const today = new Date().toISOString().split('T')[0];
      const proj = VFX.state.projects.find(p => p.id === VFX.state.currentProjectId);
      const defaultHourly = proj ? proj.hourly_rate : 0;
      const defaultDailyLabel = defaultHourly ? Math.round(defaultHourly * 8) : 0;
      VFX.openModal(`
        <div class="form-grid full">
          <div class="form-group">
            <label>Fecha *</label>
            <input type="date" id="entry-date" value="${today}">
          </div>
          <div class="form-group">
            <label>Horas *</label>
            <input type="number" id="entry-hours" placeholder="8" step="0.25" min="0.25" autofocus>
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <input type="text" id="entry-desc" placeholder="Ej: Compositing shot 045A">
          </div>
          <div class="form-group">
            <label>Tarifa (€/día)${defaultDailyLabel ? ` — por defecto del proyecto: ${defaultDailyLabel} €/día` : ' — opcional'}</label>
            ${dailyRateSelect('entry-rate', defaultHourly)}
          </div>
        </div>
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:20px">
          <button class="btn btn-ghost" onclick="VFX.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="VFX.addEntry()">Añadir entrada</button>
        </div>
      `, 'Nueva entrada de tiempo');
    },

    editEntry(id) {
      const entry = VFX.state.entries.find(e => e.id === id);
      if (!entry) return;
      VFX.openModal(`
        <div class="form-grid full">
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" id="edit-entry-date" value="${entry.date}">
          </div>
          <div class="form-group">
            <label>Horas</label>
            <input type="number" id="edit-entry-hours" value="${entry.hours}" step="0.25" min="0.25">
          </div>
          <div class="form-group">
            <label>Descripción</label>
            <input type="text" id="edit-entry-desc" value="${entry.description||''}">
          </div>
          <div class="form-group">
            <label>Tarifa personalizada (€/día) — opcional</label>
            ${dailyRateSelect('edit-entry-rate', entry.hourly_rate_override || 0)}
          </div>
        </div>
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:20px">
          <button class="btn btn-ghost" onclick="VFX.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="VFX.updateEntry(${id})">Guardar</button>
        </div>
      `, 'Editar entrada');
    },

    editCompany(id) {
      const c = id ? VFX.state.companies.find(x => x.id === id) : {};
      const isEdit = !!id;
      VFX.openModal(`
        <div class="form-grid">
          <div class="form-group span2">
            <label>Nombre de la empresa *</label>
            <input type="text" id="c-name" value="${c?.name||''}" placeholder="Productora S.L." autofocus>
          </div>
          <div class="form-group">
            <label>CIF / NIF</label>
            <input type="text" id="c-cif" value="${c?.cif||''}" placeholder="B12345678">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="c-email" value="${c?.email||''}" placeholder="facturacion@empresa.com">
          </div>
          <div class="form-group span2">
            <label>Dirección</label>
            <input type="text" id="c-address" value="${c?.address||''}" placeholder="Calle Mayor 1">
          </div>
          <div class="form-group">
            <label>Ciudad</label>
            <input type="text" id="c-city" value="${c?.city||''}" placeholder="Madrid">
          </div>
          <div class="form-group">
            <label>Código postal</label>
            <input type="text" id="c-postal" value="${c?.postal_code||''}" placeholder="28001">
          </div>
          <div class="form-group">
            <label>Teléfono</label>
            <input type="text" id="c-phone" value="${c?.phone||''}" placeholder="+34 91 000 0000">
          </div>
          <div class="form-group">
            <label>Persona de contacto</label>
            <input type="text" id="c-contact" value="${c?.contact_person||''}" placeholder="María García">
          </div>
          <div class="form-group">
            <label>Días de pago habituales</label>
            <input type="number" id="c-payment-days" value="${c?.payment_days ?? 30}" placeholder="30" min="0" max="365"
              title="Días que suele tardar en pagar (para la previsión de cobro)">
          </div>
          <div class="form-group span2">
            <label>Notas</label>
            <textarea id="c-notes">${c?.notes||''}</textarea>
          </div>
        </div>
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:20px">
          <button class="btn btn-ghost" onclick="VFX.closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="VFX.saveCompany(${id||'null'})">${isEdit ? 'Guardar cambios' : 'Crear empresa'}</button>
        </div>
      `, isEdit ? 'Editar empresa' : 'Nueva empresa');
    },

    timerStop(hours, idx, projectId) {
      const today   = new Date().toISOString().split('T')[0];
      const project = VFX.state.projects.find(p => p.id === projectId);
      const defaultHourly = project ? project.hourly_rate : 0;
      const defaultDaily = defaultHourly ? Math.round(defaultHourly * 8) : 0;
      VFX.openModal(`
        <p style="color:var(--text2);margin-bottom:4px">Sesión finalizada · <strong style="color:var(--text)">${project?.name || ''}</strong></p>
        <p style="color:var(--text2);margin-bottom:20px">Se han registrado <strong style="color:var(--gold)">${hours} horas</strong>.</p>
        <div class="form-grid full">
          <div class="form-group">
            <label>Descripción del trabajo</label>
            <input type="text" id="timer-desc" placeholder="Ej: Compositing y roto" autofocus>
          </div>
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" id="timer-date" value="${today}">
          </div>
          <div class="form-group">
            <label>Horas (ajustable)</label>
            <input type="number" id="timer-hours" value="${hours}" step="0.25" min="0.25">
          </div>
          <div class="form-group">
            <label>Tarifa (€/día)${defaultDaily ? ` — por defecto: ${defaultDaily} €/día` : ' — opcional'}</label>
            ${dailyRateSelect('timer-rate', defaultHourly)}
          </div>
        </div>
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:20px">
          <button class="btn btn-ghost" onclick="VFX.closeModal()">Descartar</button>
          <button class="btn btn-primary" onclick="VFX.saveTimerEntry(${idx}, ${projectId})">Guardar entrada</button>
        </div>
      `, 'Sesión de trabajo finalizada');
    }
  },

  openModal(content, title) {
    document.getElementById('modal-content').innerHTML = `
      <div class="modal-header">
        <span class="modal-title">${title}</span>
        <button class="modal-close" onclick="VFX.closeModal()">✕</button>
      </div>
      <div class="modal-body">${content}</div>
    `;
    const overlay = document.getElementById('modal-overlay');
    const modal   = document.getElementById('modal');
    this._modalDragFromInside = false;
    modal.addEventListener('mousedown', () => { this._modalDragFromInside = true; }, { capture: true });
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) this._modalDragFromInside = false;
    });
    overlay.classList.add('open');
    setTimeout(() => {
      const first = document.querySelector('.modal input[autofocus], .modal input:not([type="hidden"])');
      if (first) first.focus();
    }, 100);
  },

  closeModal(e) {
    if (e) {
      if (e.target !== document.getElementById('modal-overlay')) return;
      if (this._modalDragFromInside) { this._modalDragFromInside = false; return; }
    }
    document.getElementById('modal-overlay').classList.remove('open');
  },

  // ── ACTIONS ────────────────────────────────────────────────
  async createProject() {
    const isNew = document.getElementById('tab-new')?.classList.contains('active');

    let projectName, companyId, rate;

    if (isNew) {
      const compName = document.getElementById('comp-name')?.value?.trim();
      if (!compName) return alert('El nombre de la empresa es obligatorio');

      projectName = document.getElementById('proj-name-new')?.value?.trim();
      rate = getDailyRateValue('proj-rate-new') / 8;

      const compData = {
        name: compName,
        cif: document.getElementById('comp-cif')?.value?.trim() || '',
        email: document.getElementById('comp-email')?.value?.trim() || '',
        address: document.getElementById('comp-address')?.value?.trim() || '',
        city: document.getElementById('comp-city')?.value?.trim() || '',
        phone: document.getElementById('comp-phone')?.value?.trim() || '',
        contact_person: document.getElementById('comp-contact')?.value?.trim() || ''
      };
      const { id } = await this.api.post('/api/companies', compData);
      companyId = id;
    } else {
      projectName = document.getElementById('proj-name')?.value?.trim();
      companyId = parseInt(document.getElementById('proj-company-select')?.value);
      rate = getDailyRateValue('proj-rate') / 8;
    }

    if (!projectName) return alert('El nombre del proyecto es obligatorio');
    if (!companyId) return alert('Selecciona o crea una empresa');

    const budgetTypeEl = document.querySelector('input[name="new-budget-type"]:checked') ||
                         document.querySelector('input[name="new-budget-type-b"]:checked');
    const budgetType   = budgetTypeEl?.value || 'hourly';
    const fixedBudgetEl = document.getElementById('proj-fixed-budget') || document.getElementById('proj-fixed-budget-new');
    const fixedBudget  = budgetType === 'fixed' ? parseFloat(fixedBudgetEl?.value) || null : null;

    const { id } = await this.api.post('/api/projects', {
      name: projectName, company_id: companyId, hourly_rate: rate,
      budget_type: budgetType, fixed_budget: fixedBudget
    });
    await this.loadAll();
    this.state.currentProjectId = id;
    this.state.entries = [];
    localStorage.setItem('vfx_current_project', id);
    this.closeModal();
    this.navigate('proyecto');
  },

  async updateProject(id) {
    const project = this.state.projects.find(p => p.id === id) || {};
    const budgetTypeEl = document.querySelector('input[name="edit-budget-type"]:checked');
    const budgetType   = budgetTypeEl?.value || project.budget_type || 'hourly';
    const fixedBudget  = budgetType === 'fixed' ? parseFloat(document.getElementById('edit-proj-fixed-budget')?.value) || null : null;
    await this.api.put(`/api/projects/${id}`, {
      name: document.getElementById('edit-proj-name').value,
      company_id: parseInt(document.getElementById('edit-proj-company').value),
      hourly_rate: getDailyRateValue('edit-proj-rate') / 8,
      invoice_number: document.getElementById('edit-proj-invoice').value,
      notes: document.getElementById('edit-proj-notes').value,
      status: project.status || 'pending',
      budget_type: budgetType,
      fixed_budget: fixedBudget,
      is_completed: document.getElementById('edit-proj-completed')?.checked ? 1 : 0,
      invoiced_at: document.getElementById('edit-proj-invoiced-at')?.value || null,
      expected_payment_date: document.getElementById('edit-proj-expected-payment')?.value || null
    });
    await this.loadAll();
    this.closeModal();
    this.navigate(this.state.view);
  },

  async deleteProject(id) {
    if (!confirm('¿Eliminar este proyecto y todas sus entradas? Esta acción no se puede deshacer.')) return;
    await this.api.del(`/api/projects/${id}`);
    if (this.state.currentProjectId === id) {
      this.state.currentProjectId = null;
      this.state.entries = [];
    }
    await this.loadAll();
    this.closeModal();
    this.navigate(this.state.view);
  },

  async addEntry() {
    const date = document.getElementById('entry-date').value;
    const hours = parseFloat(document.getElementById('entry-hours').value);
    const desc = document.getElementById('entry-desc').value.trim();
    const dailyOverride = getDailyRateValue('entry-rate');
    const rateOverride = dailyOverride > 0 ? dailyOverride / 8 : null;

    if (!date || !hours) return alert('Fecha y horas son obligatorios');

    await this.api.post('/api/entries', {
      project_id: this.state.currentProjectId,
      date, hours,
      description: desc,
      hourly_rate_override: rateOverride
    });

    const pid = this.state.currentProjectId;
    const fresh = await this.api.get(`/api/projects/${pid}/entries`);
    this.state.entries = fresh;
    const si = this._pendingSlotIdx ?? null;
    if (si !== null && this.state.slots[si]) this.state.slots[si].entries = fresh;
    this._pendingSlotIdx = null;
    await this.loadAll();
    this.closeModal();
    this.state.view === 'proyecto' ? this.renderProyecto() : this.renderDashboard();
  },

  async updateEntry(id) {
    const dailyOverride = getDailyRateValue('edit-entry-rate');
    await this.api.put(`/api/entries/${id}`, {
      date: document.getElementById('edit-entry-date').value,
      hours: parseFloat(document.getElementById('edit-entry-hours').value),
      description: document.getElementById('edit-entry-desc').value,
      hourly_rate_override: dailyOverride > 0 ? dailyOverride / 8 : null
    });
    const entries = await this.api.get(`/api/projects/${this.state.currentProjectId}/entries`);
    this.state.entries = entries;
    await this.loadAll();
    this.closeModal();
    this.renderProyecto();
  },

  async deleteEntry(id) {
    if (!confirm('¿Eliminar esta entrada?')) return;
    await this.api.del(`/api/entries/${id}`);
    const entries = await this.api.get(`/api/projects/${this.state.currentProjectId}/entries`);
    this.state.entries = entries;
    await this.loadAll();
    this.renderProyecto();
  },

  async saveCompany(id) {
    const data = {
      name: document.getElementById('c-name').value.trim(),
      cif: document.getElementById('c-cif').value.trim(),
      email: document.getElementById('c-email').value.trim(),
      address: document.getElementById('c-address').value.trim(),
      city: document.getElementById('c-city').value.trim(),
      postal_code: document.getElementById('c-postal').value.trim(),
      phone: document.getElementById('c-phone').value.trim(),
      contact_person: document.getElementById('c-contact').value.trim(),
      notes: document.getElementById('c-notes').value.trim(),
      payment_days: parseInt(document.getElementById('c-payment-days')?.value) || 30
    };
    if (!data.name) return alert('El nombre es obligatorio');
    if (id) {
      await this.api.put(`/api/companies/${id}`, data);
    } else {
      await this.api.post('/api/companies', data);
    }
    await this.loadAll();
    this.closeModal();
    this.renderCompanies();
  },

  async deleteCompany(id) {
    if (!confirm('¿Eliminar esta empresa?')) return;
    await this.api.del(`/api/companies/${id}`);
    await this.loadAll();
    this.renderCompanies();
  },

  async updateProjectStatus(id, status) {
    const project = this.state.projects.find(p => p.id === id);
    if (!project) return;
    await this.api.put(`/api/projects/${id}`, { ...project, status });
    await this.loadAll();
    this.refreshCockpit();
  },

  async setProjectCompleted(id, completed) {
    const project = this.state.projects.find(p => p.id === id);
    if (!project) return;
    await this.api.put(`/api/projects/${id}`, { ...project, is_completed: completed ? 1 : 0 });
    await this.loadAll();
    this.refreshCockpit();
  },

  async updateInvoiceDate(id, date) {
    const project = this.state.projects.find(p => p.id === id);
    if (!project) return;
    await this.api.put(`/api/projects/${id}`, { ...project, invoiced_at: date || null });
    await this.loadAll();
  },

  async updateExpectedPayment(id, date) {
    const project = this.state.projects.find(p => p.id === id);
    if (!project) return;
    await this.api.put(`/api/projects/${id}`, { ...project, expected_payment_date: date || null });
    await this.loadAll();
  },

  async saveSettings(e) {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    data.iva_rate = parseFloat(data.iva_rate) || 21;
    data.irpf_rate = parseFloat(data.irpf_rate) || 15;
    await this.api.put('/api/user', data);
    this.state.user = { ...this.state.user, ...data };
    this.updateSidebarUser();
    this.closeModal();
    if (this.state.view === 'settings') this.renderSettings();
    this.refreshCockpit();
  },

  // ── TIMER ──────────────────────────────────────────────────
  startTimer(idx) {
    const slot = this.state.slots[idx];
    if (!slot?.projectId) return;
    slot.timerProjectId = slot.projectId; // fija el proyecto del timer
    slot.timer = { active: true, paused: false, startTime: new Date().toISOString(), accumulated: 0, interval: null };
    this._slotsSave();
    this._startSlotInterval(idx);
    this.renderProyecto();
  },

  pauseTimer(idx) {
    const slot = this.state.slots[idx];
    if (!slot?.timer.active || slot.timer.paused) return;
    if (slot.timer.interval) { clearInterval(slot.timer.interval); slot.timer.interval = null; }
    slot.timer.accumulated = this._slotElapsed(idx);
    slot.timer.paused = true;
    slot.timer.startTime = null;
    this._slotsSave();
    this.renderProyecto();
  },

  resumeTimer(idx) {
    const slot = this.state.slots[idx];
    if (!slot?.timer.active || !slot.timer.paused) return;
    slot.timer.paused = false;
    slot.timer.startTime = new Date().toISOString();
    this._slotsSave();
    this._startSlotInterval(idx);
    this.renderProyecto();
  },

  stopTimer(idx) {
    const slot  = this.state.slots[idx];
    const elapsed = this._slotElapsed(idx);
    const hours = elapsed > 0 ? Math.max(Math.round(elapsed / 3600 * 4) / 4, 0.25) : 0;
    const timerProjectId = slot.timerProjectId || slot.projectId; // usa el proyecto del timer, no el de la vista
    if (slot.timer.interval) { clearInterval(slot.timer.interval); slot.timer.interval = null; }
    slot.timer = { active: false, paused: false, startTime: null, accumulated: 0, interval: null };
    slot.timerProjectId = null;
    this._slotsSave();
    this.renderProyecto();
    if (elapsed > 0) this.modals.timerStop(hours, idx, timerProjectId);
  },

  async saveTimerEntry(idx, projectId) {
    const date  = document.getElementById('timer-date').value;
    const hours = parseFloat(document.getElementById('timer-hours').value);
    const desc  = document.getElementById('timer-desc').value.trim();
    if (!hours) return;
    const dailyOverride = getDailyRateValue('timer-rate');
    const rateOverride = dailyOverride > 0 ? dailyOverride / 8 : null;
    await this.api.post('/api/entries', { project_id: projectId, date, hours, description: desc, hourly_rate_override: rateOverride });
    const slot = this.state.slots[idx];
    if (slot) slot.entries = await this.api.get(`/api/projects/${projectId}/entries`);
    if (this.state.currentProjectId === projectId)
      this.state.entries = slot?.entries || [];
    await this.loadAll();
    this.closeModal();
    this.renderProyecto();
  },

  // ── EXPORT ─────────────────────────────────────────────────
  async exportProject(id) {
    const data = await this.api.get(`/api/projects/${id}/export`);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vfxhours_${data.project.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async printInvoice(id) {
    const data = await this.api.get(`/api/projects/${id}/export`);
    const { project, entries, user } = data;
    const hourlyRate = project.hourly_rate || 0;
    const subtotal = entries.reduce((s, e) => s + e.hours * (e.hourly_rate_override || hourlyRate), 0);
    const ivaRate = user.iva_rate || 21;
    const irpfRate = user.irpf_rate || 15;
    const ivaAmount = subtotal * (ivaRate / 100);
    const irpfAmount = subtotal * (irpfRate / 100);
    const total = subtotal + ivaAmount - irpfAmount;
    const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
    const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    const totalDays = entries.reduce((s, e) => s + e.hours, 0) / 8;
    const rows = entries.map(e => {
      const effHourly = e.hourly_rate_override || hourlyRate;
      const effDaily = effHourly * 8;
      const days = e.hours / 8;
      return `
      <tr>
        <td>${new Date(e.date+'T00:00:00').toLocaleDateString('es-ES')}</td>
        <td>${e.description || 'Trabajo realizado'}</td>
        <td style="text-align:right">${parseFloat(e.hours).toFixed(2)} h (${days.toFixed(2)} días)</td>
        <td style="text-align:right">${fmt(effDaily)}/día</td>
        <td style="text-align:right">${fmt(e.hours * effHourly)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Factura — ${project.name}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Arial',sans-serif;font-size:13px;color:#111;background:#fff;padding:40px}
      .header{display:flex;justify-content:space-between;margin-bottom:40px}
      .company-from h2{font-size:20px;font-weight:700;margin-bottom:4px}
      .company-from p{color:#555;line-height:1.6}
      .invoice-meta{text-align:right}
      .invoice-meta h1{font-size:28px;font-weight:300;letter-spacing:2px;color:#333;margin-bottom:8px}
      .invoice-meta p{color:#555;line-height:1.6}
      .to-section{background:#f8f8f8;border-radius:8px;padding:20px;margin-bottom:30px}
      .to-section h3{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#999;margin-bottom:8px}
      .to-section p{line-height:1.6;color:#333}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}
      thead th{background:#111;color:#fff;padding:10px 12px;text-align:left;font-size:12px;letter-spacing:0.5px}
      tbody td{padding:10px 12px;border-bottom:1px solid #eee}
      tbody tr:last-child td{border-bottom:none}
      .totals{margin-left:auto;width:300px}
      .totals-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px}
      .totals-row.total{font-size:16px;font-weight:700;border-bottom:none;padding-top:12px}
      .footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center}
    </style></head><body>
    <div class="header">
      <div class="company-from">
        <h2>${user.name || 'Tu nombre'}</h2>
        <p>${user.profession || 'VFX Compositor'}<br>
        ${user.nif ? 'NIF: ' + user.nif + '<br>' : ''}
        ${user.address ? user.address + '<br>' : ''}
        ${user.city || ''}${user.postal_code ? ' — ' + user.postal_code : ''}<br>
        ${user.email || ''}${user.phone ? ' · ' + user.phone : ''}</p>
      </div>
      <div class="invoice-meta">
        <h1>FACTURA</h1>
        <p>Fecha: ${today}<br>
        ${project.invoice_number ? 'Nº: ' + project.invoice_number + '<br>' : ''}
        Proyecto: ${project.name}</p>
      </div>
    </div>
    <div class="to-section">
      <h3>Facturar a</h3>
      <p><strong>${project.company_name}</strong><br>
      ${project.company_cif ? 'CIF: ' + project.company_cif + '<br>' : ''}
      ${project.company_address ? project.company_address + '<br>' : ''}
      ${project.company_city || ''}${project.company_postal_code ? ', ' + project.company_postal_code : ''}<br>
      ${project.company_email || ''}</p>
    </div>
    <table>
      <thead><tr><th>Fecha</th><th>Descripción</th><th style="text-align:right">Horas / Días</th><th style="text-align:right">€/día</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>Total días trabajados</span><span>${totalDays.toFixed(2)} días</span></div>
      <div class="totals-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
      <div class="totals-row"><span>IVA (${ivaRate}%)</span><span>+ ${fmt(ivaAmount)}</span></div>
      <div class="totals-row"><span>IRPF (${irpfRate}%)</span><span>− ${fmt(irpfAmount)}</span></div>
      <div class="totals-row total"><span>TOTAL A COBRAR</span><span>${fmt(total)}</span></div>
    </div>
    <div class="footer">Generado con VFX Hours Tracker · ${today}</div>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  },

  // ── FACTURAS ────────────────────────────────────────────────

  async renderFacturas() {
    const el = document.getElementById('view-facturas');
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Cargando...</div>`;
    const invoices = await this.api.get('/api/invoices');
    this.state.invoices = invoices;

    const totalEmitidas = invoices.filter(i => i.status === 'issued').reduce((s, i) => s + (i.total || 0), 0);
    const totalBorradores = invoices.filter(i => i.status === 'draft').length;

    el.innerHTML = `
      <div class="view-header">
        <div>
          <h1 class="view-title">Facturas</h1>
          <p class="view-subtitle">${invoices.length} facturas · ${totalBorradores} borrador${totalBorradores !== 1 ? 'es' : ''}</p>
        </div>
        <button class="btn-primary" onclick="VFX.openInvoiceForm()">+ Nueva factura</button>
      </div>

      <div class="stats-row" style="margin-bottom:24px">
        <div class="stat-card">
          <div class="stat-label">Total facturado</div>
          <div class="stat-value">${this.fmt.currency(totalEmitidas)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Facturas emitidas</div>
          <div class="stat-value">${invoices.filter(i => i.status === 'issued').length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Borradores</div>
          <div class="stat-value">${totalBorradores}</div>
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Cliente</th>
              <th>Fecha</th>
              <th style="text-align:right">Base</th>
              <th style="text-align:right">Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${invoices.length === 0 ? `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:32px">No hay facturas aún</td></tr>` :
              invoices.map(inv => `
                <tr>
                  <td><span class="mono">${inv.full_number || '—'}</span></td>
                  <td>${inv.customer_name || inv.company_display_name || '—'}</td>
                  <td>${this.fmt.date(inv.issue_date)}</td>
                  <td style="text-align:right">${this.fmt.currency(inv.subtotal)}</td>
                  <td style="text-align:right"><strong>${this.fmt.currency(inv.total)}</strong></td>
                  <td>
                    <span class="badge ${inv.status === 'issued' ? 'badge-sent' : 'badge-pending'}">
                      ${inv.status === 'issued' ? 'Emitida' : 'Borrador'}
                    </span>
                  </td>
                  <td style="text-align:right;white-space:nowrap">
                    ${inv.status === 'issued' ? `
                      <button class="btn-icon" title="Descargar PDF" onclick="VFX.downloadInvoicePdf(${inv.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                    ` : `
                      <button class="btn-icon" title="Editar" onclick="VFX.openInvoiceForm(${inv.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button class="btn-icon btn-icon-red" title="Eliminar borrador" onclick="VFX.deleteInvoice(${inv.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                      </button>
                    `}
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  },

  async openInvoiceForm(invoiceId = null, prefillProjectId = null) {
    const [nextNum, companies] = await Promise.all([
      this.api.get('/api/invoices/next-number'),
      Promise.resolve(this.state.companies)
    ]);

    let inv = null;
    let lines = [{ description: '', quantity: 1, unit_price: 0, line_total: 0 }];

    if (invoiceId) {
      const data = await this.api.get(`/api/invoices/${invoiceId}`);
      inv = data;
      lines = data.lines?.length ? data.lines : lines;
    }

    // Pre-fill from project if provided
    let prefillCompanyId = inv?.company_id || null;
    if (prefillProjectId && !inv) {
      const proj = this.state.projects.find(p => p.id === prefillProjectId);
      if (proj) {
        prefillCompanyId = proj.company_id;
        const entries = await this.api.get(`/api/projects/${prefillProjectId}/entries`);
        if (entries.length) {
          const totalHours = entries.reduce((s, e) => s + e.hours, 0);
          const rate = proj.hourly_rate;
          lines = [{
            description: `Servicios de ${proj.name}`,
            quantity: totalHours,
            unit_price: rate,
            line_total: totalHours * rate
          }];
        }
      }
    }

    const u = this.state.user;
    const today = new Date().toISOString().split('T')[0];
    const isIssued = inv?.status === 'issued';

    const companyOptions = companies.map(c =>
      `<option value="${c.id}" data-nif="${c.cif||''}" data-address="${c.address||''}" data-city="${c.city||''}" data-postal="${c.postal_code||''}" data-country="${c.country||'España'}" ${prefillCompanyId == c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const linesHtml = () => lines.map((l, i) => `
      <tr data-line="${i}">
        <td><input type="text" class="line-desc" value="${(l.description||'').replace(/"/g,'&quot;')}" placeholder="Descripción del servicio" ${isIssued?'disabled':''}></td>
        <td><input type="number" class="line-qty" value="${l.quantity||1}" min="0" step="0.5" style="width:70px" ${isIssued?'disabled':''} oninput="VFX._recalcLine(${i})"></td>
        <td><input type="number" class="line-price" value="${l.unit_price||0}" min="0" step="0.01" style="width:90px" ${isIssued?'disabled':''} oninput="VFX._recalcLine(${i})"></td>
        <td class="line-total-cell" style="text-align:right;font-weight:600">${this.fmt.currency(l.line_total||0)}</td>
        ${isIssued ? '<td></td>' : `<td><button type="button" class="btn-icon btn-icon-red" onclick="VFX._removeLine(${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>`}
      </tr>
    `).join('');

    this._invoiceFormLines = lines.map(l => ({...l}));
    this._invoiceFormIvaRate = inv?.iva_rate ?? 21;
    this._invoiceFormIvaExempt = inv?.iva_exempt ?? 0;
    this._invoiceFormIrpfRate = inv?.irpf_rate ?? 15;

    const content = `
      <div class="invoice-form">
        <div class="form-row-2">
          <div class="form-group">
            <label>Nº de factura</label>
            <input type="number" id="inv-number" value="${inv?.number || nextNum.number}" min="1" ${isIssued?'disabled':''}>
          </div>
          <div class="form-group">
            <label>Fecha de emisión</label>
            <input type="date" id="inv-date" value="${inv?.issue_date || today}" ${isIssued?'disabled':''}>
          </div>
        </div>

        <div class="form-group">
          <label>Cliente</label>
          <select id="inv-company" onchange="VFX._fillInvoiceCustomer()" ${isIssued?'disabled':''}>
            <option value="">— Selecciona empresa —</option>
            ${companyOptions}
          </select>
        </div>

        <details style="margin:12px 0" ${isIssued?'open':''}>
          <summary style="cursor:pointer;color:var(--text2);font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase">Datos del cliente (auto desde empresa)</summary>
          <div style="margin-top:10px" class="form-row-2">
            <div class="form-group">
              <label>Nombre / Razón social</label>
              <input type="text" id="inv-cust-name" value="${inv?.customer_name||''}" placeholder="Empresa S.L." ${isIssued?'disabled':''}>
            </div>
            <div class="form-group">
              <label>NIF / CIF</label>
              <input type="text" id="inv-cust-nif" value="${inv?.customer_nif||''}" placeholder="B12345678" ${isIssued?'disabled':''}>
            </div>
          </div>
          <div class="form-group">
            <label>Dirección</label>
            <input type="text" id="inv-cust-address" value="${inv?.customer_address||''}" ${isIssued?'disabled':''}>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label>Ciudad</label>
              <input type="text" id="inv-cust-city" value="${inv?.customer_city||''}" ${isIssued?'disabled':''}>
            </div>
            <div class="form-group">
              <label>Código postal</label>
              <input type="text" id="inv-cust-postal" value="${inv?.customer_postal_code||''}" ${isIssued?'disabled':''}>
            </div>
          </div>
        </details>

        <div style="margin:16px 0 8px;font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:var(--text2)">Líneas de factura</div>
        <div class="table-wrap" style="margin-bottom:8px">
          <table class="data-table" id="inv-lines-table">
            <thead><tr><th>Descripción</th><th style="width:80px">Cantidad</th><th style="width:100px">Precio unit.</th><th style="text-align:right;width:110px">Importe</th><th style="width:30px"></th></tr></thead>
            <tbody id="inv-lines-body">${linesHtml()}</tbody>
          </table>
        </div>
        ${isIssued ? '' : `<button type="button" class="btn-ghost" style="font-size:12px" onclick="VFX._addLine()">+ Añadir línea</button>`}

        <div style="margin-top:20px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
          <div class="form-group" style="flex:1;min-width:140px">
            <label>IVA</label>
            <select id="inv-iva" onchange="VFX._updateInvoiceTotals()" ${isIssued?'disabled':''}>
              <option value="21" ${this._invoiceFormIvaExempt==0 && this._invoiceFormIvaRate==21?'selected':''}>21%</option>
              <option value="10" ${this._invoiceFormIvaExempt==0 && this._invoiceFormIvaRate==10?'selected':''}>10%</option>
              <option value="4" ${this._invoiceFormIvaExempt==0 && this._invoiceFormIvaRate==4?'selected':''}>4%</option>
              <option value="0" ${this._invoiceFormIvaExempt==1||this._invoiceFormIvaRate==0?'selected':''}>0% (exento)</option>
            </select>
          </div>
          <div class="form-group" style="flex:1;min-width:140px">
            <label>Retención IRPF</label>
            <select id="inv-irpf" onchange="VFX._updateInvoiceTotals()" ${isIssued?'disabled':''}>
              <option value="15" ${this._invoiceFormIrpfRate==15?'selected':''}>15%</option>
              <option value="7" ${this._invoiceFormIrpfRate==7?'selected':''}>7%</option>
              <option value="0" ${this._invoiceFormIrpfRate==0?'selected':''}>Sin retención</option>
            </select>
          </div>
          <div style="flex:2;min-width:200px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px" id="inv-totals-preview">
          </div>
        </div>

        <div class="form-group" style="margin-top:12px">
          <label>Notas (opcional)</label>
          <textarea id="inv-notes" rows="2" style="width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:8px;color:var(--text);padding:10px 12px;font-family:inherit;font-size:13px;resize:vertical" ${isIssued?'disabled':''}>${inv?.notes||''}</textarea>
        </div>

        ${isIssued ? `
          <div style="margin-top:16px;padding:10px 14px;background:rgba(82,232,117,0.06);border:1px solid rgba(82,232,117,0.2);border-radius:8px;font-size:12px;color:var(--green)">
            Factura emitida el ${this.fmt.date(inv.issued_at?.split(' ')[0])} — no editable
          </div>
        ` : ''}

        <div id="inv-form-error" class="form-error" style="display:none;margin-top:12px"></div>
      </div>
    `;

    const title = isIssued ? `Factura ${inv.full_number}` : (invoiceId ? `Borrador — Factura ${inv.number || '#'}` : 'Nueva factura');
    this.openModal(content, title);

    this._updateInvoiceTotals();
    if (prefillCompanyId) this._fillInvoiceCustomer(prefillCompanyId);

    if (!isIssued) {
      this._currentInvoiceId = invoiceId || null;
      const footer = document.getElementById('modal').querySelector('.modal-footer');
      if (footer) footer.remove();
      const modalEl = document.getElementById('modal');
      const footerEl = document.createElement('div');
      footerEl.className = 'modal-footer';
      footerEl.innerHTML = `
        <button class="btn-ghost" onclick="VFX.closeModal()">Cancelar</button>
        <button class="btn-secondary" onclick="VFX.saveInvoiceDraft()" style="margin-left:auto">Guardar borrador</button>
        <button class="btn-primary" onclick="VFX.issueInvoice()">Emitir factura</button>
      `;
      modalEl.appendChild(footerEl);
    }
  },

  _fillInvoiceCustomer(forceId) {
    const sel = document.getElementById('inv-company');
    if (!sel) return;
    const id = forceId || sel.value;
    if (!id) return;
    const opt = sel.querySelector(`option[value="${id}"]`);
    if (!opt) return;
    if (!forceId) sel.value = id;
    const company = this.state.companies.find(c => c.id == id);
    if (!company) return;
    const set = (elId, val) => { const e = document.getElementById(elId); if (e && !e.disabled) e.value = val || ''; };
    set('inv-cust-name', company.name);
    set('inv-cust-nif', company.cif);
    set('inv-cust-address', company.address);
    set('inv-cust-city', company.city);
    set('inv-cust-postal', company.postal_code);
  },

  _recalcLine(i) {
    if (!this._invoiceFormLines[i]) return;
    const rows = document.querySelectorAll('#inv-lines-body tr[data-line]');
    const row = rows[i];
    if (!row) return;
    const qty = parseFloat(row.querySelector('.line-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.line-price')?.value) || 0;
    const total = qty * price;
    this._invoiceFormLines[i] = {
      ...this._invoiceFormLines[i],
      description: row.querySelector('.line-desc')?.value || '',
      quantity: qty, unit_price: price, line_total: total
    };
    const cell = row.querySelector('.line-total-cell');
    if (cell) cell.textContent = this.fmt.currency(total);
    this._updateInvoiceTotals();
  },

  _addLine() {
    this._invoiceFormLines.push({ description: '', quantity: 1, unit_price: 0, line_total: 0 });
    this._rerenderLines();
  },

  _removeLine(i) {
    if (this._invoiceFormLines.length <= 1) return;
    this._invoiceFormLines.splice(i, 1);
    this._rerenderLines();
  },

  _rerenderLines() {
    const body = document.getElementById('inv-lines-body');
    if (!body) return;
    const lines = this._invoiceFormLines;
    body.innerHTML = lines.map((l, i) => `
      <tr data-line="${i}">
        <td><input type="text" class="line-desc" value="${(l.description||'').replace(/"/g,'&quot;')}" placeholder="Descripción del servicio"></td>
        <td><input type="number" class="line-qty" value="${l.quantity||1}" min="0" step="0.5" style="width:70px" oninput="VFX._recalcLine(${i})"></td>
        <td><input type="number" class="line-price" value="${l.unit_price||0}" min="0" step="0.01" style="width:90px" oninput="VFX._recalcLine(${i})"></td>
        <td class="line-total-cell" style="text-align:right;font-weight:600">${this.fmt.currency(l.line_total||0)}</td>
        <td><button type="button" class="btn-icon btn-icon-red" onclick="VFX._removeLine(${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
      </tr>
    `).join('');
    this._updateInvoiceTotals();
  },

  _syncLinesFromDom() {
    const rows = document.querySelectorAll('#inv-lines-body tr[data-line]');
    rows.forEach((row, i) => {
      if (!this._invoiceFormLines[i]) return;
      this._invoiceFormLines[i].description = row.querySelector('.line-desc')?.value || '';
      this._invoiceFormLines[i].quantity = parseFloat(row.querySelector('.line-qty')?.value) || 0;
      this._invoiceFormLines[i].unit_price = parseFloat(row.querySelector('.line-price')?.value) || 0;
      this._invoiceFormLines[i].line_total = this._invoiceFormLines[i].quantity * this._invoiceFormLines[i].unit_price;
    });
  },

  _updateInvoiceTotals() {
    this._syncLinesFromDom();
    const subtotal = this._invoiceFormLines.reduce((s, l) => s + (l.line_total || 0), 0);
    const ivaVal = parseFloat(document.getElementById('inv-iva')?.value ?? 21);
    const irpfVal = parseFloat(document.getElementById('inv-irpf')?.value ?? 15);
    const ivaExempt = ivaVal === 0;
    const ivaAmount = ivaExempt ? 0 : subtotal * ivaVal / 100;
    const irpfAmount = subtotal * irpfVal / 100;
    const total = subtotal + ivaAmount - irpfAmount;
    this._invoiceFormIvaRate = ivaVal;
    this._invoiceFormIvaExempt = ivaExempt ? 1 : 0;
    this._invoiceFormIrpfRate = irpfVal;
    this._invoiceFormTotals = { subtotal, ivaAmount, irpfAmount, total };

    const preview = document.getElementById('inv-totals-preview');
    if (!preview) return;
    preview.innerHTML = `
      <div style="font-size:11px;color:var(--text2);font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">Resumen</div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--text2)">Base imponible</span><span>${this.fmt.currency(subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--text2)">IVA (${ivaExempt ? 'exento' : ivaVal + '%'})</span><span>+ ${this.fmt.currency(ivaAmount)}</span></div>
      ${irpfVal > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:var(--text2)">Retención IRPF (${irpfVal}%)</span><span style="color:var(--red)">− ${this.fmt.currency(irpfAmount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><span>Total a cobrar</span><span style="color:var(--gold)">${this.fmt.currency(total)}</span></div>
    `;
  },

  _getInvoiceFormData() {
    this._syncLinesFromDom();
    const t = this._invoiceFormTotals || { subtotal: 0, ivaAmount: 0, irpfAmount: 0, total: 0 };
    const ivaVal = parseFloat(document.getElementById('inv-iva')?.value ?? 21);
    const u = this.state.user;
    return {
      number: parseInt(document.getElementById('inv-number')?.value) || null,
      full_number: String(document.getElementById('inv-number')?.value || ''),
      company_id: parseInt(document.getElementById('inv-company')?.value) || null,
      issue_date: document.getElementById('inv-date')?.value || new Date().toISOString().split('T')[0],
      issuer_name: u.name || '',
      issuer_nif: u.nif || '',
      issuer_address: u.address || '',
      issuer_city: u.city || '',
      issuer_postal_code: u.postal_code || '',
      customer_name: document.getElementById('inv-cust-name')?.value || '',
      customer_nif: document.getElementById('inv-cust-nif')?.value || '',
      customer_address: document.getElementById('inv-cust-address')?.value || '',
      customer_city: document.getElementById('inv-cust-city')?.value || '',
      customer_postal_code: document.getElementById('inv-cust-postal')?.value || '',
      customer_country: 'España',
      subtotal: t.subtotal,
      iva_rate: ivaVal,
      iva_exempt: this._invoiceFormIvaExempt,
      iva_amount: t.ivaAmount,
      irpf_rate: this._invoiceFormIrpfRate,
      irpf_amount: t.irpfAmount,
      total: t.total,
      notes: document.getElementById('inv-notes')?.value || '',
      lines: this._invoiceFormLines
    };
  },

  async saveInvoiceDraft() {
    const data = this._getInvoiceFormData();
    try {
      if (this._currentInvoiceId) {
        await this.api.put(`/api/invoices/${this._currentInvoiceId}`, data);
      } else {
        const r = await this.api.post('/api/invoices', data);
        this._currentInvoiceId = r.id;
      }
      this.closeModal();
      this.renderFacturas();
    } catch (e) {
      const err = document.getElementById('inv-form-error');
      if (err) { err.textContent = e.message; err.style.display = 'block'; }
    }
  },

  async issueInvoice() {
    const data = this._getInvoiceFormData();
    const errEl = document.getElementById('inv-form-error');
    if (errEl) errEl.style.display = 'none';
    try {
      // Save first
      let id = this._currentInvoiceId;
      if (id) {
        await this.api.put(`/api/invoices/${id}`, data);
      } else {
        const r = await this.api.post('/api/invoices', data);
        id = r.id;
      }
      // Then issue
      const r = await fetch(`/api/invoices/${id}/issue`, { method: 'POST' });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      this.closeModal();
      this.renderFacturas();
    } catch (e) {
      if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    }
  },

  async deleteInvoice(id) {
    if (!confirm('¿Eliminar este borrador?')) return;
    await this.api.del(`/api/invoices/${id}`);
    this.renderFacturas();
  },

  downloadInvoicePdf(id) {
    window.open(`/api/invoices/${id}/pdf`, '_blank');
  },

};

// Boot
document.addEventListener('DOMContentLoaded', () => VFX.init());
