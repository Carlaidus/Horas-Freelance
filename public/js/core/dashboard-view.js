/* ── Cronoras Dashboard View ─────────────────────────────────── */

window.CronorasDashboardView = {

  async renderDashboard() {
    const el = document.getElementById('view-dashboard');
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text3)">Cargando...</div>`;
    await VFX.loadTreasury();
    const all = VFX.state.treasury;
    const filter = VFX.state.dashboardFilter;

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

    const btnCls = (f) => `btn btn-sm ${VFX.state.dashboardFilter === f ? 'btn-primary' : 'btn-ghost'}`;

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Dashboard</div>
          <div class="page-subtitle">${today.toLocaleDateString('es-ES', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Por cobrar (total)</div>
          <div class="metric-value" style="color:var(--gold)" data-private>${VFX.fmt.currency(totalPendiente)}</div>
          <div class="metric-sub">${pending.length + sent.length} proyecto${pending.length + sent.length !== 1 ? 's' : ''} abiertos</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">En espera</div>
          <div class="metric-value" style="color:var(--cyan)" data-private>${VFX.fmt.currency(totalEspera)}</div>
          <div class="metric-sub">${sent.length} factura${sent.length !== 1 ? 's' : ''} enviada${sent.length !== 1 ? 's' : ''} pendiente de cobro</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Previsión este mes</div>
          <div class="metric-value" style="color:var(--green)" data-private>${VFX.fmt.currency(previsionMes)}</div>
          <div class="metric-sub">facturas previstas en ${today.toLocaleDateString('es-ES',{month:'long'})}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Cobrado este año</div>
          <div class="metric-value" style="color:var(--text)" data-private>${VFX.fmt.currency(totalCobrado)}</div>
          <div class="metric-sub">${paid.length} proyecto${paid.length !== 1 ? 's' : ''} cobrados</div>
        </div>
      </div>

      <div class="table-container">
        <div class="table-header">
          <span class="table-title">PROYECTOS</span>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div class="filter-tabs">
              <button class="${btnCls('all')}" onclick="VFX.filterDashboard('all')">Todos</button>
              <button class="${btnCls('pending')}" onclick="VFX.filterDashboard('pending')">En curso</button>
              <button class="${btnCls('sent')}" onclick="VFX.filterDashboard('sent')">En espera</button>
              <button class="${btnCls('paid')}" onclick="VFX.filterDashboard('paid')">Cobradas</button>
            </div>
            <button class="btn btn-primary" style="font-size:12px;padding:6px 12px" onclick="VFX.modals.newProject()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
              Añadir proyecto
            </button>
          </div>
        </div>
        ${filtered.length > 0 ? `
          <table class="dashboard-projects-table">
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
      ? `<span style="display:inline-flex;align-items:center;gap:5px;color:#fff;font-size:13px;font-weight:500">${calIcon}${VFX.fmt.date(p.forecast_date)}</span>`
      : (p.status === 'sent' ? `<span style="display:inline-flex;align-items:center;gap:5px;color:var(--text3);font-size:13px">${calIcon}Sin fecha</span>` : '<span style="color:var(--text3)">—</span>');
    const completedBadge = p.is_completed
      ? `<span style="font-size:10px;background:rgba(78,205,196,0.12);color:var(--cyan);padding:2px 6px;border-radius:4px;margin-left:6px">Finalizado</span>`
      : '';
    const budgetBadge = p.budget_type === 'fixed'
      ? `<span style="font-size:10px;background:rgba(245,200,66,0.12);color:var(--gold);padding:2px 6px;border-radius:4px;margin-left:4px">Fijo</span>`
      : '';
    const isSelected = VFX.state.currentProjectId === p.id;
    return `
      <tr data-project-id="${p.id}"
        onclick="VFX.selectForCockpit(${p.id})"
        style="cursor:pointer;transition:background 0.15s${isSelected ? ';background:var(--card2)' : ''}">
        <td>
          <div style="font-weight:500">${p.name}${completedBadge}${budgetBadge}</div>
          <div style="font-size:11px;color:var(--text3)">${p.company_name}</div>
        </td>
        <td onclick="event.stopPropagation()">${VFX.renderStatusDropdown(p.id, p.status)}</td>
        <td class="mono">${VFX.fmt.hours(p.total_hours)}</td>
        <td class="gold mono" data-private>${VFX.fmt.currency(amount)}</td>
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

};
