/* ── Cronoras Slots Helpers ──────────────────────────────────── */

function slotsLoad() {
  try {
    const saved = localStorage.getItem(VFX._lsKey('vfx_slots'));
    if (saved) {
      VFX.state.slots = JSON.parse(saved).map(s => ({
        projectId: s.projectId || null,
        timerProjectId: s.timerProjectId || s.projectId || null,
        entries: [],
        timer: { active: s.timer?.active||false, paused: s.timer?.paused||false,
                 startTime: s.timer?.startTime||null, accumulated: s.timer?.accumulated||0, interval: null }
      }));
      return;
    }
    const old = localStorage.getItem('vfx_timer');
    const pid = localStorage.getItem('vfx_current_project');
    if (old && pid) {
      const t = JSON.parse(old);
      VFX.state.slots = [{ projectId: parseInt(pid), timerProjectId: parseInt(pid), entries: [],
        timer: { active: t.active||false, paused: t.paused||false,
                 startTime: t.startTime||null, accumulated: t.accumulated||0, interval: null } }];
      return;
    }
  } catch(_) {}
  VFX.state.slots = [{ projectId: null, timerProjectId: null, entries: [], timer: { active: false, paused: false, startTime: null, accumulated: 0, interval: null } }];
}

function slotsSave() {
  localStorage.setItem(VFX._lsKey('vfx_slots'), JSON.stringify(
    VFX.state.slots.map(s => ({
      projectId: s.projectId,
      timerProjectId: s.timerProjectId,
      timer: { active: s.timer.active, paused: s.timer.paused, startTime: s.timer.startTime, accumulated: s.timer.accumulated }
    }))
  ));
}

function slotElapsed(idx) {
  const t = VFX.state.slots[idx]?.timer;
  if (!t?.active) return 0;
  if (t.paused) return t.accumulated;
  return Math.max(0, t.accumulated + (t.startTime ? (Date.now() - new Date(t.startTime).getTime()) / 1000 : 0));
}

function slotFmt(idx) {
  const s = Math.floor(slotElapsed(idx));
  return [Math.floor(s/3600), Math.floor((s%3600)/60), s%60].map(n => String(n).padStart(2,'0')).join(':');
}

function startSlotInterval(idx) {
  const slot = VFX.state.slots[idx];
  if (!slot) return;
  if (slot.timer.interval) clearInterval(slot.timer.interval);
  slot.timer.interval = setInterval(() => {
    const el = document.getElementById(`timer-display-${idx}`);
    if (el) el.textContent = slotFmt(idx);
  }, 1000);
}

async function syncTimersFromServer() {
  try {
    const serverTimers = await VFX.api.get('/api/timers');
    if (!Array.isArray(serverTimers)) return;
    let dirty = false;

    serverTimers.forEach(st => {
      let slot = VFX.state.slots.find(s => s.projectId === st.project_id || s.timerProjectId === st.project_id);
      if (!slot) {
        slot = { projectId: st.project_id, timerProjectId: st.project_id, entries: [], timer: { active: false, paused: false, startTime: null, accumulated: 0, interval: null } };
        VFX.state.slots.push(slot);
      }
      slot.timerProjectId = st.project_id;
      slot.timer.active = true;
      slot.timer.paused = !!st.is_paused;
      slot.timer.startTime = st.started_at || null;
      slot.timer.accumulated = st.accumulated_seconds || 0;
      dirty = true;
      const idx = VFX.state.slots.indexOf(slot);
      if (!st.is_paused && !slot.timer.interval) VFX._startSlotInterval(idx);
    });

    VFX.state.slots.forEach((slot, idx) => {
      if (!slot.timer.active) return;
      const projectId = slot.timerProjectId || slot.projectId;
      const stillActive = serverTimers.some(st => st.project_id === projectId);
      if (!stillActive) {
        if (slot.timer.interval) { clearInterval(slot.timer.interval); slot.timer.interval = null; }
        slot.timer = { active: false, paused: false, startTime: null, accumulated: 0, interval: null };
        dirty = true;
      }
    });

    if (dirty) {
      VFX._slotsSave();
      if (VFX.state.view === 'proyecto') VFX.renderProyecto();
    }
  } catch(_) {}
}

function addSlot() {
  VFX.state.slots.push({ projectId: null, entries: [], timer: { active: false, paused: false, startTime: null, accumulated: 0, interval: null } });
  VFX._slotsSave();
  VFX.renderProyecto();
}

function removeSlot(idx) {
  const slot = VFX.state.slots[idx];
  if (slot?.timer.interval) clearInterval(slot.timer.interval);
  VFX.state.slots.splice(idx, 1);
  if (VFX.state.slots.length === 0)
    VFX.state.slots = [{ projectId: null, entries: [], timer: { active: false, paused: false, startTime: null, accumulated: 0, interval: null } }];
  VFX._slotsSave();
  VFX.renderProyecto();
}

