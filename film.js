const W = 1920, H = 1080;
const cv = document.getElementById('stage'), G0 = cv.getContext('2d');
let G = G0;
const { rng, ease, clamp } = Gods;
const mix = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const SERIF = '"Noto Serif CJK SC","Noto Serif SC",serif', SANS = '"Noto Sans CJK SC","Noto Sans SC",sans-serif';
const GOLD = '#f2b45a', WARM = '#ffb070', BLUE = '#7fc4ff', ICE = '#cfe8ff';

// ---------- 资源 ----------
const A = {};
function img(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
async function loadAll() {
  [A.marx, A.handH] = await Promise.all([img('assets/marx_bw.jpg'), img('assets/hand_human.png')]);
  A.land = await (await fetch('assets/land_dots.json')).json();
  A.logo = {};
  await Promise.all(['claude', 'chatgpt', 'deepseek', 'grok', 'gemini'].map(async n => { A.logo[n] = await img('assets/logos/' + n + '.png'); }));
  A.eng = {};
  await Promise.all(['marx', 'era_steam', 'era_factory', 'era_line', 'era_chip', 'host_merchant', 'host_factory', 'host_tech'].map(async n => { A.eng[n] = await img('assets/eng/' + n + '.png'); }));
  A.handAI = await (await fetch('assets/hand_ai_points.json')).json();
  const csv = await (await fetch('assets/world_gdp_longrun_annual_interp.csv')).text();
  A.gdp = csv.trim().split('\n').slice(1).map(l => l.split(',')).map(([y, v]) => [+y, +v / 1e12]);
  A.gods = JSON.parse(JSON.stringify(Gods.DEFAULT));
  await Promise.all(A.gods.figures.map(async f => { f.img = await img('img/' + f.id + '.webp'); }));
  await document.fonts.load('40px "UnifrakturMaguntia", Fraktur'); await document.fonts.load('700 40px "Noto Serif CJK SC"'); await document.fonts.load('900 40px "Noto Sans CJK SC"');
  prep();
  window.READY = true;
}

// ---------- 通用 ----------
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function text(s, x, y, o = {}) {
  G.save();
  G.font = `${o.weight || 700} ${o.size || 48}px ${o.font || SERIF}`;
  G.textAlign = o.align || 'center'; G.textBaseline = 'middle';
  G.globalAlpha = (o.alpha ?? 1);
  if (o.glow) { G.shadowColor = o.glow; G.shadowBlur = o.blur || 30; }
  if (o.spacing) G.letterSpacing = o.spacing + 'px';
  G.fillStyle = o.color || '#f4efe6';
  G.fillText(s, x, y);
  G.restore();
}
// 文字淡入：轻微上浮 + 去模糊
function rise(s, x, y, t0, t, o = {}) {
  const k = seg(t, t0, t0 + (o.dur || 0.5)); if (k <= 0) return;
  const out = o.out != null ? 1 - seg(t, o.out, o.out + 0.35) : 1;
  G.save(); G.filter = k < 1 ? `blur(${(1 - k) * 8}px)` : 'none';
  text(s, x, y + (1 - ease(k)) * 18, Object.assign({}, o, { alpha: ease(k) * out * (o.alpha ?? 1) }));
  G.restore();
}
// 故障字
function glitch(s, x, y, t, amt, o) {
  const c = canvas(1920, 300), g = c.getContext('2d');
  g.font = `${o.weight || 900} ${o.size}px ${o.font || SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = o.color || '#fff'; g.fillText(s, 960, 150);
  const r = rng(Math.floor(t * 24) + 9);
  G.save(); G.globalAlpha = o.alpha ?? 1;
  if (o.glow) { G.shadowColor = o.glow; G.shadowBlur = 40; }
  for (let yy = 0; yy < 300; yy += 12) {
    const dx = r() < amt ? (r() - 0.5) * 80 * amt : 0;
    G.drawImage(c, 0, yy, 1920, 12, x - 960 + dx, y - 150 + yy, 1920, 12);
  }
  if (amt > 0.05) {
    G.globalCompositeOperation = 'lighter'; G.globalAlpha = 0.5 * amt; G.shadowBlur = 0;
    const tint = (col, dx) => { const d = canvas(1920, 300), q = d.getContext('2d'); q.drawImage(c, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, 1920, 300); G.drawImage(d, x - 960 + dx, y - 150); };
    tint('#ff2050', -8 * amt); tint('#20c0ff', 8 * amt);
  }
  G.restore();
}
function glowDot(x, y, r, col, a) {
  const gr = G.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0));
  G.fillStyle = gr; G.beginPath(); G.arc(x, y, r, 0, 7); G.fill();
}
let GRAIN = [];
function grain(T) {
  const n = GRAIN[Math.floor(T * 30) % GRAIN.length];
  G.save(); G.globalAlpha = 0.07; G.globalCompositeOperation = 'overlay'; G.drawImage(n, 0, 0, W, H); G.restore();
}
function vignette(a = 0.7) {
  const vg = G.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 1.0);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${a})`);
  G.fillStyle = vg; G.fillRect(0, 0, W, H);
}
function bg(c1 = '#07080c', c2 = '#000') {
  const gr = G.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.75);
  gr.addColorStop(0, c1); gr.addColorStop(1, c2); G.fillStyle = gr; G.fillRect(0, 0, W, H);
}

