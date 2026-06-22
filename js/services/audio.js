export function createAudio() {
  const AC = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;
  const recipes = {
    shot:   { type:'square',   f:880,  gain:0.2,  dur:0.08 },
    mg:     { type:'square',   f:660,  gain:0.18, dur:0.04 },
    beam:   { type:'triangle', f:1200, gain:0.23, dur:0.18 },
    boom:   { type:'sawtooth', f:120,  gain:0.4,  dur:0.35 },
    reload: { type:'triangle', f:420,  gain:0.15, dur:0.12 },
    melee:  { type:'sawtooth', f:220,  gain:0.25, dur:0.06 },
    hit:    { type:'square',   f:110,  gain:0.3,  dur:0.2  },
    pickup: { type:'triangle', f:660,  gain:0.12, dur:0.1  },
    door:   { type:'square',   f:300,  gain:0.15, dur:0.12 },
    build:  { type:'triangle', f:180,  gain:0.2,  dur:0.15 },
    break:  { type:'square',   f:140,  gain:0.28, dur:0.18 },
    spawn:  { type:'sine',     f:260,  gain:0.18, dur:0.22 },
  };
  function sfx(name) {
    if (!AC) return;
    const r = recipes[name]; if (!r) return;
    const t = AC.currentTime;
    const o = AC.createOscillator(); const g = AC.createGain();
    o.type = r.type; o.frequency.setValueAtTime(r.f, t);
    g.gain.setValueAtTime(r.gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + r.dur);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + Math.min(0.25, r.dur + 0.02));
  }
  // モバイル等では AudioContext が suspended で始まるため、ユーザー操作で resume する
  function resume() {
    try { if (AC && AC.state === 'suspended') return AC.resume(); } catch (_e) {}
    return Promise.resolve();
  }
  return { sfx, resume };
}