/* ── Cronoras Formatters ─────────────────────────────────────── */

window.CronorasFormatters = {
  currency(n) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
  },
  hours(h) {
    return `${parseFloat(h || 0).toFixed(1)} h`;
  },
  days(h) {
    const d = parseFloat(h || 0) / 8;
    return `${d.toFixed(2)} días`;
  },
  date(d) {
    if (!d) return '—';
    const s = String(d).slice(0, 10);
    return new Date(s + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  month(ym) {
    const [y, m] = ym.split('-');
    const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${names[parseInt(m)-1]} ${y}`;
  }
};
