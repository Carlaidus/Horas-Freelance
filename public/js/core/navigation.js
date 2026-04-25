/* ── Cronoras Navigation ─────────────────────────────────────── */

window.CronorasNavigation = {

  navigate(view) {
    VFX.track('view', { view });
    VFX.state.view = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');
    document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');
    // Cerrar sidebar en móvil al navegar
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar')?.classList.remove('mobile-open');
      document.getElementById('sidebar-backdrop')?.classList.remove('show');
      const menuBtn = document.getElementById('mobile-menu-btn');
      if (menuBtn) menuBtn.style.display = 'flex';
    }

    if (view === 'dashboard')  VFX.renderDashboard();
    if (view === 'projects')   VFX.renderProjects();
    if (view === 'proyecto')   VFX.renderProyecto();
    if (view === 'stats')      VFX.renderStats();
    if (view === 'facturas')   VFX.renderFacturas();
    if (view === 'companies')  VFX.renderCompanies();
    if (view === 'planes')     VFX.renderPlanes();
    if (view === 'settings')   VFX.renderSettings();
    if (view === 'ayuda')      VFX.renderAyuda();
  },

  selectForCockpit(id) {
    VFX.renderProjectDetail(id);
  },

  filterDashboard(filter) {
    VFX.state.dashboardFilter = filter;
    VFX.renderDashboard();
  },

  async goToProject(id) {
    VFX.state.currentProjectId = id;
    localStorage.setItem(VFX._lsKey('vfx_current_project'), id);
    const entries = await VFX.api.get(`/api/projects/${id}/entries`);
    VFX.state.entries = entries;
    VFX.navigate('proyecto');
  },

};
