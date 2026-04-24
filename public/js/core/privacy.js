/* ── Cronoras Privacy Helpers ────────────────────────────────── */

const _privacy = {
  on: false,
  load() {
    const def = localStorage.getItem(VFX._lsKey('vfx_privacy_default')) === 'true';
    const saved = localStorage.getItem(VFX._lsKey('vfx_privacy_on'));
    this.on = saved !== null ? saved === 'true' : def;
  },
  save() { localStorage.setItem(VFX._lsKey('vfx_privacy_on'), this.on); },
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
};

function togglePrivacy() {
  VFX.privacy.on = !VFX.privacy.on;
  VFX.privacy.save();
  VFX.applyPrivacy();
}

function applyPrivacy() {
  const on = VFX.privacy.on;
  document.body.classList.toggle('privacy-mode', on);
  const eyeOn = document.getElementById('privacy-icon-eye');
  const eyeOff = document.getElementById('privacy-icon-off');
  const btn   = document.getElementById('privacy-toggle');
  if (eyeOn) eyeOn.style.display = on ? 'none' : 'block';
  if (eyeOff) eyeOff.style.display = on ? 'block' : 'none';
  if (btn) {
    btn.classList.toggle('active', on);
    btn.title = on ? 'Mostrar cifras' : 'Ocultar cifras (modo privacidad)';
  }
}

function savePrivacyDefault(val) {
  localStorage.setItem(VFX._lsKey('vfx_privacy_default'), val);
}

function toggleLocationPrivacy(enabled) {
  localStorage.setItem('vfx_privacy_location', enabled);
  const block = document.getElementById('location-settings-block');
  if (block) block.style.display = enabled ? 'block' : 'none';
}

function saveHomeLocation() {
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
}

window.CronorasPrivacy = {
  privacy: _privacy,
  togglePrivacy,
  applyPrivacy,
  savePrivacyDefault,
  toggleLocationPrivacy,
  saveHomeLocation
};
