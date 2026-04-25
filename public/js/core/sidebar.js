/* ── Cronoras Sidebar ────────────────────────────────────────── */

(function () {
  let _autoCollapsed = false;

  function updateSidebarUser() {
    const u = VFX.state.user;
    const name = u.name || 'Sin configurar';
    document.getElementById('sidebar-name').textContent = name;
    document.getElementById('sidebar-profession').textContent = u.profession || 'VFX Compositor';
    document.getElementById('sidebar-avatar').textContent = name[0]?.toUpperCase() || '?';
    const logoutBtn = document.getElementById('sidebar-logout');
    if (logoutBtn) logoutBtn.style.display = VFX.state.requireAuth ? 'flex' : 'none';
    // Badge de plan
    const planEl = document.getElementById('sidebar-plan');
    if (planEl) {
      const plan = VFX.state.plan;
      const days = VFX.state.daysRemaining;
      const isAdmin = VFX.state.role === 'admin';
      if (isAdmin) {
        planEl.textContent = 'Admin';
        planEl.style.cssText = 'display:inline-block;font-size:9px;font-weight:700;letter-spacing:1px;padding:2px 8px;border-radius:10px;background:rgba(150,120,255,0.15);color:#a897ff;border:1px solid rgba(150,120,255,0.3);margin-top:4px';
      } else if (plan === 'pro') {
        const label = days !== null ? `PRO · ${days}d` : 'PRO';
        const color = days !== null && days <= 7 ? '#ff9f43' : '#f5c842';
        planEl.textContent = label;
        planEl.style.cssText = `display:inline-block;font-size:9px;font-weight:700;letter-spacing:1px;padding:2px 8px;border-radius:10px;background:rgba(245,200,66,0.12);color:${color};border:1px solid rgba(245,200,66,0.3);margin-top:4px`;
      } else if (plan === 'basic') {
        const label = days !== null ? `BÁSICO · ${days}d` : 'BÁSICO';
        const color = days !== null && days <= 7 ? '#ff9f43' : '#4ecdc4';
        planEl.textContent = label;
        planEl.style.cssText = `display:inline-block;font-size:9px;font-weight:700;letter-spacing:1px;padding:2px 8px;border-radius:10px;background:rgba(78,205,196,0.12);color:${color};border:1px solid rgba(78,205,196,0.3);margin-top:4px`;
      } else {
        planEl.textContent = 'FREE';
        planEl.style.cssText = 'display:inline-block;font-size:9px;font-weight:700;letter-spacing:1px;padding:2px 8px;border-radius:10px;background:rgba(85,85,128,0.15);color:var(--text3);border:1px solid var(--border2);margin-top:4px';
      }
    }
    // Aviso de expiración próxima
    const expiryEl = document.getElementById('sidebar-expiry');
    if (expiryEl) {
      const days = VFX.state.daysRemaining;
      const isAdmin = VFX.state.role === 'admin';
      if (!isAdmin && days !== null) {
        const color = days <= 7 ? '#ff5576' : days <= 15 ? '#ff9f43' : 'var(--text3)';
        const msg   = days <= 0 ? 'Suscripción expirada' : `Expira en ${days} día${days === 1 ? '' : 's'}`;
        expiryEl.style.cssText = `display:block;margin-top:6px;font-size:10px;color:${color};white-space:normal;line-height:1.3;width:100%`;
        expiryEl.textContent = msg;
      } else {
        expiryEl.style.display = 'none';
      }
    }
    // Badge "Activación en marcha" si hay solicitud pendiente y el plan aún no coincide
    let upgradeEl = document.getElementById('sidebar-upgrade-pending');
    const upgradeRawSidebar = localStorage.getItem(VFX._lsKey('vfx_upgrade_requested'));
    const sentPlanSidebar = upgradeRawSidebar ? (JSON.parse(upgradeRawSidebar)?.plan || null) : null;
    const SENT_TO_PERIOD_SB = {
      'pro mensual': null, 'pro trimestral': 'quarterly',
      'pro semestral': 'semi', 'pro anual': 'annual', 'pro vitalicio': 'lifetime',
    };
    const planAlreadyActive = sentPlanSidebar && VFX.isPro() &&
      SENT_TO_PERIOD_SB[sentPlanSidebar.toLowerCase()] === (VFX.state.planPeriod ?? null);
    const upgradeData = sentPlanSidebar && !planAlreadyActive ? upgradeRawSidebar : null;
    if (upgradeData) {
      if (!upgradeEl) {
        upgradeEl = document.createElement('span');
        upgradeEl.id = 'sidebar-upgrade-pending';
        const expiryEl2 = document.getElementById('sidebar-expiry');
        expiryEl2?.insertAdjacentElement('afterend', upgradeEl);
      }
      upgradeEl.style.cssText = 'display:inline-flex;align-items:center;gap:4px;margin-top:5px;font-size:9px;font-weight:700;letter-spacing:0.05em;padding:2px 8px;border-radius:10px;background:rgba(78,205,196,0.12);color:var(--cyan);border:1px solid rgba(78,205,196,0.3);animation:pulse-green 2s infinite';
      upgradeEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="9" height="9"><polyline points="20 6 9 17 4 12"/></svg>ACTIVACIÓN EN MARCHA`;
    } else if (upgradeEl) {
      upgradeEl.remove();
    }
    // Enlace admin
    const adminLink = document.getElementById('sidebar-admin-link');
    if (adminLink) adminLink.style.display = VFX.state.role === 'admin' ? 'flex' : 'none';
  }

  async function logout() {
    await VFX.api.post('/api/auth/logout', {});
    window.location.href = '/login.html';
  }

  function toggleSidebar() {
    const isMobile = window.innerWidth <= 768;
    const sidebar  = document.getElementById('sidebar');
    const layout   = document.getElementById('app');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (isMobile) {
      const open = sidebar.classList.toggle('mobile-open');
      if (backdrop) backdrop.classList.toggle('show', open);
      const menuBtn = document.getElementById('mobile-menu-btn');
      if (menuBtn) menuBtn.style.display = open ? 'none' : 'flex';
    } else {
      const collapsed = sidebar.classList.toggle('collapsed');
      layout.classList.toggle('sidebar-collapsed', collapsed);
      localStorage.setItem('vfx_sidebar_collapsed', collapsed);
    }
  }

  function restoreSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile && localStorage.getItem('vfx_sidebar_collapsed') === 'true') {
      document.getElementById('sidebar')?.classList.add('collapsed');
      document.getElementById('app')?.classList.add('sidebar-collapsed');
    }
    initResponsiveSidebar();
    // Botón hamburguesa — siempre presente, visible/oculto por CSS según viewport
    if (!document.getElementById('mobile-menu-btn')) {
      const btn = document.createElement('button');
      btn.id = 'mobile-menu-btn';
      btn.onclick = () => VFX.toggleSidebar();
      btn.title = 'Menú';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"/></svg>';
      document.body.appendChild(btn);
    }
  }

  function initResponsiveSidebar() {
    const BREAKPOINT = 1100; // px — por debajo colapsa automáticamente
    _autoCollapsed = false;

    const check = () => {
      const w = window.innerWidth;
      if (w <= 768) return; // móvil lo gestiona toggleSidebar
      const sidebar = document.getElementById('sidebar');
      const layout  = document.getElementById('app');
      if (!sidebar || !layout) return;
      const isCollapsed = sidebar.classList.contains('collapsed');
      const manuallyCollapsed = localStorage.getItem('vfx_sidebar_collapsed') === 'true';

      if (w < BREAKPOINT && !isCollapsed) {
        sidebar.classList.add('collapsed');
        layout.classList.add('sidebar-collapsed');
        _autoCollapsed = true;
      } else if (w >= BREAKPOINT && isCollapsed && _autoCollapsed && !manuallyCollapsed) {
        sidebar.classList.remove('collapsed');
        layout.classList.remove('sidebar-collapsed');
        _autoCollapsed = false;
      }
    };

    window.addEventListener('resize', check);
    check();
  }

  window.CronorasSidebar = {
    updateSidebarUser,
    logout,
    toggleSidebar,
    restoreSidebar,
    initResponsiveSidebar,
  };
})();
