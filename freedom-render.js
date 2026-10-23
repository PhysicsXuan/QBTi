(function(){
  'use strict';

  let raf = 0;
  let resizeObserver = null;
  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;
  let startedAt = 0;
  let running = false;

  const VW = 1000;
  const VH = 600;

  const stars = (() => {
    let seed = 20261022;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const arr = [];
    for(let i = 0; i < 150; i++){
      arr.push({
        x: rnd() * VW,
        y: rnd() * VH,
        r: 0.45 + rnd() * 1.5,
        a: 0.2 + rnd() * 0.75,
        p: rnd() * Math.PI * 2,
        s: 0.5 + rnd() * 1.8
      });
    }
    return arr;
  })();

  const rocks = (() => {
    let seed = 7319;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return seed / 4294967296;
    };
    const arr = [];
    for(let i = 0; i < 10; i++){
      const cx = 70 + rnd() * 860;
      const cy = 360 + rnd() * 250;
      const rr = 8 + rnd() * 28;
      const pts = [];
      const n = 7 + Math.floor(rnd() * 4);
      for(let j = 0; j < n; j++){
        const ang = j / n * Math.PI * 2;
        const d = rr * (0.65 + rnd() * 0.55);
        pts.push([cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.72]);
      }
      arr.push({ pts, cx, cy, rr, a: 0.15 + rnd() * 0.35, drift: 0.3 + rnd() * 0.8 });
    }
    return arr;
  })();

  function resize(){
    if(!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, rect.width);
    cssH = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
  }

  function lg(x0, y0, x1, y1, stops){
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(s => g.addColorStop(s[0], s[1]));
    return g;
  }

  function rg(x, y, r0, r1, stops){
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(s => g.addColorStop(s[0], s[1]));
    return g;
  }

  function poly(points, fill, stroke, lw, glow, glowColor){
    ctx.beginPath();
    points.forEach((p, i) => {
      if(i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    if(fill){ ctx.fillStyle = fill; ctx.fill(); }
    if(stroke){
      if(glow && glowColor){ ctx.shadowColor = glowColor; ctx.shadowBlur = glow; }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw || 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function line(x1, y1, x2, y2, stroke, lw, glow, glowColor){
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    if(glow && glowColor){ ctx.shadowColor = glowColor; ctx.shadowBlur = glow; }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw || 1;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function circle(x, y, r, fill, stroke, lw, glow, glowColor){
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if(fill){ ctx.fillStyle = fill; ctx.fill(); }
    if(stroke){
      if(glow && glowColor){ ctx.shadowColor = glowColor; ctx.shadowBlur = glow; }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw || 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawBackground(t){
    const bg = lg(0, 0, VW, VH, [[0, '#02040f'], [0.48, '#07132f'], [0.78, '#0e173a'], [1, '#180b2b']]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = rg(790, 180, 20, 380, [[0, 'rgba(68,128,255,.28)'], [0.5, 'rgba(54,76,210,.12)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = rg(230, 400, 10, 330, [[0, 'rgba(204,62,255,.15)'], [0.55, 'rgba(130,30,170,.06)'], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, VW, VH);

    stars.forEach(s => {
      const a = s.a * (0.55 + 0.45 * Math.sin(t * s.s + s.p));
      ctx.globalAlpha = Math.max(0.08, a);
      ctx.fillStyle = s.r > 1.3 ? '#d9f2ff' : '#9fc5ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    rocks.forEach((r, i) => {
      const yy = r.cy + Math.sin(t * 0.22 + i) * 5;
      ctx.globalAlpha = r.a;
      poly(r.pts.map(p => [p[0], p[1] - r.cy + yy]), lg(r.cx, yy - r.rr, r.cx, yy + r.rr, [[0, '#202941'], [0.6, '#101526'], [1, '#05070f']]), 'rgba(120,160,220,.22)', 1);
    });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(86,146,255,.12)';
    ctx.lineWidth = 1;
    for(let i = 0; i < 7; i++){
      ctx.beginPath();
      ctx.ellipse(635, 300, 190 + i * 48, 58 + i * 20, -0.18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawWing(side, t){
    const mirror = side === 'left';
    ctx.save();
    if(mirror){ ctx.translate(1240, 0); ctx.scale(-1, 1); }
    const sway = Math.sin(t * 0.55 + (mirror ? 1.8 : 0)) * 0.010;
    ctx.translate(620, 255);
    ctx.rotate(sway);
    ctx.translate(-620, -255);

    const blue = lg(620, 100, 980, 360, [[0, '#dceaff'], [0.25, '#6ba6ff'], [0.62, '#1b49d8'], [1, '#091b58']]);
    const blue2 = lg(640, 140, 990, 320, [[0, '#f5fbff'], [0.3, '#9cc8ff'], [0.7, '#255ccc'], [1, '#0a1c56']]);

    const blades = [
      { pts: [[640, 228], [735, 112], [930, 52], [995, 84], [906, 205], [792, 255]], fill: blue, edge: '#bce8ff' },
      { pts: [[645, 255], [790, 152], [970, 122], [1008, 160], [935, 260], [795, 306]], fill: blue2, edge: '#f2fbff' },
      { pts: [[650, 288], [776, 250], [958, 266], [986, 300], [900, 365], [762, 374]], fill: blue, edge: '#9fdcff' }
    ];

    blades.forEach((b, i) => {
      ctx.save();
      ctx.shadowColor = 'rgba(64,150,255,.35)';
      ctx.shadowBlur = 16;
      poly(b.pts, b.fill, 'rgba(122,206,255,.75)', 1.2);
      ctx.shadowBlur = 0;
      const top = b.pts[1], tip = b.pts[2];
      line(b.pts[0][0], b.pts[0][1], top[0], top[1], 'rgba(240,250,255,.9)', 1.4);
      line(top[0], top[1], tip[0], tip[1], b.edge, 1.8, 8, '#79ddff');
      line(b.pts[3][0], b.pts[3][1], b.pts[4][0], b.pts[4][1], 'rgba(255,213,122,.75)', 1.1);
      poly([[b.pts[2][0] - 15, b.pts[2][1] + 6], [b.pts[2][0] + 10, b.pts[2][1] - 2], [b.pts[2][0] + 2, b.pts[2][1] + 18]], '#e73b55', 'rgba(255,150,160,.75)', 0.8);
      ctx.restore();
    });

    // Wing frame / joints
    poly([[610, 235], [650, 220], [668, 287], [626, 306]], '#18284d', 'rgba(130,200,255,.55)', 1.1);
    circle(646, 260, 8, '#61e7ff', 'rgba(220,250,255,.8)', 1, 10, '#61e7ff');
    line(660, 290, 740, 355, 'rgba(255,211,107,.55)', 1);

    // small edge lights
    [0.25, 0.55, 0.82].forEach((p, i) => {
      const x = 780 + p * 190;
      const y = 185 + i * 40 + Math.sin(t * 2 + i) * 2;
      circle(x, y, 1.8, '#ffcf74', null, 0, 6, '#ffcf74');
    });

    ctx.restore();
  }

  function drawLeg(mirror, t){
    ctx.save();
    if(mirror){ ctx.translate(1240, 0); ctx.scale(-1, 1); }

    const armor = lg(520, 330, 650, 570, [[0, '#ffffff'], [0.3, '#dbeaff'], [0.62, '#8db5ff'], [1, '#244cc0']]);
    const blue = lg(530, 340, 630, 560, [[0, '#3a80ff'], [1, '#0d2c86']]);
    const dark = '#10162c';

    // thigh
    poly([[555, 342], [612, 348], [612, 418], [538, 412]], armor, 'rgba(210,238,255,.6)', 1.2);
    poly([[535, 362], [560, 358], [563, 414], [528, 408]], blue, 'rgba(140,210,255,.45)', 1);
    poly([[580, 360], [607, 364], [606, 410], [580, 406]], 'rgba(13,28,70,.75)', 'rgba(110,180,255,.35)', 1);
    line(574, 370, 580, 402, 'rgba(255,255,255,.55)', 0.8);

    // knee
    poly([[538, 414], [614, 418], [608, 452], [532, 448]], dark, 'rgba(160,210,255,.4)', 1);
    poly([[548, 416], [590, 419], [585, 445], [542, 441]], '#e54359', 'rgba(255,190,200,.65)', 1, 8, '#e54359');
    circle(568, 432, 5, '#ffd36b', null, 0, 6, '#ffd36b');

    // shin
    poly([[526, 448], [610, 453], [598, 548], [510, 540]], armor, 'rgba(205,238,255,.62)', 1.2);
    poly([[534, 467], [588, 472], [580, 537], [526, 531]], blue, 'rgba(150,215,255,.45)', 1);
    poly([[543, 481], [570, 484], [566, 527], [536, 523]], 'rgba(10,25,65,.72)', 'rgba(120,220,255,.3)', 0.9);
    line(590, 473, 596, 532, 'rgba(255,255,255,.6)', 0.85);
    poly([[516, 500], [529, 504], [526, 526], [513, 522]], '#e33b55', 'rgba(255,160,170,.55)', 0.8);
    line(524, 532, 592, 540, 'rgba(88,236,255,.75)', 1.6, 7, '#58ecff');

    // foot
    poly([[504, 540], [600, 548], [628, 574], [490, 566]], armor, 'rgba(215,240,255,.6)', 1.1);
    poly([[494, 563], [624, 572], [628, 582], [484, 575]], '#14234c', 'rgba(110,190,255,.45)', 1);
    poly([[510, 548], [550, 552], [546, 566], [500, 562]], blue, 'rgba(160,220,255,.4)', 0.8);
    line(512, 559, 606, 568, 'rgba(95,236,255,.8)', 1.2, 6, '#5fecff');

    ctx.restore();
  }

  function drawTorso(t){
    const armor = lg(535, 220, 710, 340, [[0, '#ffffff'], [0.42, '#e4f2ff'], [0.72, '#91b8ff'], [1, '#2c53c6']]);
    const armor2 = lg(560, 225, 690, 335, [[0, '#ffffff'], [0.55, '#cfe4ff'], [1, '#4f77e8']]);
    const blue = lg(590, 220, 660, 330, [[0, '#5a9cff'], [1, '#0b2a85']]);
    const dark = '#0b1228';

    // abdomen / underframe
    poly([[558, 315], [682, 315], [708, 352], [532, 352]], dark, 'rgba(120,190,255,.35)', 1.1);
    poly([[575, 305], [666, 305], [686, 340], [556, 340]], armor2, 'rgba(220,240,255,.55)', 1);

    // chest plates
    poly([[552, 250], [610, 233], [630, 306], [540, 324]], armor, 'rgba(225,245,255,.65)', 1.2);
    poly([[630, 233], [690, 250], [704, 324], [610, 306]], armor, 'rgba(225,245,255,.65)', 1.2);
    poly([[600, 226], [650, 226], [668, 312], [584, 312]], blue, 'rgba(140,220,255,.55)', 1.1);
    poly([[616, 250], [646, 250], [652, 300], [610, 300]], lg(610, 250, 650, 300, [[0, '#14265e'], [1, '#081532']]), 'rgba(120,220,255,.4)', 0.9);

    // collar / vents
    poly([[585, 236], [610, 226], [620, 248], [598, 258]], '#ffd36b', 'rgba(255,240,180,.65)', 0.9);
    poly([[650, 226], [675, 236], [662, 258], [632, 248]], '#ffd36b', 'rgba(255,240,180,.65)', 0.9);
    poly([[560, 266], [584, 260], [590, 286], [567, 292]], '#e33b55', 'rgba(255,160,170,.6)', 0.9);
    poly([[676, 260], [700, 266], [695, 292], [672, 286]], '#e33b55', 'rgba(255,160,170,.6)', 0.9);

    // central core
    circle(625, 286, 12, lg(610, 272, 640, 300, [[0, '#6ff2ff'], [0.5, '#1d7dff'], [1, '#0b1d5a']]), 'rgba(220,255,255,.9)', 1.2, 14, '#63eaff');
    line(625, 266, 625, 272, 'rgba(255,255,255,.8)', 1);

    // gold trim / panel lines
    line(556, 300, 607, 305, 'rgba(255,211,107,.55)', 1);
    line(643, 305, 693, 300, 'rgba(255,211,107,.55)', 1);
    line(584, 312, 600, 338, 'rgba(140,220,255,.4)', 0.9);
    line(668, 312, 652, 338, 'rgba(140,220,255,.4)', 0.9);

    // shoulder joints
    circle(540, 286, 18, '#111a33', 'rgba(130,200,255,.4)', 1);
    circle(710, 286, 18, '#111a33', 'rgba(130,200,255,.4)', 1);
  }

  function drawShoulder(mirror, t){
    ctx.save();
    if(mirror){ ctx.translate(1240, 0); ctx.scale(-1, 1); }
    const armor = lg(480, 215, 590, 330, [[0, '#ffffff'], [0.45, '#d8eaff'], [0.8, '#7fa9ff'], [1, '#294bb8']]);
    const blue = lg(490, 225, 575, 315, [[0, '#3c83ff'], [1, '#0d2c86']]);
    poly([[495, 230], [555, 212], [582, 245], [574, 316], [505, 326]], armor, 'rgba(225,245,255,.7)', 1.2);
    poly([[500, 232], [550, 218], [565, 246], [557, 288], [506, 295]], blue, 'rgba(150,220,255,.45)', 1);
    poly([[514, 245], [547, 236], [554, 262], [520, 270]], 'rgba(8,20,50,.65)', 'rgba(120,220,255,.35)', 0.9);
    line(510, 300, 569, 292, 'rgba(255,211,107,.62)', 1);
    circle(565, 300, 4, '#6ff2ff', null, 0, 7, '#6ff2ff');
    ctx.restore();
  }

  function drawShield(t){
    const armor = lg(385, 300, 520, 520, [[0, '#ffffff'], [0.4, '#d9eaff'], [0.75, '#83aaff'], [1, '#2948a8']]);
    const blue = lg(400, 315, 505, 500, [[0, '#3b7dff'], [1, '#0c2a7d']]);
    poly([[410, 300], [500, 306], [530, 360], [515, 490], [455, 528], [395, 492], [380, 360]], armor, 'rgba(220,245,255,.75)', 1.4);
    poly([[418, 318], [492, 322], [510, 366], [497, 472], [452, 505], [406, 470], [398, 366]], blue, 'rgba(150,220,255,.45)', 1);
    poly([[430, 335], [480, 338], [490, 370], [480, 445], [452, 468], [425, 444], [417, 372]], lg(420, 340, 485, 460, [[0, '#10204d'], [1, '#071128']]), 'rgba(110,210,255,.4)', 1);
    poly([[445, 365], [468, 366], [472, 408], [475, 445], [452, 460], [433, 440], [430, 408]], 'rgba(235,250,255,.82)', 'rgba(255,255,255,.8)', 0.8);
    poly([[455, 340], [465, 340], [465, 450], [455, 450]], 'rgba(255,211,107,.75)', null, 0);
    poly([[425, 390], [485, 390], [485, 400], [425, 400]], 'rgba(255,211,107,.72)', null, 0);
    circle(455, 380, 12, '#e33b55', 'rgba(255,180,180,.7)', 1, 10, '#e33b55');
    line(400, 355, 420, 470, 'rgba(120,235,255,.55)', 1);
  }

  function drawArm(mirror, t){
    ctx.save();
    if(mirror){ ctx.translate(1240, 0); ctx.scale(-1, 1); }
    const armor = lg(500, 290, 600, 430, [[0, '#ffffff'], [0.45, '#dcecff'], [0.82, '#83aaff'], [1, '#2948a8']]);
    const blue = lg(505, 300, 570, 415, [[0, '#3b7dff'], [1, '#0c2a7d']]);
    poly([[510, 300], [548, 300], [557, 365], [514, 376]], '#141d3c', 'rgba(130,200,255,.4)', 1);
    poly([[505, 358], [556, 368], [564, 430], [500, 420]], armor, 'rgba(220,245,255,.6)', 1.1);
    poly([[510, 374], [550, 381], [554, 416], [506, 408]], blue, 'rgba(150,220,255,.4)', 0.9);
    poly([[494, 418], [560, 428], [566, 462], [500, 452]], '#121b38', 'rgba(130,200,255,.35)', 1);
    circle(530, 443, 8, '#61e7ff', null, 0, 9, '#61e7ff');
    ctx.restore();
  }

  function drawRifle(t){
    const steel = lg(690, 300, 990, 400, [[0, '#dbe9ff'], [0.3, '#9fb8dd'], [0.7, '#41557d'], [1, '#111a31']]);
    ctx.save();
    ctx.translate(0, Math.sin(t * 0.8) * 0.8);
    poly([[700, 344], [794, 300], [820, 314], [738, 370]], steel, 'rgba(215,240,255,.55)', 1.1);
    poly([[788, 298], [948, 224], [965, 240], [817, 321]], steel, 'rgba(215,240,255,.55)', 1.1);
    poly([[815, 312], [943, 253], [954, 266], [828, 330]], lg(825, 300, 950, 330, [[0, '#3e6dff'], [1, '#15368d']]), 'rgba(140,220,255,.4)', 0.8);
    poly([[930, 234], [1006, 204], [1014, 214], [948, 249]], '#1a2a4e', 'rgba(160,220,255,.55)', 1);
    line(966, 222, 1008, 207, 'rgba(120,240,255,.9)', 1.8, 8, '#68ecff');
    circle(1008, 207, 2.6, '#e9ffff', null, 0, 8, '#68ecff');
    poly([[754, 356], [784, 342], [808, 362], [770, 382]], '#111a31', 'rgba(120,200,255,.35)', 1);
    poly([[790, 300], [817, 292], [826, 305], [800, 316]], '#62e8ff', null, 0);
    ctx.restore();
  }

  function drawHead(t){
    ctx.save();
    ctx.translate(625, 190);
    ctx.scale(0.78, 0.78);
    ctx.translate(-625, -190);
    const white = lg(575, 130, 675, 235, [[0, '#ffffff'], [0.45, '#e7f4ff'], [0.8, '#a9c7ff'], [1, '#4d70d9']]);
    const blue = lg(585, 145, 660, 225, [[0, '#4a8dff'], [1, '#0d2b7f']]);
    const gold = lg(560, 100, 690, 175, [[0, '#fff5bd'], [0.5, '#ffd36b'], [1, '#c88916']]);

    // neck
    poly([[602, 202], [640, 202], [652, 238], [590, 238]], '#10182f', 'rgba(120,200,255,.35)', 1);
    line(598, 221, 646, 221, 'rgba(90,235,255,.45)', 1);

    // helmet
    poly([[582, 148], [616, 136], [654, 148], [673, 180], [663, 218], [640, 234], [600, 234], [577, 218], [567, 180]], white, 'rgba(225,245,255,.8)', 1.4);
    poly([[588, 152], [612, 143], [620, 180], [605, 216], [584, 208], [574, 180]], blue, 'rgba(150,220,255,.4)', 0.9);
    poly([[648, 145], [666, 158], [675, 186], [660, 213], [643, 195], [642, 165]], blue, 'rgba(150,220,255,.4)', 0.9);
    poly([[594, 176], [650, 176], [644, 216], [600, 216]], '#050c1d', 'rgba(95,235,255,.55)', 1.2);
    poly([[601, 184], [624, 188], [622, 195], [599, 194]], '#6ff2ff', null, 0, 12, '#6ff2ff');
    poly([[648, 188], [670, 184], [671, 194], [647, 195]], '#6ff2ff', null, 0, 12, '#6ff2ff');
    poly([[612, 216], [638, 216], [633, 227], [616, 227]], '#e33b55', 'rgba(255,170,180,.55)', 0.9);
    line(625, 196, 625, 211, 'rgba(160,240,255,.45)', 0.9);

    // V-fin
    poly([[606, 166], [560, 104], [582, 178]], gold, 'rgba(255,240,170,.9)', 1.2, 8, '#ffd36b');
    poly([[642, 166], [688, 104], [665, 178]], gold, 'rgba(255,240,170,.9)', 1.2, 8, '#ffd36b');
    poly([[614, 164], [628, 164], [625, 178], [618, 178]], '#ffd36b', 'rgba(255,240,170,.7)', 0.8);
    circle(625, 176, 5, '#ff4b62', null, 0, 8, '#ff4b62');

    // side vents / antenna
    poly([[574, 178], [590, 174], [594, 190], [579, 196]], '#ffd36b', 'rgba(255,240,170,.55)', 0.8);
    poly([[668, 174], [682, 178], [679, 196], [663, 190]], '#ffd36b', 'rgba(255,240,170,.55)', 0.8);
    line(625, 136, 625, 112, 'rgba(185,230,255,.7)', 1.2);

    // glow around head
    ctx.globalAlpha = 0.5;
    circle(625, 180, 64, null, 'rgba(98,235,255,.25)', 1.2, 12, '#62ebff');
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawEffects(t){
    // thrusters
    const flames = [
      [535, 330, -1], [705, 330, 1], [560, 548, -1], [680, 548, 1]
    ];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    flames.forEach((f, i) => {
      const flick = 12 + Math.sin(t * 8 + i * 2) * 5;
      const grd = rg(f[0], f[1], 0, flick * 2.1, [[0, 'rgba(190,250,255,.9)'], [0.3, 'rgba(70,180,255,.55)'], [1, 'rgba(50,80,255,0)']]);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(f[0], f[1] + (f[2] < 0 ? 4 : 2), flick * 0.55, flick * 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // spark particles
    const sparks = [
      [420, 210, 2.5, 0.3], [790, 180, 2, 1.2], [850, 350, 2.8, 2.1],
      [480, 490, 2, 0.8], [930, 300, 2.4, 1.7], [700, 440, 1.8, 2.7]
    ];
    sparks.forEach((s, i) => {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.globalAlpha = a;
      circle(s[0] + Math.sin(t * s[3] + i) * 5, s[1] + Math.cos(t * s[3] * 0.7 + i) * 4, s[2], i % 2 ? '#ffcf74' : '#6ff2ff', null, 0, 7, i % 2 ? '#ffcf74' : '#6ff2ff');
    });
    ctx.globalAlpha = 1;
  }

  function drawMecha(t){
    const bob = Math.sin(t * 0.9) * 3 + Math.sin(t * 1.7) * 0.8;
    ctx.save();
    ctx.translate(0, bob);
    ctx.scale(1 + Math.sin(t * 0.6) * 0.002, 1 + Math.sin(t * 0.6) * 0.002);

    drawWing('left', t);
    drawWing('right', t);

    // backpack / binders
    poly([[575, 238], [665, 238], [688, 300], [552, 300]], '#121b38', 'rgba(130,205,255,.45)', 1.1);
    poly([[582, 248], [620, 242], [630, 286], [570, 292]], lg(580, 240, 630, 290, [[0, '#2b63d8'], [1, '#0b1842']]), 'rgba(120,220,255,.35)', 0.9);
    poly([[630, 242], [658, 248], [670, 292], [630, 286]], lg(630, 240, 670, 290, [[0, '#2b63d8'], [1, '#0b1842']]), 'rgba(120,220,255,.35)', 0.9);

    drawLeg(false, t);
    drawLeg(true, t);
    drawTorso(t);
    drawShoulder(false, t);
    drawShoulder(true, t);
    drawArm(false, t);
    drawArm(true, t);
    drawShield(t);
    drawRifle(t);
    drawHead(t);

    // waist side skirts
    poly([[540, 330], [580, 326], [596, 394], [548, 388]], '#162247', 'rgba(120,200,255,.4)', 1);
    poly([[660, 326], [700, 330], [692, 388], [644, 394]], '#162247', 'rgba(120,200,255,.4)', 1);
    line(545, 346, 585, 344, 'rgba(255,211,107,.6)', 1);
    line(655, 344, 695, 346, 'rgba(255,211,107,.6)', 1);

    ctx.restore();
    drawEffects(t);
  }

  function frame(now){
    if(!running || !ctx || !canvas) return;
    const t = (now - startedAt) / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* background covers the card */
    const bgScale = Math.max(cssW / VW, cssH / VH) * 1.03;
    ctx.save();
    ctx.translate(cssW * 0.54, cssH * 0.52);
    ctx.scale(bgScale, bgScale);
    ctx.translate(-VW / 2, -VH / 2);
    drawBackground(t);
    ctx.restore();

    /* mecha is fitted so the full body stays visible */
    const mechaScale = Math.min(cssW / VW, cssH / VH) * 1.22;
    ctx.save();
    ctx.translate(cssW * 0.57, cssH * 0.45);
    ctx.scale(mechaScale, mechaScale);
    ctx.translate(-VW / 2, -VH / 2);
    drawMecha(t);
    ctx.restore();
    raf = requestAnimationFrame(frame);
  }

  function start(el){
    stop();
    canvas = el;
    if(!canvas) return;
    ctx = canvas.getContext('2d');
    if(!ctx) return;
    running = true;
    startedAt = performance.now();
    resize();
    if(window.ResizeObserver){
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }
    raf = requestAnimationFrame(frame);
  }

  function stop(){
    running = false;
    if(raf) cancelAnimationFrame(raf);
    raf = 0;
    if(resizeObserver){
      try { resizeObserver.disconnect(); } catch(e){}
      resizeObserver = null;
    } else {
      window.removeEventListener('resize', resize);
    }
    canvas = null;
    ctx = null;
  }

  window.QBTI_FREEDOM_RENDER = { start: start, stop: stop };
})();
