/* ── Cronoras Static Views ───────────────────────────────────── */

window.CronorasStaticViews = {

  renderSettings() {
    const u = VFX.state.user;
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
          <form id="settings-form" onsubmit="VFX.saveSettings(event)" oninput="VFX._settingsDirty()" onchange="VFX._settingsDirty()">
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
              <div class="form-group span2">
                <label>IBAN (cuenta bancaria)</label>
                <input type="text" name="iban" value="${u.iban||''}" placeholder="ES00 0000 0000 0000 0000 0000" style="font-family:var(--font-mono);letter-spacing:0.5px">
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
              <div class="settings-section-title">Objetivos</div>
              <div style="display:flex;flex-direction:column;gap:10px;max-width:480px">
                <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                  <label style="flex:1;min-width:180px;font-size:13px;color:var(--text2);margin:0">Meta de ingresos anual (€)</label>
                  <input type="number" name="annual_goal" value="${u.annual_goal||50000}" step="1000" min="0" style="width:150px;flex-shrink:0">
                </div>
                <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                  <label style="flex:1;min-width:180px;font-size:13px;color:var(--text2);margin:0">Meta de ingresos mensual (€)</label>
                  <input type="number" name="monthly_goal" value="${u.monthly_goal||4000}" step="500" min="0" style="width:150px;flex-shrink:0">
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
                  <input type="checkbox" id="privacy-default-toggle" ${localStorage.getItem(VFX._lsKey('vfx_privacy_default')) === 'true' ? 'checked' : ''} onchange="VFX.savePrivacyDefault(this.checked)">
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
              <button type="submit" id="settings-save-btn" class="btn btn-primary" disabled style="opacity:0.35;cursor:default;transition:opacity .2s">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  renderAyuda() {
    document.getElementById('view-ayuda').innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Ayuda</div>
          <div class="page-subtitle">Respuestas rápidas a las dudas más frecuentes</div>
        </div>
      </div>

      <div style="max-width:720px">
        <div style="position:relative;margin-bottom:28px">
          <svg style="position:absolute;left:14px;top:50%;transform:translateY(-50%);opacity:.45;pointer-events:none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="help-search" placeholder="Busca cualquier duda…"
            autocomplete="off" spellcheck="false"
            style="width:100%;box-sizing:border-box;padding:12px 12px 12px 42px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;color:var(--text1);font-family:inherit;font-size:14px;outline:none;transition:border-color .15s"
            oninput="VFX._renderHelpResults(this.value)"
            onfocus="this.style.borderColor='var(--gold)'"
            onblur="this.style.borderColor='var(--border)'">
        </div>
        <div id="help-results"></div>
      </div>
    `;
    VFX._renderHelpResults('');
  },

};
