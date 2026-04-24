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

window.CronorasSlots = { slotsLoad, slotsSave, slotElapsed, slotFmt, startSlotInterval };
