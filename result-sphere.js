/* ============================================================
   QBTI Result Sphere —— 报告页四球展示
   - 视觉与主页分裂后的四个小球一致：球体经纬线、粒子、轨道环、内核
   - 颜色跟随当前四个维度的量子态颜色
   - 纯展示：无点击/拖拽/蓄力/音效/震动
   ============================================================ */
(function(){
  'use strict';

  const QUANTUM_COLORS = {
    good: [80, 220, 140],
    danger: [235, 65, 75],
    superposition: [90, 140, 245]
  };
  const FALLBACK = [
    [124, 92, 255],
    [255, 107, 157],
    [107, 203, 119],
    [255, 217, 61]
  ];
  const DIM_IDS = ['PO', 'II', 'LA', 'UR'];

  let canvas = null;
  let ctx = null;
  let stage = null;
  let W = 1, H = 1, DPR = 1;
  let last = 0, time = 0;
  let dimStates = null;
  let reduceMotion = false;
  let simple = false;

  const LAT_PHIS = [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75].map(d => d * Math.PI / 180);
  const LON_THETAS = Array.from({ length: 16 }, (_, i) => i / 16 * Math.PI * 2);
  const BANDS = [-60, -30, -5, 25, 55];

  const balls = [];
  for(let i = 0; i < 4; i++){
    const particles = [];
    for(let k = 0; k < 150; k++){
      const u = Math.random() * 2 - 1;
      particles.push({
        theta: Math.random() * Math.PI * 2,
        phi: Math.asin(u),
        size: 0.6 + Math.random() * 1.5,
        white: Math.random() < 0.18,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.4
      });
    }
    balls.push({
      phase: i * 1.75 + Math.random() * 0.4,
      yawPhase: Math.random() * 6.28,
      tiltOffset: (Math.random() - 0.5) * 0.10,
      breathSeed: Math.random() * 6.28,
      particles: particles
    });
  }

  /* 当前球体的投影参数 */
  let CX = 0, CY = 0, R = 40, YAW = 0, TILT = -0.42;
  let CR = 124, CG = 92, CB = 255;

  function setColor(c){
    CR = c[0]; CG = c[1]; CB = c[2];
  }
  function colorString(alpha){
    return 'rgba(' + CR + ',' + CG + ',' + CB + ',' + alpha + ')';
  }
  function project(x, y, z){
    const cy = Math.cos(YAW), sy = Math.sin(YAW);
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const ct = Math.cos(TILT), st = Math.sin(TILT);
    const y1 = y * ct - z1 * st, z2 = y * st + z1 * ct;
    const p = 3.2 / (3.2 - z2);
    return { x: CX + x1 * R * p, y: CY + y1 * R * p, z: z2, s: p };
  }
  function drawSegments(proj, front){
    let drawing = false;
    ctx.beginPath();
    for(let i = 0; i < proj.length; i++){
      const p = proj[i];
      const visible = front ? (p.z >= 0) : (p.z < 0);
      if(visible){
        if(!drawing){ ctx.moveTo(p.x, p.y); drawing = true; }
        else ctx.lineTo(p.x, p.y);
      } else if(drawing){
        ctx.stroke(); ctx.beginPath(); drawing = false;
      }
    }
    if(drawing) ctx.stroke();
  }

  function resize(){
    if(!stage) return;
    const rect = stage.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    W = Math.max(1, Math.floor(rect.width));
    H = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function colorFor(idx){
    if(dimStates){
      const raw = dimStates[DIM_IDS[idx]];
      const type = raw && (raw.type || raw);
      if(QUANTUM_COLORS[type]) return QUANTUM_COLORS[type];
    }
    return FALLBACK[idx];
  }

  function drawSphere(ball, idx){
    const color = colorFor(idx);
    setColor(color);

    const radius = Math.min(W * 0.075, H * 0.30);
    R = Math.max(12, radius * (0.94 + 0.06 * Math.sin(time * 0.8 + ball.breathSeed)));
    CX = W * (idx + 0.5) / 4;
    CY = H * 0.50 + Math.sin(time * 0.55 + ball.phase) * 3;
    YAW = time * 0.38 + ball.yawPhase;
    TILT = -0.42 + ball.tiltOffset + Math.sin(time * 0.23 + ball.phase) * 0.045;

    /* 球体柔光 */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(CX, CY, 0, CX, CY, R * 2.2);
    aura.addColorStop(0, colorString(0.10));
    aura.addColorStop(0.5, colorString(0.035));
    aura.addColorStop(1, colorString(0));
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(CX, CY, R * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    /* 球体填充 */
    const fill = ctx.createRadialGradient(
      CX - R * 0.28, CY - R * 0.28, 0,
      CX - R * 0.28, CY - R * 0.28, R * 1.55
    );
    fill.addColorStop(0, colorString(0.10));
    fill.addColorStop(0.55, colorString(0.05));
    fill.addColorStop(1, colorString(0.02));
    ctx.save();
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = fill;
    ctx.fillRect(CX - R, CY - R, R * 2, R * 2);
    ctx.restore();

    /* 内层能量带 */
    for(const lat of BANDS){
      const phi = lat * Math.PI / 180;
      const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
      const proj = [];
      for(let i = 0; i <= 96; i++){
        const theta = i / 96 * Math.PI * 2;
        proj.push(project(cosPhi * Math.cos(theta), sinPhi, cosPhi * Math.sin(theta)));
      }
      for(let i = 0; i < proj.length - 1; i++){
        const a = proj[i], b = proj[i + 1];
        if(a.z < 0 || b.z < 0) continue;
        const depth = (a.z + 1) / 2;
        ctx.strokeStyle = colorString((0.06 + depth * 0.10).toFixed(3));
        ctx.lineWidth = (0.8 + depth * 1.0) * DPR;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }

    /* 经纬线 */
    for(const phi of LAT_PHIS){
      const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
      const proj = [];
      for(let i = 0; i <= 80; i++){
        const theta = i / 80 * Math.PI * 2;
        proj.push(project(cosPhi * Math.cos(theta), sinPhi, cosPhi * Math.sin(theta)));
      }
      ctx.strokeStyle = colorString(0.08);
      ctx.lineWidth = 0.6 * DPR;
      drawSegments(proj, false);
      ctx.strokeStyle = colorString(0.28);
      ctx.lineWidth = 0.85 * DPR;
      drawSegments(proj, true);
    }
    for(const theta of LON_THETAS){
      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      const proj = [];
      for(let i = 0; i <= 64; i++){
        const phi = -Math.PI / 2 + i / 64 * Math.PI;
        const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
        proj.push(project(cosPhi * cosT, sinPhi, cosPhi * sinT));
      }
      ctx.strokeStyle = colorString(0.06);
      ctx.lineWidth = 0.55 * DPR;
      drawSegments(proj, false);
      ctx.strokeStyle = colorString(0.22);
      ctx.lineWidth = 0.8 * DPR;
      drawSegments(proj, true);
    }

    /* 表面粒子 */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for(const p of ball.particles){
      const twinkle = 0.55 + 0.45 * Math.sin(time * p.speed + p.phase);
      const cosPhi = Math.cos(p.phi);
      const x = cosPhi * Math.cos(p.theta);
      const y = Math.sin(p.phi);
      const z = cosPhi * Math.sin(p.theta);
      const pr = project(x, y, z);
      if(pr.z < -0.05) continue;
      const depth = (pr.z + 1) / 2;
      const alpha = (0.12 + depth * 0.65) * twinkle;
      ctx.fillStyle = p.white
        ? 'rgba(255,255,255,' + alpha.toFixed(3) + ')'
        : colorString(alpha.toFixed(3));
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, p.size * (0.7 + depth * 0.6) * DPR * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    /* 轨道环 */
    const rings = simple ? 2 : 3;
    for(let i = 0; i < rings; i++){
      const rr = R * (1.16 + i * 0.12);
      const rot = time * (0.18 + i * 0.05) + i * 1.7 + ball.phase;
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(rot);
      ctx.strokeStyle = colorString((0.10 - i * 0.02).toFixed(3));
      ctx.lineWidth = 0.9 * DPR;
      ctx.beginPath();
      ctx.ellipse(0, 0, rr, rr * (0.30 + i * 0.04), 0, 0, Math.PI * 2);
      ctx.stroke();
      const dotA = time * (0.5 + i * 0.2) + ball.phase;
      ctx.fillStyle = colorString(0.7);
      ctx.beginPath();
      ctx.arc(Math.cos(dotA) * rr, Math.sin(dotA) * rr * (0.30 + i * 0.04), 1.4 * DPR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* 内核 */
    const coreR = R * 0.16;
    const core = ctx.createRadialGradient(CX, CY, 0, CX, CY, coreR);
    core.addColorStop(0, 'rgba(255,255,255,0.95)');
    core.addColorStop(0.35, colorString(0.85));
    core.addColorStop(1, colorString(0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(CX, CY, coreR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    /* 外轮廓 */
    ctx.strokeStyle = colorString(0.55);
    ctx.lineWidth = 1.2 * DPR;
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.stroke();
  }

  function draw(){
    if(!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for(let i = 0; i < 4; i++) drawSphere(balls[i], i);
  }

  function frame(ts){
    if(!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;

    const screen = document.getElementById('screen-result');
    const active = screen && screen.classList.contains('active') && !document.hidden;
    if(!active){
      requestAnimationFrame(frame);
      return;
    }
    if(!reduceMotion) time += dt;

    const rect = stage.getBoundingClientRect();
    if(Math.abs(rect.width - W) > 1 || Math.abs(rect.height - H) > 1) resize();
    draw();
    requestAnimationFrame(frame);
  }

  function boot(){
    canvas = document.getElementById('resultQuantumCanvas');
    if(!canvas) return;
    stage = canvas.parentElement;
    if(!stage) return;
    ctx = canvas.getContext('2d');
    if(!ctx) return;

    reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    try {
      const s = JSON.parse(localStorage.getItem('qbti_settings_v1') || '{}');
      simple = s.effectsMode === 'simple';
    } catch(e){}
    if(window.QBTISettings && window.QBTISettings.onChange){
      window.QBTISettings.onChange(function(info){
        if(info.key !== 'effectsMode' && info.key !== 'reset') return;
        try {
          const s = JSON.parse(localStorage.getItem('qbti_settings_v1') || '{}');
          simple = s.effectsMode === 'simple';
        } catch(e){}
      });
    }

    resize();
    window.addEventListener('resize', resize);
    if(typeof ResizeObserver !== 'undefined'){
      try { new ResizeObserver(resize).observe(stage); } catch(e){}
    }
    requestAnimationFrame(frame);
  }

  window.ResultQuantumSphere = {
    setDimensionStates: function(states){
      dimStates = (states && typeof states === 'object') ? states : null;
    },
    resize: resize
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