// ---------- 预处理 ----------
const P = {};
function prep() {
  for (let i = 0; i < 6; i++) {
    const c = canvas(480, 270), g = c.getContext('2d'), d = g.createImageData(480, 270), r = rng(300 + i);
    for (let k = 0; k < d.data.length; k += 4) { const v = r() * 255; d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255; }
    g.putImageData(d, 0, 0); GRAIN.push(c);
  }
  // 马克思：程序生成的版画排线稿，左缘渐隐
  { const c = canvas(1080, 1080), g = c.getContext('2d');
    g.drawImage(A.eng.marx, 0, 0);
    g.globalCompositeOperation = 'source-atop'; const tg = g.createLinearGradient(0, 0, 0, 1080); tg.addColorStop(0, '#f3dcb4'); tg.addColorStop(1, '#c98f52'); g.fillStyle = tg; g.globalAlpha = 0.55; g.fillRect(0, 0, 1080, 1080); g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createLinearGradient(0, 0, 1080, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 1080, 1080);
    const gb = g.createLinearGradient(0, 760, 0, 1080); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gb; g.fillRect(0, 760, 1080, 320);
    P.marx = c; }
  // 1848 宣言扉页（按原版版式用德文排出）
  { const c = canvas(900, 1240), g = c.getContext('2d'), r = rng(18);
    g.fillStyle = '#2b2219'; g.fillRect(0, 0, 900, 1240);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,230,190'},${r() * 0.06})`; g.fillRect(r() * 900, r() * 1240, 1 + r() * 3, 1 + r() * 3); }
    g.strokeStyle = 'rgba(230,205,160,0.6)'; g.lineWidth = 3; g.strokeRect(50, 50, 800, 1140); g.lineWidth = 1; g.strokeRect(62, 62, 776, 1116);
    g.fillStyle = 'rgba(235,215,175,0.9)'; g.textAlign = 'center';
    g.font = '130px "UnifrakturMaguntia", Fraktur'; g.fillText('Manifest', 450, 330);
    g.font = '60px "UnifrakturMaguntia", Fraktur'; g.fillText('der', 450, 430);
    g.font = '86px "UnifrakturMaguntia", Fraktur'; g.fillText('Kommunistischen', 450, 540); g.fillText('Partei.', 450, 640);
    g.fillRect(330, 700, 240, 2);
    g.font = '42px "UnifrakturMaguntia", Fraktur'; g.fillText('Veröffentlicht im Februar 1848.', 450, 790);
    g.font = '46px "UnifrakturMaguntia", Fraktur'; g.fillText('Proletarier aller Länder vereinigt euch.', 450, 900);
    g.fillRect(380, 960, 140, 2);
    g.font = '44px "UnifrakturMaguntia", Fraktur'; g.fillText('London.', 450, 1060);
    g.font = '30px "UnifrakturMaguntia", Fraktur'; g.fillText('1848.', 450, 1110);
    P.page = c; }
  // 时代圆窗：版画裁成圆形
  P.icons = ['era_steam', 'era_factory', 'era_line', 'era_chip'].map(n => { const c = canvas(256, 256), g = c.getContext('2d');
    g.beginPath(); g.arc(128, 128, 126, 0, 7); g.clip(); g.fillStyle = '#0b0a09'; g.fillRect(0, 0, 256, 256); g.drawImage(A.eng[n], 0, 0, 256, 256);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(232,184,106,0.18)'; g.fillRect(0, 0, 256, 256); return c; });
  // 碎片三角网格
  { const r = rng(4), pts = [], n = 6;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) pts.push([i / n * 256 + (i > 0 && i < n ? (r() - 0.5) * 28 : 0), j / n * 256 + (j > 0 && j < n ? (r() - 0.5) * 28 : 0)]);
    P.tris = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
      P.tris.push([pts[a], pts[b], pts[d]], [pts[a], pts[d], pts[c]]);
    }
    P.tris.forEach(tr => { tr.v = [(r() - 0.5) * 2, (r() - 0.7) * 2]; tr.rot = (r() - 0.5) * 4; }); }
  // 神经网络节点
  { const r = rng(21); P.net = [];
    for (let i = 0; i < 70; i++) { const a = r() * 7, d = Math.pow(r(), 0.6); P.net.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, s: 2 + 4 * r(), ph: r() * 7 }); } }
  // 无国界点阵大陆
  { const c = canvas(1920, 1080), g = c.getContext('2d');
    g.fillStyle = 'rgba(150,170,210,0.42)';
    A.land.forEach(([lo, la]) => { const [x, y] = proj(lo, la); g.beginPath(); g.arc(x, y, 2.1, 0, 7); g.fill(); });
    P.map = c; }
  // 资本流动路线（经度展开为连续环）
  P.route = [[0, 51.5], [-74, 40.7], [-83, 42.3], [-122.4, 37.6], [-180, 34], [-220.3, 35.7], [-245.9, 22.5], [-282.4, 13], [-304.7, 25.2], [-351.3, 50.1], [-360, 51.5]];
  // 巨像：看板娘转成青铜石像质感
  P.statues = A.gods.figures.map(f => {
    const im = f.img, w = im.naturalWidth, h = im.naturalHeight, c = canvas(w, h), g = c.getContext('2d');
    g.filter = 'grayscale(1) sepia(0.5) contrast(1.3) brightness(0.9)'; g.drawImage(im, 0, 0); g.filter = 'none';
    g.globalCompositeOperation = 'source-atop';
    const lg = g.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, 'rgba(255,214,150,0.35)'); lg.addColorStop(0.35, 'rgba(120,90,60,0.1)'); lg.addColorStop(1, 'rgba(8,10,20,0.75)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    const fd = g.createLinearGradient(0, h * 0.42, 0, h * 0.78); fd.addColorStop(0, 'rgba(0,0,0,0)'); fd.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = fd; g.fillRect(0, h * 0.5, w, h * 0.5);
    const gc = canvas(Math.ceil(w / 4) + 60, Math.ceil(h / 4) + 60), q = gc.getContext('2d');
    q.filter = 'blur(12px)'; q.drawImage(c, 30, 30, w / 4, h / 4); q.filter = 'none'; q.globalCompositeOperation = 'source-in'; q.fillStyle = '#ffc878'; q.fillRect(0, 0, gc.width, gc.height);
    return { id: f.id, c, glow: gc, w, h };
  });
  // AI 之手粒子：按亮度预排
  P.aiPts = A.handAI.pts;
}
function proj(lo, la) { return [(lo + 180) / 360 * 1920, 70 + (83 - la) / 141 * 960]; }
function routeAt(u) {
  const R = P.route, n = R.length - 1; u = ((u % 1) + 1) % 1;
  // 按段长度均匀参数化
  if (!P.rlen) { P.rlen = [0]; for (let i = 0; i < n; i++) P.rlen.push(P.rlen[i] + Math.hypot(R[i + 1][0] - R[i][0], R[i + 1][1] - R[i][1])); }
  const L = u * P.rlen[n]; let i = 0; while (i < n - 1 && P.rlen[i + 1] < L) i++;
  const k = (L - P.rlen[i]) / (P.rlen[i + 1] - P.rlen[i]);
  const p0 = R[Math.max(0, i - 1)], p1 = R[i], p2 = R[i + 1], p3 = R[Math.min(n, i + 2)];
  const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * k + (2 * a - 5 * b + 4 * c - d) * k * k + (-a + 3 * b - 3 * c + d) * k * k * k);
  let lo = cr(p0[0], p1[0], p2[0], p3[0]), la = cr(p0[1], p1[1], p2[1], p3[1]);
  lo = ((lo + 180) % 360 + 360) % 360 - 180;
  return proj(lo, la);
}

// ---------- 图标 ----------
function iconWorkshop(g) { // 锤与砧
  g.beginPath(); g.moveTo(40, 150); g.lineTo(180, 150); g.lineTo(165, 170); g.lineTo(55, 170); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(85, 170); g.lineTo(80, 196); g.moveTo(135, 170); g.lineTo(140, 196); g.moveTo(60, 196); g.lineTo(160, 196); g.stroke();
  g.beginPath(); g.moveTo(70, 120); g.lineTo(150, 40); g.stroke();
  g.save(); g.translate(150, 40); g.rotate(Math.PI / 4); g.strokeRect(-30, -12, 60, 24); g.restore();
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(110 + i * 14, 132); g.lineTo(118 + i * 20, 112 - i * 4); g.stroke(); }
}
function iconSteam(g) { // 飞轮 + 气缸
  g.beginPath(); g.arc(140, 120, 56, 0, 7); g.stroke(); g.beginPath(); g.arc(140, 120, 10, 0, 7); g.fill();
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.beginPath(); g.moveTo(140, 120); g.lineTo(140 + Math.cos(a) * 56, 120 + Math.sin(a) * 56); g.stroke(); }
  g.strokeRect(24, 96, 54, 92); g.beginPath(); g.moveTo(51, 96); g.lineTo(51, 60); g.lineTo(140, 120); g.stroke();
  g.beginPath(); g.moveTo(40, 96); g.bezierCurveTo(30, 60, 70, 50, 54, 22); g.stroke();
  g.beginPath(); g.moveTo(10, 196); g.lineTo(210, 196); g.stroke();
}
function iconLine(g) { // 流水线
  g.beginPath(); g.moveTo(20, 150); g.lineTo(200, 150); g.moveTo(20, 172); g.lineTo(200, 172); g.stroke();
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(34 + i * 30, 161, 8, 0, 7); g.stroke(); }
  for (let i = 0; i < 3; i++) g.strokeRect(36 + i * 58, 108, 40, 38);
  g.beginPath(); g.moveTo(110, 30); g.lineTo(110, 70); g.lineTo(96, 88); g.moveTo(110, 70); g.lineTo(124, 88); g.stroke();
  g.beginPath(); g.moveTo(20, 30); g.lineTo(200, 30); g.stroke();
}
function iconChip(g) { // 芯片
  g.strokeRect(55, 55, 110, 110); g.strokeRect(80, 80, 60, 60);
  for (let i = 0; i < 5; i++) { const p = 66 + i * 22;
    g.beginPath(); g.moveTo(p, 55); g.lineTo(p, 30); g.moveTo(p, 165); g.lineTo(p, 190); g.moveTo(55, p); g.lineTo(30, p); g.moveTo(165, p); g.lineTo(190, p); g.stroke(); }
}

// ---------- 镜头 ----------
// 1. 马克思引文
function shot1(t) {
  bg('#120d09', '#000');
  // 宣言扉页
  G.save(); G.globalAlpha = 0.22 * seg(t, 0, 1.5); G.translate(470, 560); G.rotate(-0.06 + t * 0.002); G.scale(0.95 + t * 0.006, 0.95 + t * 0.006);
  G.drawImage(P.page, -450, -620); G.restore();
  G.fillStyle = 'rgba(0,0,0,0.45)'; G.fillRect(0, 0, W, H);
  // 肖像
  const k = seg(t, 0.2, 2.4), s = 1 + t * 0.008;
  G.save(); G.globalAlpha = ease(k); G.translate(1400, 560); G.scale(s, s); G.drawImage(P.marx, -540 + 20, -540); G.restore();
  const lines = ['资产阶级在它的不到一百年的', '阶级统治中所创造的生产力，', '比过去一切世代创造的', '全部生产力还要多，还要大。'];
  rise('马克思、恩格斯说：', 130, 300, 0.4, t, { align: 'left', size: 34, font: SANS, weight: 500, color: GOLD });
  const total = lines.join('').length, typed = Math.floor(seg(t, 1.0, 7.6) * total);
  let used = 0;
  lines.forEach((ln, i) => {
    const n = clamp(typed - used, 0, ln.length); used += ln.length;
    if (n <= 0) return;
    const y = 400 + i * 96;
    if (i === 3) {
      const a = ln.slice(0, Math.min(n, 6)), b = n > 6 ? ln.slice(6, n) : '';
      text(a, 130, y, { align: 'left', size: 60 });
      if (b) { G.save(); G.font = `700 60px ${SERIF}`; const w = G.measureText(a).width; G.restore();
        text(b, 130 + w, y, { align: 'left', size: 64, color: GOLD, glow: 'rgba(242,180,90,0.7)', blur: 26 }); }
    } else text(ln.slice(0, n), 130, y, { align: 'left', size: 60 });
  });
  if (typed < total && Math.floor(t * 3) % 2 === 0 && t > 1) { // 光标
    G.fillStyle = GOLD; let ci = 0, left = typed; while (ci < 3 && left >= lines[ci].length) { left -= lines[ci].length; ci++; }
    G.save(); G.font = `700 60px ${SERIF}`; const w = G.measureText(lines[ci].slice(0, left)).width; G.restore();
    G.fillRect(136 + w, 400 + ci * 96 - 30, 4, 60);
  }
  rise('——《共产党宣言》，1848', 130, 820, 7.9, t, { align: 'left', size: 28, font: SANS, weight: 400, color: '#9a948a' });
  vignette(0.6);
}

