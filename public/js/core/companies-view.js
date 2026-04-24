/* ── Cronoras Companies View ─────────────────────────────────── */

window.CronorasCompaniesView = {

  renderCompanies() {
    const companies = VFX.state.companies;
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

};