async function selectSlotProject(idx, projectId) {
  const slot = VFX.state.slots[idx];
  if (!slot) return;
  slot.projectId = projectId ? parseInt(projectId) : null;
  slot.entries   = projectId ? await VFX.api.get(`/api/projects/${projectId}/entries`) : [];
  VFX._slotsSave();
  if (projectId) VFX.state.currentProjectId = parseInt(projectId);
  VFX.renderProyecto();
}

async function startTimer(idx) {
  const slot = VFX.state.slots[idx];
  if (!slot?.projectId) return;
  const projectId = slot.projectId;
  slot.timerProjectId = projectId;
  const startTime = new Date().toISOString();
  slot.timer = { active: true, paused: false, startTime, accumulated: 0, interval: null };
  VFX.track('timer_start', { project_id: projectId });
  try { await VFX.api.post(`/api/timers/${projectId}/start`, { started_at: startTime }); } catch(_) {}
  VFX._slotsSave();
  VFX._startSlotInterval(idx);
  VFX.renderProyecto();
}

async function pauseTimer(idx) {
  const slot = VFX.state.slots[idx];
  if (!slot?.timer.active || slot.timer.paused) return;
  if (slot.timer.interval) { clearInterval(slot.timer.interval); slot.timer.interval = null; }
  slot.timer.accumulated = VFX._slotElapsed(idx);
  slot.timer.paused = true;
  slot.timer.startTime = null;
  const projectId = slot.timerProjectId || slot.projectId;
  try { await VFX.api.post(`/api/timers/${projectId}/pause`, { accumulated_seconds: slot.timer.accumulated }); } catch(_) {}
  VFX._slotsSave();
  VFX.renderProyecto();
}

async function resumeTimer(idx) {
  const slot = VFX.state.slots[idx];
  if (!slot?.timer.active || !slot.timer.paused) return;
  const projectId = slot.timerProjectId || slot.projectId;
  try {
    const res = await VFX.api.post(`/api/timers/${projectId}/resume`, { accumulated_seconds: slot.timer.accumulated });
    slot.timer.startTime = res.started_at;
  } catch(_) {
    slot.timer.startTime = new Date().toISOString();
  }
  slot.timer.paused = false;
  VFX._slotsSave();
  VFX._startSlotInterval(idx);
  VFX.renderProyecto();
}

async function stopTimer(idx) {
  const slot = VFX.state.slots[idx];
  const elapsed = VFX._slotElapsed(idx);
  const hours = elapsed > 0 ? Math.max(Math.round(elapsed / 3600 * 4) / 4, 0.25) : 0;
  const timerProjectId = slot.timerProjectId || slot.projectId;
  if (slot.timer.interval) { clearInterval(slot.timer.interval); slot.timer.interval = null; }
  slot.timer = { active: false, paused: false, startTime: null, accumulated: 0, interval: null };
  slot.timerProjectId = null;
  VFX.track('timer_stop', { project_id: timerProjectId, elapsed_seconds: Math.round(elapsed) });
  try { await VFX.api.del(`/api/timers/${timerProjectId}`); } catch(_) {}
  VFX._slotsSave();
  VFX.renderProyecto();
  if (elapsed > 0) VFX.modals.timerStop(hours, idx, timerProjectId);
}

async function saveTimerEntry(idx, projectId) {
  const date  = document.getElementById('timer-date').value;
  const hours = parseFloat(document.getElementById('timer-hours').value);
  const desc  = document.getElementById('timer-desc').value.trim();
  if (!hours) return;
  const dailyOverride = getDailyRateValue('timer-rate');
  const rateOverride = dailyOverride > 0 ? dailyOverride / 8 : null;
  VFX.track('entry_create', { project_id: projectId, hours });
  await VFX.api.post('/api/entries', { project_id: projectId, date, hours, description: desc, hourly_rate_override: rateOverride });
  const slot = VFX.state.slots[idx];
  if (slot) slot.entries = await VFX.api.get(`/api/projects/${projectId}/entries`);
  if (VFX.state.currentProjectId === projectId)
    VFX.state.entries = slot?.entries || [];
  await VFX.loadAll();
  VFX.closeModal();
  VFX.renderProyecto();
}

window.CronorasSlots = { slotsLoad, slotsSave, slotElapsed, slotFmt, startSlotInterval, syncTimersFromServer, addSlot, removeSlot, selectSlotProject, startTimer, pauseTimer, resumeTimer, stopTimer, saveTimerEntry };
