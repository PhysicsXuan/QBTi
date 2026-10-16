/* ============================================================
   Quantum Sphere —— 量子球视觉引擎 + 触感音效 + 手机震动
   使用方式：<script src="quantum-sphere.js"></script>
   暴露全局：window.QuantumSphere = {
     resize, isSplit, reset, sound, haptic,
     setQuantumState, setDimensionStates,
     getQuantumState, clearQuantumState
   }
   ============================================================ */
(function(){
  'use strict';

  /* ==========================================================
     HapticFX —— 手机震动反馈
     ========================================================== */
  const HapticFX = (function(){
    const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    let enabled = true;
    function vibrate(pattern){
      if(!enabled || !isSupported) return;
      try { navigator.vibrate(pattern); } catch(e){}
    }
    function setEnabled(v){ enabled = !!v; }
    return {
      vibrate,
      setEnabled,
      isSupported: function(){ return isSupported; }
    };
  })();

  /* ==========================================================
     AudioFX —— Web Audio API 合成音效
     ========================================================== */
  const AudioFX = (function(){
    let ctx = null;
    let master = null;
    let enabled = true;
    let baseFreq = 330;
    let chargeOsc = null, chargeGain = null, chargeFilter = null;
    let lastHoverTime = 0;
    let lastDragTime = 0;
    let unlocked = false;

    function createContext(){
      if(ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.26;
        master.connect(ctx.destination);
      } catch(e){ ctx = null; }
    }

    function warmup(){
      if(!ctx || !master) return;
      try {
        const t0 = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        osc.frequency.value = 440;
        osc.connect(gain);
        gain.connect(master);
        osc.start(t0);
        osc.stop(t0 + 0.03);
      } catch(e){}
    }

    function unlock(){
      createContext();
      if(!ctx) return;
      if(ctx.state === 'suspended'){
        try {
          const p = ctx.resume();
          if(p && typeof p.then === 'function'){
            p.then(function(){ unlocked = true; warmup(); }).catch(function(){});
          }
        } catch(e){}
      } else {
        unlocked = true;
      }
      if(ctx.state === 'running' && !unlocked){ unlocked = true; warmup(); }
    }

    function ensure(){
      createContext();
      if(!ctx) return;
      if(ctx.state === 'suspended'){ try { ctx.resume(); } catch(e){} }
    }

    function setBase(brightness){
      baseFreq = 200 + (brightness / 255) * 320;
    }

    function isEnabled(){ return enabled; }
    function setEnabled(v){
      enabled = !!v;
      if(!enabled) stopCharge();
      try { localStorage.setItem('qs_sound_enabled', enabled ? '1' : '0'); } catch(e){}
    }
    function toggle(){ setEnabled(!enabled); return enabled; }
    function loadPreference(){
      try { const saved = localStorage.getItem('qs_sound_enabled'); if(saved === '0') enabled = false; } catch(e){}
    }

    function playTone(o){
      if(!enabled) return;
      ensure();
      if(!ctx) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = o.type || 'sine';
      const f0 = o.freq != null ? o.freq : baseFreq;
      const f1 = o.endFreq != null ? o.endFreq : f0;
      osc.frequency.setValueAtTime(f0, t0);
      if(f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + (o.sweepDur || o.dur));
      const vol = o.vol != null ? o.vol : 0.3;
      const attack = o.attack != null ? o.attack : 0.005;
      const dur = o.dur || 0.2;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      if(o.lowpass){
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.value = o.q != null ? o.q : 1;
        filter.frequency.setValueAtTime(o.lowpass, t0);
        if(o.lowpassEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(60, o.lowpassEnd), t0 + dur * 0.9);
        osc.connect(filter); filter.connect(gain);
      } else { osc.connect(gain); }
      gain.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    }

    function playNoise(o){
      if(!enabled) return;
      ensure();
      if(!ctx) return;
      o = o || {};
      const t0 = ctx.currentTime;
      const dur = o.dur || 0.3;
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
      const data = buf.getChannelData(0);
      for(let i=0;i<data.length;i++) data[i] = (Math.random()*2-1) * (1 - i/data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(o.filterFreq || 2500, t0);
      if(o.filterEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(60, o.filterEnd), t0 + dur);
      const gain = ctx.createGain();
      const atk = o.attack != null ? o.attack : 0.008;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(o.vol != null ? o.vol : 0.15, t0 + atk);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter); filter.connect(gain); gain.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.05);
    }

    function hover(){
      if(!enabled) return;
      const now = performance.now();
      if(now - lastHoverTime < 90) return;
      lastHoverTime = now;
      playTone({ type:'sine', freq:baseFreq*2.4, endFreq:baseFreq*2.6, vol:0.07, attack:0.008, dur:0.12, sweepDur:0.1 });
    }
    function ripple(){
      playTone({ type:'sine', freq:baseFreq*3.2, endFreq:baseFreq*1.1, vol:0.30, attack:0.004, dur:0.32, sweepDur:0.26 });
      playTone({ type:'triangle', freq:baseFreq*0.7, endFreq:baseFreq*0.5, vol:0.16, attack:0.01, dur:0.45, sweepDur:0.4 });
    }
    function burst(){
      playTone({ type:'sawtooth', freq:baseFreq*1.6, endFreq:baseFreq*0.4, vol:0.32, attack:0.003, dur:0.55, sweepDur:0.48 });
      playTone({ type:'sine', freq:baseFreq*4.5, endFreq:baseFreq*1.8, vol:0.18, attack:0.003, dur:0.28, sweepDur:0.24 });
      playNoise({dur:0.28, vol:0.11, filterFreq:3500, filterEnd:600});
    }
    function focus(){
      playTone({ type:'sine', freq:baseFreq*2.0, endFreq:baseFreq*2.0, vol:0.22, attack:0.008, dur:0.38 });
      setTimeout(function(){
        playTone({ type:'sine', freq:baseFreq*3.0, endFreq:baseFreq*3.0, vol:0.16, attack:0.01, dur:0.45 });
      }, 55);
    }
    function unfocus(){
      playTone({ type:'sine', freq:baseFreq*1.6, endFreq:baseFreq*1.2, vol:0.16, attack:0.008, dur:0.28, sweepDur:0.24 });
    }
    function drag(){
      if(!enabled) return;
      const now = performance.now();
      if(now - lastDragTime < 100) return;
      lastDragTime = now;
      playTone({ type:'triangle', freq:baseFreq*1.2, endFreq:baseFreq*1.8, vol:0.05, attack:0.01, dur:0.09, sweepDur:0.08 });
    }
    function startCharge(){
      if(!enabled) return;
      ensure();
      if(!ctx) return;
      stopCharge();
      chargeOsc = ctx.createOscillator();
      chargeOsc.type = 'triangle';
      chargeOsc.frequency.value = baseFreq * 0.35;
      chargeFilter = ctx.createBiquadFilter();
      chargeFilter.type = 'lowpass';
      chargeFilter.frequency.value = 320;
      chargeFilter.Q.value = 1.2;
      chargeGain = ctx.createGain();
      chargeGain.gain.value = 0.0001;
      chargeOsc.connect(chargeFilter);
      chargeFilter.connect(chargeGain);
      chargeGain.connect(master);
      chargeOsc.start();
    }
    function updateCharge(v){
      if(!chargeOsc || !ctx) return;
      const t = ctx.currentTime;
      chargeOsc.frequency.setTargetAtTime(baseFreq * (0.35 + v * 0.65), t, 0.05);
      chargeFilter.frequency.setTargetAtTime(320 + v * 630, t, 0.06);
      chargeGain.gain.setTargetAtTime(0.02 + v * 0.14, t, 0.05);
    }
    function stopCharge(){
      if(chargeOsc){ try { chargeOsc.stop(); } catch(e){} try { chargeOsc.disconnect(); } catch(e){} chargeOsc = null; }
      if(chargeFilter){ try { chargeFilter.disconnect(); } catch(e){} chargeFilter = null; }
      if(chargeGain){ try { chargeGain.disconnect(); } catch(e){} chargeGain = null; }
    }
    function superRelease(){
      stopCharge();
      const sf = Math.min(baseFreq, 380);
      playTone({ type:'triangle', freq:sf*0.55, endFreq:sf*0.12, vol:0.55, attack:0.045, dur:1.9, sweepDur:1.6, lowpass:600, lowpassEnd:90, q:2.0 });
      playTone({ type:'sine', freq:sf*0.32, endFreq:sf*0.10, vol:0.42, attack:0.055, dur:2.2, sweepDur:1.8 });
      playTone({ type:'sine', freq:55, endFreq:38, vol:0.32, attack:0.08, dur:1.5, sweepDur:1.2 });
      playNoise({ dur:1.1, vol:0.18, filterFreq:380, filterEnd:60, attack:0.025 });
    }
    function split(){
      for(let i=0;i<4;i++){
        (function(idx){
          setTimeout(function(){
            playTone({ type:'sine', freq:baseFreq*(1.8+idx*0.15), endFreq:baseFreq*(2.4+idx*0.2), vol:0.15, attack:0.005, dur:0.35, sweepDur:0.3 });
          }, idx*65);
        })(i);
      }
      setTimeout(function(){
        playTone({ type:'triangle', freq:baseFreq*0.6, endFreq:baseFreq*0.4, vol:0.20, attack:0.01, dur:1.2, sweepDur:1.0, lowpass:1200, lowpassEnd:400 });
      }, 100);
    }
    function debugState(){
      return { hasContext: !!ctx, state: ctx ? ctx.state : 'none', enabled: enabled, unlocked: unlocked, baseFreq: baseFreq, masterGain: master ? master.gain.value : 0 };
    }

    return {
      unlock, ensure, setBase, isEnabled, setEnabled, toggle, loadPreference,
      hover, ripple, burst, focus, unfocus, drag,
      startCharge, updateCharge, stopCharge,
      superRelease, split, debugState
    };
  })();

  /* ---------- 全局解锁 ---------- */
  (function bindGlobalUnlock(){
    let fired = false;
    function once(){
      if(fired) return;
      fired = true;
      AudioFX.unlock();
      setTimeout(function(){ AudioFX.unlock(); }, 120);
      document.removeEventListener('pointerdown', once, true);
      document.removeEventListener('touchstart', once, true);
      document.removeEventListener('keydown', once, true);
      document.removeEventListener('click', once, true);
    }
    document.addEventListener('pointerdown', once, true);
    document.addEventListener('touchstart', once, true);
    document.addEventListener('keydown', once, true);
    document.addEventListener('click', once, true);
  })();

  /* ---------- 音效开关按钮 ---------- */
  function injectSoundToggle(){
    if(document.getElementById('qSoundToggle')) return;
    const style = document.createElement('style');
    style.textContent = '.q-sound-toggle{position:fixed;right:20px;bottom:72px;z-index:150;width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.1);background:rgba(12,14,28,.85);color:var(--muted);cursor:pointer;display:grid;place-items:center;font-size:16px;line-height:1;transition:.25s;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:0;font-family:inherit;}.q-sound-toggle:hover{color:var(--txt);border-color:var(--q-color);}.q-sound-toggle.muted{opacity:.5;}';
    document.head.appendChild(style);
    const btn = document.createElement('button');
    btn.id = 'qSoundToggle';
    btn.className = 'q-sound-toggle';
    btn.type = 'button';
    btn.title = '音效开关';
    btn.textContent = AudioFX.isEnabled() ? '🔊' : '🔇';
    if(!AudioFX.isEnabled()) btn.classList.add('muted');
    btn.addEventListener('click', function(){
      AudioFX.unlock();
      const on = AudioFX.toggle();
      btn.textContent = on ? '🔊' : '🔇';
      btn.classList.toggle('muted', !on);
      if(on) HapticFX.vibrate(20);
    });
    document.body.appendChild(btn);
  }

  /* ==========================================================
     主引擎
     ========================================================== */
  function boot(){
    const canvas = document.getElementById('quantumCanvas');
    const visualEl = document.getElementById('quantumVisual');
    if(!canvas) return;

    AudioFX.loadPreference();
    injectSoundToggle();

    try {
      console.log('[QuantumSphere] 音效状态:', AudioFX.debugState());
      console.log('[QuantumSphere] 震动支持:', HapticFX.isSupported() ? '是' : '否');
    } catch(e){}

    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    /* ---------- 颜色系统 ---------- */
    const palette = [[255,140,80],[120,180,255],[180,130,255],[255,110,170],[100,230,200],[200,230,110],[255,210,90]];

    const QUANTUM_COLORS = {
      good:          [ 80, 220, 140],
      danger:        [235,  65,  75],
      superposition: [ 90, 140, 245]
    };
    const DIM_IDS = ['PO','II','LA','UR'];
    const STATE_STORAGE_KEY = 'qbti_quantum_state';
    const DIM_STATE_KEY = 'qbti_dimension_states';

    // ★ 全局状态变量（之前缺失的就是这些）
    let globalState = 'default';
    let dimensionStates = null;
    let fallbackColor = palette[Math.floor(Math.random() * palette.length)];
    let globalColor = [fallbackColor[0], fallbackColor[1], fallbackColor[2]];

    let CR = fallbackColor[0], CG = fallbackColor[1], CB = fallbackColor[2];
    let PR = CR, PG = CG, PB = CB;

    function applyGlobalColor(c){
      globalColor = c.slice();
      document.documentElement.style.setProperty('--q-r', c[0]);
      document.documentElement.style.setProperty('--q-g', c[1]);
      document.documentElement.style.setProperty('--q-b', c[2]);
      document.documentElement.style.setProperty('--q-color', 'rgb('+c[0]+','+c[1]+','+c[2]+')');
      AudioFX.setBase((c[0]+c[1]+c[2]) / 3);
    }

    function applyColor(cr, cg, cb){
      CR = cr; CG = cg; CB = cb;
      PR = CR; PG = CG; PB = CB;
      document.documentElement.style.setProperty('--q-r', CR);
      document.documentElement.style.setProperty('--q-g', CG);
      document.documentElement.style.setProperty('--q-b', CB);
      document.documentElement.style.setProperty('--q-color', 'rgb('+CR+','+CG+','+CB+')');
      AudioFX.setBase((CR + CG + CB) / 3);
    }

    function colorForBall(ball, idx){
      if(!hasSplit) return globalColor;
      if(dimensionStates){
        const dimId = ball._dim || DIM_IDS[idx] || null;
        if(dimId && dimensionStates[dimId]){
          const t = dimensionStates[dimId].type || dimensionStates[dimId];
          if(QUANTUM_COLORS[t]) return QUANTUM_COLORS[t];
        }
      }
      return globalColor;
    }

    (function initColors(){
      let savedState = null, savedDim = null;
      try {
        savedState = localStorage.getItem(STATE_STORAGE_KEY);
        savedDim = localStorage.getItem(DIM_STATE_KEY);
      } catch(e){}
      if(savedState && QUANTUM_COLORS[savedState]){
        globalState = savedState;
        applyGlobalColor(QUANTUM_COLORS[savedState]);
      } else {
        applyGlobalColor(fallbackColor);
      }
      if(savedDim){
        try {
          const parsed = JSON.parse(savedDim);
          if(parsed && typeof parsed === 'object') dimensionStates = parsed;
        } catch(e){}
      }
    })();

    const BALL_NAMES = ['潜能开放度','内在驱动力','学习自主性','未知应对方式'];
    const BALL_SHORT = ['PO','II','LA','UR'];

    let W = 0, H = 0;
    let BASE_CX = 0, BASE_CY = 0, BASE_R = 0;
    let CX = 0, CY = 0, R = 0;

    const SPLIT_SCALE = 0.38;
    const FOCUS_SCALE = 1.55;
    const FOCUS_SHIFT = 0.45;
    const MIN_BASE_R = 24;

    const CHARGE_RATE = 1.6;
    const CHARGE_FULL = 0.999;

    let hasSplit = false;
    let flash = 0;

    function safeBaseR(){
      return (isFinite(BASE_R) && BASE_R > MIN_BASE_R) ? BASE_R : MIN_BASE_R;
    }

    function resize(){
      const rect = canvas.getBoundingClientRect();
      let cssW = rect.width, cssH = rect.height;
      if(!isFinite(cssW) || !isFinite(cssH) || cssW < 20 || cssH < 20){
        const vw = window.innerWidth || 800;
        const vh = window.innerHeight || 600;
        const s = Math.min(vw * 0.92, vh * 0.82, 880);
        cssW = s; cssH = s;
      }
      const w = Math.max(20, Math.floor(cssW * DPR));
      const h = Math.max(20, Math.floor(cssH * DPR));
      if(w === W && h === H) return;
      W = canvas.width = w;
      H = canvas.height = h;
      BASE_CX = W / 2;
      BASE_CY = H / 2;
      BASE_R = Math.min(W, H) * 0.36;
      if(!isFinite(BASE_R) || BASE_R < MIN_BASE_R) BASE_R = MIN_BASE_R;
      if(aura.targetR === 0){
        aura.r = BASE_R * 0.4;
        aura.targetR = BASE_R * 0.4;
      }
      if(hasSplit) updateLayoutTargets(true);
    }

    const YAW_BASE = 0.28, TILT_BASE = -0.42, CAM = 3.2;
    let currentYaw = YAW_BASE;
    let tiltCur = TILT_BASE;

    function project(x, y, z){
      const cy = Math.cos(currentYaw), sy = Math.sin(currentYaw);
      const x1 = x*cy + z*sy, z1 = -x*sy + z*cy;
      const ct = Math.cos(tiltCur), st = Math.sin(tiltCur);
      const y1 = y*ct - z1*st, z2 = y*st + z1*ct;
      const p = CAM / (CAM - z2);
      return { x: CX + x1*R*p, y: CY + y1*R*p, z: z2, s: p };
    }

    const latPhis = [-75,-60,-45,-30,-15,0,15,30,45,60,75].map(d => d*Math.PI/180);
    const lonThetas = Array.from({length:16},(_,i) => i/16*Math.PI*2);

    const particles = [];
    for(let i=0;i<900;i++){
      const u = Math.random()*2-1;
      const theta = Math.random()*Math.PI*2;
      const phi = Math.asin(u);
      particles.push({theta, phi, size:0.7+Math.random()*1.8, white:Math.random()<0.16, twinkle:Math.random()*Math.PI*2, speed:0.4+Math.random()*1.6, edgePhase:Math.random()*Math.PI*2});
    }

    const circuits = [];
    function makeCircuit(cTheta, cPhi, spread, count){
      for(let i=0;i<count;i++){
        let th = cTheta + (Math.random()-0.5)*spread;
        let ph = cPhi + (Math.random()-0.5)*spread*0.8;
        ph = Math.max(-1.35, Math.min(1.35, ph));
        const steps = 3 + Math.floor(Math.random()*5);
        const pts = [];
        for(let s=0;s<steps;s++){
          const cp = Math.cos(ph);
          pts.push({x:cp*Math.cos(th), y:Math.sin(ph), z:cp*Math.sin(th)});
          th += (Math.random()-0.5)*0.20;
          ph += (Math.random()-0.5)*0.14;
          ph = Math.max(-1.35, Math.min(1.35, ph));
        }
        circuits.push({pts, phase:Math.random()*Math.PI*2, speed:0.6+Math.random()*0.9});
      }
    }
    makeCircuit(0.5, 0.15, 0.6, 26);
    makeCircuit(0.9, -0.35, 0.55, 20);
    makeCircuit(0.25, 0.7, 0.5, 16);
    makeCircuit(Math.PI-0.4, 0.3, 0.55, 22);
    makeCircuit(Math.PI+0.2, -0.35, 0.5, 18);
    makeCircuit(Math.PI-0.6, 0.7, 0.45, 14);
    makeCircuit(Math.PI+0.55, 0.5, 0.45, 12);
    makeCircuit(0.2, 1.15, 0.4, 12);

    const innerBands = [
      {lat:-60,width:5,alpha:0.30,phase:0},{lat:-30,width:7,alpha:0.22,phase:1.1},
      {lat:-5,width:4,alpha:0.34,phase:2.3},{lat:25,width:6,alpha:0.26,phase:3.5},
      {lat:55,width:5,alpha:0.28,phase:4.7}
    ];

    const rings = [
      {tilt:0.28,phase:0,speed:0.35,color:1.0,radius:1.16},
      {tilt:1.05,phase:1.3,speed:-0.28,color:0.75,radius:1.22},
      {tilt:0.65,phase:2.6,speed:0.22,color:0.9,radius:1.18},
      {tilt:-0.45,phase:4.0,speed:-0.32,color:0.82,radius:1.28},
      {tilt:1.45,phase:5.1,speed:0.26,color:0.68,radius:1.14}
    ];
    const ringBalls = [];
    rings.forEach((r,i)=>{for(let k=0;k<2;k++){ringBalls.push({ring:i,angle:Math.random()*Math.PI*2,speed:0.5+Math.random()*0.8,size:1.6+Math.random()*1.2});}});

    const flowParticles = [];
    for(let i=0;i<120;i++){
      flowParticles.push({lon:Math.floor(Math.random()*lonThetas.length),phi:Math.random()*Math.PI-Math.PI/2,speed:0.35+Math.random()*0.7,dir:Math.random()<0.5?1:-1,size:1.0+Math.random()*1.4,twinkle:Math.random()*Math.PI*2,tail:0.10+Math.random()*0.14});
    }

    const coreOrbiters = [];
    for(let i=0;i<24;i++){
      coreOrbiters.push({angle:Math.random()*Math.PI*2,orbitR:0.06+Math.random()*0.12,speed:0.5+Math.random()*1.3,tilt:Math.random()*Math.PI,dir:Math.random()<0.5?1:-1,size:0.8+Math.random()*1.0});
    }

    const pulsePoints = [];
    for(let i=0;i<60;i++){
      pulsePoints.push({
        lon: Math.floor(Math.random()*lonThetas.length),
        lat: Math.floor(Math.random()*latPhis.length),
        phase: Math.random()*Math.PI*2,
        speed: 0.6+Math.random()*1.2,
        size: 1.2+Math.random()*1.4
      });
    }

    const nodes = [];
    for(let i=0;i<56;i++){
      const u = Math.random()*2-1;
      const theta = Math.random()*Math.PI*2;
      const phi = Math.asin(u);
      nodes.push({theta, phi});
    }
    const nodeLinks = [];
    for(let i=0;i<nodes.length;i++){
      const a = nodes[i];
      const ax = Math.cos(a.phi)*Math.cos(a.theta), ay = Math.sin(a.phi), az = Math.cos(a.phi)*Math.sin(a.theta);
      const dists = [];
      for(let j=0;j<nodes.length;j++){
        if(i===j) continue;
        const b = nodes[j];
        const bx = Math.cos(b.phi)*Math.cos(b.theta), by = Math.sin(b.phi), bz = Math.cos(b.phi)*Math.sin(b.theta);
        const d = (ax-bx)*(ax-bx) + (ay-by)*(ay-by) + (az-bz)*(az-bz);
        dists.push({j, d});
      }
      dists.sort((p,q)=>p.d-q.d);
      for(let k=0;k<2;k++){const j = dists[k].j; if(i<j) nodeLinks.push({a:i,b:j,phase:Math.random()*Math.PI*2});}
    }

    function computeSplitLayout(){
      const BR = safeBaseR();
      const focusR = BR * SPLIT_SCALE * FOCUS_SCALE;
      const padX = 26 * DPR;
      const padY = 26 * DPR;
      const labelPad = 50 * DPR;
      const denom = Math.max(1, (1 - FOCUS_SHIFT) * BR);

      let safeHx = (W/2 - padX - focusR) / denom;
      let safeHy = (H/2 - padY - labelPad - focusR) / denom;
      if(!isFinite(safeHx) || safeHx <= 0) safeHx = 1.0;
      if(!isFinite(safeHy) || safeHy <= 0) safeHy = 0.6;

      const aspect = W / Math.max(1, H);
      const wantHx = 0.76 * Math.min(1.10, Math.max(0.85, Math.sqrt(aspect)));
      const wantHy = 0.52 * Math.min(1.05, Math.max(0.85, 1/Math.sqrt(aspect)));

      const minHx = 0.55, minHy = 0.40;
      let hx = Math.max(minHx, Math.min(wantHx, safeHx));
      let hy = Math.max(minHy, Math.min(wantHy, safeHy));
      if(!isFinite(hx)) hx = minHx;
      if(!isFinite(hy)) hy = minHy;

      return [
        {ox:-hx, oy:-hy, name: BALL_NAMES[0], short: BALL_SHORT[0], dim: 'PO'},
        {ox: hx, oy:-hy, name: BALL_NAMES[1], short: BALL_SHORT[1], dim: 'II'},
        {ox:-hx, oy: hy, name: BALL_NAMES[2], short: BALL_SHORT[2], dim: 'LA'},
        {ox: hx, oy: hy, name: BALL_NAMES[3], short: BALL_SHORT[3], dim: 'UR'}
      ];
    }

    function updateLayoutTargets(instant){
      const layout = computeSplitLayout();
      for(let i = 0; i < balls.length; i++){
        if(i >= layout.length) break;
        const p = layout[i];
        const b = balls[i];
        b.toOx = p.ox;
        b.toOy = p.oy;
        if(instant && b.arrived){ b.ox = p.ox; b.oy = p.oy; }
        if(p.name) b.name = p.name;
        if(p.short) b.short = p.short;
        if(p.dim) b._dim = p.dim;
      }
    }

    function easeOutBack(t){const c1=1.70158,c3=c1+1;return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2);}
    function easeOutCubic(t){return 1 - Math.pow(1-t,3);}

    function makeBall(opts){
      opts = opts || {};
      const ox = opts.ox || 0, oy = opts.oy || 0, sc = opts.scale || 1;
      return {
        ox, oy, scale: sc,
        fromOx: ox, fromOy: oy, fromScale: sc,
        toOx: ox, toOy: oy, toScale: sc,
        t0: 0, dur: 0, arrived: true,
        yawPhase: opts.yawPhase || 0,
        yawOffset: 0, tiltOffset: 0,
        breathSeed: Math.random() * 6.28,
        seed: Math.random() * 6.28,
        jitterAmp: 0,
        jitterDecay: 4,
        jitterPhaseX: 0,
        jitterPhaseY: 0,
        name: opts.name || '',
        short: opts.short || '',
        _dim: opts.dim || null,
        focusAmount: 0,
        focusPing: 0
      };
    }

    const balls = [ makeBall({ox:0, oy:0, scale:1}) ];

    function splitSpheres(inheritAmp){
      if(!isFinite(BASE_R) || BASE_R < MIN_BASE_R) BASE_R = MIN_BASE_R;
      const now = performance.now();
      const layout = computeSplitLayout();
      const maxJitter = Math.min(inheritAmp * 0.6, safeBaseR() * 0.07);
      const next = layout.map((p, i) => {
        const b = makeBall({ox:0, oy:0, scale:1});
        b.fromOx = 0; b.fromOy = 0; b.fromScale = 1;
        b.toOx = p.ox; b.toOy = p.oy; b.toScale = SPLIT_SCALE;
        b.ox = 0; b.oy = 0; b.scale = 1;
        b.t0 = now + i * 70;
        b.dur = 1.55;
        b.arrived = false;
        b.yawPhase = i * 1.75 + Math.random() * 0.5;
        b.jitterAmp = maxJitter * (0.85 + Math.random() * 0.4);
        b.jitterDecay = 3.2 + Math.random() * 1.6;
        b.jitterPhaseX = Math.random() * 6.28;
        b.jitterPhaseY = Math.random() * 6.28;
        b.name = p.name;
        b.short = p.short;
        b._dim = p.dim;
        return b;
      });
      balls.length = 0;
      balls.push.apply(balls, next);
      flash = 1;
      screenShake = Math.max(screenShake, 1.0);

      const hint = document.querySelector('.quantum-hint');
      if(hint) hint.style.display = 'none';

      AudioFX.split();
      HapticFX.vibrate([40, 30, 40, 30, 80]);

      for(let i=0;i<5;i++){
        pushRing(BASE_CX, BASE_CY, {
          delay: i * 0.07, duration: 2.2 - i*0.15,
          maxR: safeBaseR() * (3.0 - i*0.35),
          width: 3.5 - i*0.5, alpha: 0.95 - i*0.14,
          glow: 1.6, ease: 2.0 + i*0.22
        });
      }
      for(let i=0;i<72;i++){
        const a = (i / 72) * Math.PI * 2 + Math.random() * 0.16;
        pushSpark(BASE_CX, BASE_CY, {
          angle: a, speed: 3.0 + Math.random()*6.5,
          duration: 1.1 + Math.random()*0.9, size: 1.2 + Math.random()*2.0
        });
      }
    }

    function updateBalls(now, dt){
      for(const b of balls){
        if(!b.arrived && b.t0 && b.dur > 0){
          let age = (now - b.t0) / (b.dur * 1000);
          if(age < 0) age = 0;
          if(age >= 1){
            b.ox = b.toOx; b.oy = b.toOy; b.scale = b.toScale;
            b.arrived = true;
          } else {
            const k = easeOutCubic(age);
            const kScale = easeOutBack(age);
            b.ox = b.fromOx + (b.toOx - b.fromOx) * k;
            b.oy = b.fromOy + (b.toOy - b.fromOy) * k;
            b.scale = b.fromScale + (b.toScale - b.fromScale) * kScale;
            if(b.scale < 0.02) b.scale = 0.02;
          }
        }
        const targetFocus = (b === focusedBall) ? 1 : 0;
        const tc = targetFocus > b.focusAmount ? 0.16 : 0.22;
        const k = 1 - Math.exp(-dt / tc);
        b.focusAmount += (targetFocus - b.focusAmount) * k;
        if(b.focusAmount < 0.0005 && targetFocus === 0) b.focusAmount = 0;
        if(b.focusAmount > 0.9995 && targetFocus === 1) b.focusAmount = 1;
        if(b.focusPing > 0){
          b.focusPing *= Math.exp(-dt * 4.0);
          if(b.focusPing < 0.005) b.focusPing = 0;
        }
      }
    }

    function computeBallVisual(b){
      let visScale = b.scale;
      let visOx = b.ox;
      let visOy = b.oy;
      let visAlpha = 1;
      const f = b.focusAmount;
      if(hasSplit && f > 0.0005){
        visScale = b.scale * (1 + f * (FOCUS_SCALE - 1));
        visOx = b.ox * (1 - f * FOCUS_SHIFT);
        visOy = b.oy * (1 - f * FOCUS_SHIFT);
        visAlpha = 1;
      }
      if(hasSplit && globalFocus > 0.0005){
        const dimFactor = 1 - (1 - f) * globalFocus * 0.72;
        visAlpha *= dimFactor;
      }
      if(!isFinite(visScale) || visScale < 0.01) visScale = 0.01;
      if(!isFinite(visOx)) visOx = 0;
      if(!isFinite(visOy)) visOy = 0;
      if(!isFinite(visAlpha)) visAlpha = 1;
      return { visScale, visOx, visOy, visAlpha };
    }

    function findBall(x, y){
      let best = null;
      let bestR = 0;
      for(const b of balls){
        const v = computeBallVisual(b);
        const bx = BASE_CX + v.visOx * safeBaseR();
        const by = BASE_CY + v.visOy * safeBaseR();
        const br = safeBaseR() * v.visScale;
        const dx = x - bx, dy = y - by;
        if(dx*dx + dy*dy <= (br*1.15)*(br*1.15)){
          if(br > bestR){ bestR = br; best = b; }
        }
      }
      return best;
    }

    const pointer = { x:-9999, y:-9999, vx:0, vy:0, speed:0, inside:false, down:false, downT:0, dragDist:0, lastTap:0, taps:0 };
    const shocks = [];
    const sparks = [];
    const trails = [];
    const waves = [];
    const aura = { x:0, y:0, r:0, strength:0, targetStrength:0, targetR:0 };
    const charge = { active:false, value:0, x:0, y:0, radius:0 };

    let activeBall = null;
    let focusedBall = null;
    let hoveredBall = null;
    let prevHoveredBall = null;
    let hoverT = 0;
    let screenShake = 0;
    let lastFrame = performance.now();
    let globalFocus = 0;

    function localPos(e){
      const rect = canvas.getBoundingClientRect();
      return { x:(e.clientX-rect.left)*DPR, y:(e.clientY-rect.top)*DPR };
    }

    function pushRing(x, y, cfg){
      shocks.push(Object.assign({
        x, y, t0: performance.now(), delay: 0,
        duration: 1.9, maxR: safeBaseR()*1.35, ease: 2.4,
        width: 2.0, alpha: 0.8, glow: 0, color: 'bright'
      }, cfg || {}));
    }
    function pushSpark(x, y, cfg){
      cfg = cfg || {};
      const a = cfg.angle != null ? cfg.angle : Math.random()*Math.PI*2;
      const sp = (cfg.speed != null ? cfg.speed : (1.0 + Math.random()*3.0)) * DPR;
      sparks.push({
        x, y,
        vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
        t0: performance.now(),
        duration: cfg.duration || (1.1 + Math.random()*0.9),
        size: (cfg.size || (1.0 + Math.random()*1.8))*DPR,
        color: cfg.color || 'bright'
      });
    }

    function emitSphereWave(sourceBall, strength){
      if(!sourceBall || balls.indexOf(sourceBall) < 0) return;
      const BR = safeBaseR();
      const sx = BASE_CX + sourceBall.ox * BR;
      const sy = BASE_CY + sourceBall.oy * BR;
      waves.push({ x:sx, y:sy, t0:performance.now(), speed:BR*3.2, strength:strength, lifetime:2.6 });
    }

    function getBallPulse(ball, now){
      const BR = safeBaseR();
      const bx = BASE_CX + ball.ox * BR;
      const by = BASE_CY + ball.oy * BR;
      const ballRadius = BR * ball.scale;
      let total = 0;
      for(const w of waves){
        const age = (now - w.t0) / 1000;
        if(age < 0 || age > w.lifetime) continue;
        const dx = bx - w.x, dy = by - w.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const waveRadius = age * w.speed;
        const gap = Math.abs(dist - waveRadius);
        const width = BR * 0.55 + ballRadius * 0.9;
        if(gap > width) continue;
        const x = gap / width;
        const prox = Math.cos(x * Math.PI * 0.5);
        const att = 1 / Math.sqrt(1 + dist / BR);
        const temp = 1 / (1 + age * 1.2);
        total += prox * att * temp * w.strength;
      }
      return Math.min(1, total);
    }

    function purgeWaves(now){
      for(let i = waves.length - 1; i >= 0; i--){
        const age = (now - waves[i].t0) / 1000;
        if(age > waves[i].lifetime) waves.splice(i, 1);
      }
    }

    canvas.addEventListener('pointerdown', e=>{
      AudioFX.unlock();
      const p = localPos(e);
      const ball = findBall(p.x, p.y);
      pointer.x = p.x; pointer.y = p.y;
      pointer.vx = 0; pointer.vy = 0;
      pointer.dragDist = 0;
      pointer.down = true;
      pointer.downT = performance.now();
      pointer.inside = !!ball;
      activeBall = ball;
      if(!ball) return;
      charge.active = true; charge.value = 0;
      charge.x = p.x; charge.y = p.y;
      charge.radius = safeBaseR() * ball.scale;
      aura.x = p.x; aura.y = p.y;
      aura.targetR = safeBaseR() * ball.scale * 0.48;
      aura.targetStrength = 1.3;
      pushRing(p.x, p.y, { duration: 1.3, maxR: safeBaseR()*ball.scale*0.45, width: 1.3, alpha: 0.4, ease: 2.0 });
      AudioFX.startCharge();
      HapticFX.vibrate(15);
      try { canvas.setPointerCapture(e.pointerId); } catch(err){}
    });

    canvas.addEventListener('pointermove', e=>{
      const p = localPos(e);
      const dx = p.x - pointer.x, dy = p.y - pointer.y;
      pointer.vx = dx; pointer.vy = dy;
      pointer.speed = Math.sqrt(dx*dx + dy*dy);
      pointer.x = p.x; pointer.y = p.y;
      const hoverBall = findBall(p.x, p.y);

      if(hoverBall !== prevHoveredBall){
        prevHoveredBall = hoverBall;
        if(hoverBall){
          AudioFX.hover();
          HapticFX.vibrate(10);
        }
      }
      hoveredBall = hoverBall;
      pointer.inside = !!hoverBall;
      canvas.style.cursor = pointer.inside ? 'pointer' : 'crosshair';
      if(pointer.inside){
        aura.x = p.x; aura.y = p.y;
        const br = safeBaseR() * (hoverBall ? hoverBall.scale : 1);
        aura.targetR = br * (pointer.down ? 0.52 : 0.40);
        aura.targetStrength = pointer.down ? 1.35 : 1.0;
      } else if(!pointer.down){
        aura.targetStrength = 0;
      }
      if(pointer.down){
        pointer.dragDist += pointer.speed;
        if(charge.active && pointer.dragDist > 12*DPR){
          charge.active = false;
          HapticFX.vibrate(0);
        }
        if(charge.active){ charge.x = p.x; charge.y = p.y; }
        if(activeBall){
          activeBall.yawOffset += pointer.vx * 0.0035;
          activeBall.tiltOffset = Math.max(-1.0, Math.min(1.0, activeBall.tiltOffset + pointer.vy * 0.0026));
        }
        if(pointer.speed > 1.5*DPR && trails.length < 52){
          trails.push({x:p.x,y:p.y,t0:performance.now(),duration:0.85,size:(2+Math.min(5,pointer.speed/(2*DPR)))*DPR});
        }
        if(pointer.speed > 4*DPR && !charge.active) AudioFX.drag();
        if(pointer.speed > 6*DPR){
          const n = Math.min(3, Math.floor(pointer.speed/(6*DPR)));
          for(let i=0;i<n;i++){
            pushSpark(p.x, p.y, {
              angle: Math.atan2(-pointer.vy, -pointer.vx) + (Math.random()-0.5)*1.6,
              speed: 0.6 + Math.random()*2.2,
              duration: 0.7 + Math.random()*0.5,
              size: 0.8 + Math.random()*1.4
            });
          }
        }
      } else if(pointer.inside && pointer.speed > 9*DPR && Math.random() < 0.4){
        pushSpark(p.x, p.y, {
          angle: Math.atan2(-pointer.vy, -pointer.vx) + (Math.random()-0.5)*1.2,
          speed: 0.4 + Math.random()*1.2,
          duration: 0.6 + Math.random()*0.4,
          size: 0.7 + Math.random()*1.1
        });
      }
    });

    canvas.addEventListener('pointerup', e=>{
      const p = localPos(e);
      const now = performance.now();
      const wasDown = pointer.down;
      pointer.down = false;
      aura.targetR = safeBaseR()*0.40;
      aura.targetStrength = pointer.inside ? 1.0 : 0;
      try { canvas.releasePointerCapture(e.pointerId); } catch(err){}
      if(!wasDown) return;
      AudioFX.stopCharge();
      if(!activeBall){
        charge.active = false; charge.value = 0;
        if(hasSplit && focusedBall){
          focusedBall = null;
          AudioFX.unfocus();
          HapticFX.vibrate(15);
        }
        return;
      }
      const cx = charge.x, cy = charge.y;
      const charging = charge.active;
      const chargeVal = charge.value;
      charge.active = false; charge.value = 0;

      if(pointer.dragDist > 16*DPR){
        pushRing(cx, cy, { duration: 1.3, maxR: R*0.6, width: 1.2, alpha: 0.38 });
        emitSphereWave(activeBall, 0.45);
        activeBall = null; return;
      }

      if(charging && chargeVal >= CHARGE_FULL){
        const releaseShakeAmp = chargeVal * chargeVal * 26 * DPR;
        AudioFX.superRelease();
        HapticFX.vibrate([100, 50, 200]);
        (function fireSuper(x, y, power, sourceBall){
          const BR = safeBaseR();
          const k = 0.62 + power*0.38;
          const br = R;
          for(let i=0;i<6;i++){
            pushRing(x, y, {
              delay: i*0.11, duration: 2.8 - i*0.13,
              maxR: Math.max(br*(2.35 - i*0.20)*k, BR*(2.12 - i*0.10)),
              width: 4.0 - i*0.5, alpha: 1.0 - i*0.13,
              ease: 2.0 + i*0.34,
              color: i%2===0 ? 'bright' : 'base', glow: 1.6
            });
          }
          emitSphereWave(sourceBall, 1.0);
          if(!hasSplit) screenShake = Math.max(screenShake, 0.85);
          for(let i=0;i<64;i++){ pushSpark(x, y, { speed: 2.4 + Math.random()*6.5, duration: 1.2 + Math.random()*1.2, size: 1.2 + Math.random()*2.4 }); }
        })(cx, cy, chargeVal, activeBall);
        if(!hasSplit){ hasSplit = true; splitSpheres(releaseShakeAmp); }
        activeBall = null; return;
      }

      if(hasSplit){
        if(focusedBall === activeBall){
          focusedBall = null;
          AudioFX.unfocus();
          HapticFX.vibrate(15);
        } else {
          focusedBall = activeBall;
          activeBall.focusPing = 0.55;
          AudioFX.focus();
          HapticFX.vibrate([20, 30, 20]);
          const BR = safeBaseR();
          const bx = BASE_CX + activeBall.ox * BR;
          const by = BASE_CY + activeBall.oy * BR;
          const br = BR * activeBall.scale;
          pushRing(bx, by, { duration: 1.15, maxR: br*1.35, width: 1.5, alpha: 0.38, glow: 0.25, ease: 2.4 });
          for(let i=0;i<4;i++){
            pushSpark(bx, by, { speed: 0.45 + Math.random()*1.1, duration: 0.65 + Math.random()*0.4, size: 0.7 + Math.random()*0.9 });
          }
        }
        activeBall = null; return;
      }

      if(now - pointer.lastTap < 340 && pointer.taps >= 1){
        pointer.taps = 0;
        AudioFX.burst();
        HapticFX.vibrate([30, 20, 30]);
        (function fireBurst(x, y, sourceBall){
          const BR = safeBaseR();
          const br = R;
          for(let i=0;i<4;i++){
            pushRing(x, y, {
              delay: i*0.09, duration: 2.1 - i*0.16,
              maxR: Math.max(br*(1.75 - i*0.16), BR*(1.92 - i*0.08)),
              width: 2.6 - i*0.4, alpha: 0.9 - i*0.16,
              ease: 2.2 + i*0.3,
              color: i%2===0 ? 'bright' : 'base', glow: 1.2
            });
          }
          emitSphereWave(sourceBall, 0.95);
          screenShake = Math.max(screenShake, 0.35);
          for(let i=0;i<28;i++){ pushSpark(x, y, { speed: 1.6 + Math.random()*4.5, duration: 1.0 + Math.random()*0.9, size: 1.0 + Math.random()*2.0 }); }
        })(cx, cy, activeBall);
      } else {
        pointer.taps = 1;
        AudioFX.ripple();
        HapticFX.vibrate(18);
        (function fireRipple(x, y, sourceBall){
          const BR = safeBaseR();
          pushRing(x, y, { duration: 2.5, maxR: Math.max(R*1.45, BR*1.95), width: 2.2, alpha: 0.85, glow: 1.0, ease: 2.6 });
          pushRing(x, y, { delay: 0.14, duration: 2.2, maxR: Math.max(R*1.20, BR*1.68), width: 1.3, alpha: 0.45, color:'base', ease: 2.4 });
          emitSphereWave(sourceBall, 0.80);
          for(let i=0;i<9;i++){ pushSpark(x, y, { speed: 0.8 + Math.random()*1.8, duration: 0.9 + Math.random()*0.6, size: 0.9 + Math.random()*1.2 }); }
        })(cx, cy, activeBall);
      }
      pointer.lastTap = now;
      activeBall = null;
    });

    canvas.addEventListener('pointercancel', ()=>{
      pointer.down = false;
      charge.active = false;
      charge.value = 0;
      aura.targetStrength = 0;
      activeBall = null;
      AudioFX.stopCharge();
      HapticFX.vibrate(0);
    });

    /* ---------- 绘制基础函数 ---------- */
    function drawSphereFill(){
      const lx = CX - R*0.28, ly = CY - R*0.28;
      const grad = ctx.createRadialGradient(lx,ly,0,lx,ly,R*1.55);
      grad.addColorStop(0.00, 'rgba('+CR+','+CG+','+CB+',0.10)');
      grad.addColorStop(0.55, 'rgba('+CR+','+CG+','+CB+',0.05)');
      grad.addColorStop(1.00, 'rgba('+CR+','+CG+','+CB+',0.02)');
      ctx.save();
      ctx.beginPath(); ctx.arc(CX,CY,R,0,Math.PI*2); ctx.clip();
      ctx.fillStyle = grad; ctx.fillRect(CX-R, CY-R, R*2, R*2);
      ctx.restore();
    }

    function drawOutline(){
      ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+',0.55)';
      ctx.lineWidth = 1.3*DPR;
      ctx.beginPath(); ctx.arc(CX,CY,R,0,Math.PI*2); ctx.stroke();
      if(pulse > 0.05){
        ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+(pulse*0.9).toFixed(3)+')';
        ctx.lineWidth = (1.2 + pulse*2.0) * DPR;
        ctx.beginPath(); ctx.arc(CX,CY,R - 0.5*DPR,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+(pulse*0.35).toFixed(3)+')';
        ctx.lineWidth = (3 + pulse*6) * DPR;
        ctx.beginPath(); ctx.arc(CX,CY,R,0,Math.PI*2); ctx.stroke();
      }
    }

    function drawPulseRings(t){
      if(pulse < 0.15) return;
      for(let i=0;i<3;i++){
        const phase = (t*0.11 + i*0.33) % 1;
        if(phase > 0.95) continue;
        const radius = R*phase;
        const fade = Math.pow(1-phase, 1.8) * pulse;
        const alpha = fade * 0.8;
        if(alpha < 0.03) continue;
        ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+alpha.toFixed(3)+')';
        ctx.lineWidth = (0.9 + fade*2.6)*DPR;
        ctx.beginPath(); ctx.arc(CX,CY,radius,0,Math.PI*2); ctx.stroke();
      }
    }

    function drawShocks(now){
      for(let i = shocks.length - 1; i >= 0; i--){
        const s = shocks[i];
        const age = (now - s.t0)/1000 - s.delay;
        if(age < 0) continue;
        if(age > s.duration){ shocks.splice(i,1); continue; }
        const prog = age / s.duration;
        const fade = Math.pow(1 - prog, 1.7);
        const ease = 1 - Math.pow(1 - prog, s.ease);
        const radius = s.maxR * ease;
        const col = s.color === 'base' ? [CR,CG,CB] : [PR,PG,PB];
        const rgb = col[0]+','+col[1]+','+col[2];
        if(s.glow > 0){
          ctx.strokeStyle = 'rgba('+rgb+','+(fade*s.alpha*0.26*s.glow).toFixed(3)+')';
          ctx.lineWidth = (s.width + fade*9*s.glow)*DPR;
          ctx.beginPath(); ctx.arc(s.x, s.y, radius, 0, Math.PI*2); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba('+rgb+','+(fade*s.alpha).toFixed(3)+')';
        ctx.lineWidth = s.width*(0.4 + fade*0.9)*DPR;
        ctx.beginPath(); ctx.arc(s.x, s.y, radius, 0, Math.PI*2); ctx.stroke();
        if(prog < 0.3 && s.glow > 0.5){
          const BR = safeBaseR();
          const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, BR*0.32);
          const ga = (1 - prog/0.3) * 0.34 * s.alpha;
          gr.addColorStop(0, 'rgba('+rgb+','+ga.toFixed(3)+')');
          gr.addColorStop(1, 'rgba('+rgb+',0)');
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(s.x, s.y, BR*0.32, 0, Math.PI*2); ctx.fill();
        }
      }
    }

    function drawSparks(now, dt){
      const k60 = dt*60;
      for(let i = sparks.length - 1; i >= 0; i--){
        const sp = sparks[i];
        const age = (now - sp.t0)/1000;
        if(age > sp.duration){ sparks.splice(i,1); continue; }
        const k = 1 - age/sp.duration;
        sp.x += sp.vx * k60;
        sp.y += sp.vy * k60;
        const damp = Math.pow(0.955, k60);
        sp.vx *= damp; sp.vy *= damp;
        const col = sp.color === 'base' ? [CR,CG,CB] : [PR,PG,PB];
        const rgb = col[0]+','+col[1]+','+col[2];
        const tx = sp.x - sp.vx*3.2, ty = sp.y - sp.vy*3.2;
        ctx.strokeStyle = 'rgba('+rgb+','+(k*0.8).toFixed(3)+')';
        ctx.lineWidth = Math.max(0.4, sp.size*k);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(sp.x, sp.y); ctx.stroke();
        ctx.fillStyle = 'rgba('+rgb+','+(k*0.95).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(0.3, sp.size*k*0.85), 0, Math.PI*2); ctx.fill();
      }
    }

    function drawTrails(now){
      for(let i = trails.length - 1; i >= 0; i--){
        const tr = trails[i];
        const age = (now - tr.t0)/1000;
        if(age > tr.duration){ trails.splice(i,1); continue; }
        const k = 1 - age/tr.duration;
        const r = tr.size * (0.5 + k*0.9);
        ctx.fillStyle = 'rgba('+CR+','+CG+','+CB+','+(k*0.22).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(tr.x, tr.y, r, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba('+PR+','+PG+','+PB+','+(k*0.40).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(tr.x, tr.y, r*0.42, 0, Math.PI*2); ctx.fill();
      }
    }

    function drawAura(t){
      if(aura.strength < 0.02) return;
      const r = aura.r * (1 + Math.sin(t*0.9)*0.05);
      const g = ctx.createRadialGradient(aura.x, aura.y, 0, aura.x, aura.y, r);
      g.addColorStop(0, 'rgba('+PR+','+PG+','+PB+',0)');
      g.addColorStop(0.62, 'rgba('+CR+','+CG+','+CB+','+(0.05*aura.strength).toFixed(3)+')');
      g.addColorStop(0.90, 'rgba('+PR+','+PG+','+PB+','+(0.13*aura.strength).toFixed(3)+')');
      g.addColorStop(1, 'rgba('+PR+','+PG+','+PB+',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(aura.x, aura.y, r, 0, Math.PI*2); ctx.fill();
      ctx.save();
      ctx.translate(aura.x, aura.y);
      ctx.rotate(t*0.32);
      ctx.setLineDash([5*DPR, 9*DPR]);
      ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+(0.26*aura.strength).toFixed(3)+')';
      ctx.lineWidth = 1.0*DPR;
      ctx.beginPath(); ctx.arc(0, 0, r*0.82, 0, Math.PI*2); ctx.stroke();
      ctx.rotate(-t*0.78);
      ctx.setLineDash([2*DPR, 7*DPR]);
      ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+(0.38*aura.strength).toFixed(3)+')';
      ctx.beginPath(); ctx.arc(0, 0, r*0.62, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    function drawCharge(t){
      if(!charge.active || charge.value <= 0.001) return;
      const v = charge.value;
      const baseR = charge.radius || safeBaseR() * 0.4;
      const r = baseR * (0.14 + 0.06*v) + Math.sin(t*5)*2*DPR;
      const isFull = v >= CHARGE_FULL;
      const fullPulse = isFull ? (0.65 + 0.35 * Math.sin(t * 14)) : 1;
      ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+',0.30)';
      ctx.lineWidth = 2.0*DPR;
      ctx.beginPath(); ctx.arc(charge.x, charge.y, r, 0, Math.PI*2); ctx.stroke();
      if(isFull){
        ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+(0.35 * fullPulse).toFixed(3)+')';
        ctx.lineWidth = (7 + fullPulse * 4) * DPR;
        ctx.beginPath(); ctx.arc(charge.x, charge.y, r, 0, Math.PI*2); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+(isFull ? fullPulse : 0.95).toFixed(3)+')';
      ctx.lineWidth = (isFull ? 3.4 : 2.6)*DPR;
      ctx.beginPath();
      ctx.arc(charge.x, charge.y, r, -Math.PI/2, -Math.PI/2 + v*Math.PI*2);
      ctx.stroke();
      const g = ctx.createRadialGradient(charge.x, charge.y, 0, charge.x, charge.y, r);
      g.addColorStop(0, 'rgba('+PR+','+PG+','+PB+','+((isFull ? 0.48 * fullPulse : 0.32*v)).toFixed(3)+')');
      g.addColorStop(1, 'rgba('+PR+','+PG+','+PB+',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(charge.x, charge.y, r, 0, Math.PI*2); ctx.fill();
      if(isFull){
        const dotR = 3.2 * DPR * fullPulse;
        ctx.fillStyle = 'rgba('+PR+','+PG+','+PB+','+fullPulse.toFixed(3)+')';
        ctx.beginPath(); ctx.arc(charge.x, charge.y, dotR, 0, Math.PI*2); ctx.fill();
      }
    }

    function drawSegments(proj, front){
      let drawing = false;
      ctx.beginPath();
      for(let i=0;i<proj.length;i++){
        const p = proj[i];
        const visible = front ? (p.z >= 0) : (p.z < 0);
        if(visible){ if(!drawing){ctx.moveTo(p.x,p.y); drawing = true;} else ctx.lineTo(p.x,p.y); }
        else { if(drawing){ctx.stroke(); ctx.beginPath(); drawing = false;} }
      }
      if(drawing) ctx.stroke();
    }

    function drawInnerBands(t){
      for(const band of innerBands){
        const phi = band.lat*Math.PI/180;
        const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
        const N = 120;
        const proj = [];
        for(let i=0;i<=N;i++){
          const theta = i/N*Math.PI*2;
          proj.push(project(cosPhi*Math.cos(theta), sinPhi, cosPhi*Math.sin(theta)));
        }
        for(let i=0;i<proj.length-1;i++){
          const a = proj[i], b = proj[i+1];
          if(a.z<0 || b.z<0) continue;
          const depth = (a.z+1)/2;
          const baseAlpha = band.alpha*(0.5+depth*0.5);
          ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+baseAlpha.toFixed(3)+')';
          ctx.lineWidth = band.width*DPR*0.55;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
        if(pulse > 0.05){
          const localBoost = 0.6 + 0.4*Math.sin(t*0.5 + band.phase);
          const edgeAlpha = band.alpha * pulse * localBoost * 2.2;
          if(edgeAlpha > 0.03){
            ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+Math.min(1,edgeAlpha).toFixed(3)+')';
            ctx.lineWidth = band.width*DPR*1.0;
            for(let i=0;i<proj.length-1;i++){
              const a = proj[i], b = proj[i+1];
              if(a.z<0 || b.z<0) continue;
              ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
            }
          }
        }
      }
    }

    function drawLatitudes(){
      for(const phi of latPhis){
        const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
        const N = 90;
        const pts = [];
        for(let i=0;i<=N;i++){
          const theta = i/N*Math.PI*2;
          pts.push({x:cosPhi*Math.cos(theta), y:sinPhi, z:cosPhi*Math.sin(theta)});
        }
        const proj = pts.map(p=>project(p.x,p.y,p.z));
        ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+',0.14)';
        ctx.lineWidth = 0.6*DPR;
        drawSegments(proj, false);
        ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+',0.38)';
        ctx.lineWidth = 0.9*DPR;
        drawSegments(proj, true);
        if(pulse > 0.05){
          ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+(pulse*0.75).toFixed(3)+')';
          ctx.lineWidth = 1.5*DPR;
          drawSegments(proj, true);
        }
      }
    }

    function drawLongitudes(){
      for(const theta of lonThetas){
        const cosT = Math.cos(theta), sinT = Math.sin(theta);
        const N = 70;
        const pts = [];
        for(let i=0;i<=N;i++){
          const phi = -Math.PI/2 + i/N*Math.PI;
          const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
          pts.push({x:cosPhi*cosT, y:sinPhi, z:cosPhi*sinT});
        }
        const proj = pts.map(p=>project(p.x,p.y,p.z));
        ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+',0.10)';
        ctx.lineWidth = 0.55*DPR;
        drawSegments(proj, false);
        ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+',0.30)';
        ctx.lineWidth = 0.85*DPR;
        drawSegments(proj, true);
        if(pulse > 0.05){
          ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+(pulse*0.65).toFixed(3)+')';
          ctx.lineWidth = 1.4*DPR;
          drawSegments(proj, true);
        }
      }
    }

    function drawNodeNetwork(t){
      for(const link of nodeLinks){
        const a = nodes[link.a], b = nodes[link.b];
        const pa = project(Math.cos(a.phi)*Math.cos(a.theta), Math.sin(a.phi), Math.cos(a.phi)*Math.sin(a.theta));
        const pb = project(Math.cos(b.phi)*Math.cos(b.theta), Math.sin(b.phi), Math.cos(b.phi)*Math.sin(b.theta));
        if(pa.z < -0.15 && pb.z < -0.15) continue;
        const depth = ((pa.z+pb.z)/2 + 1)/2;
        const baseAlpha = (0.25+depth*0.6)*0.7;
        ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+baseAlpha.toFixed(3)+')';
        ctx.lineWidth = (0.5+depth*0.5)*DPR;
        ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke();
        const localBoost = 0.5 + 0.5*Math.sin(t*0.75 + link.phase);
        const edgeAlpha = pulse * localBoost * (0.3+depth*0.7);
        if(edgeAlpha > 0.05){
          ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+edgeAlpha.toFixed(3)+')';
          ctx.lineWidth = 0.8*DPR;
          ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke();
        }
      }
    }

    function drawCircuits(t){
      for(const c of circuits){
        const proj = c.pts.map(p=>project(p.x,p.y,p.z));
        for(let i=0;i<proj.length-1;i++){
          const a = proj[i], b = proj[i+1];
          const avgZ = (a.z+b.z)/2;
          if(avgZ < -0.05) continue;
          const depth = (avgZ+1)/2;
          const alpha = (0.18 + depth*0.4);
          ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+alpha.toFixed(3)+')';
          ctx.lineWidth = (0.6+depth*0.7)*DPR;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
        const localBoost = 0.5 + 0.5*Math.sin(t*c.speed*0.6 + c.phase);
        const edgeAlpha = pulse * localBoost * 0.9;
        if(edgeAlpha > 0.05){
          ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+edgeAlpha.toFixed(3)+')';
          ctx.lineWidth = 0.8*DPR;
          for(let i=0;i<proj.length-1;i++){
            const a = proj[i], b = proj[i+1];
            const avgZ = (a.z+b.z)/2;
            if(avgZ < -0.05) continue;
            ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
          }
        }
        const last = proj[proj.length-1];
        if(last.z > 0){
          const depth = (last.z+1)/2;
          const glow = 0.55 + depth*0.45 + pulse*0.35;
          ctx.fillStyle = 'rgba('+PR+','+PG+','+PB+','+Math.min(1,glow).toFixed(3)+')';
          ctx.beginPath(); ctx.arc(last.x, last.y, (1.0 + depth*0.9 + pulse*0.8)*DPR, 0, Math.PI*2); ctx.fill();
        }
      }
    }

    function drawParticles(now, t){
      const auraOn = aura.strength > 0.02;
      const ar = aura.r * 1.25;
      const ar2 = ar*ar;
      const list = particles.map(p=>{
        const cp = Math.cos(p.phi);
        const x = cp*Math.cos(p.theta), y = Math.sin(p.phi), z = cp*Math.sin(p.theta);
        const pr = project(x,y,z);
        if(auraOn){
          const dx = pr.x - aura.x, dy = pr.y - aura.y;
          const d2 = dx*dx + dy*dy;
          if(d2 < ar2){
            const d = Math.sqrt(d2) || 1;
            const f = 1 - d/ar;
            const push = f*f * aura.strength * 20 * DPR;
            pr.x += dx/d*push;
            pr.y += dy/d*push;
          }
        }
        return {p, pr};
      });
      list.sort((a,b)=>a.pr.z - b.pr.z);
      for(const item of list){
        const p = item.p, pr = item.pr;
        const depth = (pr.z+1)/2;
        const twinkle = 0.7 + 0.3*Math.sin(now*0.0016*p.speed + p.twinkle);
        if(pr.z < -0.02){
          const baseAlpha = (0.10 + depth*0.15)*twinkle;
          ctx.fillStyle = p.white ? 'rgba('+PR+','+PG+','+PB+','+baseAlpha.toFixed(3)+')' : 'rgba('+CR+','+CG+','+CB+','+baseAlpha.toFixed(3)+')';
          ctx.beginPath(); ctx.arc(pr.x, pr.y, Math.max(0.5, p.size*pr.s*DPR*0.55), 0, Math.PI*2); ctx.fill();
          continue;
        }
        const baseAlpha = (0.55 + depth*0.45)*twinkle;
        const size = Math.max(0.6, p.size*pr.s*DPR*0.95);
        ctx.fillStyle = p.white ? 'rgba('+PR+','+PG+','+PB+','+baseAlpha.toFixed(3)+')' : 'rgba('+CR+','+CG+','+CB+','+baseAlpha.toFixed(3)+')';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, size, 0, Math.PI*2); ctx.fill();
        const localPulse = 0.5 + 0.5*Math.sin(t*0.85 + p.edgePhase);
        const hp = pulse * localPulse;
        if(hp > 0.08){
          ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+(hp * depth * 0.9).toFixed(3)+')';
          ctx.lineWidth = (0.9 + hp*0.9)*DPR;
          ctx.beginPath(); ctx.arc(pr.x, pr.y, size*(1.7 + hp*1.4), 0, Math.PI*2); ctx.stroke();
          ctx.fillStyle = 'rgba('+PR+','+PG+','+PB+','+(hp * depth * 0.95).toFixed(3)+')';
          ctx.beginPath(); ctx.arc(pr.x, pr.y, size*0.55, 0, Math.PI*2); ctx.fill();
        }
      }
    }

    function drawFlowParticles(now, t){
      for(const fp of flowParticles){
        fp.phi += fp.speed*fp.dir*0.008;
        if(fp.phi > Math.PI/2) fp.phi = -Math.PI/2;
        if(fp.phi < -Math.PI/2) fp.phi = Math.PI/2;
        const theta = lonThetas[fp.lon];
        const cosT = Math.cos(theta), sinT = Math.sin(theta);
        const cp = Math.cos(fp.phi), sp = Math.sin(fp.phi);
        const p = project(cp*cosT, sp, cp*sinT);
        if(p.z < -0.05) continue;
        const prevPhi = fp.phi - fp.tail*fp.dir;
        const pcp = Math.cos(prevPhi), psp = Math.sin(prevPhi);
        const pp = project(pcp*cosT, psp, pcp*sinT);
        const depth = (p.z+1)/2;
        const twinkle = 0.7 + 0.3*Math.sin(now*0.004 + fp.twinkle);
        const alpha = (0.55 + depth*0.4)*twinkle;
        const size = fp.size*p.s*DPR*1.1;
        if(pp.z > -0.05){
          ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+(alpha*0.65).toFixed(3)+')';
          ctx.lineWidth = size*0.6;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(pp.x,pp.y); ctx.lineTo(p.x,p.y); ctx.stroke();
        }
        ctx.fillStyle = 'rgba('+PR+','+PG+','+PB+','+alpha.toFixed(3)+')';
        ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI*2); ctx.fill();
        const hp = pulse * (0.7 + depth*0.3);
        if(hp > 0.08){
          ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+hp.toFixed(3)+')';
          ctx.lineWidth = (1.0 + hp*1.2)*DPR;
          ctx.beginPath(); ctx.arc(p.x, p.y, size*(2.0 + hp*1.8), 0, Math.PI*2); ctx.stroke();
        }
      }
    }

    function drawPulsePoints(t){
      for(const pp of pulsePoints){
        const theta = lonThetas[pp.lon], phi = latPhis[pp.lat];
        const cosT = Math.cos(theta), sinT = Math.sin(theta);
        const cp = Math.cos(phi), sp = Math.sin(phi);
        const proj = project(cp*cosT, sp, cp*sinT);
        if(proj.z < -0.05) continue;
        const localPhase = (t*pp.speed*0.42 + pp.phase) % 1;
        if(localPhase > 0.75) continue;
        const intensity = Math.sin(localPhase/0.75*Math.PI);
        const depth = (proj.z+1)/2;
        const alpha = intensity * pulse * (0.5 + depth*0.5);
        if(alpha < 0.05) continue;
        const size = pp.size*proj.s*DPR*(0.6 + intensity*1.4);
        ctx.fillStyle = 'rgba('+PR+','+PG+','+PB+','+alpha.toFixed(3)+')';
        ctx.beginPath(); ctx.arc(proj.x, proj.y, size, 0, Math.PI*2); ctx.fill();
        const ringR = size*(2.5 + intensity*3.5);
        ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+(alpha*0.9).toFixed(3)+')';
        ctx.lineWidth = 1.0*DPR;
        ctx.beginPath(); ctx.arc(proj.x, proj.y, ringR, 0, Math.PI*2); ctx.stroke();
      }
    }

    function drawOrbitRings(now){
      for(const ring of rings){
        const N = 140;
        const cosT = Math.cos(ring.tilt), sinT = Math.sin(ring.tilt);
        const rr = ring.radius;
        const proj = [];
        for(let i=0;i<=N;i++){
          const t = i/N*Math.PI*2 + ring.phase;
          const x = Math.cos(t)*rr;
          const z0 = Math.sin(t)*rr;
          const y = -z0*sinT;
          const z = z0*cosT;
          proj.push(project(x,y,z));
        }
        ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+(0.14*ring.color).toFixed(3)+')';
        ctx.lineWidth = 1.0*DPR;
        drawSegments(proj, false);
        ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+(0.60*ring.color).toFixed(3)+')';
        ctx.lineWidth = 1.3*DPR;
        drawSegments(proj, true);
        const edgeAlpha = pulse * 0.85 * ring.color;
        if(edgeAlpha > 0.05){
          ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+edgeAlpha.toFixed(3)+')';
          ctx.lineWidth = 2.4*DPR;
          drawSegments(proj, true);
        }
      }
      for(const ball of ringBalls){
        const ring = rings[ball.ring];
        ball.angle += ball.speed*0.006;
        const t = ball.angle;
        const rr = ring.radius;
        const x = Math.cos(t)*rr;
        const z0 = Math.sin(t)*rr;
        const cosT = Math.cos(ring.tilt), sinT = Math.sin(ring.tilt);
        const y = -z0*sinT;
        const z = z0*cosT;
        const p = project(x,y,z);
        const depth = (p.z+1)/2;
        const size = ball.size*(0.7 + depth*0.8)*DPR;
        ctx.fillStyle = 'rgba('+CR+','+CG+','+CB+','+(0.85 + depth*0.15).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba('+PR+','+PG+','+PB+','+(0.75 + depth*0.25).toFixed(3)+')';
        ctx.beginPath(); ctx.arc(p.x, p.y, size*0.4, 0, Math.PI*2); ctx.fill();
        const hp = pulse * (0.5 + depth*0.5);
        if(hp > 0.08){
          ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+hp.toFixed(3)+')';
          ctx.lineWidth = 1.2*DPR;
          ctx.beginPath(); ctx.arc(p.x, p.y, size*(2.0 + pulse*1.8), 0, Math.PI*2); ctx.stroke();
        }
      }
    }

    function drawCoreOrbiters(){
      for(const o of coreOrbiters){
        o.angle += o.speed*0.011*o.dir;
        const r = o.orbitR*R;
        const cosA = Math.cos(o.angle), sinA = Math.sin(o.angle);
        const cosT = Math.cos(o.tilt), sinT = Math.sin(o.tilt);
        const x0 = cosA*r;
        const z0 = sinA*r;
        const x = CX + x0;
        const y = CY - z0*sinT;
        const z = z0*cosT;
        const depth = (z/Math.max(r,1) + 1)/2;
        const size = o.size*(0.7 + depth*0.8)*DPR;
        const alpha = 0.75 + depth*0.25;
        ctx.fillStyle = 'rgba('+PR+','+PG+','+PB+','+alpha.toFixed(3)+')';
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI*2); ctx.fill();
        const hp = pulse * (0.5 + depth*0.5);
        if(hp > 0.08){
          ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+hp.toFixed(3)+')';
          ctx.lineWidth = 1.0*DPR;
          ctx.beginPath(); ctx.arc(x, y, size*(2.2 + pulse*1.5), 0, Math.PI*2); ctx.stroke();
        }
      }
    }

    function drawCore(now){
      const kx = CX, ky = CY;
      ctx.fillStyle = 'rgba('+PR+','+PG+','+PB+',0.98)';
      ctx.beginPath(); ctx.arc(kx, ky, 3.5*DPR, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+',0.85)';
      ctx.lineWidth = 1.2*DPR;
      ctx.beginPath(); ctx.arc(kx, ky, 8*DPR, 0, Math.PI*2); ctx.stroke();
      if(pulse > 0.05){
        const r = (10 + pulse*7)*DPR;
        ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+(pulse*0.95).toFixed(3)+')';
        ctx.lineWidth = (1.5 + pulse*1.8)*DPR;
        ctx.beginPath(); ctx.arc(kx, ky, r, 0, Math.PI*2); ctx.stroke();
      }
      ctx.save();
      ctx.translate(kx, ky);
      const rot = now*0.00016;
      ctx.rotate(rot);
      ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+',0.85)';
      ctx.lineWidth = 1.2*DPR;
      ctx.beginPath(); ctx.ellipse(0, 0, R*0.09, R*0.032, 0, 0, Math.PI*2); ctx.stroke();
      if(pulse > 0.05){
        ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+(pulse*0.85).toFixed(3)+')';
        ctx.lineWidth = 2.0*DPR;
        ctx.beginPath(); ctx.ellipse(0, 0, R*0.09, R*0.032, 0, 0, Math.PI*2); ctx.stroke();
      }
      ctx.rotate(-rot*2.4);
      ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+',0.5)';
      ctx.lineWidth = 1.0*DPR;
      ctx.beginPath(); ctx.ellipse(0, 0, R*0.13, R*0.045, 0, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    function drawFocusRing(t, alpha, extraPing){
      if(alpha < 0.02) return;
      const ping = extraPing || 0;
      const hr = R * (1.18 + ping * 0.05);
      ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+(0.55 * alpha).toFixed(3)+')';
      ctx.lineWidth = (1.6 + ping * 0.9) * DPR;
      ctx.beginPath(); ctx.arc(CX, CY, hr, 0, Math.PI*2); ctx.stroke();
      if(ping > 0.01){
        ctx.strokeStyle = 'rgba('+PR+','+PG+','+PB+','+(ping * 0.5 * alpha).toFixed(3)+')';
        ctx.lineWidth = (2.0 + ping * 1.6) * DPR;
        ctx.beginPath(); ctx.arc(CX, CY, hr * (0.90 + ping * 0.06), 0, Math.PI*2); ctx.stroke();
      }
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(t * 0.42);
      ctx.setLineDash([9*DPR, 7*DPR]);
      ctx.lineDashOffset = -t * 24 * DPR;
      ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+(0.40 * alpha).toFixed(3)+')';
      ctx.lineWidth = 1.4 * DPR;
      ctx.beginPath(); ctx.arc(0, 0, hr * 1.09, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    function drawHoverRing(t, alpha){
      if(alpha < 0.02) return;
      const hr = R * 1.16;
      const pulseA = 0.55 + 0.45 * Math.sin(t * 4.2);
      ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+(0.75 * alpha * pulseA).toFixed(3)+')';
      ctx.lineWidth = 2.2 * DPR;
      ctx.beginPath(); ctx.arc(CX, CY, hr, 0, Math.PI*2); ctx.stroke();
      ctx.strokeStyle = 'rgba('+CR+','+CG+','+CB+','+(0.20 * alpha * pulseA).toFixed(3)+')';
      ctx.lineWidth = 9 * DPR;
      ctx.beginPath(); ctx.arc(CX, CY, hr, 0, Math.PI*2); ctx.stroke();
    }

    function drawBallLabel(ball, cx, cy, ballR, alpha, isFocused, focusAmt){
      if(!ball.name) return;
      const logicalR = ballR / DPR;
      const baseSize = isFocused
        ? Math.max(13, Math.min(22, logicalR * 0.16))
        : Math.max(11, Math.min(17, logicalR * 0.18));
      const fontSize = baseSize * DPR;
      const labelY = cy + ballR * 1.08 + 14 * DPR;
      ctx.save();
      ctx.font = '700 '+fontSize+'px -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const subFontSize = fontSize * 0.62;
      ctx.font = '700 '+subFontSize+'px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba('+PR+','+PG+','+PB+','+(0.55 * alpha).toFixed(3)+')';
      ctx.fillText(ball.short, cx, labelY);
      ctx.font = '700 '+fontSize+'px -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
      ctx.shadowColor = 'rgba('+CR+','+CG+','+CB+','+(0.65 * alpha).toFixed(3)+')';
      ctx.shadowBlur = (10 + focusAmt * 8) * DPR;
      ctx.fillStyle = 'rgba(255,255,255,'+(0.92 * alpha).toFixed(3)+')';
      ctx.fillText(ball.name, cx, labelY + subFontSize + 4 * DPR);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    let pulse = 0;
    const t0 = performance.now();

    function setDrawColor(rgb){
      CR = rgb[0]; CG = rgb[1]; CB = rgb[2];
      PR = Math.min(255, CR + 30);
      PG = Math.min(255, CG + 30);
      PB = Math.min(255, CB + 30);
    }

    function frame(now){
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame)/1000));
      lastFrame = now;
      const t = (now - t0)/1000;

      if(W === 0 || H === 0){
        resize();
        if(W === 0 || H === 0){ requestAnimationFrame(frame); return; }
      }
      if(!isFinite(BASE_R) || BASE_R < MIN_BASE_R) BASE_R = MIN_BASE_R;

      if(screenShake > 0) screenShake = Math.max(0, screenShake - dt*1.7);
      if(flash > 0) flash = Math.max(0, flash - dt*2.6);

      if(charge.active){
        charge.value = Math.min(1, charge.value + dt * CHARGE_RATE);
        aura.targetStrength = Math.max(aura.targetStrength, 0.6 + charge.value*0.9);
        aura.targetR = safeBaseR()*(0.45 + charge.value*0.18);
        AudioFX.updateCharge(charge.value);
        if(Math.floor(now / 100) !== Math.floor(lastFrame / 100)){
          HapticFX.vibrate(5);
        }
      }
      if(aura.targetR === 0) aura.targetR = safeBaseR()*0.4;
      aura.r += (aura.targetR - aura.r) * Math.min(1, dt*6);
      aura.strength += (aura.targetStrength - aura.strength) * Math.min(1, dt*5);

      updateBalls(now, dt);

      let gf = 0;
      for(const b of balls){ if(b.focusAmount > gf) gf = b.focusAmount; }
      globalFocus = gf;

      const hoverTarget = (hoveredBall && hasSplit) ? 1 : 0;
      hoverT += (hoverTarget - hoverT) * Math.min(1, dt*10);

      purgeWaves(now);

      ctx.clearRect(0, 0, W, H);

      const globalShake = hasSplit ? 0 : screenShake;
      const shakeX = globalShake > 0 ? (Math.random()-0.5)*globalShake*14*DPR : 0;
      const shakeY = globalShake > 0 ? (Math.random()-0.5)*globalShake*14*DPR : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);

      const drawOrder = balls.map((b, i) => ({b, i})).sort((a, c) => a.b.focusAmount - c.b.focusAmount);
      const BR = safeBaseR();

      for(let k = 0; k < drawOrder.length; k++){
        const ball = drawOrder[k].b;
        const idx = drawOrder[k].i;

        const ballColor = colorForBall(ball, idx);
        setDrawColor(ballColor);

        const vis = computeBallVisual(ball);
        CX = BASE_CX + vis.visOx * BR;
        CY = BASE_CY + vis.visOy * BR;
        R = BR * vis.visScale;
        if(!isFinite(CX) || !isFinite(CY) || !isFinite(R) || R <= 0.5) continue;

        currentYaw = YAW_BASE + t*0.075 + ball.yawPhase + ball.yawOffset;
        tiltCur = TILT_BASE + ball.tiltOffset + Math.sin(t*0.23 + ball.seed)*0.045;

        const localPulse = getBallPulse(ball, now);

        let ambientPulse = 0;
        if(!hasSplit){
          const breathRaw = (Math.sin(t * 0.40 + ball.breathSeed) + 1) / 2;
          ambientPulse = Math.pow(breathRaw, 3);
        }
        const chargePulse = (charge.active && activeBall === ball && !hasSplit) ? charge.value * 0.28 : 0;
        pulse = Math.min(1, ambientPulse + localPulse * 0.92 + chargePulse + ball.focusAmount * 0.18 + ball.focusPing * 0.20);

        let breathY = 0, breathS = 1;
        if(!hasSplit){
          breathY = Math.sin(t * 0.40 + ball.breathSeed) * 6 * DPR;
          breathS = 1 + Math.sin(t * 0.40 + ball.breathSeed) * 0.006 - localPulse*0.034;
        } else {
          breathS = 1 - localPulse*0.05 + ball.focusPing * 0.018;
        }

        let chargeShakeX = 0, chargeShakeY = 0;
        if(charge.active && activeBall === ball && !hasSplit){
          const shakeAmp = charge.value * charge.value * 26 * DPR;
          const sx1 = Math.sin(t*63 + ball.seed*1.7);
          const sy1 = Math.cos(t*71 + ball.seed*2.3);
          const sx2 = Math.sin(t*113 + ball.seed*3.1) * 0.5;
          const sy2 = Math.cos(t*127 + ball.seed*4.7) * 0.5;
          chargeShakeX = (sx1 + sx2) * shakeAmp;
          chargeShakeY = (sy1 + sy2) * shakeAmp;
        }

        if(ball.jitterAmp > 0.1){ ball.jitterAmp *= Math.exp(-dt * ball.jitterDecay); }
        else { ball.jitterAmp = 0; }
        let jitterX = 0, jitterY = 0;
        if(ball.jitterAmp > 0.1){
          jitterX = Math.sin(t*68 + ball.jitterPhaseX) * ball.jitterAmp;
          jitterY = Math.cos(t*76 + ball.jitterPhaseY) * ball.jitterAmp;
        }

        const effCx = CX + chargeShakeX + jitterX;
        const effCy = CY + breathY + chargeShakeY + jitterY;

        ctx.save();
        ctx.globalAlpha = vis.visAlpha;
        ctx.translate(effCx, effCy);
        ctx.scale(breathS, breathS);
        ctx.translate(-CX, -CY);

        drawSphereFill();
        drawPulseRings(t);
        drawInnerBands(t);
        drawLatitudes();
        drawLongitudes();
        drawNodeNetwork(t);
        drawCircuits(t);
        drawParticles(now, t);
        drawFlowParticles(now, t);
        drawPulsePoints(t);
        drawOrbitRings(now);
        drawCoreOrbiters();
        drawOutline();
        drawCore(now);

        if(ball.focusAmount > 0.02){
          drawFocusRing(t, ball.focusAmount * vis.visAlpha, ball.focusPing);
        }
        if(hasSplit && hoveredBall === ball && focusedBall !== ball && hoverT > 0.05){
          drawHoverRing(t, hoverT * vis.visAlpha);
        }
        ctx.restore();

        if(hasSplit && ball.name){
          const labelAlpha = ball.focusAmount > 0.5 ? 1 : Math.max(0.35, vis.visAlpha);
          drawBallLabel(ball, effCx, effCy, R * breathS, labelAlpha, ball.focusAmount > 0.5, ball.focusAmount);
        }
      }

      setDrawColor(globalColor);

      const globalRaw = (Math.sin(t * 0.40) + 1) / 2;
      pulse = 0.10 + Math.pow(globalRaw, 3) * 0.16;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawAura(t);
      drawTrails(now);
      drawShocks(now);
      drawSparks(now, dt);
      ctx.restore();

      drawCharge(t);

      if(flash > 0.01){
        ctx.fillStyle = 'rgba('+PR+','+PG+','+PB+','+(flash*0.32).toFixed(3)+')';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();

      requestAnimationFrame(frame);
    }

    function start(){
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', function(){ setTimeout(resize, 120); });
      if(typeof ResizeObserver !== 'undefined' && visualEl){
        try {
          const ro = new ResizeObserver(function(){ resize(); });
          ro.observe(visualEl);
        } catch(e){}
      }
      requestAnimationFrame(function(){
        resize();
        requestAnimationFrame(function(){
          resize();
          requestAnimationFrame(frame);
        });
      });
      setTimeout(resize, 50);
      setTimeout(resize, 200);
      setTimeout(resize, 500);
      setTimeout(resize, 1200);
    }
    start();

    /* ---------- 对外接口 ---------- */
    window.QuantumSphere = {
      resize: resize,
      isSplit: function(){ return hasSplit; },
      reset: function(){
        hasSplit = false;
        focusedBall = null;
        hoveredBall = null;
        prevHoveredBall = null;
        balls.length = 0;
        balls.push(makeBall({ox:0, oy:0, scale:1}));
        const hint = document.querySelector('.quantum-hint');
        if(hint) hint.style.display = '';
        AudioFX.stopCharge();
        HapticFX.vibrate(0);
      },
      setQuantumState: function(state){
        const c = QUANTUM_COLORS[state];
        if(!c) return false;
        globalState = state;
        applyGlobalColor(c);
        try { localStorage.setItem(STATE_STORAGE_KEY, state); } catch(e){}
        return true;
      },
      setDimensionStates: function(states){
        if(!states || typeof states !== 'object') return false;
        dimensionStates = {};
        DIM_IDS.forEach(id=>{
          const v = states[id];
          if(v && typeof v === 'string') dimensionStates[id] = { type: v };
          else if(v && v.type) dimensionStates[id] = { type: v.type };
        });
        try { localStorage.setItem(DIM_STATE_KEY, JSON.stringify(dimensionStates)); } catch(e){}
        return true;
      },
      getQuantumState: function(){
        try { return localStorage.getItem(STATE_STORAGE_KEY) || 'default'; } catch(e){ return 'default'; }
      },
      getDimensionStates: function(){
        return dimensionStates ? JSON.parse(JSON.stringify(dimensionStates)) : null;
      },
      clearQuantumState: function(){
        try { localStorage.removeItem(STATE_STORAGE_KEY); localStorage.removeItem(DIM_STATE_KEY); } catch(e){}
        globalState = 'default';
        dimensionStates = null;
        fallbackColor = palette[Math.floor(Math.random() * palette.length)];
        applyGlobalColor(fallbackColor);
      },
      sound: {
        isEnabled: function(){ return AudioFX.isEnabled(); },
        setEnabled: function(v){ AudioFX.setEnabled(v); },
        toggle: function(){ return AudioFX.toggle(); },
        debug: function(){ return AudioFX.debugState(); },
        reset: function(){
          try { localStorage.removeItem('qs_sound_enabled'); } catch(e){}
          AudioFX.setEnabled(true);
          AudioFX.unlock();
          const btn = document.getElementById('qSoundToggle');
          if(btn){ btn.textContent = '🔊'; btn.classList.remove('muted'); }
          return '音效已重置并开启';
        }
      },
      haptic: {
        isSupported: function(){ return HapticFX.isSupported(); },
        setEnabled: function(v){ HapticFX.setEnabled(v); },
        vibrate: function(pattern){ HapticFX.vibrate(pattern); }
      }
    };
    window.__qsphereResize = resize;
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();