// 2–3. 时间轴
const NODES = [['蒸汽机', '1784'], ['机器工厂', '1835'], ['流水线', '1913'], ['芯片', '2020']];
function drawTimeline(t, off, nShow, shatterAll) {
  const y = 600, x0 = 330 - off;
  G.save(); G.strokeStyle = 'rgba(242,180,90,0.45)'; G.lineWidth = 3;
  const xEnd = x0 + 410 * (nShow - 1) + (nShow > 4 ? 0 : 200);
  G.beginPath(); G.moveTo(-50, y); G.lineTo(Math.min(W + 50, xEnd), y); G.stroke(); G.restore();
  NODES.forEach(([name, yr], i) => {
    const ti = 0.25 + i * 1.05, x = x0 + i * 410;
    const ap = seg(t, ti, ti + 0.4); if (ap <= 0) return;
    // 下一个节点出现时，这个碎掉
    const sh = i < 3 ? seg(t, ti + 1.05, ti + 1.85) : (shatterAll ? seg(t, shatterAll, shatterAll + 0.8) : 0);
    G.save(); G.globalAlpha = ap;
    G.strokeStyle = `rgba(242,180,90,${0.9 - sh * 0.6})`; G.lineWidth = 3; G.beginPath(); G.arc(x, y, 130, 0, 7); G.stroke();
    G.fillStyle = '#0a0806'; G.beginPath(); G.arc(x, y, 128, 0, 7); G.fill();
    if (sh <= 0) G.drawImage(P.icons[i], x - 128, y - 128);
    else if (sh < 1) {
      P.tris.forEach(tr => {
        const cx = (tr[0][0] + tr[1][0] + tr[2][0]) / 3, cy = (tr[0][1] + tr[1][1] + tr[2][1]) / 3;
        const e = ease(sh), dx = tr.v[0] * 160 * e, dy = tr.v[1] * 160 * e + 120 * e * e;
        G.save(); G.globalAlpha = ap * (1 - sh);
        G.translate(x - 128 + cx + dx, y - 128 + cy + dy); G.rotate(tr.rot * e); G.translate(-cx, -cy);
        G.beginPath(); G.moveTo(...tr[0]); G.lineTo(...tr[1]); G.lineTo(...tr[2]); G.closePath(); G.clip();
        G.drawImage(P.icons[i], 0, 0); G.restore();
      });
    }
    G.restore();
    rise(name, x, y + 190, ti + 0.1, t, { size: 40, color: sh > 0.5 ? '#8a7e6c' : '#f4efe6' });
    rise(yr, x, y + 240, ti + 0.2, t, { size: 26, font: SANS, weight: 400, color: '#8a7e6c' });
  });
}
function shot2(t) {
  bg('#0e0b08', '#000');
  drawTimeline(t, 0, 4);
  rise('生产力', 760, 230, 0.2, t, { size: 64, color: GOLD, glow: 'rgba(242,180,90,0.5)' });
  const ak = seg(t, 0.8, 1.3);
  if (ak > 0) { G.save(); G.strokeStyle = `rgba(244,239,230,${ak})`; G.lineWidth = 4; G.beginPath(); G.moveTo(870, 230); G.lineTo(870 + 120 * ak, 230); G.stroke();
    G.beginPath(); G.moveTo(990 * ak + 870 * (1 - ak), 230); G.lineTo(975 * ak + 870 * (1 - ak), 218); G.moveTo(990 * ak + 870 * (1 - ak), 230); G.lineTo(975 * ak + 870 * (1 - ak), 242); G.stroke(); G.restore(); }
  const pulse = [1.3, 2.35, 3.4].reduce((m, p) => Math.max(m, 1 - Math.abs(t - p) / 0.3), 0);
  rise('生产关系', 1150, 230, 1.0, t, { size: 64, glow: pulse > 0 ? `rgba(255,255,255,${pulse})` : null });
  vignette();
}
function shot3(t) {
  bg('#0b0c10', '#000');
  const off = 410 * ease(seg(t, 0, 0.9)), zoom = 1 + 1.4 * ease(seg(t, 2.1, 3.2));
  const nx = 330 - off + 4 * 410, ny = 600;
  G.save(); G.translate(nx, ny); G.scale(zoom, zoom); G.translate(-nx, -ny);
  drawTimeline(5, off, 5);
  // 第五个节点
  const qa = seg(t, 0.5, 0.9);
  G.save(); G.globalAlpha = qa; G.setLineDash([10, 10]); G.strokeStyle = 'rgba(200,220,255,0.6)'; G.lineWidth = 3;
  G.beginPath(); G.arc(nx, ny, 130, 0, 7); G.stroke(); G.restore();
  const bloom = seg(t, 1.35, 2.6);
  if (bloom <= 0) text('?', nx, ny, { size: 110, alpha: qa * (0.6 + 0.4 * Math.sin(t * 8)), color: '#cfd8e8' });
  else {
    G.save(); G.globalCompositeOperation = 'lighter';
    const R = 120 * ease(bloom) + 400 * ease(seg(t, 2.1, 4));
    const pts = P.net.map(p => [nx + p.x * R, ny + p.y * R]);
    G.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
      if (d < R * 0.32) { G.strokeStyle = `rgba(127,196,255,${0.5 * (1 - d / (R * 0.32)) * bloom})`; G.beginPath(); G.moveTo(...pts[i]); G.lineTo(...pts[j]); G.stroke(); }
    }
    P.net.forEach((p, i) => glowDot(pts[i][0], pts[i][1], p.s * 4, 'rgba(150,210,255,A)', 0.8 * bloom * (0.6 + 0.4 * Math.sin(t * 6 + p.ph))));
    glowDot(nx, ny, 160 * bloom, 'rgba(120,190,255,A)', 0.5 * bloom);
    G.restore();
  }
  G.restore();
  const dark = seg(t, 2.2, 2.6);
  if (dark > 0) { G.fillStyle = `rgba(0,0,6,${0.8 * dark})`; G.fillRect(0, 0, W, H); }
  if (t > 2.35) glitch('可能不是人类', 960, 560, t, Math.max(0, 1 - (t - 2.35) * 1.6) + 0.15 * (Math.sin(t * 13) > 0.85 ? 1 : 0), { size: 150, color: ICE, glow: 'rgba(110,180,255,0.9)', alpha: seg(t, 2.35, 2.6) });
  vignette();
}

// 4. 资本没有国籍
function shot4(t) {
  G.fillStyle = '#04060a'; G.fillRect(0, 0, W, H);
  const z = 1.04 + t * 0.012; G.save(); G.translate(W / 2, H / 2); G.scale(z, z); G.translate(-W / 2, -H / 2);
  G.drawImage(P.map, 0, 0);
  G.globalCompositeOperation = 'lighter';
  const r = rng(44), N = 1400;
  for (let i = 0; i < N; i++) {
    const u0 = r(), spd = 0.07 + 0.02 * r(), off = (r() - 0.5) * 26, off2 = (r() - 0.5) * 26, sz = 1 + 2.2 * r();
    const u = u0 + spd * (t + 3);
    const [x1, y1] = routeAt(u), [x0, y0] = routeAt(u - 0.004);
    if (Math.abs(x1 - x0) > 300) continue;
    const a = 0.35 + 0.5 * r();
    G.strokeStyle = `rgba(255,${180 + 50 * r()},90,${a})`; G.lineWidth = sz;
    G.beginPath(); G.moveTo(x0 + off, y0 + off2); G.lineTo(x1 + off, y1 + off2); G.stroke();
  }
  [[0, 51.5], [-74, 40.7], [-122.4, 37.6], [139.7, 35.7], [114, 22.5], [77.6, 13], [55.3, 25.2], [8.7, 50.1]].forEach(([lo, la], i) => {
    const [x, y] = proj(lo, la); glowDot(x, y, 26 + 8 * Math.sin(t * 4 + i), 'rgba(255,200,110,A)', 0.55);
  });
  G.restore();
  rise('没有国籍，', 760, 190, 0.15, t, { size: 76, glow: 'rgba(0,0,0,0.9)' });
  rise('也没有忠诚', 1160, 190, 1.0, t, { size: 76, color: GOLD, glow: 'rgba(0,0,0,0.9)' });
  vignette(0.75);
}

