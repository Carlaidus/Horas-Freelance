/* ── Cronoras Daily Rate Helpers ─────────────────────────────── */

const DAILY_RATES = [200, 250, 300, 350, 400, 450];

function dailyRateSelect(id, currentHourlyRate) {
  const daily = currentHourlyRate ? Math.round(currentHourlyRate * 8) : '';
  const options = DAILY_RATES.map(r =>
    `<option value="${r}" ${daily == r ? 'selected' : ''}>${r} €/día</option>`
  ).join('');
  return `
    <select id="${id}" onchange="document.getElementById('${id}-custom').style.display=this.value==='custom'?'block':'none'">
      <option value="" ${!daily ? 'selected' : ''}>— Selecciona tarifa —</option>
      ${options}
      <option value="custom" ${daily && !DAILY_RATES.includes(daily) ? 'selected' : ''}>Personalizada...</option>
    </select>
    <input type="number" id="${id}-custom" placeholder="Tarifa personalizada €/día" step="0.5" min="0"
      style="margin-top:6px;display:${daily && !DAILY_RATES.includes(daily) ? 'block' : 'none'}"
      value="${daily && !DAILY_RATES.includes(daily) ? daily : ''}">
  `;
}

function getDailyRateValue(id) {
  const sel = document.getElementById(id);
  if (!sel) return 0;
  if (sel.value === 'custom') return parseFloat(document.getElementById(id + '-custom')?.value) || 0;
  return parseFloat(sel.value) || 0;
}

// Acceso global directo (usado por app.js como funciones libres)
window.DAILY_RATES       = DAILY_RATES;
window.dailyRateSelect   = dailyRateSelect;
window.getDailyRateValue = getDailyRateValue;

// Agrupado bajo namespace
window.CronorasRates = { DAILY_RATES, dailyRateSelect, getDailyRateValue };
