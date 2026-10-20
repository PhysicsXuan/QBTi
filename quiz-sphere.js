/* ============================================================
   QBTI Quiz Sphere —— 问卷页装饰性四球动画
   - 与主页四个小球同色系
   - 纯展示，无任何点击/拖拽/蓄力交互
   - 页面不可见时自动暂停绘制
   ============================================================ */
(function(){
  'use strict';

  function boot(){
    const screen = document.getElementById('screen-quiz');
    const canvas = document.getElementById('quizQuantumCanvas');
    if(!screen || !canvas) return;
    const stage = canvas.parentElement;
    if(!stage) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    const COLORS = [[124, 92, 255], [255, 107, 157], [107, 203, 119], [255, 217, 61]];
    let W = 1, H = 1, DPR = 1;
    let last = 0, time = 0;

    let simple = false;
    try {
      const s = JSON.parse(localStorage.getItem('qbti_settings_v1') || '{}');
      simple = s.effectsMode === 'simple';
    } catch(e){}
    const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const balls = COLORS.map((c, i) => ({
      c: c,
      phase: i * Math.PI / 2,
      speed: 0.12 + i * 0.018,
      size: 0.16 + i * 0.012
    }));

    const dots = Array.from({ length: simple ? 16 : 42 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.35 + Math.random() * 0.85,
      s: 0.08 + Math.random() * 0.18,
      o: 0.12 + Math.random() * 0.30
    }));

    function resize(){
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

    function draw(t){
      ctx.clearRect(0, 0, W, H);
      const cx = W * 0.50;
      const cy = H * 0.44;
      const base = Math.min(W, H) * 0.30;
      const tilt = Math.sin(t * 0.08) * 0.07;

      /* 中心柔光 */
      const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 0.85);
      centerGlow.addColorStop(0, 'rgba(160,150,255,0.075)');
      centerGlow.addColorStop(0.55, 'rgba(120,100,255,0.025)');
      centerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = centerGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, base * 0.85, 0, Math.PI * 2);
      ctx.fill();

      /* 轨道与星尘 */
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.strokeStyle = 'rgba(255,255,255,0.055)';
      ctx.lineWidth = 1;
      const ringCount = simple ? 2 : 3;
      for(let i = 0; i < ringCount; i++){
        const rr = base * (1.10 + i * 0.16);
        ctx.beginPath();
        ctx.ellipse(0, 0, rr, rr * (0.44 + i * 0.03), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for(const d of dots){
        const a = d.a + t * d.s;
        const rr = base * d.r;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr * 0.44;
        const alpha = d.o * (0.5 + 0.5 * Math.sin(t * 0.8 + d.a * 3));
        ctx.fillStyle = 'rgba(190,200,255,' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x, y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      /* 四个球的位置 */
      const pts = balls.map((b) => {
        const a = t * b.speed * 2 + b.phase;
        const rr = base * (1.05 + Math.sin(t * 0.35 + b.phase) * 0.06);
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.46 + Math.sin(t * 0.55 + b.phase) * base * 0.035;
        const size = base * b.size * (0.92 + 0.08 * Math.sin(t * 0.9 + b.phase));
        return { x: x, y: y, r: size, c: b.c };
      });

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      /* 球间连线 */
      for(let i = 0; i < pts.length; i++){
        for(let j = i + 1; j < pts.length; j++){
          const a = pts[i], b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const max = base * 1.9;
          if(d < max){
            const alpha = 0.07 * (1 - d / max);
            ctx.strokeStyle = 'rgba(180,190,255,' + alpha.toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      /* 球体 */
      for(const p of pts){
        const rgb = p.c.join(',');
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
        glow.addColorStop(0, 'rgba(' + rgb + ',0.50)');
        glow.addColorStop(0.4, 'rgba(' + rgb + ',0.16)');
        glow.addColorStop(1, 'rgba(' + rgb + ',0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fill();

        const core = ctx.createRadialGradient(
          p.x - p.r * 0.25, p.y - p.r * 0.25, p.r * 0.08,
          p.x, p.y, p.r
        );
        core.addColorStop(0, 'rgba(255,255,255,0.92)');
        core.addColorStop(0.3, 'rgba(' + rgb + ',0.92)');
        core.addColorStop(1, 'rgba(' + rgb + ',0.20)');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function frame(ts){
      if(!last) last = ts;
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      if(!reduceMotion) time += dt;

      const active = screen.classList.contains('active') && !document.hidden;
      if(!active){
        requestAnimationFrame(frame);
        return;
      }

      const rect = stage.getBoundingClientRect();
      if(Math.abs(rect.width - W) > 1 || Math.abs(rect.height - H) > 1) resize();
      draw(time);
      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    if(typeof ResizeObserver !== 'undefined'){
      try { new ResizeObserver(resize).observe(stage); } catch(e){}
    }
    if(window.QBTISettings && window.QBTISettings.onChange){
      window.QBTISettings.onChange(function(info){
        if(info.key !== 'effectsMode' && info.key !== 'reset') return;
        try {
          const s = JSON.parse(localStorage.getItem('qbti_settings_v1') || '{}');
          simple = s.effectsMode === 'simple';
        } catch(e){}
      });
    }
    requestAnimationFrame(frame);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
