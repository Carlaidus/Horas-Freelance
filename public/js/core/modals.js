/* ── Cronoras Modals ─────────────────────────────────────────── */

window.CronorasModals = {
    settings() {
      VFX.openModal(`
        <div class="welcome-header">
          <div class="welcome-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div class="welcome-title">Bienvenido a Cronoras</div>
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
      if (!VFX.isPro() && VFX.state.projects.length >= 1) {
        VFX.showUpgradeModal('projects');
        return;
      }
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
            <label>Orden de compra (PO)</label>
            <input type="text" id="edit-proj-po" value="${project.purchase_order||''}" placeholder="Ej: PO-2026-0042">
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
      let entry = VFX.state.entries.find(e => e.id === id);
      if (!entry) {
        for (const slot of VFX.state.slots) {
          entry = slot.entries?.find(e => e.id === id);
          if (entry) break;
        }
      }
      if (!entry) return;
      VFX.openModal(`
        <div class="form-grid full">
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" id="edit-entry-date" value="${String(entry.date).slice(0, 10)}">
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
};