// 资本粒子群
function swarm(cx, cy, t, n, rad, colK = 0, seed = 8, spiral = 0) {
  const r = rng(seed);
  G.save(); G.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const a = r() * 7 + t * (1.2 + r()) * (r() > 0.5 ? 1 : -1), d = rad * Math.sqrt(r()) * (1 - spiral) + 4;
    const x = cx + Math.cos(a) * d * 1.3, y = cy + Math.sin(a) * d * 0.8;
    const c = colK > 0 ? `rgba(${Math.round(mix(255, 140, colK))},${Math.round(mix(190, 210, colK))},${Math.round(mix(90, 255, colK))},` : 'rgba(255,195,95,';
    G.fillStyle = c + (0.4 + 0.5 * r()) + ')'; const s = 1.5 + 2.5 * r(); G.fillRect(x, y, s, s);
  }
  glowDot(cx, cy, rad * 1.6, colK > 0.5 ? 'rgba(130,190,255,A)' : 'rgba(255,180,80,A)', 0.25);
  G.restore();
}
function figure(kind, x, base, lit) {
  G.save(); G.fillStyle = '#0c0b0e'; G.strokeStyle = `rgba(255,190,100,${0.15 + 0.85 * lit})`; G.lineWidth = 3;
  if (lit > 0) { G.shadowColor = `rgba(255,180,80,${lit})`; G.shadowBlur = 40 * lit; }
  G.beginPath();
  if (kind === 0) { // 商人：长袍、背着货包、手持天平
    G.arc(x, base - 300, 32, 0, 7); G.moveTo(x - 40, base - 260); G.lineTo(x + 40, base - 260); G.lineTo(x + 70, base); G.lineTo(x - 70, base); G.closePath();
    G.moveTo(x - 60, base - 250); G.ellipse(x - 80, base - 200, 44, 56, 0, 0, 7);
    G.moveTo(x + 40, base - 230); G.lineTo(x + 110, base - 230); G.lineTo(x + 110, base - 220); G.lineTo(x + 40, base - 220);
  } else if (kind === 1) { // 工厂主：礼帽、手杖、背后烟囱
    G.rect(x + 90, base - 420, 46, 420); G.rect(x + 150, base - 300, 36, 300);
    G.arc(x, base - 300, 30, 0, 7); G.rect(x - 34, base - 382, 68, 56); G.rect(x - 52, base - 330, 104, 8);
    G.moveTo(x - 46, base - 262); G.lineTo(x + 46, base - 262); G.lineTo(x + 50, base - 120); G.lineTo(x + 30, base); G.lineTo(x - 30, base); G.lineTo(x - 50, base - 120); G.closePath();
    G.moveTo(x - 70, base - 150); G.lineTo(x - 66, base - 150); G.lineTo(x - 80, base); G.lineTo(x - 84, base);
  } else { // 科技巨头：玻璃大楼
    G.moveTo(x - 110, base); G.lineTo(x - 110, base - 470); G.lineTo(x + 20, base - 540); G.lineTo(x + 110, base - 500); G.lineTo(x + 110, base); G.closePath();
  }
  G.fill(); G.stroke(); G.shadowBlur = 0;
  if (kind === 2) { G.fillStyle = `rgba(255,200,120,${0.08 + 0.5 * lit})`; for (let j = 0; j < 18; j++) for (let i = 0; i < 7; i++) if ((i * 7 + j * 3) % 5) G.fillRect(x - 96 + i * 30, base - 440 + j * 24 + (i < 4 ? 0 : 0), 16, 12); }
  G.restore();
}
// 5. 商人 → 工厂主 → 科技巨头
const HOSTS = [[420, '商人'], [960, '工厂主'], [1500, '科技巨头']];
function hostPos(t) {
  const keys = [[0, -200, 520], [0.5, 420, 560], [1.3, 420, 560], [1.75, 960, 560], [2.5, 960, 560], [2.95, 1500, 560], [4, 1500, 560]].map(k => [k[0], k[1], k[2] - 20]);
  let i = 0; while (i < keys.length - 2 && keys[i + 1][0] < t) i++;
  const k = ease(seg(t, keys[i][0], keys[i + 1][0]));
  return [mix(keys[i][1], keys[i + 1][1], k), mix(keys[i][2], keys[i + 1][2], k) - 60 * Math.sin(Math.PI * k)];
}
function shot5(t) {
  bg('#0d0a08', '#000');
  const [sx, sy] = hostPos(t);
  HOSTS.forEach(([x, name], i) => {
    const lit = clamp(1 - Math.abs(sx - x) / 240, 0, 1) * seg(t, 0.3, 0.6), im = A.eng[['host_merchant', 'host_factory', 'host_tech'][i]];
    const w = 470, h = 338, y = 500;
    G.save(); G.globalAlpha = 0.3 + 0.7 * lit; G.drawImage(im, x - w / 2, y - h / 2, w, h);
    if (lit > 0) { G.globalCompositeOperation = 'source-atop'; }
    G.restore();
    if (lit > 0) { G.save(); G.globalCompositeOperation = 'lighter'; G.globalAlpha = 0.45 * lit; G.fillStyle = 'rgba(232,170,80,1)'; G.fillRect(x - w / 2, y - h / 2, w, h); G.restore(); }
    G.strokeStyle = `rgba(232,184,106,${0.2 + 0.7 * lit})`; G.lineWidth = 2; G.strokeRect(x - w / 2 - 10, y - h / 2 - 10, w + 20, h + 20);
    rise(name, x, 770, [0.45, 1.75, 2.95][i], t, { size: 54, color: lit > 0.3 ? GOLD : '#9a9184' });
    rise(['1662', '1835', '今天'][i], x, 830, [0.55, 1.85, 3.05][i], t, { size: 24, font: SANS, weight: 400, color: '#7c7468' });
  });
  swarm(sx, sy - 60, t, 700, 120, 0, 8);
  vignette();
}
// 6. 它找到了更好的选择：AI
function shot6(t) {
  bg('#06080e', '#000');
  const gk = seg(t, 1.0, 2.6);
  if (gk > 0) { if (!P.godsLayer) P.godsLayer = canvas(1920, 1080);
    const q = P.godsLayer.getContext('2d'); const st = Object.assign({}, A.gods, { camera: 'static', caption: '', letterbox: false, people: 0, cityLights: 0.3 });
    Gods.draw(q, 20 + t, st); G.save(); G.globalAlpha = 0.42 * gk; G.drawImage(P.godsLayer, 0, 0); G.restore(); }
  const k = ease(seg(t, 0, 1.0)), cx = mix(1500, 960, k), cy = mix(500, 540, k);
  // 芯片
  const ca = seg(t, 0.1, 0.6);
  G.save(); G.globalAlpha = ca; G.translate(960, 540); G.strokeStyle = BLUE; G.lineWidth = 4; G.shadowColor = BLUE; G.shadowBlur = 40;
  G.strokeRect(-110, -110, 220, 220); G.strokeRect(-60, -60, 120, 120);
  for (let i = 0; i < 7; i++) { const p = -90 + i * 30; G.beginPath(); G.moveTo(p, -110); G.lineTo(p, -150); G.moveTo(p, 110); G.lineTo(p, 150); G.moveTo(-110, p); G.lineTo(-150, p); G.moveTo(110, p); G.lineTo(150, p); G.stroke(); }
  G.restore();
  swarm(cx, cy, t, 700, mix(130, 40, seg(t, 0.6, 1.3)), seg(t, 0.5, 1.3), 8, seg(t, 0.7, 1.3) * 0.7);
  const flash = Math.max(0, 1 - Math.abs(t - 1.3) / 0.25);
  if (flash > 0) { G.fillStyle = `rgba(200,230,255,${flash * 0.8})`; G.fillRect(0, 0, W, H); }
  if (t > 1.3) { const a = seg(t, 1.3, 1.6), s = 1 + 0.04 * (t - 1.3);
    G.save(); G.translate(960, 560); G.scale(s, s); text('AI', 0, 0, { size: 460, font: SANS, weight: 900, color: '#f2f8ff', glow: 'rgba(110,180,255,1)', blur: 80, alpha: a }); G.restore(); }
  vignette(0.6);
}
// 7. 军备竞赛
const RACE = [['claude', '#d97757'], ['chatgpt', '#e8eefc'], [null, '#8a8f9c'], ['deepseek', '#4f6bfe'], ['grok', '#d8d8d8'], ['gemini', '#7fb0ff']];
function shot7(t) {
  bg('#05070d', '#000');
  const vx = 960, vy = 380, r = rng(70);
  G.save(); G.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 160; i++) { // 速度线
    const a = r() * Math.PI * 2, sp = 0.6 + r(), ph = r();
    const k = ((t * 1.8 * sp + ph) % 1), d0 = 60 + k * k * 1400, d1 = d0 + 60 + 260 * k * k;
    G.strokeStyle = `rgba(160,200,255,${0.35 * k})`; G.lineWidth = 1 + 2 * k;
    G.beginPath(); G.moveTo(vx + Math.cos(a) * d0, vy + Math.sin(a) * d0 * 0.6); G.lineTo(vx + Math.cos(a) * d1, vy + Math.sin(a) * d1 * 0.6); G.stroke();
  }
  G.restore();
  // 车道
  G.strokeStyle = 'rgba(120,150,200,0.25)'; G.lineWidth = 2;
  for (let i = -3; i <= 3; i++) { G.beginPath(); G.moveTo(vx, vy); G.lineTo(vx + i * 420, H + 200); G.stroke(); }
  for (let j = 0; j < 14; j++) { const z = ((j / 14 + t * 1.6) % 1), y = vy + (H + 200 - vy) * z * z;
    G.strokeStyle = `rgba(120,150,200,${0.25 * z})`; G.beginPath(); G.moveTo(vx - (y - vy) * 2.8, y); G.lineTo(vx + (y - vy) * 2.8, y); G.stroke(); }
  // 发光牌：深度 z 越小越近；没有标志的那块减速掉队
  const cubes = RACE.map(([logo, c], i) => {
    let z = 0.3 + 0.04 * Math.sin(t * 2 + i * 1.7) + (i % 2) * 0.03;
    if (logo === null) z -= 0.9 * Math.pow(seg(t, 1.9, 3.6), 1.6);
    return { logo, c, i, z };
  }).sort((a, b) => b.z - a.z);
  cubes.forEach(({ logo, c, i, z }) => {
    const lane = (i - 2.5) * 0.52;
    const P3 = (zz) => { const d = Math.max(0.05, zz); return [vx + lane * 420 * (0.3 / d) * 0.8, vy + 260 * (0.3 / d), 150 / d * 0.3]; };
    const [x, y, s] = P3(z);
    if (y - s > H + 40) return;
    G.save(); G.globalCompositeOperation = 'lighter';
    for (let k = 4; k >= 1; k--) { const [gx, gy, gs] = P3(z - k * 0.025); G.globalAlpha = 0.1 * (5 - k) / 4; G.fillStyle = c; G.beginPath(); G.roundRect(gx - gs / 2, gy - gs / 2, gs, gs, gs * 0.18); G.fill(); }
    G.globalAlpha = 1; glowDot(x, y, s * 2.2, hexA(c), 0.35);
    G.restore();
    G.save(); G.shadowColor = c; G.shadowBlur = 36;
    G.fillStyle = 'rgba(14,17,26,0.95)'; G.strokeStyle = c; G.lineWidth = Math.max(2, s * 0.045);
    G.beginPath(); G.roundRect(x - s / 2, y - s / 2, s, s, s * 0.18); G.fill(); G.stroke(); G.shadowBlur = 0;
    if (logo) G.drawImage(A.logo[logo], x - s * 0.34, y - s * 0.34, s * 0.68, s * 0.68);
    else text('?', x, y + s * 0.02, { size: s * 0.5, font: SANS, weight: 700, color: '#8a8f9c' });
    G.fillStyle = 'rgba(255,255,255,0.08)'; G.beginPath(); G.roundRect(x - s / 2 + 3, y - s / 2 + 3, s - 6, s * 0.2, s * 0.14); G.fill();
    G.restore();
  });
  rise('谁敢停下？', 960, 180, 0.1, t, { size: 92, glow: 'rgba(0,0,0,0.9)' });
  vignette(0.7);
}
function hexA(h) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},A)`; }
// 8. 反转：不是人推 AI，是 AI 和资本推着人跑
function runner(x, y, s, ph, col, lean = 0.25) {
  G.save(); G.translate(x, y); G.strokeStyle = col; G.fillStyle = col; G.lineCap = 'round'; G.lineWidth = s * 0.11;
  const hipY = -s * 0.5, sh = [Math.sin(lean) * s * 0.42, hipY - Math.cos(lean) * s * 0.42];
  G.beginPath(); G.arc(sh[0] + Math.sin(lean) * s * 0.14, sh[1] - s * 0.13, s * 0.1, 0, 7); G.fill();
  G.beginPath(); G.moveTo(0, hipY); G.lineTo(sh[0], sh[1]); G.stroke();
  const leg = (p) => { const a = Math.sin(p) * 0.7; const kx = Math.sin(a) * s * 0.26, ky = hipY + Math.cos(a) * s * 0.26; G.beginPath(); G.moveTo(0, hipY); G.lineTo(kx, ky); G.lineTo(kx + Math.sin(a - 0.5 - 0.4 * Math.max(0, -Math.sin(p))) * s * 0.26, ky + s * 0.24); G.stroke(); };
  leg(ph); leg(ph + Math.PI);
  const arm = (p) => { const a = -Math.sin(p) * 0.9; G.beginPath(); G.moveTo(sh[0], sh[1] + s * 0.03); G.lineTo(sh[0] + Math.sin(a) * s * 0.2, sh[1] + Math.cos(a) * s * 0.2); G.lineTo(sh[0] + Math.sin(a) * s * 0.2 + s * 0.12, sh[1] + Math.cos(a) * s * 0.2 - s * 0.08); G.stroke(); };
  arm(ph); arm(ph + Math.PI);
  G.restore();
}
function shot8(t) {
  bg('#0a0909', '#000');
  const gy = 820;
  G.fillStyle = '#060508'; G.fillRect(0, gy, W, H - gy);
  G.strokeStyle = 'rgba(255,190,120,0.25)'; G.beginPath(); G.moveTo(0, gy); G.lineTo(W, gy); G.stroke();
  const flip = 2.05;
  if (t < flip) {
    const x = 560 + t * 60;
    // 人推着光球
    G.save(); G.translate(x, gy); G.strokeStyle = WARM; G.fillStyle = WARM; G.lineWidth = 12; G.lineCap = 'round';
    G.beginPath(); G.arc(70, -250, 22, 0, 7); G.fill();
    G.beginPath(); G.moveTo(0, -120); G.lineTo(60, -220); G.lineTo(150, -200); G.moveTo(60, -220); G.lineTo(140, -170);
    G.moveTo(0, -120); G.lineTo(-40 + 10 * Math.sin(t * 6), -60); G.lineTo(-80 + 10 * Math.sin(t * 6), 0); G.moveTo(0, -120); G.lineTo(30, -60); G.lineTo(0, 0); G.stroke(); G.restore();
    G.save(); G.globalCompositeOperation = 'lighter'; glowDot(x + 260, gy - 110, 240, 'rgba(120,190,255,A)', 0.55); G.restore();
    G.save(); G.fillStyle = ICE; G.shadowColor = BLUE; G.shadowBlur = 50; G.beginPath(); G.arc(x + 260, gy - 110, 100, 0, 7); G.fill(); G.restore();
  } else {
    const tt = t - flip;
    // 光球 + 资本在后，推着人群
    const ox = -80 + tt * 90;
    G.save(); G.globalCompositeOperation = 'lighter'; glowDot(ox + 260, gy - 220, 520, 'rgba(110,180,255,A)', 0.6); G.restore();
    swarm(ox + 160, gy - 200, t, 800, 200, 0, 12);
    G.save(); G.fillStyle = ICE; G.shadowColor = BLUE; G.shadowBlur = 80; G.beginPath(); G.arc(ox + 300, gy - 230, 210, 0, 7); G.fill(); G.restore();
    const r = rng(9);
    for (let i = 0; i < 14; i++) {
      const x = ox + 620 + i * 95 + r() * 60, s = 110 + r() * 80;
      runner(x + tt * (60 + 20 * r()), gy, s, t * 11 + r() * 6, '#140f0c', 0.35);
      G.save(); G.globalAlpha = 0.35; runner(x + tt * (60 + 20 * r()) - 3, gy, s, t * 11 + r() * 6, WARM, 0.35); G.restore();
    }
    rise('推着人往前跑', 960, 220, 0.9, tt, { size: 92, color: GOLD, glow: 'rgba(242,180,90,0.6)' });
  }
  const wp = Math.max(0, 1 - Math.abs(t - flip) / 0.18);
  if (wp > 0) { G.fillStyle = `rgba(255,255,255,${wp * 0.85})`; G.fillRect(0, 0, W, H); }
  vignette();
}
// 9. 增长曲线
function shot9(t) {
  bg('#090a0d', '#000');
  const x0 = 230, x1 = 1640, yb = 860, top = 210, vmax0 = 135;
  const squash = ease(seg(t, 3.9, 4.8)), vmax = mix(vmax0, vmax0 * 3.2, squash);
  const X = (yr) => x0 + (yr - 1) / (2022 - 1) * (x1 - x0), Y = (v) => yb - v / vmax * (yb - top);
  // 坐标轴
  G.strokeStyle = 'rgba(200,200,210,0.35)'; G.lineWidth = 2; G.beginPath(); G.moveTo(x0, top - 20); G.lineTo(x0, yb); G.lineTo(x1 + 60, yb); G.stroke();
  [1, 500, 1000, 1500, 2000].forEach(yr => text(yr === 1 ? '公元 1 年' : yr + '', X(yr), yb + 34, { size: 24, font: SANS, weight: 400, color: '#7c7f88' }));
  text('世界 GDP（万亿国际元，2011 年价）', x0 - 10, top - 50, { size: 24, font: SANS, weight: 400, color: '#7c7f88', align: 'left' });
  const yrNow = Math.round(1 + 2021 * Math.pow(ease(seg(t, 0.1, 2.3)), 1.4));
  const pts = A.gdp.filter(d => d[0] <= yrNow);
  // 面积高亮
  const hk = seg(t, 2.4, 2.9);
  if (hk > 0) {
    const area = (a, b, col) => { G.beginPath(); G.moveTo(X(a), yb); A.gdp.forEach(([y, v]) => { if (y >= a && y <= b) G.lineTo(X(y), Y(v)); }); G.lineTo(X(b), yb); G.closePath(); G.fillStyle = col; G.fill(); };
    area(1, 1870, `rgba(255,176,112,${0.28 * hk})`); area(1871, 1970, `rgba(242,180,90,${0.85 * hk})`);
  }
  G.save(); G.strokeStyle = GOLD; G.lineWidth = 5; G.shadowColor = GOLD; G.shadowBlur = 16; G.beginPath();
  pts.forEach(([y, v], i) => i ? G.lineTo(X(y), Y(v)) : G.moveTo(X(y), Y(v))); G.stroke(); G.restore();
  if (t < 2.5) text(`${yrNow} 年`, X(yrNow) - 20, Math.min(Y(pts[pts.length - 1][1]) - 40, yb - 60), { size: 40, font: SANS, weight: 700, color: GOLD, align: 'right' });
  if (hk > 0) {
    rise('100 年 ≈ 1870 年', 330, 370, 2.5, t, { size: 84, color: GOLD, align: 'left', out: 3.8 });
  }
  if (hk > 0) {
    const cum = (a, b) => A.gdp.reduce((m, [y, v]) => m + (y >= a && y <= b ? v : 0), 0);
    const c1 = cum(1, 1870), c2 = cum(1871, 1970), bw = 560 / Math.max(c1, c2);
    const ba = hk * (1 - seg(t, 3.8, 4.1)), grow = ease(seg(t, 2.6, 3.3));
    G.save(); G.globalAlpha = ba;
    G.fillStyle = 'rgba(255,176,112,0.45)'; G.fillRect(330, 520, c1 * bw * grow, 44);
    G.fillStyle = GOLD; G.fillRect(330, 600, c2 * bw * grow, 44); G.restore();
    text('公元 1—1870 年累计', 320, 542, { size: 26, font: SANS, weight: 500, color: '#d9c3a3', align: 'right', alpha: ba });
    text('1871—1970 年累计', 320, 622, { size: 26, font: SANS, weight: 500, color: GOLD, align: 'right', alpha: ba });
    text(`${Math.round(c1)} 万亿`, 340 + c1 * bw * grow, 542, { size: 24, font: SANS, weight: 400, color: '#d9c3a3', align: 'left', alpha: ba * grow });
    text(`${Math.round(c2)} 万亿`, 340 + c2 * bw * grow, 622, { size: 24, font: SANS, weight: 400, color: GOLD, align: 'left', alpha: ba * grow });
  }
  // AI 曲线
  const ak = seg(t, 4.3, 5.6);
  if (ak > 0) {
    G.save(); G.strokeStyle = BLUE; G.lineWidth = 6; G.setLineDash([16, 10]); G.shadowColor = BLUE; G.shadowBlur = 30; G.beginPath();
    const n = 40; for (let i = 0; i <= n * ak; i++) { const u = i / n, x = X(2022) + u * 170, v = 130 * Math.exp(u * 4.2) ; i ? G.lineTo(x, Y(v)) : G.moveTo(x, Y(v)); }
    G.stroke(); G.restore();
    rise('十年？', 1500, 330, 4.5, t, { size: 110, color: ICE, glow: 'rgba(110,180,255,0.9)', align: 'right' });
  }
  text('数据：Maddison Project Database 2023；1820 年前为 Maddison (2017) 估算，经 Our World in Data。', 60, 1030, { size: 20, font: SANS, weight: 400, color: '#5d6069', align: 'left' });
  vignette(0.5);
}
// 10. 神明俯视
function shot10(t) {
  const st = Object.assign({}, A.gods, { sacred: 1, camera: 'elite', duration: 4, caption: '人，还剩下什么？', captionAt: 2.3, captionSize: 96, captionY: 520, letterbox: false });
  Gods.draw(G, t, st);
  text('看板娘为非官方同人形象，与各公司无关', 1880, 1046, { size: 18, font: SANS, weight: 400, color: 'rgba(220,220,230,0.45)', align: 'right' });
}
// 11. 定规则的权力
const RULES = ['第一条　人类拥有最终决定权', '第二条　AI 必须服务于人类', '第三条　任何系统不得越过此线'];
const SCR = '人类拥有最终决定权服务越线ΣΔΩ∴01λ∞#';
function shot11(t) {
  bg('#070a10', '#000');
  const k = ease(seg(t, 0, 0.5));
  G.save(); G.globalAlpha = k; G.translate(960, 500); G.scale(0.96 + 0.04 * k, 0.96 + 0.04 * k);
  G.fillStyle = 'rgba(14,18,28,0.95)'; G.strokeStyle = 'rgba(200,220,255,0.6)'; G.lineWidth = 2; G.shadowColor = 'rgba(120,180,255,0.6)'; G.shadowBlur = 40;
  G.beginPath(); G.roundRect(-520, -270, 1040, 520, 18); G.fill(); G.stroke(); G.restore();
  text('规　则', 960, 300, { size: 40, color: `rgba(230,220,200,${k})` });
  const scr = seg(t, 1.0, 2.8), r = rng(Math.floor(t * 20));
  RULES.forEach((ln, i) => {
    const y = 410 + i * 100, chars = [...ln];
    G.save(); G.font = `500 46px ${SERIF}`; G.textBaseline = 'middle'; let x = 960 - G.measureText(ln).width / 2;
    chars.forEach((ch, j) => {
      const thr = scr * 1.6 - (j / chars.length) * 0.6 - i * 0.15, bad = r() < thr * 0.7;
      const c = bad ? SCR[Math.floor(r() * SCR.length)] : ch, w = G.measureText(ch).width;
      G.fillStyle = bad ? BLUE : `rgba(255,232,200,${k})`; if (bad) { G.shadowColor = BLUE; G.shadowBlur = 16; } else G.shadowBlur = 0;
      G.globalAlpha = k * (bad && r() < 0.2 ? 0.4 : 1);
      G.fillText(c, x + (bad ? (r() - 0.5) * 8 * scr : 0), y + (bad ? (r() - 0.5) * 6 * scr : 0)); x += w;
    });
    G.restore();
  });
  const q = 1 + 0.5 * Math.max(0, 1 - Math.abs(t - 1.9) / 0.2);
  rise('定规则的权力？', 960, 920, 0.4, t, { size: 76 * q, color: '#f4efe6', glow: q > 1 ? 'rgba(127,196,255,0.9)' : null });
  vignette(0.7);
}
// 12–13. 两只手
function hands(t, rise13) {
  bg('#0a0908', '#000');
  const app = ease(seg(t, 0, 1.2)), close = ease(seg(t, 0.2, 4.2));
  const S = 2.35, gap = mix(260, 46, close);
  const hx = 960 - gap / 2 - 352 * S, hy = 560 - 60 * S;
  // 人类之手（原画，暖色）
  G.save(); G.globalAlpha = app; G.filter = 'sepia(0.2) saturate(1.35) brightness(1.05) contrast(1.1)';
  G.drawImage(A.handH, hx, hy + (67 - 67) * S, A.handH.width * S, A.handH.height * S); G.restore();
  G.save(); G.globalCompositeOperation = 'lighter'; glowDot(960 - gap / 2 - 30, 560, 220, 'rgba(255,170,90,A)', 0.18 * app); G.restore();
  // AI 之手（光点）
  const ax = 960 + gap / 2 - 4, ay = 560 - 64 * S;
  const up = rise13 ? ease(seg(rise13, 0.4, 3.0)) : 0, disp = rise13 ? seg(rise13, 0.6, 3.4) : 0;
  const r = rng(5);
  G.save(); G.globalCompositeOperation = 'lighter';
  const pts = P.aiPts;
  for (let i = 0; i < pts.length; i++) {
    const [px, py, l] = pts[i], rr = r(), rr2 = r();
    let x = ax + px * S + Math.sin(t * 2 + i) * 1.2, y = ay + py * S - up * 640 + Math.cos(t * 1.7 + i * 0.7) * 1.2;
    x += (rr - 0.5) * 300 * disp * disp; y -= rr2 * 500 * disp * disp;
    const a = app * (0.35 + 0.6 * l) * (1 - disp * 0.85);
    if (a <= 0.01) continue;
    G.fillStyle = `rgba(${150 + 100 * l},${200 + 50 * l},255,${a})`; const s = 1.6 + 2.2 * l;
    G.fillRect(x, y, s, s);
  }
  glowDot(ax + 140 * S, ay + 70 * S - up * 640, 420, 'rgba(110,180,255,A)', 0.2 * app * (1 - disp));
  G.restore();
}
function shot12(t) {
  hands(t, 0);
  rise('共生？', 960, 190, 0.4, t, { size: 92 });
  vignette(0.65);
}
function shot13(t) {
  hands(5 + t, t);
  const d = seg(t, 1.9, 2.5); if (d > 0) { G.fillStyle = `rgba(0,0,0,${0.82 * d})`; G.fillRect(0, 0, W, H); }
  { const parts = ['被抛弃的，', '也许', '就是', '人类自己。']; G.save(); G.font = `700 76px ${SERIF}`; const ws = parts.map(p => G.measureText(p).width); G.restore();
    let x = 960 - ws.reduce((a, b) => a + b, 0) / 2; parts.forEach((p, i) => { rise(p, x, 540, 2.1 + i * 0.32, t, { size: 76, align: 'left', dur: 0.6 }); x += ws[i]; }); }
  vignette(0.7);
  const end = seg(t, 3.55, 4.0); if (end > 0) { G.fillStyle = `rgba(0,0,0,${end})`; G.fillRect(0, 0, W, H); }
}

// 14. 终章：AI 巨像——从神像面孔拉远，露出整座神殿和脚下渺小的人
const COLOSSI = [['gemini', 150, 300, 1250, 0.5], ['deepseek', 1770, 300, 1250, 0.5], ['chatgpt', 500, 150, 1450, 0.25], ['grok', 1420, 150, 1450, 0.25], ['claude', 960, 20, 1700, 0]];
function shot14(t) {
  const k = ease(seg(t, 0.3, 5.2)), hx = 960, hy = 20 + 0.075 * 1700;
  const z = Math.exp(Math.log(2.7) * (1 - k)), fx = mix(hx, 960, k), fy = mix(hy + 90, 540, k);
  G.save(); G.translate(W / 2, H / 2); G.scale(z, z); G.translate(-fx, -fy);
  const sk = G.createLinearGradient(0, -200, 0, 1100); sk.addColorStop(0, '#04060d'); sk.addColorStop(0.5, '#141b33'); sk.addColorStop(0.82, '#3d3036'); sk.addColorStop(1, '#7a4f33');
  G.fillStyle = sk; G.fillRect(-400, -400, W + 800, H + 800);
  // 圣光
  G.save(); G.globalCompositeOperation = 'lighter';
  const r = rng(61);
  for (let i = 0; i < 28; i++) { const a = r() * Math.PI * 2 + t * 0.025, wd = 0.012 + 0.03 * r(), L = 2400;
    const gr = G.createRadialGradient(hx, hy, 0, hx, hy, L); gr.addColorStop(0, `rgba(255,225,170,${0.1 + 0.1 * r()})`); gr.addColorStop(1, 'rgba(255,225,170,0)');
    G.fillStyle = gr; G.beginPath(); G.moveTo(hx, hy); G.lineTo(hx + Math.cos(a - wd) * L, hy + Math.sin(a - wd) * L); G.lineTo(hx + Math.cos(a + wd) * L, hy + Math.sin(a + wd) * L); G.fill(); }
  glowDot(hx, hy, 820, 'rgba(255,210,140,A)', 0.45); glowDot(hx, hy, 300, 'rgba(255,240,210,A)', 0.5);
  G.strokeStyle = 'rgba(255,230,180,0.55)'; G.lineWidth = 4; G.beginPath(); G.arc(hx, hy, 270, 0, 7); G.stroke();
  G.lineWidth = 1.5; G.beginPath(); G.arc(hx, hy, 296, 0, 7); G.stroke();
  G.restore();
  // 巨像（远的雾更重）
  COLOSSI.forEach(([id, x, top, h, haze], i) => {
    const S = P.statues.find(q => q.id === id), w = h * S.w / S.h, br = 1 + 0.004 * Math.sin(t * 0.8 + i);
    G.save(); G.translate(x, top + h * 0.6); G.scale(br, br); G.translate(-x, -(top + h * 0.6));
    G.save(); G.globalCompositeOperation = 'lighter'; G.globalAlpha = 0.5 - haze * 0.4; const gk = h / (S.h / 4);
    G.drawImage(S.glow, x - w / 2 - 30 * gk, top - 30 * gk, S.glow.width * gk, S.glow.height * gk); G.restore();
    G.globalAlpha = 1 - haze * 0.35; G.drawImage(S.c, x - w / 2, top, w, h);
    G.restore();
  });
  // 云海：暖色暮霭，上下边缘都柔和过渡，不形成色带
  const mist = G.createLinearGradient(0, 600, 0, 1080);
  mist.addColorStop(0, 'rgba(60,46,36,0)'); mist.addColorStop(0.45, 'rgba(70,54,42,0.55)'); mist.addColorStop(0.8, 'rgba(40,30,24,0.9)'); mist.addColorStop(1, 'rgba(14,11,10,1)');
  G.fillStyle = mist; G.fillRect(-400, 600, W + 800, 800);
  const cr = rng(64);
  for (let i = 0; i < 70; i++) { const x = cr() * 2400 - 240 + Math.sin(t * 0.25 + i) * 30, y = 700 + cr() * 300, sz = 220 + 420 * cr();
    const gr = G.createRadialGradient(x, y, 0, x, y, sz); const c = cr() < 0.5 ? '150,124,96' : '96,78,62';
    gr.addColorStop(0, `rgba(${c},${0.16 + 0.16 * cr()})`); gr.addColorStop(1, `rgba(${c},0)`); G.fillStyle = gr; G.beginPath(); G.ellipse(x, y, sz, sz * 0.3, 0, 0, 7); G.fill(); }
  // 石台与一个仰望的人
  G.fillStyle = '#06050a'; G.beginPath(); G.moveTo(-200, 1050); G.quadraticCurveTo(960, 1000, 2120, 1050); G.lineTo(2120, 1400); G.lineTo(-200, 1400); G.fill();
  glowDot(960, 1020, 70, 'rgba(255,190,120,A)', 0.6);
  G.fillStyle = '#0b0705'; G.beginPath(); G.arc(960, 1003.5, 2.4, 0, 7); G.fill(); G.fillRect(958.2, 1006, 3.6, 10); G.fillRect(958.2, 1015, 1.5, 9); G.fillRect(960.3, 1015, 1.5, 9);
  // 上升光尘
  G.save(); G.globalCompositeOperation = 'lighter'; const mr = rng(65);
  for (let i = 0; i < 160; i++) { const sp = 18 + 45 * mr(), x = mr() * W, y = 1100 - ((t * sp + mr() * 1300) % 1300), s2 = 0.8 + 2.2 * mr();
    G.fillStyle = `rgba(255,214,150,${0.2 + 0.5 * mr()})`; G.beginPath(); G.arc(x, y, s2, 0, 7); G.fill(); }
  G.restore();
  G.restore();
  vignette(0.7);
  const tk = seg(t, 5.0, 6.0) * (1 - seg(t, 7.0, 7.5));
  if (tk > 0) { G.save(); G.globalAlpha = tk; G.filter = `blur(${(1 - tk) * 6}px)`;
    text('下一个生产力的代表', 960, 900, { size: 88, color: '#fff3dc', glow: 'rgba(0,0,0,0.95)', blur: 40 }); G.restore(); }
  const fi = 1 - seg(t, 0, 1.2); if (fi > 0) { G.fillStyle = `rgba(0,0,0,${fi})`; G.fillRect(0, 0, W, H); }
  const fo = seg(t, 7.1, 7.5); if (fo > 0) { G.fillStyle = `rgba(0,0,0,${fo})`; G.fillRect(0, 0, W, H); }
}

const SHOTS = [[0, 9, shot1], [9, 14, shot2], [14, 18, shot3], [18, 22, shot4], [22, 26, shot5], [26, 29, shot6], [29, 33, shot7], [33, 38, shot8], [38, 44, shot9], [44, 48, shot10], [48, 51, shot11], [51, 56, shot12], [56, 60, shot13], [60, 67.5, shot14]];
window.SHOTS = SHOTS.map(s => [s[0], s[1]]);
const ACTS = [[0, '序', '引文'], [9, '第一幕', '生产力'], [18, '第二幕', '资本'], [33, '第三幕', '神明'], [48, '尾声', '规则与双手']];
// 转场：push = 旧画面向镜头推近并淡出；其余边界用 0.2 s 的短暗场
const PUSH = { 9: 1, 18: 1, 29: 1, 44: 1 };
function drawShot(s, t) { G.save(); s[2](t); G.restore(); }
function goldDust(T) {
  const r = rng(91); G.save(); G.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const sp = 6 + 14 * r(), x = (r() * 2200 + T * (4 + 6 * r())) % 2200 - 140, y = (r() * 1300 + T * sp) % 1300 - 110, s = 1 + 2.5 * r();
    G.fillStyle = `rgba(240,190,110,${0.12 + 0.25 * r() * (0.6 + 0.4 * Math.sin(T * 1.5 + i))})`; G.beginPath(); G.arc(x, y, s, 0, 7); G.fill();
  }
  G.restore();
}
// 钩子词：在转折点上屏的短词（设计时间）
const KICKERS = [[15.25, 16.2, '但是——', 960, 300, 96, '#efe6d6'], [18.25, 19.7, '你知道吗？', 960, 965, 60, GOLD], [26.1, 27.15, '它的新宿主，竟然是——', 960, 200, 64, '#efe6d6'],
  [33.2, 34.85, '其实，反了。', 960, 230, 92, '#efe6d6'], [38.25, 40.3, '没想到吧？', 400, 400, 76, GOLD], [44.15, 45.2, '原来——', 960, 210, 88, '#fff3dc']];
let BUF = null;
window.renderAt = function (T) {
  G = G0; G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over'; G.filter = 'none';
  G.fillStyle = '#000'; G.fillRect(0, 0, W, H);
  const idx = Math.max(0, SHOTS.findIndex(([a, b]) => T >= a && T < b)), s = idx >= 0 ? SHOTS[idx] : SHOTS[SHOTS.length - 1];
  const t = T - s[0], dur = s[1] - s[0];
  drawShot(s, t);
  G.setTransform(1, 0, 0, 1, 0, 0);
  if ((s[0] < 44 || s[0] >= 48) && s[0] < 60) goldDust(T);
  // 推进式转场
  if (PUSH[s[0]] && t < 0.45 && idx > 0) {
    const p = SHOTS[idx - 1], k = t / 0.45;
    if (!BUF) BUF = canvas(W, H);
    const bg2 = BUF.getContext('2d'); bg2.setTransform(1, 0, 0, 1, 0, 0); bg2.globalAlpha = 1; bg2.globalCompositeOperation = 'source-over'; bg2.filter = 'none';
    bg2.fillStyle = '#000'; bg2.fillRect(0, 0, W, H);
    G = bg2; drawShot(p, p[1] - p[0] - 0.001 + t); G = G0;
    G.save(); G.globalAlpha = 1 - ease(k); const z = 1 + 0.9 * k * k; G.translate(W / 2, H / 2); G.scale(z, z); G.translate(-W / 2, -H / 2);
    G.filter = `blur(${k * 10}px)`; G.drawImage(BUF, 0, 0); G.restore();
  } else if (s[0] > 0) {
    const fin = 1 - seg(t, 0, 0.22); if (fin > 0) { G.fillStyle = `rgba(0,0,0,${fin})`; G.fillRect(0, 0, W, H); }
  }
  const next = SHOTS[idx + 1];
  if (next && !PUSH[next[0]] && s[0] !== 56) { const fo = seg(t, dur - 0.12, dur); if (fo > 0) { G.fillStyle = `rgba(0,0,0,${fo * 0.8})`; G.fillRect(0, 0, W, H); } }
  if (s[0] === 0) { const k = 1 - seg(t, 0, 0.6); if (k > 0) { G.fillStyle = `rgba(0,0,0,${k})`; G.fillRect(0, 0, W, H); } }
  // 幕次小标
  const act = ACTS.filter(a => T >= a[0]).pop(), ak = seg(T, act[0] + 0.3, act[0] + 0.9) * (1 - seg(T, 59, 59.6));
  if (ak > 0) { text(act[1], 72, 70, { size: 24, align: 'left', color: 'rgba(239,230,214,0.75)', alpha: ak, weight: 600 });
    G.save(); G.font = `600 24px ${SERIF}`; const w = G.measureText(act[1]).width; G.restore();
    text('· ' + act[2], 82 + w, 70, { size: 22, align: 'left', font: SANS, weight: 400, color: 'rgba(239,230,214,0.5)', alpha: ak }); }
  KICKERS.forEach(([a, b, str, x, y, size, col]) => { if (T >= a - 0.01 && T < b + 0.4) rise(str, x, y, a, T, { size, color: col, out: b, dur: 0.28, glow: 'rgba(0,0,0,0.95)', blur: 30 }); });
  grain(T);
};
// 口播对齐：新时间（随配音）→ 原动画时间，分段线性
const SPEED = 1.06, LEAD = 0.5, COLD = 4.4;
const VOICE = [[0.6, 0.04], [4.6, 5.66], [9.1, 10.44], [11.4, 14.01], [14.05, 17.13], [15.3, 18.33], [18.1, 22.67], [20.0, 25.39], [22.2, 27.72], [26.1, 31.0], [29.1, 34.73], [31.0, 36.86], [33.1, 38.89], [35.2, 40.58], [38.1, 43.9], [42.0, 48.96], [44.1, 51.33], [46.3, 54.21], [48.2, 56.24], [51.2, 57.81], [53.5, 60.14], [56.1, 62.41], [57.9, 65.11], [60.0, 67.54]];
const WARP = [[0, 0]].concat(VOICE.map(([o, v]) => [LEAD + v / SPEED, o]));
WARP.push([WARP[WARP.length - 1][0] + 7.5, 67.5]);
window.T_MAX = WARP[WARP.length - 1][0];
window.oldT = function (n) {
  for (let i = 1; i < WARP.length; i++) if (n <= WARP[i][0]) { const [n0, o0] = WARP[i - 1], [n1, o1] = WARP[i]; return o0 + (o1 - o0) * (n - n0) / (n1 - n0); }
  return 67.49;
};
// 冷开场：正片之前 COLD 秒，先把结尾的巨像和全片的问题亮出来
function coldOpen(n) {
  G = G0; G.setTransform(1, 0, 0, 1, 0, 0); G.globalAlpha = 1; G.globalCompositeOperation = 'source-over'; G.filter = 'none';
  G.fillStyle = '#000'; G.fillRect(0, 0, W, H);
  const beat = n < 1.5 ? 0 : n < 3.0 ? 1 : 2, bt = n - [0, 1.5, 3.0][beat];
  if (beat < 2) {
    const z = beat === 0 ? 1.0 + 0.04 * bt : 1.55 + 0.05 * bt, cy = beat === 0 ? H / 2 : 260;
    G.save(); G.translate(W / 2, cy); G.scale(z, z); G.translate(-W / 2, -cy);
    shot14(4.4 + n * 0.12); G.restore();
    G.fillStyle = 'rgba(0,0,0,0.38)'; G.fillRect(0, 0, W, H);
    if (beat === 0) rise('马克思说对了一半', 960, 800, 0.12, bt, { size: 110, color: '#fff3dc', glow: 'rgba(0,0,0,0.95)', blur: 40, dur: 0.3 });
    else glitch('另一半，他没想到', 960, 800, n, Math.max(0, 1 - bt * 2.2), { size: 120, color: '#ffe9c4', glow: 'rgba(232,184,106,0.9)', font: SERIF, weight: 700 });
    const fl = Math.max(0, 1 - bt / 0.14); if (fl > 0) { G.fillStyle = `rgba(255,240,215,${fl * 0.7})`; G.fillRect(0, 0, W, H); }
  } else {
    bg('#14100b', '#000');
    rise('一分钟看懂', 960, 430, 0.05, bt, { size: 54, font: SANS, weight: 500, color: GOLD, dur: 0.3 });
    rise('资本为什么非追 AI 不可', 960, 560, 0.25, bt, { size: 104, dur: 0.35 });
    const out = seg(bt, 1.15, 1.4); if (out > 0) { G.fillStyle = `rgba(0,0,0,${out})`; G.fillRect(0, 0, W, H); }
  }
  G.setTransform(1, 0, 0, 1, 0, 0); goldDust(n + 40); vignette(0.6); grain(n);
}
window.T_MAX += COLD;
window.COLD = COLD;
window.drawAt = function (n) { if (n < COLD) coldOpen(n); else renderAt(Math.min(67.49, oldT(n - COLD))); };
window.voiceT = function (o) { for (let i = 1; i < WARP.length; i++) if (o <= WARP[i][1]) { const [n0, o0] = WARP[i - 1], [n1, o1] = WARP[i]; return COLD + n0 + (n1 - n0) * (o - o0) / Math.max(1e-6, o1 - o0); } return window.T_MAX; };
window.frameAt = function (n, q) { if (n < COLD) coldOpen(n); else renderAt(Math.min(67.49, oldT(n - COLD))); return cv.toDataURL('image/jpeg', q || 0.93); };
window.frameJPEG = function (T, q) { renderAt(T); return cv.toDataURL('image/jpeg', q || 0.93); };
loadAll();
