/* ── Cronoras Plans View ─────────────────────────────────────── */

window.CronorasPlansView = {

  renderPlanes() {
    const el = document.getElementById('view-planes');
    const isPro = VFX.isPro();
    const isTrial = VFX.state.isTrial;
    const daysLeft = VFX.state.daysRemaining;
    const currentPeriod = VFX.state.planPeriod; // quarterly | semi | annual | lifetime | null
    const userName = VFX.state.user?.name || '';

    const chk = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>`;
    const x   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    const mailIco = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
    const starIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    const chkIco = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>`;
    // precio tachado con raya diagonal
    const struck = (price, size = 16) => `<span style="position:relative;display:inline-block;line-height:1">
      <span style="font-size:${size}px;font-weight:600;color:var(--text3);opacity:0.55">${price}€</span>
      <span style="position:absolute;left:-6%;top:48%;width:112%;height:1.5px;background:rgba(255,85,118,0.75);transform:rotate(-18deg);pointer-events:none;border-radius:2px"></span>
    </span>`;

    // solicitud pendiente (persiste en localStorage)
    const upgradeRaw = localStorage.getItem(VFX._lsKey('vfx_upgrade_requested'));
    const upgradeReq = upgradeRaw ? JSON.parse(upgradeRaw) : null;
    let sentPlan = upgradeReq?.plan || null; // ej: "Pro Trimestral"

    // Limpiar solicitud solo si el plan activo ya coincide con lo que se solicitó
    if (sentPlan && isPro) {
      const SENT_TO_PERIOD = {
        'pro mensual': null, 'pro trimestral': 'quarterly',
        'pro semestral': 'semi', 'pro anual': 'annual', 'pro vitalicio': 'lifetime',
      };
      if (SENT_TO_PERIOD[sentPlan.toLowerCase()] === currentPeriod) {
        localStorage.removeItem(VFX._lsKey('vfx_upgrade_requested'));
        sentPlan = null;
      }
    }

    // helper: ¿esta tarjeta fue la solicitada?
    const isSentCard = (periodLabel) => sentPlan && sentPlan.toLowerCase().includes(periodLabel.toLowerCase());
    const sentCardStyle = 'box-shadow:0 0 0 2px var(--cyan),0 0 20px rgba(78,205,196,0.25)';
    const sentBtnHtml = `<button class="btn" style="width:100%;justify-content:center;font-size:12px;background:rgba(78,205,196,0.15);color:var(--cyan);border-color:var(--cyan);cursor:default" disabled>${chkIco}&nbsp;Solicitud enviada</button>`;

    // precios: precio real (oferta) y precio tachado
    const PERIODS = {
      quarterly: { label: 'Trimestral', price: 16,  oldPrice: 24,  days: 90,  rank: 1, perMonth: '5,33€/mes' },
      semi:      { label: 'Semestral',  price: 29,  oldPrice: 45,  days: 180, rank: 2, perMonth: '4,83€/mes' },
      annual:    { label: 'Anual',      price: 55,  oldPrice: 85,  days: 365, rank: 3, perMonth: '4,58€/mes' },
      lifetime:  { label: 'Vitalicio',  price: 200, oldPrice: null, days: null, rank: 4 },
    };

    // calcula diferencia de upgrade: valor restante del plan actual prorrateado
    const upgradeDiff = (targetPeriod) => {
      if (!isPro || !daysLeft || !currentPeriod || !PERIODS[currentPeriod]) return null;
      const cur = PERIODS[currentPeriod];
      if (!cur.days) return null;
      const tgt = PERIODS[targetPeriod];
      if (!tgt || tgt.rank <= cur.rank) return null;
      const dailyRate = cur.price / cur.days;
      const remainingValue = Math.round(dailyRate * daysLeft * 100) / 100;
      const diff = Math.max(0, Math.round((tgt.price - remainingValue) * 100) / 100);
      return { diff, curLabel: cur.label, daysLeft };
    };

    // botón para tarjeta de periodo
    const periodBtn = (periodKey, btnLabel) => {
      const isCurrent = isPro && currentPeriod === periodKey;
      if (isCurrent) return '';
      const p = PERIODS[periodKey];
      if (isSentCard(p.label)) return sentBtnHtml;
      const ud = upgradeDiff(periodKey);
      const priceLabel = p.days ? `${p.price}€ (oferta)` : `${p.price}€ (pago único)`;
      const periodLabel = p.days ? `${p.days} días` : 'Acceso vitalicio';
      const extraNote = ud ? `, upgrade desde ${ud.curLabel}, diferencia calculada: ${ud.diff}€` : '';
      const onclickAttr = `VFX.requestUpgrade('Pro ${p.label}', '${priceLabel}', '${periodLabel}${extraNote}', this)`;
      return `<button class="btn btn-primary" style="width:100%;justify-content:center;font-size:12px" onclick="${onclickAttr}">${mailIco}&nbsp;${btnLabel}</button>`;
    };

    // badge de "plan actual" con color por tipo
    const currentBadge = (color) =>
      `<div style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);background:${color};color:#000;font-size:10px;font-weight:700;padding:3px 14px;border-radius:0 0 8px 8px;letter-spacing:0.06em;white-space:nowrap">TU PLAN ACTUAL</div>`;

    const isFreeCurrent  = !isPro;
    const isProOverview  = isPro && !currentPeriod; // solo mensual (sin periodo específico)
    const isQuartCurrent = isPro && currentPeriod === 'quarterly';
    const isSemiCurrent  = isPro && currentPeriod === 'semi';
    const isAnnCurrent   = isPro && currentPeriod === 'annual';
    const isLifeCurrent  = isPro && currentPeriod === 'lifetime';

    el.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Planes</div>
          <div class="page-subtitle">Elige el plan que mejor se adapta a tu trabajo</div>
        </div>
      </div>

      <div class="planes-outer" style="max-width:900px;margin:0 auto;padding:0 4px">

        ${isPro && isTrial ? `<div style="background:rgba(78,205,196,0.07);border:1px solid rgba(78,205,196,0.3);border-radius:12px;padding:14px 18px;margin-bottom:28px;display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text2)">
          <svg viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" stroke-width="1.5" width="20" height="20"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>Estás en el <strong style="color:#4ecdc4">período de prueba gratuito</strong>${daysLeft !== null ? ` — te quedan <strong style="color:#4ecdc4">${daysLeft} días</strong>` : ''}. Cuando expire, tu cuenta pasará al plan Básico. Tus datos no se borran.</span>
        </div>` : isPro ? `<div style="background:rgba(245,200,66,0.07);border:1px solid rgba(245,200,66,0.25);border-radius:12px;padding:14px 18px;margin-bottom:28px;display:flex;align-items:center;gap:12px;font-size:13px;color:var(--text2)">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="1.5" width="20" height="20"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          <span>Tienes el plan <strong style="color:var(--gold)">Pro</strong> activo${daysLeft !== null ? ` — caduca en <strong style="color:var(--gold)">${daysLeft} días</strong>` : ''}. Gracias por tu apoyo.</span>
        </div>` : ''}

        <!-- FILA 1: FREE + PRO -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px" class="planes-grid">

          <!-- FREE -->
          <div style="background:var(--card);border:1px solid ${isFreeCurrent ? 'rgba(78,205,196,0.35)' : 'var(--border)'};border-radius:16px;padding:28px;display:flex;flex-direction:column;position:relative">
            ${isFreeCurrent ? currentBadge('var(--cyan)') : ''}
            <div style="margin-bottom:18px${isFreeCurrent ? ';padding-top:12px' : ''}">
              <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:0.1em;margin-bottom:8px">FREE</div>
              <div style="display:flex;align-items:baseline;gap:4px">
                <span class="planes-price-main" style="font-size:38px;font-weight:800;color:var(--text);line-height:1">0€</span>
                <span style="font-size:13px;color:var(--text3)">/mes</span>
              </div>
              <div style="font-size:12px;color:var(--text3);margin-top:5px">Para empezar sin compromiso</div>
              ${!isPro ? `<div style="margin-top:8px;font-size:11px;font-weight:600;color:#4ecdc4;background:rgba(78,205,196,0.1);border:1px solid rgba(78,205,196,0.25);border-radius:6px;padding:4px 8px;display:inline-block">✓ Primer mes Pro gratis al registrarte</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:9px;flex:1">
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text2)"><span style="color:var(--cyan);flex-shrink:0">${chk}</span>1 proyecto activo</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text2)"><span style="color:var(--cyan);flex-shrink:0">${chk}</span>1 empresa</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text2)"><span style="color:var(--cyan);flex-shrink:0">${chk}</span>Timer ilimitado</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text2)"><span style="color:var(--cyan);flex-shrink:0">${chk}</span>Dashboard</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text3)"><span style="flex-shrink:0">${x}</span>Estadísticas</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text3)"><span style="flex-shrink:0">${x}</span>Facturas</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text3)"><span style="flex-shrink:0">${x}</span>Exportar PDF</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text3)"><span style="flex-shrink:0">${x}</span>Proyectos ilimitados</div>
            </div>
          </div>

          <!-- PRO resumen -->
          <div style="background:linear-gradient(145deg,rgba(245,200,66,0.07) 0%,var(--card) 55%);border:1px solid ${isProOverview ? 'rgba(245,200,66,0.55)' : 'rgba(245,200,66,0.28)'};border-radius:16px;padding:28px;display:flex;flex-direction:column;position:relative">
            ${isProOverview ? currentBadge('var(--gold)') : ''}
            <div style="margin-bottom:18px${isProOverview ? ';padding-top:12px' : ''}">
              <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
                <span style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:0.1em">PRO</span>
                <span style="color:var(--gold)">${starIcon}</span>
              </div>
              <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
                <span class="planes-price-main" style="font-size:38px;font-weight:800;color:var(--text);line-height:1">6€</span>
                <span style="font-size:13px;color:var(--text3)">/mes</span>
                ${struck(9, 22)}
              </div>
              <div style="font-size:12px;color:var(--text3);margin-top:5px">${isPro ? (currentPeriod ? `Ver tu plan activo ↓` : 'Plan activo · Mensual') : 'Elige el periodo que prefieras ↓'}</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:9px;flex:1">
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text2)"><span style="color:var(--gold);flex-shrink:0">${chk}</span>Proyectos ilimitados</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text2)"><span style="color:var(--gold);flex-shrink:0">${chk}</span>Empresas ilimitadas</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text2)"><span style="color:var(--gold);flex-shrink:0">${chk}</span>Timer ilimitado</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text2)"><span style="color:var(--gold);flex-shrink:0">${chk}</span>Dashboard completo</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text2)"><span style="color:var(--gold);flex-shrink:0">${chk}</span>Estadísticas detalladas</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text2)"><span style="color:var(--gold);flex-shrink:0">${chk}</span>Gestión de facturas</div>
              <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--text2)"><span style="color:var(--gold);flex-shrink:0">${chk}</span>Exportar PDF</div>
            </div>
            ${!isPro ? `<div style="padding-top:16px;border-top:1px solid var(--border);margin-top:16px">
              <div style="font-size:11px;color:var(--text3);text-align:center;margin-bottom:10px">O activa directamente el plan mensual</div>
              ${isSentCard('Mensual') ? sentBtnHtml : `<button class="btn btn-primary" style="width:100%;justify-content:center;font-size:12px" onclick="VFX.requestUpgrade('Pro Mensual','6€/mes (oferta)','1 mes (renovación mensual)',this)">${mailIco}&nbsp;Activar Pro Mensual</button>`}
            </div>` : ''}
          </div>
        </div>

        <!-- FILA 2: 3 tarjetas de periodo (Trimestral, Semestral, Anual) -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:12px" class="planes-small-grid">

          <!-- TRIMESTRAL -->
          <div style="background:var(--card);border:1px solid ${isQuartCurrent ? 'rgba(108,143,255,0.6)' : 'rgba(108,143,255,0.25)'};border-radius:13px;padding:18px 14px;display:flex;flex-direction:column;gap:0;position:relative;${isQuartCurrent ? 'box-shadow:0 0 0 2px rgba(108,143,255,0.5),0 0 20px rgba(108,143,255,0.2)' : isSentCard('Trimestral') ? sentCardStyle : ''}">
            ${isQuartCurrent ? currentBadge('#6c8fff') : ''}
            ${!isQuartCurrent ? `<div style="position:absolute;top:10px;right:10px;background:rgba(108,143,255,0.15);border:1px solid rgba(108,143,255,0.4);color:#6c8fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:0.05em;white-space:nowrap">Más popular</div>` : ''}
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px${isQuartCurrent ? ';padding-top:10px' : ''}">
              <span style="font-size:10px;font-weight:700;color:#6c8fff;letter-spacing:0.1em">TRIMESTRAL</span>
            </div>
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px;flex-wrap:wrap">
              <span style="font-size:26px;font-weight:800;color:var(--text);line-height:1">16€</span>
              ${struck(24, 17)}
            </div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:12px;flex:1">5,33€/mes · 3 meses</div>
            ${periodBtn('quarterly', 'Activar Pro Trimestral')}
          </div>

          <!-- SEMESTRAL -->
          <div style="background:var(--card);border:1px solid ${isSemiCurrent ? 'rgba(168,151,255,0.6)' : 'rgba(168,151,255,0.25)'};border-radius:13px;padding:18px 14px;display:flex;flex-direction:column;gap:0;position:relative;${isSemiCurrent ? 'box-shadow:0 0 0 2px rgba(168,151,255,0.5),0 0 20px rgba(168,151,255,0.2)' : isSentCard('Semestral') ? sentCardStyle : ''}">
            ${isSemiCurrent ? currentBadge('#a897ff') : ''}
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px${isSemiCurrent ? ';padding-top:10px' : ''}">
              <span style="font-size:10px;font-weight:700;color:#a897ff;letter-spacing:0.1em">SEMESTRAL</span>
            </div>
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px;flex-wrap:wrap">
              <span style="font-size:26px;font-weight:800;color:var(--text);line-height:1">29€</span>
              ${struck(45, 17)}
            </div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:12px;flex:1">4,83€/mes · 6 meses</div>
            ${periodBtn('semi', 'Activar Pro Semestral')}
          </div>

          <!-- ANUAL -->
          <div style="background:var(--card);border:1px solid ${isAnnCurrent ? 'rgba(245,200,66,0.6)' : 'rgba(245,200,66,0.28)'};border-radius:13px;padding:18px 14px;display:flex;flex-direction:column;gap:0;position:relative;${isAnnCurrent ? 'box-shadow:0 0 0 2px rgba(245,200,66,0.55),0 0 20px rgba(245,200,66,0.2)' : isSentCard('Anual') ? sentCardStyle : ''}">
            ${isAnnCurrent ? currentBadge('var(--gold)') : ''}
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px${isAnnCurrent ? ';padding-top:10px' : ''}">
              <span style="font-size:10px;font-weight:700;color:var(--gold);letter-spacing:0.1em">ANUAL</span>
            </div>
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px;flex-wrap:wrap">
              <span style="font-size:26px;font-weight:800;color:var(--text);line-height:1">55€</span>
              ${struck(85, 17)}
            </div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:12px;flex:1">4,58€/mes · 12 meses</div>
            ${periodBtn('annual', 'Activar Pro Anual')}
          </div>
        </div>

        <!-- FILA 3: VITALICIO (prominente) -->
        <div style="background:linear-gradient(135deg,rgba(245,200,66,0.1) 0%,rgba(255,170,60,0.06) 50%,var(--card) 100%);border:2px solid ${isLifeCurrent ? 'rgba(245,200,66,0.8)' : 'rgba(245,200,66,0.45)'};border-radius:18px;padding:32px 36px;display:flex;align-items:center;justify-content:space-between;gap:24px;position:relative;overflow:hidden;${isLifeCurrent ? 'box-shadow:0 0 0 2px rgba(245,200,66,0.7),0 0 28px rgba(245,200,66,0.25)' : isSentCard('Vitalicio') ? sentCardStyle : ''}" class="planes-lifetime">
          <div style="position:absolute;top:0;right:0;width:200px;height:200px;background:radial-gradient(circle at 70% 30%,rgba(245,200,66,0.08) 0%,transparent 70%);pointer-events:none"></div>
          <div style="position:absolute;top:-1px;left:50%;transform:translateX(-50%);background:${isLifeCurrent ? 'var(--gold)' : 'linear-gradient(90deg,var(--gold),#ffb830)'};color:#000;font-size:11px;font-weight:700;padding:4px 20px;border-radius:0 0 10px 10px;letter-spacing:0.08em;white-space:nowrap">${isLifeCurrent ? 'TU PLAN ACTUAL' : 'MEJOR VALOR · PAGO ÚNICO'}</div>

          <div style="flex:1;min-width:0;padding-top:10px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
              <span style="font-size:13px;font-weight:800;color:var(--gold);letter-spacing:0.12em">VITALICIO</span>
              <span style="color:var(--gold)">${starIcon}</span><span style="color:var(--gold)">${starIcon}</span><span style="color:var(--gold)">${starIcon}</span>
              ${!isLifeCurrent ? `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,85,118,0.12);border:1px solid rgba(255,85,118,0.35);color:var(--red);font-size:12px;font-weight:700;padding:5px 12px;border-radius:20px;letter-spacing:0.03em;animation:pulse-red 2s infinite">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Solo para los 10 primeros · hasta junio
              </span>` : ''}
            </div>
            <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px">
              <span class="planes-price-lifetime" style="font-size:52px;font-weight:900;color:var(--gold);line-height:1">200€</span>
              <span style="font-size:14px;color:var(--text3)">una sola vez</span>
            </div>
            <div style="font-size:13px;color:var(--text2);margin-bottom:18px">Paga una vez, úsalo para siempre. Sin renovaciones, sin sorpresas.</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--text2)"><span style="color:var(--gold)">${chk}</span>Todo Pro incluido</span>
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--text2)"><span style="color:var(--gold)">${chk}</span>Actualizaciones futuras</span>
              <span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--text2)"><span style="color:var(--gold)">${chk}</span>Sin fecha de expiración</span>
            </div>
          </div>

          <div style="flex-shrink:0;width:210px">
            ${isLifeCurrent ? '' : periodBtn('lifetime', 'Activar Vitalicio')}
          </div>
        </div>

        <div style="margin-top:20px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 20px;font-size:12px;color:var(--text3);line-height:1.6">
          <strong style="color:var(--text2)">¿Cómo funciona?</strong> — Haz clic en el plan que quieras y se abrirá un email ya redactado con todos tus datos. Tras recibir el pago te activamos el plan en menos de 24 horas.
        </div>

      </div>
    `;
  },

};
