/* ── Cronoras Projects View ──────────────────────────────────── */

window.CronorasProjectsView = {

  renderProjects() {
    const projects = VFX.state.projects;
    const el = document.getElementById('view-projects');
    const total = projects.length;
    const completed = projects.filter(p => p.is_completed || p.status === 'paid').length;
    const active = total - completed;

    const rows = projects.map(p => {
      const st = VFX._projectStatus(p);
      const endDate = p.completed_at || (p.is_completed || p.status === 'paid' ? p.last_entry_date : null);
      return `
        <tr style="cursor:pointer" onclick="VFX.renderProjectDetail(${p.id})">
          <td>
            <div style="font-weight:600;color:var(--text)">${p.name}</div>
            ${p.notes ? `<div style="font-size:11px;color:var(--text3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px">${p.notes}</div>` : ''}
          </td>
          <td style="color:var(--text2)">${p.company_name || '—'}</td>
          <td style="color:var(--text3);font-family:'Space Mono',monospace;font-size:12px">${VFX.fmt.date(p.first_entry_date || p.created_at)}</td>
          <td style="color:var(--text3);font-family:'Space Mono',monospace;font-size:12px">${endDate ? VFX.fmt.date(endDate) : '<span style="color:var(--amber);font-size:11px">En curso</span>'}</td>
          <td class="mono dim" style="text-align:right">${VFX.fmt.hours(p.total_hours)}</td>
          <td class="gold" style="text-align:right" data-private>${VFX.fmt.currency(p.total_amount)}</td>
          <td><span class="badge ${st.cls}">${st.label}</span></td>
        </tr>
      `;
    }).join('');

    const mobileCards = projects.map(p => {
      const st = VFX._projectStatus(p);
      const endDate = p.completed_at || (p.is_completed || p.status === 'paid' ? p.last_entry_date : null);
      return `
        <button type="button" class="project-mobile-card" onclick="VFX.renderProjectDetail(${p.id})">
          <div class="project-mobile-top">
            <div>
              <div class="project-mobile-label">Proyecto</div>
              <div class="project-mobile-name">${p.name}</div>
            </div>
            <span class="badge ${st.cls}">${st.label}</span>
          </div>
          ${p.notes ? `<div class="project-mobile-notes">${p.notes}</div>` : ''}
          <div class="project-mobile-client">${p.company_name || '—'}</div>
          <div class="project-mobile-meta">
            <span>Inicio ${VFX.fmt.date(p.first_entry_date || p.created_at)}</span>
            <span>${endDate ? `Fin ${VFX.fmt.date(endDate)}` : 'En curso'}</span>
          </div>
          <div class="project-mobile-totals">
            <div>
              <span>Horas</span>
              <strong>${VFX.fmt.hours(p.total_hours)}</strong>
            </div>
            <div>
              <span>Ingresos</span>
              <strong data-private>${VFX.fmt.currency(p.total_amount)}</strong>
            </div>
          </div>
        </button>
      `;
    }).join('');

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Proyectos</div>
          <div class="page-subtitle">${total} proyecto${total !== 1 ? 's' : ''} — ${active} en curso, ${completed} completado${completed !== 1 ? 's' : ''}</div>
        </div>
        <button class="btn btn-primary" onclick="VFX.modals.newProject()">Nuevo proyecto</button>
      </div>

      ${total === 0 ? `
        <div class="no-project-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
          <h3>Sin proyectos</h3>
          <p>Empieza creando un proyecto en la sección "Proyecto en curso".</p>
          <button class="btn btn-primary btn-lg" onclick="VFX.navigate('proyecto')">Ir a Proyecto en curso</button>
        </div>
      ` : `
        <div class="table-container projects-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Cliente</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th style="text-align:right">Horas</th>
                <th style="text-align:right">Ingresos</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="project-mobile-list">${mobileCards}</div>
      `}
    `;
  },

};
