/* ══════════════════════════════════════════════════════════════
   CRONORAS — app.js
   ══════════════════════════════════════════════════════════════ */


const VFX = {

  // ── STATE ──────────────────────────────────────────────────
  state: {
    view: 'dashboard',
    statsView: 'general',
    statsPeriod: '1m',
    statsCompareMode: 'none',
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
    treasury: [],
    plan: 'free',
    role: 'user',
    daysRemaining: null,
    planPeriod: null,
    isTrial: false,
    userId: null
  },

  charts: {},
  _selectedEntryIdsByProject: new Map(),
  _openEntryGroupKeys: new Set(),
  _modalDragFromInside: false,

  _lsKey(key) { return this.state.userId ? `${key}_u${this.state.userId}` : key; },

  isPro() { return this.state.plan !== 'free'; },

  showUpgradeModal(feature) {
    const labels = {
      stats: 'Estadísticas detalladas',
      facturas: 'Gestión de facturas',
      pdf: 'Exportar PDF',
      projects: 'Proyectos ilimitados',
      companies: 'Empresas ilimitadas',
    };
    const name = (feature && labels[feature]) ? labels[feature] : null;
    const proFeatures = [
      { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="15" height="15"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`, text: 'Estadísticas detalladas' },
      { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="15" height="15"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`, text: 'Gestión de facturas y PDF' },
      { icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="15" height="15"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`, text: 'Proyectos y empresas ilimitados' },
    ];
    this.openModal(`
      <div style="text-align:center;padding:40px 28px 28px;position:relative">
        <button class="modal-close" onclick="VFX.closeModal()" style="position:absolute;top:14px;right:14px">✕</button>

        <div style="width:56px;height:56px;background:linear-gradient(135deg,rgba(245,200,66,0.2),rgba(245,200,66,0.05));border:1px solid rgba(245,200,66,0.35);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" width="26" height="26"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </div>

        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:0.12em;margin-bottom:6px">PLAN PRO</div>
        <h3 style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:8px">Desbloquea todo</h3>
        ${name ? `<p style="font-size:13px;color:var(--text3);margin-bottom:20px"><strong style="color:var(--text2)">${name}</strong> requiere el plan Pro</p>` : `<p style="font-size:13px;color:var(--text3);margin-bottom:20px">Accede a todas las funciones sin límites</p>`}

        <div style="background:var(--card2);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:22px;display:flex;flex-direction:column;gap:10px;text-align:left">
          ${proFeatures.map(f => `
            <div style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--text2)">
              <span style="color:var(--gold);flex-shrink:0">${f.icon}</span>${f.text}
            </div>`).join('')}
        </div>

        <button class="btn btn-primary" style="width:100%;justify-content:center;font-size:14px;padding:12px" onclick="VFX.closeModal();VFX.navigate('planes')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          Ver planes y precios
        </button>
        <button class="btn" style="width:100%;justify-content:center;margin-top:8px;font-size:13px;color:var(--text3)" onclick="VFX.closeModal()">Ahora no</button>
      </div>
    `);
  },

  async requestUpgrade(plan, price, period, btnEl) {
    const PAYPAL_AMOUNTS = {
      'Pro Mensual':    '6',
      'Pro Trimestral': '16',
      'Pro Semestral':  '29',
      'Pro Anual':      '55',
      'Pro Vitalicio':  '200',
    };
    const original = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".25"/><path d="M21 12a9 9 0 00-9-9"/></svg>&nbsp;Enviando...`;
    // Abrir ventana antes del await para que cuente como gesto del usuario (fix PWA/mobile)
    const amount = PAYPAL_AMOUNTS[plan];
    const paypalWin = amount ? window.open('', '_blank') : null;
    try {
      await this.api.post('/api/contact/upgrade', { plan, price, period });
      localStorage.setItem(this._lsKey('vfx_upgrade_requested'), JSON.stringify({ plan, price, period, ts: Date.now() }));
      this.updateSidebarUser();
      this.renderPlanes();
      if (paypalWin) paypalWin.location = `https://paypal.me/vfxhours/${amount}EUR`;
    } catch (e) {
      if (paypalWin) paypalWin.close();
      btnEl.innerHTML = original;
      btnEl.disabled = false;
      alert('Error al enviar la solicitud. Inténtalo de nuevo.');
    }
  },

  _upgradeWallHtml(feature) {
    const labels = {
      stats: 'Estadísticas detalladas',
      facturas: 'Gestión de facturas',
    };
    return `
      <div class="upgrade-wall">
        <div class="upgrade-card">
          <div class="upgrade-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <h3>${labels[feature] || feature}</h3>
          <p>Esta sección está disponible en el plan <strong style="color:var(--gold)">Pro</strong>.<br>
          Actualiza para acceder a todas las funciones.</p>
          <button class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:10px"
            onclick="VFX.showUpgradeModal('${feature}')">Ver planes Pro</button>
        </div>
      </div>
    `;
  },

  // ── PRIVACY ────────────────────────────────────────────────
  privacy:                window.CronorasPrivacy.privacy,

  // ── UI HELPERS (acordeones) ────────────────────────────────
  toggleSummary(idx) {
    const body = document.getElementById(`summary-body-${idx}`);
    const chevron = document.getElementById(`summary-chevron-${idx}`);
    if (!body) return;
    const open = body.style.display === 'none';
    body.style.display = open ? 'block' : 'none';
    if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
  },

  toggleSummaryDetail() {
    const body = document.getElementById('summary-body-detail');
    const chevron = document.getElementById('summary-chevron-detail');
    if (!body) return;
    const open = body.style.display === 'none';
    body.style.display = open ? 'block' : 'none';
    if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
  },

  toggleProjectDayEntries(key) {
    const rows = document.querySelectorAll(`[data-project-day-children="${key}"]`);
    const toggle = document.querySelector(`[data-project-day-toggle="${key}"]`);
    const expanded = toggle?.getAttribute('aria-expanded') === 'true';
    rows.forEach(row => { row.style.display = expanded ? 'none' : 'table-row'; });
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!expanded));
      toggle.classList.toggle('open', !expanded);
    }
    if (expanded) this._openEntryGroupKeys.delete(key);
    else this._openEntryGroupKeys.add(key);
  },

  _toggleAllProjectDetailEntries(checked, projectId) {
    document.querySelectorAll(`.project-detail-entry-cb[data-project="${projectId}"]`).forEach(cb => { cb.checked = checked; });
    this._onProjectDetailEntryCbChange(projectId);
  },

  _onProjectDetailEntryCbChange(projectId) {
    const all = document.querySelectorAll(`.project-detail-entry-cb[data-project="${projectId}"]`);
    const checked = document.querySelectorAll(`.project-detail-entry-cb[data-project="${projectId}"]:checked`);
    this._selectedEntryIdsByProject.set(projectId, new Set([...checked].map(cb => parseInt(cb.dataset.id))));
    const editBtn = document.getElementById(`project-detail-edit-btn-${projectId}`);
    if (editBtn) editBtn.style.display = checked.length === 1 ? 'inline' : 'none';
    const deleteBtn = document.getElementById(`project-detail-delete-btn-${projectId}`);
    if (deleteBtn) deleteBtn.style.display = checked.length > 1 ? 'inline' : 'none';
    const cbAll = document.getElementById(`project-detail-cb-all-${projectId}`);
    if (cbAll) {
      cbAll.indeterminate = checked.length > 0 && checked.length < all.length;
      cbAll.checked = all.length > 0 && checked.length === all.length;
    }
  },

  _clearEntrySelection(id) {
    const entryId = Number(id);
    this._selectedEntryIdsByProject.forEach(set => set.delete(entryId));
    document.querySelectorAll(`.entry-cb[data-id="${entryId}"], .project-detail-entry-cb[data-id="${entryId}"]`).forEach(cb => {
      cb.checked = false;
      const projectId = Number(cb.dataset.project);
      if (cb.classList.contains('project-detail-entry-cb')) this._onProjectDetailEntryCbChange(projectId);
      else this._onEntryCbChange(projectId);
    });
  },

  togglePrivacy:          window.CronorasPrivacy.togglePrivacy,
  applyPrivacy:           window.CronorasPrivacy.applyPrivacy,

  // ── SLOTS (un panel por proyecto) ─────────────────────────
  // state.slots = [{ projectId, entries, timer: { active, paused, startTime, accumulated, interval } }]

  _slotsLoad()      { window.CronorasSlots.slotsLoad(); },
  _slotsSave()      { window.CronorasSlots.slotsSave(); },
  _slotElapsed(idx) { return window.CronorasSlots.slotElapsed(idx); },
  _slotFmt(idx)     { return window.CronorasSlots.slotFmt(idx); },

  async _syncTimersFromServer() { return window.CronorasSlots.syncTimersFromServer(); },

  _startSlotInterval(idx) { window.CronorasSlots.startSlotInterval(idx); },

  addSlot()                          { return window.CronorasSlots.addSlot(); },
  removeSlot(idx)                    { return window.CronorasSlots.removeSlot(idx); },
  async selectSlotProject(idx, pid)  { return window.CronorasSlots.selectSlotProject(idx, pid); },

  // ── ANALYTICS ──────────────────────────────────────────────
  track(event, metadata) {
    fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, metadata }) }).catch(() => {});
  },

  // ── API ────────────────────────────────────────────────────
  api: window.CronorasApi,

  // ── UTILS ──────────────────────────────────────────────────
  fmt: window.CronorasFormatters,

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

  savePrivacyDefault:     window.CronorasPrivacy.savePrivacyDefault,
  toggleLocationPrivacy:  window.CronorasPrivacy.toggleLocationPrivacy,
  saveHomeLocation:       window.CronorasPrivacy.saveHomeLocation,

  // ── INIT / BOOTSTRAP ───────────────────────────────────────
  async init() {
    try {
      document.getElementById('view-dashboard').innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Cargando...</div>`;
      const authData = await this.api.get('/api/auth/me');
      this.state.requireAuth = authData.requireAuth;
      this.state.plan = authData.plan || 'free';
      this.state.role = authData.role || 'user';
      this.state.daysRemaining = authData.daysRemaining ?? null;
      this.state.planPeriod = authData.planPeriod || null;
      this.state.isTrial = !!authData.isTrial;
      this.state.userId = authData.userId || 1;
      if (authData.requireAuth && !authData.authenticated) { window.location.href = '/login.html'; return; }

      this.privacy.load();
      await this.privacy.checkLocation();
      this.applyPrivacy();
      this._slotsLoad();
      await this.loadAll();
      await this._syncTimersFromServer();

      // Restaurar proyecto activo desde localStorage
      const savedId = localStorage.getItem(this._lsKey('vfx_current_project'));
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

      // Polling cada 15s para sincronizar timers entre dispositivos
      if (this._syncPollInterval) clearInterval(this._syncPollInterval);
      this._syncPollInterval = setInterval(() => this._syncTimersFromServer(), 15000);

      // Sync inmediato al recuperar el foco (cambio de pestaña, desbloqueo de pantalla)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this._syncTimersFromServer();
      });

      document.addEventListener('click', () => {
        document.querySelectorAll('[id^="status-dd-"]').forEach(d => d.style.display = 'none');
      });

      this._restoreSidebar();

      if (!this.state.user.name) {
        setTimeout(() => this.modals.settings(), 300);
      }
    } catch (e) {
      this.showBootError(e);
    }
  },

  showBootError(error) {
    const el = document.getElementById('view-dashboard');
    if (!el) return;
    el.innerHTML = `
      <div style="max-width:420px;margin:48px auto;padding:22px;border:1px solid var(--border);border-radius:12px;background:var(--card);text-align:center">
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:8px">No se ha podido cargar Cronoras</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.55;margin-bottom:16px">
          Revisa la conexión e inténtalo de nuevo. Si vienes de iniciar sesión en móvil, prueba también a recargar la página.
        </div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:16px">${error?.message || 'Error de carga'}</div>
        <button class="btn btn-primary" onclick="window.location.reload()">Reintentar</button>
      </div>
    `;
  },

  async loadAll() {
    const now = new Date();
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
    const monthFrom = `${y}-${m}-01`;
    const monthTo   = `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}`;
    const yearFrom  = `${y}-01-01`;
    const yearTo    = `${y}-12-31`;

    const [user, projects, companies, monthSummary, yearSummary] = await Promise.all([
      this.api.get('/api/user'),
      this.api.get('/api/projects'),
      this.api.get('/api/companies'),
      this.api.get(`/api/stats/summary?from=${monthFrom}&to=${monthTo}`),
      this.api.get(`/api/stats/summary?from=${yearFrom}&to=${yearTo}`)
    ]);
    this.state.user = user;
    this.state.projects = projects;
    this.state.companies = companies;
    this.state.monthEarnings = monthSummary?.total_earnings || 0;
    this.state.yearEarnings  = yearSummary?.total_earnings  || 0;
    // Limpiar slots que apuntan a proyectos que este usuario ya no posee
    let slotsDirty = false;
    this.state.slots.forEach(s => {
      if (s.projectId && !projects.find(p => p.id === s.projectId)) {
        s.projectId = null; s.timerProjectId = null; s.entries = [];
        slotsDirty = true;
      }
    });
    if (slotsDirty) this._slotsSave();
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
      default:    return { from: ago(30), to: today, group: 'day' }; // '1m'
    }
  },

  previousPeriodDates(range) {
    const fromDate = new Date(`${range.from}T12:00:00`);
    const toDate = new Date(`${range.to}T12:00:00`);
    const days = Math.max(1, Math.round((toDate - fromDate) / 86400000) + 1);
    const prevTo = new Date(fromDate);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - days + 1);
    const fmt = d => d.toISOString().split('T')[0];
    return { from: fmt(prevFrom), to: fmt(prevTo), group: range.group };
  },

  previousYearDates(range) {
    const shift = (date) => {
      const d = new Date(`${date}T12:00:00`);
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().split('T')[0];
    };
    return { from: shift(range.from), to: shift(range.to), group: range.group };
  },

  async loadStatsRange(period) {
    const range = this.periodDates(period);
    const { from, to, group } = range;
    const prev = this.previousPeriodDates(range);
    const [periodic, heatmap, clients, summary, previousSummary] = await Promise.all([
      this.api.get(`/api/stats/monthly?from=${from}&to=${to}&group=${group}`),
      this.api.get('/api/stats/heatmap'),
      this.api.get(`/api/stats/clients?from=${from}&to=${to}`),
      this.api.get(`/api/stats/summary?from=${from}&to=${to}`),
      this.api.get(`/api/stats/summary?from=${prev.from}&to=${prev.to}`)
    ]);
    let comparison = [];
    if (this.state.statsCompareMode !== 'none') {
      const compareRange = this.state.statsCompareMode === 'year'
        ? this.previousYearDates(range)
        : prev;
      comparison = await this.api.get(`/api/stats/monthly?from=${compareRange.from}&to=${compareRange.to}&group=${compareRange.group}`);
    }
    this.state.stats = { periodic, heatmap, clients, summary, previousSummary, comparison };
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

  // ── SIDEBAR ────────────────────────────────────────────────
  updateSidebarUser()          { return window.CronorasSidebar.updateSidebarUser(); },
  async logout()               { return window.CronorasSidebar.logout(); },
  toggleSidebar()              { return window.CronorasSidebar.toggleSidebar(); },
  _restoreSidebar()            { return window.CronorasSidebar.restoreSidebar(); },
  _initResponsiveSidebar()     { return window.CronorasSidebar.initResponsiveSidebar(); },

  // ── NAVIGATION ─────────────────────────────────────────────
  navigate(view)              { return window.CronorasNavigation.navigate(view); },

  // ── DASHBOARD (overview facturación) ──────────────────────
  async renderDashboard() { return window.CronorasDashboardView.renderDashboard(); },
  selectForCockpit(id)        { return window.CronorasNavigation.selectForCockpit(id); },
  filterDashboard(filter)     { return window.CronorasNavigation.filterDashboard(filter); },
  async goToProject(id)       { return window.CronorasNavigation.goToProject(id); },

  // ── PROYECTO EN CURSO ──────────────────────────────────────
  async renderProyecto() {
    this._renderingProyecto = true;
    // Cargar entradas de slots que tienen proyecto pero entries vacío
    await Promise.all(this.state.slots.map(async (slot, idx) => {
      if (slot.projectId && slot.entries.length === 0) {
        slot.entries = await this.api.get(`/api/projects/${slot.projectId}/entries`);
      }
    }));

    // Preservar estado abierto del acordeón de resumen antes del re-render
    const openSummaries = new Set();
    this.state.slots.forEach((_, i) => {
      const b = document.getElementById(`summary-body-${i}`);
      if (b && b.style.display !== 'none') openSummaries.add(i);
    });

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

    // Restaurar acordeones que estaban abiertos antes del re-render
    openSummaries.forEach(i => {
      const body = document.getElementById(`summary-body-${i}`);
      const chevron = document.getElementById(`summary-chevron-${i}`);
      if (body) body.style.display = 'block';
      if (chevron) chevron.style.transform = 'rotate(180deg)';
    });

    // Reiniciar intervalos tras re-render
    this.state.slots.forEach((s, i) => {
      if (s.timer.active && !s.timer.paused) this._startSlotInterval(i);
    });

    // Actualizar señal live en sidebar
    const anyRunning = this.state.slots.some(s => s.timer.active && !s.timer.paused);
    const signal = document.getElementById('sidebar-signal');
    if (signal) signal.classList.toggle('live', anyRunning);
    this.state.slots.forEach(s => {
      if (s.projectId) this._onEntryCbChange(s.projectId);
    });
    this._renderingProyecto = false;
  },

  _renderSlot(idx) {
    const slot    = this.state.slots[idx];
    const project = slot.projectId ? this.state.projects.find(p => p.id === slot.projectId) : null;
    const canRemove = this.state.slots.length > 1;

    const projectOptions = this.state.projects.map(p =>
      `<option value="${p.id}" ${p.id === slot.projectId ? 'selected' : ''}>${p.name} — ${p.company_name}</option>`
    ).join('');

    const noProjects = this.state.projects.length === 0;
    const entriesHtml = slot.projectId && Array.isArray(slot.entries)
      ? this.renderEntriesTable(slot.entries, slot.projectId, idx)
      : (!slot.projectId && noProjects ? this.renderNoProjectHint() : '');

    return `
      <div class="current-project-slot">
        ${noProjects ? '' : `<div class="project-bar">
          <div class="project-bar-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
          </div>
          <label class="project-bar-field">
            <span>Proyecto visible</span>
            <select onchange="VFX.selectSlotProject(${idx}, this.value)">
              <option value="">— Selecciona un proyecto —</option>
              ${projectOptions}
            </select>
          </label>
          ${canRemove ? `
            <button class="btn btn-ghost btn-sm project-bar-remove" onclick="VFX.removeSlot(${idx})" title="Dejar de visualizar este proyecto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ` : ''}
        </div>`}
        ${noProjects ? '' : this._renderSlotTimer(idx)}
        ${entriesHtml}
        ${this._renderSlotSummary(idx)}
      </div>
    `;
  },

  _renderSlotTimer(idx) {
    const slot = this.state.slots[idx];
    const project = slot?.projectId ? this.state.projects.find(p => p.id === slot.projectId) : null;
    const timerProject = slot?.timerProjectId ? this.state.projects.find(p => p.id === slot.timerProjectId) : project;
    const t = slot?.timer || { active: false, paused: false };
    const isRunning = t.active && !t.paused;
    const timerIsForOtherProject = t.active && slot.timerProjectId && slot.timerProjectId !== slot.projectId;

    return `
      <div class="timer-card ${isRunning ? 'active' : ''} ${t.active && t.paused ? 'paused' : ''}" id="timer-card-${idx}">
        <div>
          <div class="timer-label">
            SESIÓN DE TRABAJO${t.active ? (t.paused ? ' — PAUSADA' : ' — EN CURSO') : ''}
            ${timerIsForOtherProject ? `<span style="color:var(--gold);margin-left:6px">· ${timerProject?.name || ''}</span>` : ''}
          </div>
          <div class="timer-display ${isRunning ? 'running' : ''}" id="timer-display-${idx}">
            ${t.active ? this._slotFmt(idx) : '00:00:00'}
          </div>
          <div class="timer-status-line ${isRunning ? 'running' : t.active && t.paused ? 'paused' : ''}">
            ${isRunning ? 'Registrando tiempo ahora' : t.active && t.paused ? 'Sesión pausada' : 'Listo para iniciar'}
          </div>
          ${!slot.projectId && !t.active ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">Selecciona un proyecto para iniciar</div>` : ''}
          ${timerIsForOtherProject ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">Viendo entradas de: ${project?.name || '—'}</div>` : ''}
        </div>
        <div class="timer-actions">
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
  },

  refreshSlotTimer(idx) {
    const card = document.getElementById(`timer-card-${idx}`);
    if (card) card.outerHTML = this._renderSlotTimer(idx);
    const signal = document.getElementById('sidebar-signal');
    if (signal) signal.classList.toggle('live', this.state.slots.some(s => s.timer.active && !s.timer.paused));
  },

  _renderSlotSummary(idx) {
    const slot = this.state.slots[idx];
    if (!slot?.projectId) return '';
    const project = this.state.projects.find(p => p.id === slot.projectId);
    if (!project) return '';

    const entries    = slot.entries || [];
    const hourlyRate = project.hourly_rate || 0;
    const dailyRate  = hourlyRate * 8;
    const totalHours = entries.reduce((s, e) => s + e.hours, 0);
    const totalDays  = totalHours / 8;
    const subtotal   = entries.reduce((s, e) => s + e.hours * (e.hourly_rate_override || hourlyRate), 0);
    const ivaRate    = this.state.user.iva_rate || 21;
    const irpfRate   = this.state.user.irpf_rate || 15;
    const ivaAmount  = subtotal * (ivaRate / 100);
    const irpfAmount = subtotal * (irpfRate / 100);
    const total      = subtotal + ivaAmount - irpfAmount;
    const yearEarnings   = this.state.yearEarnings  || 0;
    const monthEarnings  = this.state.monthEarnings || 0;
    const annualGoal     = this.state.user.annual_goal  || 50000;
    const monthlyGoal    = this.state.user.monthly_goal || 4000;
    const meterPct       = Math.min((yearEarnings  / annualGoal)  * 100, 100);
    const monthMeterPct  = Math.min((monthEarnings / monthlyGoal) * 100, 100);
    const meterClass     = meterPct < 33 ? 'low' : meterPct < 66 ? 'mid' : 'high';
    const monthMeterClass = monthMeterPct < 33 ? 'low' : monthMeterPct < 66 ? 'mid' : 'high';

    return `
      <div class="project-summary">
        <div class="summary-header summary-header-toggle" onclick="VFX.toggleSummary(${idx})">
          <svg class="summary-chevron" id="summary-chevron-${idx}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          <span class="summary-header-label">Resumen del proyecto</span>
        </div>

        <div class="summary-collapsible" id="summary-body-${idx}" style="display:none">
        <div class="summary-stats">
          <div class="stat-pill">
            <div class="stat-pill-label">Horas totales</div>
            <div class="stat-pill-value cyan">${this.fmt.hours(totalHours)}</div>
          </div>
          <div class="stat-pill desktop-only">
            <div class="stat-pill-label">Días</div>
            <div class="stat-pill-value cyan">${totalDays.toFixed(2)} d</div>
          </div>
          <div class="stat-pill">
            <div class="stat-pill-label">Entradas</div>
            <div class="stat-pill-value">${entries.length}</div>
          </div>
          <div class="stat-pill stat-pill-gold">
            <div class="stat-pill-label">Total neto</div>
            <div class="stat-pill-value gold" data-private>${this.fmt.currency(total)}</div>
          </div>
        </div>

        <div class="summary-detail desktop-only">
          <div>
            <div class="cockpit-section-label" style="margin-bottom:8px">Desglose fiscal</div>
            <div class="cockpit-row">
              <span class="cockpit-row-label">Base imponible</span>
              <span class="cockpit-row-value" data-private>${this.fmt.currency(subtotal)}</span>
            </div>
            <div class="cockpit-row">
              <span class="cockpit-row-label">+ IVA (${ivaRate}%)</span>
              <span class="cockpit-row-value green" data-private>+${this.fmt.currency(ivaAmount)}</span>
            </div>
            <div class="cockpit-row">
              <span class="cockpit-row-label">− IRPF (${irpfRate}%)</span>
              <span class="cockpit-row-value red" data-private>−${this.fmt.currency(irpfAmount)}</span>
            </div>
            <div class="cockpit-row" style="margin-top:4px;padding-top:8px;border-top:1px solid var(--border)">
              <span class="cockpit-row-label" style="color:var(--text)">Tarifa/día</span>
              <span class="cockpit-row-value" data-private>${this.fmt.currency(dailyRate)}</span>
            </div>
          </div>
          <div>
            <div style="margin-top:16px">
              <div class="cockpit-section-label" style="margin-bottom:8px">Meta de ingresos mensual</div>
              <div class="meter-bar-bg">
                <div class="meter-bar-fill" style="width:${monthMeterPct}%;background:var(--green)"></div>
              </div>
              <div class="meter-label-row">
                <span class="meter-label-text" data-private>${this.fmt.currency(monthEarnings)}</span>
                <span class="meter-label-text" data-private>${this.fmt.currency(monthlyGoal)}</span>
              </div>
              <div class="cockpit-section-label" style="margin-bottom:8px;margin-top:16px">Meta de ingresos anual</div>
              <div class="meter-bar-bg">
                <div class="meter-bar-fill" style="width:${meterPct}%;background:var(--cyan)"></div>
              </div>
              <div class="meter-label-row">
                <span class="meter-label-text" data-private>${this.fmt.currency(yearEarnings)}</span>
                <span class="meter-label-text" data-private>${this.fmt.currency(annualGoal)}</span>
              </div>
            </div>
            ${project.budget_type === 'fixed' && project.fixed_budget ? `
            <div style="margin-top:16px">
              <div class="cockpit-section-label" style="margin-bottom:8px">Presupuesto cerrado</div>
              <div class="cockpit-row">
                <span class="cockpit-row-label">Acordado</span>
                <span class="cockpit-row-value gold" data-private>${this.fmt.currency(project.fixed_budget)}</span>
              </div>
              <div class="cockpit-row">
                <span class="cockpit-row-label">Balance</span>
                <span class="cockpit-row-value ${project.fixed_budget - subtotal >= 0 ? 'green' : 'red'}" data-private>
                  ${project.fixed_budget - subtotal >= 0 ? '+' : ''}${this.fmt.currency(project.fixed_budget - subtotal)}
                </span>
              </div>
            </div>
            ` : ''}
          </div>
        </div>

        <div>
          <div class="summary-controls-row">
            <div>
              <div class="cockpit-section-label" style="margin-bottom:8px">Trabajo</div>
              <label class="summary-checkbox-label">
                <input type="checkbox" ${project.is_completed ? 'checked' : ''} onchange="VFX.setProjectCompleted(${project.id}, this.checked)">
                Trabajo finalizado
              </label>
            </div>
            <div>
              <div class="cockpit-section-label" style="margin-bottom:8px">Facturación</div>
              <select class="summary-select" onchange="VFX.updateProjectStatus(${project.id}, this.value)">
                <option value="pending" ${project.status === 'pending' ? 'selected' : ''}>⏳ Pendiente de envío</option>
                <option value="sent" ${project.status === 'sent' ? 'selected' : ''}>📤 Enviada / En espera</option>
                <option value="paid" ${project.status === 'paid' ? 'selected' : ''}>✅ Cobrada</option>
              </select>
            </div>
          </div>
          ${project.status === 'sent' || project.status === 'paid' ? `
          <div class="summary-dates desktop-only">
            <div>
              <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Fecha de envío de factura</label>
              <input type="date" value="${project.invoiced_at || ''}" onchange="VFX.updateInvoiceDate(${project.id}, this.value)">
            </div>
            <div>
              <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:4px">Fecha de cobro esperada <span style="opacity:0.6">(manual)</span></label>
              <input type="date" value="${project.expected_payment_date || ''}" onchange="VFX.updateExpectedPayment(${project.id}, this.value)">
            </div>
          </div>
          ` : ''}
        </div>

        <div class="summary-actions" style="margin-top:16px">
          <button class="btn btn-ghost" onclick="VFX.exportProject(${project.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>
          <button class="btn btn-ghost" onclick="VFX.printInvoice(${project.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Factura
          </button>
        </div>
        </div><!-- /summary-collapsible -->
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

  _renderTimeEntryRows(entries, project, options = {}) {
    const hourlyRate = project?.hourly_rate || 0;
    const projectId = project?.id || options.projectId;
    const checkboxClass = options.checkboxClass || 'entry-cb';
    const onCheckboxChange = options.onCheckboxChange || `VFX._onEntryCbChange(${projectId})`;
    const keyPrefix = options.keyPrefix || `entries-${projectId}`;
    const mobileEdit = options.mobileEdit ? (id) => ` onclick="if (window.matchMedia('(max-width: 700px)').matches && !event.target.closest('input,button')) VFX.modals.editEntry(${id})"` : () => '';
    const selectedIds = this._selectedEntryIdsByProject.get(projectId) || new Set();

    const groups = entries.reduce((acc, entry) => {
      const dateKey = String(entry.date || '').slice(0, 10);
      let group = acc.find(g => g.dateKey === dateKey);
      if (!group) {
        group = { dateKey, entries: [], totalHours: 0, totalAmount: 0, rates: [] };
        acc.push(group);
      }
      const effectiveHourly = entry.hourly_rate_override ?? hourlyRate;
      group.entries.push(entry);
      group.totalHours += Number(entry.hours || 0);
      group.totalAmount += Number(entry.hours || 0) * effectiveHourly;
      group.rates.push(effectiveHourly);
      return acc;
    }, []);

    const renderEntryRow = (e, extraClass = '', hiddenKey = '', initiallyOpen = false) => {
      const effectiveHourly = e.hourly_rate_override ?? hourlyRate;
      const effectiveDaily = effectiveHourly * 8;
      const hours = Number(e.hours || 0);
      const days = hours / 8;
      const total = hours * effectiveHourly;
      return `
        <tr class="project-detail-entry-row entry-row ${extraClass}" ${hiddenKey ? `data-project-day-children="${hiddenKey}" style="display:${initiallyOpen ? 'table-row' : 'none'}"` : ''}${mobileEdit(e.id)}>
          <td class="project-detail-check"><input type="checkbox" class="${checkboxClass}" data-id="${e.id}" data-project="${projectId}" ${selectedIds.has(Number(e.id)) ? 'checked' : ''} onchange="${onCheckboxChange}"></td>
          <td class="project-detail-date dim">${this.fmt.date(e.date)}</td>
          <td class="project-detail-description">${e.description || '<span style="color:var(--text3)">Sin descripción</span>'}</td>
          <td class="mono dim project-detail-hours">${this.fmt.hours(hours)}<span class="entry-days-inline">(${days.toFixed(2)}d)</span></td>
          <td class="mono dim project-detail-rate" data-private>${this.fmt.currency(effectiveDaily)}/día</td>
          <td class="gold project-detail-amount" data-private>${this.fmt.currency(total)}</td>
        </tr>
      `;
    };

    return groups.map(group => {
      if (group.entries.length === 1) return renderEntryRow(group.entries[0]);

      const key = `${keyPrefix}-${group.dateKey}`;
      const uniqueRates = [...new Set(group.rates)];
      const rateLabel = uniqueRates.length === 1 ? `${this.fmt.currency(uniqueRates[0] * 8)}/día` : 'varias';
      const isOpen = this._openEntryGroupKeys.has(key);

      return `
        <tr class="project-day-group-row" onclick="VFX.toggleProjectDayEntries('${key}')">
          <td class="project-detail-date project-day-group-date" colspan="2">${this.fmt.date(group.dateKey)}</td>
          <td class="project-day-group-description">
            <div class="project-day-group-main">
              <button class="project-day-toggle ${isOpen ? 'open' : ''}" data-project-day-toggle="${key}" aria-expanded="${isOpen ? 'true' : 'false'}" onclick="event.stopPropagation();VFX.toggleProjectDayEntries('${key}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <span class="project-day-count">${group.entries.length} entrada${group.entries.length !== 1 ? 's' : ''}</span>
            </div>
          </td>
          <td class="mono dim project-detail-hours">${this.fmt.hours(group.totalHours)}</td>
          <td class="mono dim project-detail-rate">${rateLabel}</td>
          <td class="gold project-detail-amount" data-private>${this.fmt.currency(group.totalAmount)}</td>
        </tr>
        ${group.entries.map(e => renderEntryRow(e, 'project-day-child-row', key, isOpen)).join('')}
      `;
    }).join('');
  },

  renderEntriesTable(entries = this.state.entries, projectId = this.state.currentProjectId, slotIdx = null) {
    const project = this.state.projects.find(p => p.id === projectId);
    const rows = this._renderTimeEntryRows(entries, project, {
      projectId,
      checkboxClass: 'entry-cb',
      onCheckboxChange: `VFX._onEntryCbChange(${projectId})`,
      keyPrefix: `current-${projectId}`,
      mobileEdit: true
    });

    return `
      <div class="table-container entries-table-container">
        <div class="table-header entries-header">
          <span class="table-title">ENTRADAS DE TIEMPO — ${entries.length} registro${entries.length !== 1 ? 's' : ''}</span>
          <div class="entry-table-actions">
            <button class="btn btn-ghost btn-sm" onclick="VFX.state.currentProjectId=${projectId};${slotIdx!==null?`VFX._pendingSlotIdx=${slotIdx};`:``}VFX.modals.addEntry()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              Añadir entrada
            </button>
            <span class="entry-bulk-action" id="bulk-edit-btn-${projectId}" style="display:none">
              <button class="btn btn-ghost btn-sm" onclick="VFX.editSelectedEntry(${projectId})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar seleccionada
              </button>
            </span>
            <span class="entry-bulk-action" id="bulk-delete-btn-${projectId}" style="display:none">
              <button class="btn btn-danger btn-sm" onclick="VFX.deleteSelectedEntries(${projectId})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Eliminar seleccionadas
              </button>
            </span>
          </div>
        </div>
        ${entries.length > 0 ? `
          <table class="time-entries-table project-detail-entries-table">
            <thead>
              <tr>
                <th style="width:28px;padding-right:0"><input type="checkbox" id="entry-cb-all-${projectId}" onchange="VFX._toggleAllEntries(this.checked, ${projectId})"></th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Horas / Días</th>
                <th>€/día</th>
                <th>Total</th>
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

  _toggleAllEntries(checked, projectId) {
    document.querySelectorAll(`.entry-cb[data-project="${projectId}"]`).forEach(cb => { cb.checked = checked; });
    this._onEntryCbChange(projectId);
  },

  _onEntryCbChange(projectId) {
    const all     = document.querySelectorAll(`.entry-cb[data-project="${projectId}"]`);
    const checked = document.querySelectorAll(`.entry-cb[data-project="${projectId}"]:checked`);
    this._selectedEntryIdsByProject.set(projectId, new Set([...checked].map(cb => parseInt(cb.dataset.id))));
    const editBtn = document.getElementById(`bulk-edit-btn-${projectId}`);
    if (editBtn) editBtn.style.display = checked.length === 1 ? 'inline' : 'none';
    const deleteBtn = document.getElementById(`bulk-delete-btn-${projectId}`);
    if (deleteBtn) deleteBtn.style.display = checked.length > 1 ? 'inline' : 'none';
    const cbAll = document.getElementById(`entry-cb-all-${projectId}`);
    if (cbAll) {
      cbAll.indeterminate = checked.length > 0 && checked.length < all.length;
      cbAll.checked = all.length > 0 && checked.length === all.length;
    }
  },

  editSelectedEntry(projectId) {
    const ids = [...document.querySelectorAll(`.entry-cb[data-project="${projectId}"]:checked`)].map(cb => parseInt(cb.dataset.id));
    if (ids.length !== 1) return;
    this.modals.editEntry(ids[0]);
  },

  openBulkRateModal(projectId) {
    const proj = this.state.projects.find(p => p.id === projectId);
    const defaultHourly = proj ? proj.hourly_rate : 0;
    const ids = [...document.querySelectorAll(`.entry-cb[data-project="${projectId}"]:checked`)].map(cb => parseInt(cb.dataset.id));
    if (!ids.length) return;
    this.openModal(`
      <p style="color:var(--text2);margin-bottom:16px">Cambiando tarifa de <strong style="color:var(--text)">${ids.length} entrada${ids.length !== 1 ? 's' : ''}</strong>.</p>
      <div class="form-group">
        <label>Nueva tarifa (€/día)</label>
        ${dailyRateSelect('bulk-rate', defaultHourly)}
      </div>
      <p style="font-size:11px;color:var(--text3);margin-top:8px">Selecciona "— Selecciona tarifa —" para eliminar la tarifa personalizada y usar la del proyecto.</p>
      <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:20px">
        <button class="btn btn-ghost" onclick="VFX.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="VFX.applyBulkRate(${JSON.stringify(ids)}, ${projectId})">Aplicar</button>
      </div>
    `, 'Cambiar tarifa en masa');
  },

  editSelectedProjectDetailEntry(projectId) {
    const ids = [...document.querySelectorAll(`.project-detail-entry-cb[data-project="${projectId}"]:checked`)].map(cb => parseInt(cb.dataset.id));
    if (ids.length !== 1) return;
    this.modals.editEntry(ids[0]);
  },

  openProjectDetailBulkRateModal(projectId) {
    const proj = this.state.projects.find(p => p.id === projectId);
    const defaultHourly = proj ? proj.hourly_rate : 0;
    const ids = [...document.querySelectorAll(`.project-detail-entry-cb[data-project="${projectId}"]:checked`)].map(cb => parseInt(cb.dataset.id));
    if (!ids.length) return;
    this.openModal(`
      <p style="color:var(--text2);margin-bottom:16px">Cambiando tarifa de <strong style="color:var(--text)">${ids.length} entrada${ids.length !== 1 ? 's' : ''}</strong>.</p>
      <div class="form-group">
        <label>Nueva tarifa (€/día)</label>
        ${dailyRateSelect('project-detail-bulk-rate', defaultHourly)}
      </div>
      <p style="font-size:11px;color:var(--text3);margin-top:8px">Selecciona "— Selecciona tarifa —" para eliminar la tarifa personalizada y usar la del proyecto.</p>
      <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border);margin-top:20px">
        <button class="btn btn-ghost" onclick="VFX.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="VFX.applyProjectDetailBulkRate(${JSON.stringify(ids)}, ${projectId})">Aplicar</button>
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
      localStorage.setItem(this._lsKey('vfx_current_project'), this.state.currentProjectId);
      const entries = await this.api.get(`/api/projects/${this.state.currentProjectId}/entries`);
      this.state.entries = entries;
    } else {
      localStorage.removeItem(this._lsKey('vfx_current_project'));
      this.state.entries = [];
    }
    this.renderProyecto();
  },

  // ── COCKPIT ────────────────────────────────────────────────
  refreshCockpit() {
    const anyRunning = this.state.slots.some(s => s.timer.active && !s.timer.paused);
    const signal = document.getElementById('sidebar-signal');
    if (signal) signal.classList.toggle('live', anyRunning);
    if (this.state.view === 'proyecto' && !this._renderingProyecto) this.renderProyecto();
  },

  renderBadge(status) {
    return `<span class="badge badge-${status}">${{pending:'Pendiente',sent:'Enviada',paid:'Cobrada'}[status]||status}</span>`;
  },

  renderStatusDropdown(projectId, status) {
    const labels = { pending:'En curso', sent:'Enviada', paid:'Cobrada' };
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
    if (!this.isPro()) {
      el.innerHTML = `
        <div class="page-header">
          <div><div class="page-title">Estadísticas</div></div>
        </div>
        <div style="position:relative">
          <div class="plan-locked-wrap" aria-hidden="true">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px">
              ${[1,2,3,4].map(() => `<div class="metric-card"><div class="metric-label">————</div><div class="metric-value">—.—</div></div>`).join('')}
            </div>
            <div class="table-container" style="height:200px"></div>
          </div>
          <div class="plan-locked-overlay">
            <div class="upgrade-card">
              <div class="upgrade-card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <h3>Estadísticas detalladas</h3>
              <p>Analiza tus horas, ingresos y clientes con el plan <strong style="color:var(--gold)">Pro</strong>.</p>
              <button class="btn btn-primary" style="width:100%;justify-content:center"
                onclick="VFX.showUpgradeModal('stats')">Actualizar a Pro</button>
            </div>
          </div>
        </div>
      `;
      return;
    }
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

    const tabBtnCls = (v) => `stats-view-tab ${statsView === v ? 'active' : ''}`;
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

      <div class="stats-toolbar">
        <div class="stats-periods">
          ${periodBtns}
          <button class="btn btn-sm ${period === 'custom' ? 'btn-primary' : 'btn-ghost'}" onclick="VFX.changeStatsPeriod('custom')">Rango</button>
        </div>
        <div class="stats-view-tabs">
          <button class="${tabBtnCls('general')}" onclick="VFX.changeStatsView('general')">General</button>
          <button class="${tabBtnCls('project')}" onclick="VFX.changeStatsView('project')">Por proyecto</button>
        </div>
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
    const { periodic, heatmap, clients, summary, comparison } = this.state.stats;
    const { group } = this.periodDates(this.state.statsPeriod);

    const unbilled      = Number(summary?.unbilled_earnings || 0);
    const pendingAmount = Number(summary?.pending_amount || 0);
    const paidAmount    = Number(summary?.paid_amount || 0);
    const totalHours    = Number(summary?.total_hours || 0);
    const avgRate       = Number(summary?.avg_rate || 0);
    const totalProjects = Number(summary?.total_projects || 0);
    const totalClients  = Number(summary?.total_clients || 0);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth  = now.getDate();
    const thisMonth   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const thisMonthData  = periodic.find(m => m.period === thisMonth);
    const monthEarnings  = thisMonthData?.earnings || 0;
    const projectedMonth = dayOfMonth > 0 ? (monthEarnings / dayOfMonth) * daysInMonth : 0;
    const projPct        = Math.min(Math.round((dayOfMonth / daysInMonth) * 100), 100);
    const circumference  = 2 * Math.PI * 30;

    const annualGoal     = this.state.user.annual_goal  || 50000;
    const monthlyGoal    = this.state.user.monthly_goal || 4000;
    const annualGoalPct  = Math.min(Math.round((this.state.yearEarnings  / annualGoal)  * 100), 100);
    const monthlyGoalPct = Math.min(Math.round((this.state.monthEarnings / monthlyGoal) * 100), 100);

    document.getElementById('stats-content').innerHTML = `
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Sin facturar</div>
          <div class="metric-value" style="color:var(--gold)" data-private>${this.fmt.currency(unbilled)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Pendiente</div>
          <div class="metric-value" style="color:var(--red)" data-private>${this.fmt.currency(pendingAmount)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Cobrado</div>
          <div class="metric-value" style="color:var(--green)" data-private>${this.fmt.currency(paidAmount)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Horas</div>
          <div class="metric-value" style="color:var(--cyan)">${this.fmt.hours(totalHours)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Tarifa media</div>
          <div class="metric-value" style="font-size:clamp(13px,1.25vw,18px);white-space:nowrap;letter-spacing:0" data-private>${this.fmt.currency(avgRate * 8)}/día</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Proyectos</div>
          <div class="metric-value" style="color:var(--green)">${totalProjects}</div>
          <div class="metric-sub">${totalClients} cliente${totalClients !== 1 ? 's' : ''} distintos</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="chart-card full">
          <div class="chart-head">
            <div class="chart-title">Ingresos y horas por período</div>
            <div class="chart-compare" aria-label="Comparar gráfico">
              <button class="${this.state.statsCompareMode === 'none' ? 'active' : ''}" title="Sin comparativa" onclick="VFX.changeStatsCompare('none')">Actual</button>
              <button class="${this.state.statsCompareMode === 'previous' ? 'active' : ''}" title="Comparar con el período anterior" onclick="VFX.changeStatsCompare('previous')">Anterior</button>
              <button class="${this.state.statsCompareMode === 'year' ? 'active' : ''}" title="Comparar con el año anterior" onclick="VFX.changeStatsCompare('year')">Año -1</button>
            </div>
          </div>
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
        <div class="chart-card">
          <div class="chart-title">Objetivos</div>
          <div style="display:flex;flex-direction:column;gap:20px;margin-top:4px">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px">
                <span style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Mensual</span>
                <span style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:var(--green)" data-private>${monthlyGoalPct}%</span>
              </div>
              <div style="background:var(--border);border-radius:6px;height:8px;overflow:hidden">
                <div style="background:var(--green);height:8px;border-radius:6px;width:${monthlyGoalPct}%;transition:width .5s ease"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:5px">
                <span style="font-size:11px;color:var(--text3)" data-private>${this.fmt.currency(this.state.monthEarnings)}</span>
                <span style="font-size:11px;color:var(--text3)" data-private>${this.fmt.currency(monthlyGoal)}</span>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px">
                <span style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.04em">Anual ${new Date().getFullYear()}</span>
                <span style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:var(--cyan)" data-private>${annualGoalPct}%</span>
              </div>
              <div style="background:var(--border);border-radius:6px;height:8px;overflow:hidden">
                <div style="background:var(--cyan);height:8px;border-radius:6px;width:${annualGoalPct}%;transition:width .5s ease"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:5px">
                <span style="font-size:11px;color:var(--text3)" data-private>${this.fmt.currency(this.state.yearEarnings)}</span>
                <span style="font-size:11px;color:var(--text3)" data-private>${this.fmt.currency(annualGoal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    if (this.applyPrivacy) this.applyPrivacy();
    this.renderPeriodicChart(periodic, group, comparison || []);
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
    const { from, to, group } = this.periodDates(this.state.statsPeriod);
    const { summary, monthly } = await this.api.get(`/api/stats/project/${projectId}?from=${from}&to=${to}&group=${group}`);
    const project = this.state.projects.find(p => p.id === projectId) || {};
    const groupLabel = group === 'day' ? 'día' : group === 'week' ? 'semana' : 'mes';
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
          <div style="font-size:13px;font-weight:600;color:var(--text1);margin-top:6px">${summary?.first_date ? this.fmt.date(summary.first_date) : '—'}</div>
          <div style="font-size:11px;color:var(--text3);margin:2px 0">↓</div>
          <div style="font-size:13px;font-weight:600;color:var(--text1)">${summary?.last_date ? this.fmt.date(summary.last_date) : '—'}</div>
        </div>`}
      </div>
      <div class="stats-grid">
        <div class="chart-card full">
          <div class="chart-title">Horas e ingresos por ${groupLabel} — ${project.name || ''}</div>
          <div class="chart-wrap" style="height:200px">
            <canvas id="chart-monthly"></canvas>
          </div>
        </div>
      </div>
    `;
    if (this.applyPrivacy) this.applyPrivacy();
    this.renderPeriodicChart(monthly, group);
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

  async changeStatsCompare(mode) {
    this.state.statsCompareMode = mode;
    this.renderStats();
  },

  async changeStatsProject(id) {
    this.state.statsProjectId = id || null;
    this._renderStatsProject(this.state.statsProjectId);
  },

  renderPeriodicChart(data, group, comparison = []) {
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
    const compareEarningsData = data.map((_, i) => comparison[i]?.earnings || 0);
    const compareHoursData = data.map((_, i) => comparison[i]?.hours || 0);
    const compareLabel = this.state.statsCompareMode === 'year' ? 'Año anterior' : 'Periodo anterior';
    const comparisonDatasets = this.state.statsCompareMode === 'none' ? [] : [
      {
        type: 'bar',
        label: `${compareLabel} (€)`,
        data: compareEarningsData,
        backgroundColor: 'rgba(144, 144, 184, 0.13)',
        borderColor: 'rgba(144, 144, 184, 0.45)',
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'y'
      },
      {
        type: 'line',
        label: `${compareLabel} h`,
        data: compareHoursData,
        borderColor: 'rgba(144, 144, 184, 0.75)',
        backgroundColor: 'transparent',
        borderDash: [5, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.35,
        fill: false,
        yAxisID: 'y2'
      }
    ];

    this.charts.monthly = new Chart(ctx, {
      data: {
        labels,
        datasets: [
          ...comparisonDatasets,
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

  // ── PROYECTOS (listado histórico) + COMPANIES ─────────────
  _projectStatus(p) {
    if (p.status === 'paid')        return { label: 'Cobrado',    cls: 'badge-paid' };
    if (p.status === 'sent')        return { label: 'Facturado',  cls: 'badge-sent' };
    if (p.is_completed)             return { label: 'Terminado',  cls: 'badge-completed' };
    return                                 { label: 'En curso',   cls: 'badge-pending' };
  },

  renderProjects() { return window.CronorasProjectsView.renderProjects(); },
  async renderProjectDetail(id) {
    const el = document.getElementById('view-projects');
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Cargando...</div>`;
    this._projectDetailId = id;

    const [p, entries] = await Promise.all([
      this.api.get(`/api/projects/${id}`),
      this.api.get(`/api/projects/${id}/entries`)
    ]);

    this.state.currentProjectId = p.id;
    this.state.entries = entries;

    const u = this.state.user;
    const ivaRate  = u.iva_rate  ?? 21;
    const irpfRate = u.irpf_rate ?? 15;
    const gross    = p.total_amount || 0;
    const ivaAmt   = gross * (ivaRate / 100);
    const irpfAmt  = gross * (irpfRate / 100);
    const net      = gross + ivaAmt - irpfAmt;
    const avgRate  = p.total_hours > 0 ? gross / p.total_hours : 0;

    const st = this._projectStatus(p);
    const endDate = p.completed_at || (p.is_completed || p.status === 'paid' ? p.last_entry_date : null);

    const entryRows = this._renderTimeEntryRows(entries, p, {
      projectId: p.id,
      checkboxClass: 'project-detail-entry-cb',
      onCheckboxChange: `VFX._onProjectDetailEntryCbChange(${p.id})`,
      keyPrefix: `project-${p.id}`
    });

    el.innerHTML = `
      <div class="page-header project-detail-header">
        <div class="project-detail-back">
          <button class="btn btn-ghost btn-sm project-detail-action-btn" onclick="VFX.renderProjects()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Todos los proyectos
          </button>
        </div>
        <div class="page-actions project-detail-actions">
          <button class="btn btn-ghost btn-sm project-detail-action-btn" onclick="VFX.goToProjectInCurso(${p.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            En curso
          </button>
          <button class="btn btn-ghost btn-sm project-detail-action-btn" onclick="VFX.modals.editProject(${p.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Editar
          </button>
          <button class="btn btn-ghost btn-sm project-detail-action-btn" onclick="VFX.exportProject(${p.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
          </button>
          <button class="btn btn-primary btn-sm project-detail-action-btn project-detail-primary-action" onclick="VFX.printInvoice(${p.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Factura
          </button>
        </div>
      </div>

      <div class="project-detail-hero">
        <div class="project-detail-hero-main">
          <div>
            <div class="project-detail-hero-label">Proyecto</div>
            <h2>${p.name}</h2>
          </div>
          <span class="badge ${st.cls}">${st.label}</span>
        </div>
        <div class="project-detail-hero-client">${p.company_name || '—'}</div>
        ${p.notes ? `<div class="project-detail-hero-notes">${p.notes}</div>` : ''}
        <div class="project-detail-hero-stats">
          <div>
            <span>Horas</span>
            <strong>${this.fmt.hours(p.total_hours)}</strong>
          </div>
          <div>
            <span>Ingresos</span>
            <strong data-private>${this.fmt.currency(gross)}</strong>
          </div>
          <div>
            <span>Inicio</span>
            <strong>${this.fmt.date(p.first_entry_date || p.created_at)}</strong>
          </div>
          <div>
            <span>Fin</span>
            <strong class="${endDate ? '' : 'is-open'}">${endDate ? this.fmt.date(endDate) : 'En curso'}</strong>
          </div>
        </div>
        ${p.purchase_order ? `<div class="project-detail-hero-po">PO: ${p.purchase_order}</div>` : ''}
      </div>

      <div class="table-container entries-table-container">
        <div class="table-header">
          <span class="table-title">ENTRADAS DE TRABAJO — ${entries.length} registro${entries.length !== 1 ? 's' : ''}</span>
          <div class="entry-table-actions project-detail-entry-actions" style="display:flex;gap:6px;align-items:center">
            <span id="project-detail-edit-btn-${p.id}" style="display:none">
              <button class="btn btn-ghost btn-sm" onclick="VFX.editSelectedProjectDetailEntry(${p.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar seleccionada
              </button>
            </span>
            <span id="project-detail-delete-btn-${p.id}" style="display:none">
              <button class="btn btn-danger btn-sm" onclick="VFX.deleteSelectedProjectDetailEntries(${p.id})">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Eliminar seleccionadas
              </button>
            </span>
          </div>
        </div>
        ${entries.length === 0 ? `
          <div class="empty-table">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <p>Sin entradas registradas</p>
          </div>
        ` : `
          <div style="overflow-x:auto">
            <table class="time-entries-table project-detail-entries-table">
              <thead>
                <tr>
                  <th style="width:28px;padding-right:0"><input type="checkbox" id="project-detail-cb-all-${p.id}" onchange="VFX._toggleAllProjectDetailEntries(this.checked, ${p.id})"></th>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th style="text-align:right">Horas / Días</th>
                  <th style="text-align:right">€/día</th>
                  <th style="text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>${entryRows}</tbody>
            </table>
          </div>
        `}
      </div>

      <div class="project-summary">
        <div class="summary-header summary-header-toggle" onclick="VFX.toggleSummaryDetail()">
          <svg class="summary-chevron" id="summary-chevron-detail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transform:rotate(180deg)"><polyline points="6 9 12 15 18 9"/></svg>
          <span class="summary-header-label">Resumen del proyecto</span>
        </div>
        <div id="summary-body-detail" style="display:block">
          <div class="project-summary-grid">
            <div class="summary-card">
              <div class="summary-card-title">Información del proyecto</div>
              <div class="summary-card-rows">
                <div class="summary-row">
                  <span>Inicio</span>
                  <strong>${this.fmt.date(p.first_entry_date || p.created_at)}</strong>
                </div>
                <div class="summary-row">
                  <span>Fin</span>
                  <strong class="${endDate ? '' : 'is-open'}">${endDate ? this.fmt.date(endDate) : 'En curso'}</strong>
                </div>
                <div class="summary-row">
                  <span>Total horas</span>
                  <strong>${this.fmt.hours(p.total_hours)}</strong>
                </div>
                <div class="summary-row">
                  <span>Tarifa media/día</span>
                  <strong>${this.fmt.currency(avgRate * 8)}/día</strong>
                </div>
                ${p.purchase_order ? `<div class="summary-row"><span>Orden de compra</span><strong class="gold">${p.purchase_order}</strong></div>` : ''}
                ${p.invoice_number ? `<div class="summary-row"><span>Nº Factura</span><strong>${p.invoice_number}</strong></div>` : ''}
              </div>
            </div>
            <div class="summary-card">
              <div class="summary-card-title">Resumen financiero</div>
              <div class="summary-card-rows">
                <div class="summary-row">
                  <span>Base imponible</span>
                  <strong data-private>${this.fmt.currency(gross)}</strong>
                </div>
                <div class="summary-row">
                  <span>IVA (${ivaRate}%)</span>
                  <strong class="cyan" data-private>+${this.fmt.currency(ivaAmt)}</strong>
                </div>
                <div class="summary-row">
                  <span>Retención IRPF (${irpfRate}%)</span>
                  <strong class="red" data-private>−${this.fmt.currency(irpfAmt)}</strong>
                </div>
                <div class="summary-divider"></div>
                <div class="summary-row summary-row-total">
                  <span>Total neto</span>
                  <strong data-private>${this.fmt.currency(net)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div><!-- /summary-body-detail -->
      </div><!-- /project-summary -->
    `;
    this._onProjectDetailEntryCbChange(p.id);
  },

  downloadProjectReport(id) {
    if (!this.isPro()) { this.showUpgradeModal('pdf'); return; }
    window.open(`/api/projects/${id}/report`, '_blank');
  },

  async goToProjectInCurso(id) {
    // Si el proyecto ya está en un slot, no hace falta añadirlo
    let slot = this.state.slots.find(s => s.projectId === id);
    if (!slot) {
      // Usar el primer slot vacío, o el primero si todos tienen proyecto
      slot = this.state.slots.find(s => !s.projectId) || this.state.slots[0];
      slot.projectId = id;
      slot.entries = await this.api.get(`/api/projects/${id}/entries`);
      this._slotsSave();
    }
    this.state.currentProjectId = id;
    localStorage.setItem(this._lsKey('vfx_current_project'), id);
    this.navigate('proyecto');
  },

  // ── RENDER VIEWS (wrappers a módulos core) ─────────────────
  renderCompanies() { return window.CronorasCompaniesView.renderCompanies(); },
  // ── PLANES ─────────────────────────────────────────────────
  renderPlanes() { return window.CronorasPlansView.renderPlanes(); },
  // ── SETTINGS ───────────────────────────────────────────────
  renderSettings() { return window.CronorasStaticViews.renderSettings(); },

  // ── MODALS ─────────────────────────────────────────────────
  modals: window.CronorasModals,

  openModal(content, title) {
    document.querySelectorAll('#modal > .modal-footer').forEach(el => el.remove());
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
      if (window.matchMedia('(max-width: 700px)').matches) return;
      const first = document.querySelector('.modal input[autofocus], .modal input:not([type="hidden"])');
      if (first) first.focus();
    }, 100);
  },

  closeModal(e) {
    if (e) {
      if (e.target !== document.getElementById('modal-overlay')) return;
      if (this._modalDragFromInside) { this._modalDragFromInside = false; return; }
    }
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    document.getElementById('modal-overlay').classList.remove('open');
  },

  // ── ACTIONS ────────────────────────────────────────────────
  async createProject() {
    if (!this.isPro() && this.state.projects.length >= 1) {
      this.closeModal();
      this.showUpgradeModal('projects');
      return;
    }
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
    localStorage.setItem(this._lsKey('vfx_current_project'), id);
    this.closeModal();
    this.navigate(this.state.view);
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
      purchase_order: document.getElementById('edit-proj-po')?.value || '',
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
    const existingEntry = this.state.entries.find(e => e.id === id);
    const oldProjectId = existingEntry?.project_id || this.state.currentProjectId || this._projectDetailId;
    const newProjectId = parseInt(document.getElementById('edit-entry-project').value);
    const dailyOverride = getDailyRateValue('edit-entry-rate');
    await this.api.put(`/api/entries/${id}`, {
      project_id: newProjectId,
      date: document.getElementById('edit-entry-date').value,
      hours: parseFloat(document.getElementById('edit-entry-hours').value),
      description: document.getElementById('edit-entry-desc').value,
      hourly_rate_override: dailyOverride > 0 ? dailyOverride / 8 : null
    });
    const slot = this.state.slots.find(s => s.entries?.some(e => e.id === id));
    const projectId = oldProjectId || slot?.projectId || this.state.currentProjectId || this._projectDetailId;
    this._clearEntrySelection(id);
    if (projectId) {
      const entries = await this.api.get(`/api/projects/${projectId}/entries`);
      this.state.entries = entries;
      if (slot) slot.entries = entries;
    }
    await this.loadAll();
    this.closeModal();
    if (this.state.view === 'projects' && this._projectDetailId) {
      await this.renderProjectDetail(this._projectDetailId);
      return;
    }
    await this.renderProyecto();
  },

  async deleteEntry(id) {
    if (!confirm('¿Eliminar esta entrada?')) return;
    await this.api.del(`/api/entries/${id}`);
    // Limpiar slot.entries para forzar recarga en renderProyecto
    this.state.slots.forEach(s => { if (s.entries?.some(e => e.id === id)) s.entries = []; });
    await this.loadAll();
    this.closeModal();
    if (this.state.view === 'projects' && this._projectDetailId) {
      await this.renderProjectDetail(this._projectDetailId);
      return;
    }
    this.renderProyecto();
  },

  async applyProjectDetailBulkRate(ids, projectId) {
    const dailyVal = getDailyRateValue('project-detail-bulk-rate');
    const rateOverride = dailyVal > 0 ? dailyVal / 8 : null;
    await Promise.all(ids.map(id => {
      const entry = this.state.entries.find(e => e.id === id);
      if (!entry) return;
      return this.api.put(`/api/entries/${id}`, {
        date: entry.date,
        hours: entry.hours,
        description: entry.description || '',
        hourly_rate_override: rateOverride
      });
    }));
    this.state.slots.forEach(s => { if (s.entries?.some(e => ids.includes(e.id))) s.entries = []; });
    await this.loadAll();
    this.closeModal();
    await this.renderProjectDetail(projectId);
  },

  async deleteSelectedEntries(projectId) {
    const ids = [...document.querySelectorAll(`.entry-cb[data-project="${projectId}"]:checked`)].map(cb => parseInt(cb.dataset.id));
    if (!ids.length) return;
    const msg = ids.length === 1 ? '¿Eliminar la entrada seleccionada?' : `¿Eliminar ${ids.length} entradas seleccionadas?`;
    if (!confirm(msg)) return;
    await Promise.all(ids.map(id => this.api.del(`/api/entries/${id}`)));
    this.state.slots.forEach(s => { if (s.entries?.some(e => ids.includes(e.id))) s.entries = []; });
    await this.loadAll();
    await this.renderProyecto();
  },

  async deleteSelectedProjectDetailEntries(projectId) {
    const ids = [...document.querySelectorAll(`.project-detail-entry-cb[data-project="${projectId}"]:checked`)].map(cb => parseInt(cb.dataset.id));
    if (!ids.length) return;
    const msg = ids.length === 1 ? '¿Eliminar la entrada seleccionada?' : `¿Eliminar ${ids.length} entradas seleccionadas?`;
    if (!confirm(msg)) return;
    await Promise.all(ids.map(id => this.api.del(`/api/entries/${id}`)));
    this.state.slots.forEach(s => { if (s.entries?.some(e => ids.includes(e.id))) s.entries = []; });
    await this.loadAll();
    await this.renderProjectDetail(projectId);
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
    const data = Object.fromEntries(new FormData(e.target));
    data.iva_rate     = parseFloat(data.iva_rate)     || 21;
    data.irpf_rate    = parseFloat(data.irpf_rate)    || 15;
    data.annual_goal  = parseInt(data.annual_goal)    || 50000;
    data.monthly_goal = parseInt(data.monthly_goal)   || 4000;
    await this.api.put('/api/user', data);
    this.state.user = { ...this.state.user, ...data };
    this.updateSidebarUser();
    this.closeModal();
    this.refreshCockpit();
    const btn = document.getElementById('settings-save-btn');
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.cursor = 'default';
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg> Cambios guardados`;
      setTimeout(() => { if (this.state.view === 'settings') this.renderSettings(); }, 2500);
    } else {
      if (this.state.view === 'settings') this.renderSettings();
    }
  },

  _settingsDirty() {
    const btn = document.getElementById('settings-save-btn');
    if (!btn || !btn.disabled) return;
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = '';
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar cambios`;
  },

  // ── TIMER ──────────────────────────────────────────────────
  async startTimer(idx) { return window.CronorasSlots.startTimer(idx); },
  async pauseTimer(idx) { return window.CronorasSlots.pauseTimer(idx); },
  async resumeTimer(idx) { return window.CronorasSlots.resumeTimer(idx); },

  async stopTimer(idx) { return window.CronorasSlots.stopTimer(idx); },
  async saveTimerEntry(idx, projectId) { return window.CronorasSlots.saveTimerEntry(idx, projectId); },

  // ── EXPORT ─────────────────────────────────────────────────
  async exportProject(id) {
    const data = await this.api.get(`/api/projects/${id}/export`);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cronoras_${data.project.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async printInvoice(id) {
    if (!this.isPro()) { this.showUpgradeModal('pdf'); return; }
    this.track('invoice_print', { project_id: id });
    const data = await this.api.get(`/api/projects/${id}/export`);
    const { project, entries, user } = data;
    const hourlyRate = project.hourly_rate || 0;
    const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
    const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    // Agrupar entradas por tarifa diaria efectiva
    const groups = {};
    entries.forEach(e => {
      const effHourly = e.hourly_rate_override || hourlyRate;
      const effDaily = Math.round(effHourly * 8 * 100) / 100;
      const key = effDaily.toFixed(2);
      if (!groups[key]) groups[key] = { daily: effDaily, hours: 0, total: 0 };
      groups[key].hours += e.hours;
      groups[key].total += e.hours * effHourly;
    });

    const rows = Object.values(groups).map(g => {
      const days = g.hours / 8;
      return `
        <tr>
          <td>${project.name}</td>
          <td style="text-align:right">${days % 1 === 0 ? days : days.toFixed(2)} día${days !== 1 ? 's' : ''}</td>
          <td style="text-align:right">${fmt(g.daily)}/día</td>
          <td style="text-align:right"><strong>${fmt(g.total)}</strong></td>
        </tr>`;
    }).join('');

    const subtotal = Object.values(groups).reduce((s, g) => s + g.total, 0);
    const totalHours = entries.reduce((s, e) => s + e.hours, 0);
    const totalDays = totalHours / 8;
    const ivaRate = user.iva_rate || 21;
    const irpfRate = user.irpf_rate || 15;
    const ivaAmount = subtotal * (ivaRate / 100);
    const irpfAmount = subtotal * (irpfRate / 100);
    const total = subtotal + ivaAmount - irpfAmount;

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Factura — ${project.name}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Inter',Arial,sans-serif;font-size:13px;color:#1a1a2e;background:#fff;padding:48px;max-width:800px;margin:0 auto}
      /* CABECERA */
      .top-bar{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:32px;border-bottom:2px solid #1a1a2e}
      .invoice-label{font-size:32px;font-weight:700;letter-spacing:3px;color:#1a1a2e}
      .invoice-number{font-size:13px;color:#777;margin-top:4px;letter-spacing:0.5px}
      .invoice-date{text-align:right;font-size:13px;color:#555}
      .invoice-date strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#aaa;margin-bottom:3px}
      /* BLOQUES EMISOR / DESTINATARIO */
      .parties{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:36px}
      .party-block{padding:20px;background:#f7f7fa;border-radius:8px}
      .party-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#aaa;margin-bottom:10px}
      .party-name{font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:6px}
      .party-detail{font-size:12px;color:#555;line-height:1.7}
      /* TABLA */
      table{width:100%;border-collapse:collapse;margin-bottom:8px}
      thead th{background:#1a1a2e;color:#fff;padding:10px 14px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase}
      tbody td{padding:12px 14px;border-bottom:1px solid #eef0f5;font-size:13px;color:#333}
      tbody tr:last-child td{border-bottom:none}
      tbody tr:hover td{background:#f9f9fc}
      .table-note{font-size:11px;color:#aaa;margin-bottom:28px;padding:0 2px}
      /* TOTALES */
      .bottom{display:flex;justify-content:space-between;align-items:flex-start;gap:32px;margin-top:8px}
      .bottom-note{font-size:12px;color:#aaa;line-height:1.7;flex:1;padding-top:6px}
      .totals{width:280px;flex-shrink:0}
      .totals-row{display:flex;justify-content:space-between;padding:7px 0;font-size:13px;border-bottom:1px solid #eef0f5}
      .totals-row:last-child{border-bottom:none}
      .totals-row.highlight{font-size:16px;font-weight:700;color:#1a1a2e;padding-top:14px;margin-top:6px;border-top:2px solid #1a1a2e}
      .totals-row .label{color:#777}
      .totals-row.highlight .label{color:#1a1a2e}
      /* PIE */
      .footer{margin-top:48px;padding-top:20px;border-top:1px solid #eef0f5;display:flex;justify-content:space-between;font-size:11px;color:#bbb}
      @media print{body{padding:24px}@page{margin:1.5cm}}
    </style></head><body>

    <div class="top-bar">
      <div>
        <div class="invoice-label">FACTURA</div>
        ${project.invoice_number ? `<div class="invoice-number">Nº ${project.invoice_number}</div>` : ''}
      </div>
      <div class="invoice-date">
        <strong>Fecha de emisión</strong>${today}
      </div>
    </div>

    <div class="parties">
      <div class="party-block">
        <div class="party-label">Emisor</div>
        <div class="party-name">${user.name || '—'}</div>
        <div class="party-detail">
          ${user.profession || ''}${user.nif ? '<br>NIF: ' + user.nif : ''}
          ${user.address ? '<br>' + user.address : ''}
          ${(user.city || user.postal_code) ? '<br>' + [user.postal_code, user.city].filter(Boolean).join(' ') : ''}
          ${user.email ? '<br>' + user.email : ''}
          ${user.phone ? '<br>' + user.phone : ''}
          ${user.iban ? '<br><strong>IBAN:</strong> ' + user.iban : ''}
        </div>
      </div>
      <div class="party-block">
        <div class="party-label">Destinatario</div>
        <div class="party-name">${project.company_name || '—'}</div>
        <div class="party-detail">
          ${project.company_cif ? 'CIF: ' + project.company_cif : ''}
          ${project.company_address ? '<br>' + project.company_address : ''}
          ${project.company_city ? '<br>' + project.company_city : ''}
          ${project.company_email ? '<br>' + project.company_email : ''}
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Concepto</th>
          <th style="text-align:right;width:100px">Días</th>
          <th style="text-align:right;width:110px">Tarifa/día</th>
          <th style="text-align:right;width:120px">Importe</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="table-note">Total: ${totalDays % 1 === 0 ? totalDays : totalDays.toFixed(2)} días · ${parseFloat(totalHours).toFixed(1)} horas registradas</div>

    <div class="bottom">
      <div class="bottom-note">
        ${user.nif ? `Sujeto a retención de IRPF del ${irpfRate}%.` : ''}
      </div>
      <div class="totals">
        <div class="totals-row"><span class="label">Base imponible</span><span>${fmt(subtotal)}</span></div>
        <div class="totals-row"><span class="label">IVA (${ivaRate}%)</span><span>+ ${fmt(ivaAmount)}</span></div>
        <div class="totals-row"><span class="label">Retención IRPF (${irpfRate}%)</span><span>− ${fmt(irpfAmount)}</span></div>
        <div class="totals-row highlight"><span class="label">Total</span><span>${fmt(total)}</span></div>
      </div>
    </div>

    ${user.iban ? `
    <div style="margin-top:32px;padding:16px 20px;background:#f7f7fa;border-radius:8px;border-left:3px solid #1a1a2e">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#aaa;margin-bottom:8px">Datos de pago</div>
      <div style="font-size:12px;color:#333">Titular: <strong>${user.name || ''}</strong></div>
      <div style="font-size:12px;color:#333;margin-top:4px;font-family:monospace;letter-spacing:0.5px">IBAN: <strong>${user.iban}</strong></div>
    </div>` : ''}

    <div class="footer">
      <span>${user.name || ''}${user.nif ? ' · NIF ' + user.nif : ''}</span>
      <span>Generado con Cronoras</span>
    </div>
    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 600);
  },

  // ── FACTURAS ────────────────────────────────────────────────

  async renderFacturas() {
    const el = document.getElementById('view-facturas');
    if (!this.isPro()) {
      el.innerHTML = `
        <div class="page-header">
          <div><div class="page-title">Facturas</div></div>
        </div>
        ${this._upgradeWallHtml('facturas')}
      `;
      return;
    }
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Cargando...</div>`;
    const invoices = await this.api.get('/api/invoices');
    this.state.invoices = invoices;

    const issuedInvoices = invoices.filter(i => i.status === 'issued');
    const billedInvoices = invoices.filter(i => i.status === 'issued' || i.status === 'paid');
    const totalEmitido = billedInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const totalPendienteCobro = issuedInvoices.reduce((s, i) => s + (i.total || 0), 0);
    const totalBorradores = invoices.filter(i => i.status === 'draft').length;
    const invoiceStatusControl = inv => inv.status === 'draft'
      ? `<span class="badge badge-pending">Borrador</span>`
      : `<select class="invoice-status-select" onchange="VFX.updateInvoiceStatus(${inv.id}, this.value)">
          <option value="issued" ${inv.status === 'issued' ? 'selected' : ''}>Emitida</option>
          <option value="paid" ${inv.status === 'paid' ? 'selected' : ''}>Cobrada</option>
        </select>`;
    const invoiceActions = inv => `
      ${inv.status !== 'draft' ? `
        <button class="btn-icon" title="Descargar PDF" onclick="VFX.downloadInvoicePdf(${inv.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      ` : ''}
      <button class="btn-icon" title="Duplicar como nueva" onclick="VFX.openInvoiceForm(null, null, ${inv.id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>
      </button>
      <button class="btn-icon" title="${inv.status === 'draft' ? 'Editar' : 'Vista previa'}" onclick="${inv.status === 'draft' ? `VFX.openInvoiceForm(${inv.id})` : `VFX.previewStoredInvoicePdf(${inv.id})`}">
        ${inv.status === 'draft'
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>'}
      </button>
      <button class="btn-icon btn-icon-red" title="Eliminar factura" onclick="VFX.deleteInvoice(${inv.id}, '${inv.status}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    `;

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Facturas</div>
          <div class="page-subtitle">${invoices.length} factura${invoices.length !== 1 ? 's' : ''} · ${totalBorradores} borrador${totalBorradores !== 1 ? 'es' : ''}</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" onclick="VFX.openInvoiceForm()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            Nueva factura
          </button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:28px">
        <div class="metric-card">
          <div class="metric-label">Total emitido</div>
          <div class="metric-value" style="color:var(--gold)" data-private>${this.fmt.currency(totalEmitido)}</div>
          <div class="metric-sub">${billedInvoices.length} factura${billedInvoices.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Pendiente de cobro</div>
          <div class="metric-value" style="color:var(--cyan)" data-private>${this.fmt.currency(totalPendienteCobro)}</div>
          <div class="metric-sub">${issuedInvoices.length} emitida${issuedInvoices.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Borradores</div>
          <div class="metric-value">${totalBorradores}</div>
          <div class="metric-sub">pendientes de emitir</div>
        </div>
      </div>

      <div class="table-wrap invoice-table-wrap">
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
                    ${invoiceStatusControl(inv)}
                  </td>
                  <td style="text-align:right;white-space:nowrap">
                    ${invoiceActions(inv)}
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
      <div class="invoice-mobile-list">
        ${invoices.length === 0 ? `<div class="invoice-mobile-empty">No hay facturas aún</div>` :
          invoices.map(inv => `
            <div class="invoice-mobile-card">
              <div class="invoice-mobile-top">
                <div>
                  <div class="invoice-mobile-label">Factura</div>
                  <div class="invoice-mobile-number">${inv.full_number || '—'}</div>
                </div>
                <div class="invoice-mobile-total" data-private>${this.fmt.currency(inv.total)}</div>
              </div>
              <div class="invoice-mobile-client">${inv.customer_name || inv.company_display_name || '—'}</div>
              <div class="invoice-mobile-meta">
                <span>${this.fmt.date(inv.issue_date)}</span>
                <span>${this.fmt.currency(inv.subtotal)} base</span>
              </div>
              <div class="invoice-mobile-footer">
                <div>${invoiceStatusControl(inv)}</div>
                <div class="invoice-mobile-actions">${invoiceActions(inv)}</div>
              </div>
            </div>
          `).join('')
        }
      </div>
      <div style="margin-top:14px;padding:12px 14px;background:rgba(120,120,180,0.07);border:1px solid var(--border);border-radius:8px;color:var(--text2);font-size:13px;line-height:1.55">
        <strong style="color:var(--text)">Nota orientativa sobre facturas:</strong>
        una factura emitida conserva sus datos fiscales. Si detectas un error, crea una nueva factura o una rectificativa segun corresponda. Duplicar como nueva solo crea un borrador y no modifica la factura original.
      </div>
    `;
  },

  async openInvoiceForm(invoiceId = null, prefillProjectId = null, duplicateFromId = null) {
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
    if (duplicateFromId) {
      const source = await this.api.get(`/api/invoices/${duplicateFromId}`);
      inv = {
        ...source,
        id: null,
        status: 'draft',
        number: nextNum.number,
        full_number: String(nextNum.number),
        issue_date: new Date().toISOString().split('T')[0]
      };
      lines = source.lines?.length ? source.lines.map(l => ({ ...l })) : lines;
      invoiceId = null;
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
            description: `Proyecto ${proj.name}`,
            quantity: totalHours,
            unit_price: rate,
            line_total: totalHours * rate,
            project_id: prefillProjectId
          }];
        }
      }
    }

    const u = this.state.user;
    const today = new Date().toISOString().split('T')[0];
    const isReadOnly = !!inv && inv.status !== 'draft';

    const companyOptions = companies.map(c =>
      `<option value="${c.id}" data-nif="${c.cif||''}" data-address="${c.address||''}" data-city="${c.city||''}" data-postal="${c.postal_code||''}" data-country="${c.country||'España'}" ${prefillCompanyId == c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');

    const linesHtml = () => lines.map((l, i) => `
      <tr data-line="${i}">
        <td colspan="4" style="padding-bottom:4px">
          <textarea class="line-desc" rows="2" placeholder="Descripción del servicio" style="width:100%;resize:vertical;min-height:52px" ${isReadOnly?'disabled':''}>${(l.description||'').replace(/</g,'&lt;')}</textarea>
        </td>
        <td style="padding-bottom:4px"></td>
      </tr>
      <tr data-line="${i}" data-sub="1">
        <td><input type="number" class="line-qty" value="${l.quantity||1}" min="0" step="0.5" style="width:80px" ${isReadOnly?'disabled':''} oninput="VFX._recalcLine(${i})"></td>
        <td><input type="number" class="line-price" value="${l.unit_price||0}" min="0" step="0.01" style="width:100px" ${isReadOnly?'disabled':''} oninput="VFX._recalcLine(${i})"></td>
        <td class="line-total-cell" style="text-align:right;font-weight:600;padding-bottom:12px">${this.fmt.currency(l.line_total||0)}</td>
        ${isReadOnly ? '<td></td>' : `<td style="padding-bottom:12px"><button type="button" class="btn-icon btn-icon-red" onclick="VFX._removeLine(${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>`}
      </tr>
    `).join('');

    this._invoiceFormLines = lines.map(l => ({...l}));
    this._invoiceFormIvaRate = inv?.iva_rate ?? 21;
    this._invoiceFormIvaExempt = inv?.iva_exempt ?? 0;
    this._invoiceFormIrpfRate = inv?.irpf_rate ?? 15;
    this._invoiceFormPrefillProjectId = prefillProjectId || null;
    this._invoiceFormReadOnly = isReadOnly;
    this._invoiceIncludeEntryDetails = invoiceId
      ? localStorage.getItem(`invoiceEntryDetails:${invoiceId}`) === '1'
      : false;

    const content = `
      <div class="invoice-form">
        <div class="form-row-2">
          <div class="form-group">
            <label>Nº de factura</label>
            <input type="number" id="inv-number" value="${inv?.number || nextNum.number}" min="1" ${isReadOnly?'disabled':''}>
          </div>
          <div class="form-group">
            <label>Fecha de emisión</label>
            <input type="date" id="inv-date" value="${inv?.issue_date || today}" ${isReadOnly?'disabled':''}>
          </div>
        </div>

        <div class="form-group">
          <label>Cliente</label>
          <select id="inv-company" onchange="VFX._fillInvoiceCustomer()" ${isReadOnly?'disabled':''}>
            <option value="">— Selecciona empresa —</option>
            ${companyOptions}
          </select>
        </div>

        ${isReadOnly ? '' : `
        <div id="inv-project-selector" style="display:none;margin:0 0 12px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:var(--text2);margin-bottom:8px">Proyectos de esta empresa</div>
          <div id="inv-projects-list"></div>
        </div>
        <div id="inv-entry-detail-option" class="invoice-detail-option" style="display:none">
          <label title="Detalla en el PDF cada entrada registrada: fecha, horas y descripcion de trabajo.">
            <input type="checkbox" id="inv-entry-details" ${this._invoiceIncludeEntryDetails ? 'checked' : ''} onchange="VFX._invoiceIncludeEntryDetails = this.checked">
            <span>Incluir detalle de entradas en el PDF</span>
          </label>
          <div>Opcional. Añade bajo cada proyecto las entradas de tiempo con su fecha, horas y descripcion.</div>
        </div>
        `}

        <details style="margin:12px 0" ${isReadOnly?'open':''}>
          <summary style="cursor:pointer;color:var(--text2);font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase">Datos del cliente (auto desde empresa)</summary>
          <div style="margin-top:10px" class="form-row-2">
            <div class="form-group">
              <label>Nombre / Razón social</label>
              <input type="text" id="inv-cust-name" value="${inv?.customer_name||''}" placeholder="Empresa S.L." ${isReadOnly?'disabled':''}>
            </div>
            <div class="form-group">
              <label>NIF / CIF</label>
              <input type="text" id="inv-cust-nif" value="${inv?.customer_nif||''}" placeholder="B12345678" ${isReadOnly?'disabled':''}>
            </div>
          </div>
          <div class="form-group">
            <label>Dirección</label>
            <input type="text" id="inv-cust-address" value="${inv?.customer_address||''}" ${isReadOnly?'disabled':''}>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label>Ciudad</label>
              <input type="text" id="inv-cust-city" value="${inv?.customer_city||''}" ${isReadOnly?'disabled':''}>
            </div>
            <div class="form-group">
              <label>Código postal</label>
              <input type="text" id="inv-cust-postal" value="${inv?.customer_postal_code||''}" ${isReadOnly?'disabled':''}>
            </div>
          </div>
        </details>

        <div id="inv-lines-label" style="margin:16px 0 8px;font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:var(--text2)">Líneas de factura</div>
        <div class="table-wrap invoice-lines-table-wrap" style="margin-bottom:8px">
          <table class="data-table" id="inv-lines-table">
            <thead id="inv-lines-thead"><tr><th>Cantidad</th><th style="width:110px">Precio unit.</th><th style="text-align:right;width:120px">Importe</th><th style="width:30px"></th></tr></thead>
            <tbody id="inv-lines-body">${linesHtml()}</tbody>
          </table>
        </div>
        <div id="inv-lines-cards" class="invoice-lines-cards"></div>
        ${isReadOnly ? '' : '<button type="button" id="inv-add-line-btn" class="btn-ghost" style="font-size:12px" onclick="VFX._addLine()">+ Añadir línea</button>'}

        <div style="margin-top:20px;display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
          <div class="form-group" style="flex:1;min-width:140px">
            <label>IVA</label>
            <select id="inv-iva" onchange="VFX._updateInvoiceTotals()" ${isReadOnly?'disabled':''}>
              <option value="21" ${this._invoiceFormIvaExempt==0 && this._invoiceFormIvaRate==21?'selected':''}>21%</option>
              <option value="10" ${this._invoiceFormIvaExempt==0 && this._invoiceFormIvaRate==10?'selected':''}>10%</option>
              <option value="4" ${this._invoiceFormIvaExempt==0 && this._invoiceFormIvaRate==4?'selected':''}>4%</option>
              <option value="0" ${this._invoiceFormIvaExempt==1||this._invoiceFormIvaRate==0?'selected':''}>0% (exento)</option>
            </select>
          </div>
          <div class="form-group" style="flex:1;min-width:140px">
            <label>Retención IRPF</label>
            <select id="inv-irpf" onchange="VFX._updateInvoiceTotals()" ${isReadOnly?'disabled':''}>
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
          <textarea id="inv-notes" rows="2" style="width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:8px;color:var(--text);padding:10px 12px;font-family:inherit;font-size:13px;resize:vertical" ${isReadOnly?'disabled':''}>${inv?.notes||''}</textarea>
        </div>

        <div style="margin-top:16px;padding:10px 14px;background:rgba(120,120,180,0.07);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--text2);line-height:1.45">
          Nota orientativa: una factura emitida conserva sus datos fiscales. Para corregir errores, crea una nueva factura o una rectificativa segun corresponda. Duplicar como nueva solo prepara un nuevo borrador y no modifica ni anula la factura original.
        </div>

        <div id="inv-form-error" class="form-error" style="display:none;margin-top:12px"></div>
      </div>
    `;

    const title = duplicateFromId ? 'Duplicar como nueva' : (isReadOnly ? `Factura ${inv.full_number}` : (invoiceId ? `Borrador — Factura ${inv.number || '#'}` : 'Nueva factura'));
    this.openModal(content, title);

    this._updateInvoiceTotals();
    this._rerenderLines();
    if (prefillCompanyId) this._fillInvoiceCustomer(prefillCompanyId);

    this._currentInvoiceId = invoiceId || null;
    const footer = document.getElementById('modal').querySelector('.modal-footer');
    if (footer) footer.remove();
    const modalEl = document.getElementById('modal');
    const footerEl = document.createElement('div');
    footerEl.className = 'modal-footer';
    if (isReadOnly) {
      footerEl.innerHTML = `
        <button class="btn btn-ghost" onclick="VFX.closeModal()">Cerrar</button>
        <button class="btn btn-primary" onclick="VFX.openInvoiceForm(null, null, ${invoiceId})">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>
          Duplicar como nueva
        </button>
      `;
    } else {
      footerEl.innerHTML = `
        <button class="btn btn-ghost" onclick="VFX.closeModal()">Cancelar</button>
        <button class="btn btn-ghost" onclick="VFX.previewInvoicePdf()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
          Vista previa
        </button>
        <button class="btn btn-ghost" onclick="VFX.saveInvoiceDraft()" style="margin-left:auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Guardar borrador
        </button>
        <button class="btn btn-primary" onclick="VFX.issueInvoice()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Emitir factura
        </button>
      `;
    }
    modalEl.appendChild(footerEl);
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
    this._renderInvoiceProjectSelector(parseInt(id));
  },

  _renderInvoiceProjectSelector(companyId) {
    const container = document.getElementById('inv-project-selector');
    if (!container) return;
    const projects = (this.state.projects || []).filter(p => p.company_id == companyId);
    if (!projects.length) { container.style.display = 'none'; return; }
    const checkedIds = new Set(this._invoiceFormLines.map(l => l.project_id).filter(id => id != null));
    if (this._invoiceFormPrefillProjectId) checkedIds.add(this._invoiceFormPrefillProjectId);
    const list = document.getElementById('inv-projects-list');
    if (list) {
      list.innerHTML = projects.map(p => `
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px;cursor:pointer">
          <input type="checkbox" value="${p.id}" ${checkedIds.has(p.id) ? 'checked' : ''} style="width:14px;height:14px;cursor:pointer" onchange="VFX._onProjectCheckboxChange()">
          <span>${p.name}</span>
          <span style="color:var(--text2);font-size:11px">${Math.round(p.hourly_rate * 8)} €/día</span>
        </label>
      `).join('');
    }
    container.style.display = 'block';
    this._updateInvoiceMode();
  },

  async _onProjectCheckboxChange() {
    const checkboxes = document.querySelectorAll('#inv-projects-list input[type=checkbox]:checked');
    const projectIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
    if (!projectIds.length) {
      const hasProjectLines = this._invoiceFormLines.some(l => l.project_id != null);
      if (hasProjectLines) {
        this._invoiceFormLines = [{ description: '', quantity: 1, unit_price: 0, line_total: 0 }];
        this._updateInvoiceMode();
      }
      return;
    }
    const hasManualLines = this._invoiceFormLines.some(l => l.project_id == null && (l.description || l.unit_price > 0));
    if (hasManualLines && !confirm('Esto reemplazará las líneas actuales de la factura por las líneas de los proyectos seleccionados. ¿Continuar?')) return;
    await this._generateProjectLines(projectIds);
  },

  async _generateProjectLines(projectIds) {
    const newLines = [];
    for (const pid of projectIds) {
      const proj = this.state.projects.find(p => p.id === pid);
      if (!proj) continue;
      const entries = await this.api.get(`/api/projects/${pid}/entries`);
      const totalHours = entries.reduce((s, e) => s + (e.hours || 0), 0);
      newLines.push({
        description: `Proyecto ${proj.name}`,
        quantity: totalHours,
        unit_price: proj.hourly_rate,
        line_total: totalHours * proj.hourly_rate,
        project_id: pid
      });
    }
    if (newLines.length) {
      this._invoiceFormLines = newLines;
      this._updateInvoiceMode();
    }
  },

  _updateInvoiceMode() {
    const isProjectMode = this._invoiceFormLines.some(l => l.project_id != null);
    const label = document.getElementById('inv-lines-label');
    if (label) label.textContent = isProjectMode ? 'Proyectos facturados' : 'Líneas de factura';
    const thead = document.getElementById('inv-lines-thead');
    if (thead) {
      thead.innerHTML = isProjectMode
        ? '<tr><th>Proyecto</th><th style="text-align:right;width:80px">Horas</th><th style="text-align:right;width:110px">Tarifa/día</th><th style="text-align:right;width:120px">Importe</th></tr>'
        : '<tr><th>Cantidad</th><th style="width:110px">Precio unit.</th><th style="text-align:right;width:120px">Importe</th><th style="width:30px"></th></tr>';
    }
    const addBtn = document.getElementById('inv-add-line-btn');
    if (addBtn) addBtn.style.display = isProjectMode ? 'none' : '';
    const detailOption = document.getElementById('inv-entry-detail-option');
    if (detailOption) detailOption.style.display = isProjectMode && !this._invoiceFormReadOnly ? 'block' : 'none';
    this._rerenderLines();
  },

  _recalcLine(i) {
    if (!this._invoiceFormLines[i]) return;
    const descEls  = document.querySelectorAll('#inv-lines-body .line-desc');
    const qtyEls   = document.querySelectorAll('#inv-lines-body .line-qty');
    const priceEls = document.querySelectorAll('#inv-lines-body .line-price');
    const qty   = parseFloat(qtyEls[i]?.value) || 0;
    const price = parseFloat(priceEls[i]?.value) || 0;
    const total = qty * price;
    this._invoiceFormLines[i] = {
      ...this._invoiceFormLines[i],
      description: descEls[i]?.value || '',
      quantity: qty, unit_price: price, line_total: total
    };
    const row = qtyEls[i]?.closest('tr');
    const cell = row?.querySelector('.line-total-cell');
    if (cell) cell.textContent = this.fmt.currency(total);
    const cards = document.getElementById('inv-lines-cards');
    if (cards) cards.innerHTML = this._invoiceLinesCardsHtml();
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

  _invoiceLinesCardsHtml() {
    const lines = this._invoiceFormLines;
    const isProjectMode = lines.some(l => l.project_id != null);
    const fmtH = n => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n || 0) + ' h';
    const fmtD = n => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format((n || 0) * 8) + ' €/día';
    const esc = s => String(s || '').replace(/</g, '&lt;');
    return lines.map((l, i) => `
      <div class="invoice-line-card">
        <div class="invoice-line-card-top">
          <div>
            <div class="invoice-line-card-label">${isProjectMode ? 'Proyecto facturado' : 'Línea de factura'}</div>
            ${(!isProjectMode && !this._invoiceFormReadOnly) ? `
              <textarea class="invoice-line-card-desc" rows="2" placeholder="Descripción del servicio" oninput="VFX._recalcCardLine(${i}, this)">${esc(l.description)}</textarea>
            ` : `<div class="invoice-line-card-title">${esc(l.description) || 'Sin descripción'}</div>`}
          </div>
          <div class="invoice-line-card-total" data-private>${this.fmt.currency(l.line_total || 0)}</div>
        </div>
        <div class="invoice-line-card-grid">
          <div>
            <span>${isProjectMode ? 'Horas' : 'Cantidad'}</span>
            ${(!isProjectMode && !this._invoiceFormReadOnly)
              ? `<input type="number" class="invoice-line-card-qty" value="${l.quantity || 1}" min="0" step="0.5" oninput="VFX._recalcCardLine(${i}, this)">`
              : `<strong>${isProjectMode ? fmtH(l.quantity) : (l.quantity || 0)}</strong>`}
          </div>
          <div>
            <span>${isProjectMode ? 'Tarifa' : 'Precio'}</span>
            ${(!isProjectMode && !this._invoiceFormReadOnly)
              ? `<input type="number" class="invoice-line-card-price" value="${l.unit_price || 0}" min="0" step="0.01" oninput="VFX._recalcCardLine(${i}, this)">`
              : `<strong>${isProjectMode ? fmtD(l.unit_price) : this.fmt.currency(l.unit_price || 0)}</strong>`}
          </div>
        </div>
        ${(!isProjectMode && !this._invoiceFormReadOnly && lines.length > 1) ? `
          <button type="button" class="btn-icon btn-icon-red invoice-line-card-remove" onclick="VFX._removeLine(${i})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Eliminar línea
          </button>
        ` : ''}
      </div>
    `).join('');
  },

  _recalcCardLine(i, el = null) {
    if (!this._invoiceFormLines[i]) return;
    const descEls = document.querySelectorAll('#inv-lines-cards .invoice-line-card-desc');
    const qtyEls = document.querySelectorAll('#inv-lines-cards .invoice-line-card-qty');
    const priceEls = document.querySelectorAll('#inv-lines-cards .invoice-line-card-price');
    const qty = parseFloat(qtyEls[i]?.value) || 0;
    const price = parseFloat(priceEls[i]?.value) || 0;
    this._invoiceFormLines[i] = {
      ...this._invoiceFormLines[i],
      description: descEls[i]?.value || '',
      quantity: qty,
      unit_price: price,
      line_total: qty * price
    };
    const tableDescEls = document.querySelectorAll('#inv-lines-body .line-desc');
    const tableQtyEls = document.querySelectorAll('#inv-lines-body .line-qty');
    const tablePriceEls = document.querySelectorAll('#inv-lines-body .line-price');
    if (tableDescEls[i]) tableDescEls[i].value = this._invoiceFormLines[i].description;
    if (tableQtyEls[i]) tableQtyEls[i].value = this._invoiceFormLines[i].quantity;
    if (tablePriceEls[i]) tablePriceEls[i].value = this._invoiceFormLines[i].unit_price;
    const cardTotal = el?.closest('.invoice-line-card')?.querySelector('.invoice-line-card-total');
    if (cardTotal) cardTotal.textContent = this.fmt.currency(this._invoiceFormLines[i].line_total);
    this._updateInvoiceTotals();
  },

  _rerenderLines() {
    const body = document.getElementById('inv-lines-body');
    if (!body) return;
    const lines = this._invoiceFormLines;
    const isProjectMode = lines.some(l => l.project_id != null);
    const fmtH = n => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n || 0) + ' h';
    const fmtD = n => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(n || 0) + ' €/día';
    if (isProjectMode) {
      body.innerHTML = lines.map(l => `
        <tr>
          <td style="font-size:13px;padding:8px 4px">${(l.description||'').replace(/</g,'&lt;')}</td>
          <td style="text-align:right;font-size:13px;padding:8px 4px">${fmtH(l.quantity)}</td>
          <td style="text-align:right;font-size:13px;padding:8px 4px">${fmtD(l.unit_price * 8)}</td>
          <td style="text-align:right;font-weight:600;font-size:13px;padding:8px 4px">${this.fmt.currency(l.line_total||0)}</td>
        </tr>
      `).join('');
    } else {
      const ro = !!this._invoiceFormReadOnly;
      body.innerHTML = lines.map((l, i) => `
        <tr data-line="${i}">
          <td colspan="4" style="padding-bottom:4px">
            <textarea class="line-desc" rows="2" placeholder="Descripción del servicio" style="width:100%;resize:vertical;min-height:52px" ${ro?'disabled':''}>${(l.description||'').replace(/</g,'&lt;')}</textarea>
          </td>
          <td style="padding-bottom:4px"></td>
        </tr>
        <tr data-line="${i}" data-sub="1">
          <td><input type="number" class="line-qty" value="${l.quantity||1}" min="0" step="0.5" style="width:80px" ${ro?'disabled':''} oninput="VFX._recalcLine(${i})"></td>
          <td><input type="number" class="line-price" value="${l.unit_price||0}" min="0" step="0.01" style="width:100px" ${ro?'disabled':''} oninput="VFX._recalcLine(${i})"></td>
          <td class="line-total-cell" style="text-align:right;font-weight:600;padding-bottom:12px">${this.fmt.currency(l.line_total||0)}</td>
          ${ro ? '<td></td>' : `<td style="padding-bottom:12px"><button type="button" class="btn-icon btn-icon-red" onclick="VFX._removeLine(${i})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>`}
        </tr>
      `).join('');
    }
    const cards = document.getElementById('inv-lines-cards');
    if (cards) cards.innerHTML = this._invoiceLinesCardsHtml();
    this._updateInvoiceTotals();
  },

  _syncLinesFromDom() {
    const descEls = document.querySelectorAll('#inv-lines-body .line-desc');
    const qtyEls  = document.querySelectorAll('#inv-lines-body .line-qty');
    const priceEls= document.querySelectorAll('#inv-lines-body .line-price');
    descEls.forEach((el, i) => {
      if (!this._invoiceFormLines[i]) return;
      this._invoiceFormLines[i].description = el.value || '';
      this._invoiceFormLines[i].quantity    = parseFloat(qtyEls[i]?.value) || 0;
      this._invoiceFormLines[i].unit_price  = parseFloat(priceEls[i]?.value) || 0;
      this._invoiceFormLines[i].line_total  = this._invoiceFormLines[i].quantity * this._invoiceFormLines[i].unit_price;
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
      include_entry_details: !!document.getElementById('inv-entry-details')?.checked,
      lines: this._invoiceFormLines
    };
  },

  _saveInvoiceEntryDetailsPreference(id) {
    if (!id) return;
    const checked = !!document.getElementById('inv-entry-details')?.checked;
    localStorage.setItem(`invoiceEntryDetails:${id}`, checked ? '1' : '0');
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
      this._saveInvoiceEntryDetailsPreference(this._currentInvoiceId);
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
      this._saveInvoiceEntryDetailsPreference(id);
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

  async previewInvoicePdf() {
    if (!this.isPro()) { this.showUpgradeModal('pdf'); return; }
    const errEl = document.getElementById('inv-form-error');
    if (errEl) errEl.style.display = 'none';
    const win = window.open('', '_blank');
    try {
      const r = await fetch('/api/invoices/preview-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this._getInvoiceFormData())
      });
      if (!r.ok) {
        const result = await r.json().catch(() => ({}));
        throw new Error(result.error || 'No se pudo generar la vista previa');
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      if (win) {
        win.location = url;
      } else {
        window.location.href = url;
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (e) {
      if (win) win.close();
      if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    }
  },

  previewStoredInvoicePdf(id) {
    if (!this.isPro()) { this.showUpgradeModal('pdf'); return; }
    const details = localStorage.getItem(`invoiceEntryDetails:${id}`) === '1';
    window.open(`/api/invoices/${id}/preview-pdf${details ? '?entryDetails=1' : ''}`, '_blank');
  },

  async deleteInvoice(id, status) {
    const msg = status === 'issued'
      ? '¿Seguro que quieres eliminar esta factura emitida? Esta acción no se puede deshacer.'
      : '¿Eliminar este borrador?';
    if (!confirm(msg)) return;
    await this.api.del(`/api/invoices/${id}`);
    this.renderFacturas();
  },

  async updateInvoiceStatus(id, status) {
    try {
      await this.api.patch(`/api/invoices/${id}/status`, { status });
      this.renderFacturas();
    } catch (e) {
      alert(e.message || 'Error al actualizar estado');
    }
  },

  downloadInvoicePdf(id) {
    if (!this.isPro()) { this.showUpgradeModal('pdf'); return; }
    const details = localStorage.getItem(`invoiceEntryDetails:${id}`) === '1';
    window.open(`/api/invoices/${id}/pdf${details ? '?entryDetails=1' : ''}`, '_blank');
  },

  // ── AYUDA ───────────────────────────────────────────────────
  renderAyuda() { return window.CronorasStaticViews.renderAyuda(); },

  _renderHelpResults(query) {
    const el = document.getElementById('help-results');
    if (!el) return;
    const results = this._searchHelp(query);

    if (results !== null) {
      if (results.length === 0) {
        el.innerHTML = `
          <div style="text-align:center;padding:48px 20px;color:var(--text3)">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.4;margin-bottom:12px"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5" fill="currentColor"/></svg>
            <div style="font-size:14px;margin-bottom:4px">Sin resultados para <em>"${this._escHtml(query)}"</em></div>
            <div style="font-size:12px">Prueba con otras palabras</div>
          </div>`;
        return;
      }
      el.innerHTML = results.map(item => `
        <div style="margin-bottom:6px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
          <button onclick="VFX._toggleHelpItem(this)"
            style="width:100%;text-align:left;padding:13px 16px;background:var(--bg2);border:none;color:var(--text1);font-family:inherit;font-size:13.5px;cursor:pointer;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
            <div>
              <div style="font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px">${this._escHtml(item.section)}</div>
              <div style="font-weight:500;line-height:1.4">${this._escHtml(item.q)}</div>
            </div>
            <svg style="flex-shrink:0;margin-top:2px;transition:transform .2s" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div style="display:none;padding:13px 16px;background:var(--bg3);border-top:1px solid var(--border);color:var(--text2);font-size:13px;line-height:1.65">
            ${this._formatHelpAnswer(item.a)}
          </div>
        </div>
      `).join('');
      return;
    }

    el.innerHTML = HELP_CONTENT.map(section => `
      <div style="margin-bottom:20px">
        <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--gold);font-weight:700;margin-bottom:8px;padding-left:2px">${this._escHtml(section.title)}</div>
        <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
          ${section.items.map((item, i) => `
            <div style="${i > 0 ? 'border-top:1px solid var(--border)' : ''}">
              <button onclick="VFX._toggleHelpItem(this)"
                style="width:100%;text-align:left;padding:13px 16px;background:var(--bg2);border:none;color:var(--text1);font-family:inherit;font-size:13.5px;cursor:pointer;display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
                <span style="font-weight:500;line-height:1.4">${this._escHtml(item.q)}</span>
                <svg style="flex-shrink:0;margin-top:3px;transition:transform .2s" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div style="display:none;padding:13px 16px;background:var(--bg3);border-top:1px solid var(--border);color:var(--text2);font-size:13px;line-height:1.65">
                ${this._formatHelpAnswer(item.a)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  },

  _searchHelp(query) {
    const q = query.trim();
    if (!q) return null;
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const words = norm(q).split(/\s+/).filter(Boolean);
    const results = [];
    for (const section of HELP_CONTENT) {
      for (const item of section.items) {
        const nq = norm(item.q);
        const na = norm(item.a);
        let score = 0, matched = 0;
        for (const w of words) {
          if (nq.includes(w))      { score += 3; matched++; }
          else if (na.includes(w)) { score += 1; matched++; }
        }
        if (matched === words.length && words.length > 1) score += 3;
        if (score > 0) results.push({ ...item, section: section.title, score });
      }
    }
    return results.sort((a, b) => b.score - a.score);
  },

  _toggleHelpItem(btn) {
    const answer = btn.nextElementSibling;
    const icon = btn.querySelector('svg');
    const open = answer.style.display !== 'none';
    answer.style.display = open ? 'none' : 'block';
    icon.style.transform = open ? '' : 'rotate(180deg)';
  },

  _formatHelpAnswer(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  },

  _escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

};

// Boot
document.addEventListener('DOMContentLoaded', () => VFX.init());
