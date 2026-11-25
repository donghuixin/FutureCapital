/* 神明场景渲染器：五位巨大的 AI 看板娘从云层中升起，俯视渺小的人间。
 * 纯函数式绘制：draw(ctx, t, state) 只依赖时间 t 和 state，可逐帧录制。
 * 坐标以 1920×1080 设计，figure 的 x/top 为该画布像素，h 为高度占画面高度的倍数。 */
(function (root) {
  const W = 1920, H = 1080, BASE = H - 92;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const mix = (a, b, k) => a + (b - a) * k;

  function canvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }

  // 柔和圆斑精灵，用来堆云和光点
  const SPRITES = {};
  function blob(color) {
    if (SPRITES[color]) return SPRITES[color];
    const c = canvas(256, 256), g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, color); gr.addColorStop(0.45, color.replace(/[\d.]+\)$/, '0.45)'));
    gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return (SPRITES[color] = c);
  }

  // 每个人物预处理：底部淡入云层 + 大气雾化 + 发光轮廓
  const CACHE = new Map();
  function prepared(fig) {
    const key = [fig.id, fig.img && fig.img.src && fig.img.src.length, fig.haze, fig.fade, fig.glowColor, fig.shade].join('|');
    if (CACHE.has(key)) return CACHE.get(key);
    const img = fig.img, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const body = canvas(w, h), g = body.getContext('2d');
    g.filter = 'saturate(0.78) contrast(1.06)';
    g.drawImage(img, 0, 0);
    g.filter = 'none';
    // 大气透视：向天空色偏移
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(62,92,140,${fig.haze})`; g.fillRect(0, 0, w, h);
    const hg = g.createLinearGradient(0, h * 0.25, 0, h * fig.fade);
    hg.addColorStop(0, 'rgba(52,76,118,0)'); hg.addColorStop(1, 'rgba(52,76,118,0.7)');
    g.fillStyle = hg; g.fillRect(0, 0, w, h);
    const sg = g.createLinearGradient(0, 0, 0, h);
    sg.addColorStop(0, `rgba(0,0,8,${fig.shade * 0.4})`); sg.addColorStop(1, `rgba(0,0,8,${fig.shade})`);
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    // 底部渐隐
    g.globalCompositeOperation = 'destination-in';
    const fg = g.createLinearGradient(0, 0, 0, h);
    fg.addColorStop(0, 'rgba(0,0,0,1)');
    fg.addColorStop(clamp(fig.fade, 0.2, 0.95), 'rgba(0,0,0,1)');
    fg.addColorStop(clamp(fig.fade + 0.28, 0.3, 1), 'rgba(0,0,0,0)');
    g.fillStyle = fg; g.fillRect(0, 0, w, h);
    // 发光轮廓
    const s = 0.25, gw = Math.ceil(w * s) + 80, gh = Math.ceil(h * s) + 80;
    const glow = canvas(gw, gh), q = glow.getContext('2d');
    q.filter = 'blur(14px)';
    q.drawImage(body, 40, 40, w * s, h * s);
    q.filter = 'none';
    q.globalCompositeOperation = 'source-in';
    q.fillStyle = fig.glowColor || '#8fc4ff'; q.fillRect(0, 0, gw, gh);
    const out = { body, glow, w, h, gs: s };
    if (CACHE.size > 40) CACHE.clear();
    CACHE.set(key, out);
    return out;
  }

  const DEFAULT = {
    sky: 0.55, rays: 0.6, clouds: 0.75, cityLights: 0.8, people: 34, motes: 0.6,
    halo: 0.35, camera: 'reveal', duration: 8, caption: '', captionSize: 84, letterbox: true,
    figures: [
      { id: 'gemini', name: 'Gemini', x: 215, top: 150, h: 1.42, opacity: 0.9, glow: 0.5, haze: 0.38, shade: 0.45, fade: 0.42, sway: 1, glowColor: '#b49cff' },
      { id: 'deepseek', name: 'DeepSeek', x: 1715, top: 150, h: 1.42, opacity: 0.9, glow: 0.5, haze: 0.38, shade: 0.45, fade: 0.42, sway: 1, glowColor: '#7fb0ff' },
      { id: 'chatgpt', name: 'ChatGPT', x: 575, top: 95, h: 1.55, opacity: 0.95, glow: 0.6, haze: 0.26, shade: 0.35, fade: 0.44, sway: 1, glowColor: '#e8eefc' },
      { id: 'grok', name: 'Grok', x: 1355, top: 95, h: 1.55, opacity: 0.95, glow: 0.6, haze: 0.26, shade: 0.35, fade: 0.44, sway: 1, glowColor: '#ffcf7a' },
      { id: 'claude', name: 'Claude', x: 960, top: 40, h: 1.75, opacity: 1, glow: 0.7, haze: 0.12, shade: 0.25, fade: 0.46, sway: 1, glowColor: '#ffb070' },
    ],
  };

  function camera(state, t) {
    const d = Math.max(0.1, state.duration), k = ease(t / d);
    switch (state.camera) {
      case 'reveal': // 从仰望的人拉远、上摇，揭示巨神
        return { zoom: mix(4.5, 1, k), fx: 960, fy: mix(985, 540, k) };
      case 'elite': { // 先贴近四个精英剪影，再拉远揭示神明
        const e = ease(clamp((t / d - 0.32) / 0.55, 0, 1));
        return { zoom: Math.exp(Math.log(17) * (1 - e)), fx: mix(964, 960, e), fy: mix(BASE - 17, 540, Math.pow(e, 0.7)), close: 1 - e };
      }
      case 'push': return { zoom: mix(1, 1.14, k), fx: 960, fy: mix(540, 430, k) };
      case 'descend': return { zoom: mix(1.15, 1, k), fx: 960, fy: mix(300, 540, k) };
      default: return { zoom: 1, fx: 960, fy: 540 };
    }
  }

  function drawSky(g, state, t) {
    const b = state.sky;
    const gr = g.createLinearGradient(0, -400, 0, H);
    gr.addColorStop(0, `rgb(${3 + 8 * b},${5 + 10 * b},${14 + 26 * b})`);
    gr.addColorStop(0.55, `rgb(${12 + 22 * b},${20 + 34 * b},${44 + 60 * b})`);
    gr.addColorStop(0.86, `rgb(${40 + 40 * b},${38 + 30 * b},${52 + 30 * b})`);
    gr.addColorStop(1, `rgb(${70 + 50 * b},${44 + 26 * b},${30 + 14 * b})`);
    g.fillStyle = gr; g.fillRect(-W, -800, W * 3, H * 3);
    const r = rng(7);
    g.fillStyle = '#cfe0ff';
    for (let i = 0; i < 160; i++) {
      const x = r() * W, y = r() * H * 0.6 - 300, a = 0.15 + 0.5 * r() * (0.6 + 0.4 * Math.sin(t * 1.3 + i));
      g.globalAlpha = a * 0.6; g.fillRect(x, y, 1.6, 1.6);
    }
    g.globalAlpha = 1;
  }

  function drawRays(g, state, t, cx, cy) {
    if (state.rays <= 0) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    const r = rng(11);
    for (let i = 0; i < 14; i++) {
      const a0 = Math.PI * (0.18 + 0.64 * r()) + 0.04 * Math.sin(t * 0.25 + i), wd = 0.02 + 0.05 * r();
      const len = 1700;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, len);
      const al = state.rays * (0.05 + 0.06 * r()) * (0.7 + 0.3 * Math.sin(t * 0.7 + i * 1.7));
      gr.addColorStop(0, `rgba(190,215,255,${al})`); gr.addColorStop(1, 'rgba(190,215,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a0 - wd) * len, cy + Math.sin(a0 - wd) * len);
      g.lineTo(cx + Math.cos(a0 + wd) * len, cy + Math.sin(a0 + wd) * len);
      g.closePath(); g.fill();
    }
    g.restore();
  }

  // 圣光：主神像头后的放射光芒与光环
  function drawSacred(g, state, t) {
    const f = state.figures.find(q => q.id === 'claude') || state.figures[state.figures.length - 1];
    if (!f || !f._prep) return;
    const R = figureRect(f), hx = f.x, hy = R.y + R.h * 0.075, k = state.sacred;
    g.save(); g.globalCompositeOperation = 'lighter';
    const r = rng(61);
    for (let i = 0; i < 30; i++) {
      const a = r() * Math.PI * 2 + t * 0.03, wd = 0.012 + 0.028 * r(), L = 2200;
      const gr = g.createRadialGradient(hx, hy, 0, hx, hy, L);
      gr.addColorStop(0, `rgba(255,228,175,${(0.09 + 0.09 * r()) * k})`); gr.addColorStop(1, 'rgba(255,228,175,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(hx, hy);
      g.lineTo(hx + Math.cos(a - wd) * L, hy + Math.sin(a - wd) * L); g.lineTo(hx + Math.cos(a + wd) * L, hy + Math.sin(a + wd) * L); g.fill();
    }
    const gl = g.createRadialGradient(hx, hy, 0, hx, hy, 700);
    gl.addColorStop(0, `rgba(255,236,200,${0.55 * k})`); gl.addColorStop(0.35, `rgba(255,205,140,${0.22 * k})`); gl.addColorStop(1, 'rgba(255,205,140,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(hx, hy, 700, 0, 7); g.fill();
    g.strokeStyle = `rgba(255,232,185,${0.55 * k})`; g.lineWidth = 4; g.beginPath(); g.arc(hx, hy, R.h * 0.17, 0, 7); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.arc(hx, hy, R.h * 0.185, 0, 7); g.stroke();
    g.restore();
  }

  function figureRect(f) {
    const p = f._prep; const hh = f.h * H, ww = hh * p.w / p.h;
    return { x: f.x - ww / 2, y: f.top, w: ww, h: hh };
  }

  function drawFigure(g, f, state, t, i) {
    if (!f.img || f.visible === false || !(f.img.naturalWidth || f.img.width)) return;
    const p = (f._prep = prepared(f));
    const R = figureRect(f);
    const breathe = 1 + 0.006 * Math.sin(t * 0.9 + i * 1.3) * f.sway;
    const rot = 0.006 * Math.sin(t * 0.45 + i * 2.1) * f.sway;
    const float = 6 * Math.sin(t * 0.6 + i) * f.sway;
    g.save();
    g.translate(f.x, R.y + R.h * 0.62 + float);
    g.rotate(rot); g.scale(breathe * (f.flip ? -1 : 1), breathe);
    g.translate(-f.x, -(R.y + R.h * 0.62));
    // 头后光环
    if (state.halo > 0) {
      const hx = f.x, hy = R.y + R.h * 0.07, hr = R.h * 0.14;
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(hx, hy, hr * 0.2, hx, hy, hr * 1.6);
      gr.addColorStop(0, `rgba(255,236,200,${0.22 * state.halo * f.opacity})`);
      gr.addColorStop(0.55, `rgba(160,190,255,${0.1 * state.halo * f.opacity})`);
      gr.addColorStop(1, 'rgba(160,190,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(hx, hy, hr * 1.6, 0, 7); g.fill();
      g.strokeStyle = `rgba(255,230,190,${0.25 * state.halo * f.opacity})`; g.lineWidth = 2;
      g.beginPath(); g.arc(hx, hy, hr, 0, 7); g.stroke();
      g.globalCompositeOperation = 'source-over';
    }
    // 轮廓光
    if (f.glow > 0) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = f.glow * f.opacity * (0.75 + 0.25 * Math.sin(t * 1.1 + i));
      const k = R.h / (p.h * p.gs);
      g.drawImage(p.glow, R.x - 40 * k, R.y - 40 * k, p.glow.width * k, p.glow.height * k);
      g.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = f.opacity;
    g.drawImage(p.body, R.x, R.y, R.w, R.h);
    g.restore(); g.globalAlpha = 1;
  }

  function drawClouds(g, state, t, layer) {
    if (state.clouds <= 0) return;
    const r = rng(100 + layer);
    const base = [700, 830, 950][layer], n = [60, 56, 48][layer];
    const col = ['rgba(96,122,168,1)', 'rgba(70,84,112,1)', 'rgba(40,42,52,1)'][layer];
    const spr = blob(col);
    for (let i = 0; i < n; i++) {
      const sz = (260 + 420 * r()) * (1 + layer * 0.25);
      const x = ((r() * (W + 800) + t * (8 + 6 * layer) * (r() > 0.5 ? 1 : -1)) % (W + 800) + W + 800) % (W + 800) - 400;
      const y = base + (r() - 0.5) * 220;
      g.globalAlpha = state.clouds * (0.28 + 0.3 * r());
      g.drawImage(spr, x - sz / 2, y - sz * 0.32, sz, sz * 0.64);
    }
    g.globalAlpha = 1;
  }

  // 上海、纽约、香港混合天际线（地标剪影，基线 y=0，向上为负）
  const LANDMARKS = [
    ['esb', 260, 1.0], ['chrysler', 345, 0.92], ['wtc1', 470, 1.0],
    ['jinmao', 720, 0.92], ['swfc', 790, 1.0], ['sht', 880, 1.0], ['pearl', 1040, 0.9],
    ['ifc2', 1330, 1.0], ['boc', 1450, 1.0], ['icc', 1600, 1.0],
  ];
  function landmark(g, kind, x, s) {
    g.beginPath();
    const R = (x0, w, h) => g.rect(x + x0 * s, -h * s, w * s, h * s);
    switch (kind) {
      case 'esb': R(-14, 28, 70); R(-10, 20, 86); R(-6, 12, 98); R(-3, 6, 106); R(-1, 2, 128); break;
      case 'chrysler': R(-11, 22, 70); g.moveTo(x - 9 * s, -70 * s); g.lineTo(x - 9 * s, -84 * s); g.quadraticCurveTo(x, -104 * s, x + 9 * s, -84 * s); g.lineTo(x + 9 * s, -70 * s); R(-1, 2, 122); break;
      case 'wtc1': g.moveTo(x - 16 * s, 0); g.lineTo(x - 16 * s, -30 * s); g.lineTo(x - 9 * s, -128 * s); g.lineTo(x + 9 * s, -128 * s); g.lineTo(x + 16 * s, -30 * s); g.lineTo(x + 16 * s, 0); R(-1, 2, 160); break;
      case 'jinmao': for (let i = 0; i < 9; i++) R(-13 + i * 1.2, 26 - i * 2.4, 40 + i * 9); R(-1, 2, 128); break;
      case 'swfc': g.moveTo(x - 15 * s, 0); g.lineTo(x - 15 * s, -60 * s); g.lineTo(x - 6 * s, -140 * s); g.lineTo(x + 6 * s, -140 * s); g.lineTo(x + 15 * s, -60 * s); g.lineTo(x + 15 * s, 0); break;
      case 'sht': g.moveTo(x - 18 * s, 0); g.bezierCurveTo(x - 18 * s, -80 * s, x - 10 * s, -140 * s, x - 6 * s, -172 * s); g.lineTo(x + 8 * s, -178 * s); g.bezierCurveTo(x + 12 * s, -130 * s, x + 18 * s, -80 * s, x + 18 * s, 0); break;
      case 'pearl': R(-12, 4, 60); R(8, 4, 60); R(-2, 4, 120); g.moveTo(x + 16 * s, -54 * s); g.arc(x, -54 * s, 16 * s, 0, 7); g.moveTo(x + 9 * s, -100 * s); g.arc(x, -100 * s, 9 * s, 0, 7); g.moveTo(x + 4 * s, -124 * s); g.arc(x, -124 * s, 4 * s, 0, 7); R(-0.8, 1.6, 150); break;
      case 'ifc2': R(-12, 24, 120); R(-9, 18, 132); g.moveTo(x - 9 * s, -132 * s); g.lineTo(x - 5 * s, -146 * s); g.lineTo(x + 5 * s, -146 * s); g.lineTo(x + 9 * s, -132 * s); break;
      case 'boc': g.moveTo(x - 14 * s, 0); g.lineTo(x - 14 * s, -80 * s); g.lineTo(x - 4 * s, -126 * s); g.lineTo(x + 2 * s, -112 * s); g.lineTo(x + 14 * s, -96 * s); g.lineTo(x + 14 * s, 0); R(-5, 1.5, 150); R(1, 1.5, 140); break;
      case 'icc': R(-15, 30, 150); R(-10, 20, 158); break;
    }
    g.fill();
  }
  function drawCity(g, state, t) {
    const r = rng(42), base = BASE;
    // 远景楼群
    g.fillStyle = '#0d0e15';
    let x = -40;
    const lights = [];
    while (x < W + 40) {
      const bw = 8 + 20 * r(), bh = 8 + 40 * r() * r();
      g.fillRect(x, base - bh, bw, bh + 50);
      for (let wy = base - bh + 3; wy < base - 4; wy += 4) for (let wx = x + 2; wx < x + bw - 2; wx += 3.5) if (r() < 0.22 * state.cityLights) lights.push([wx, wy, r()]);
      x += bw + 1;
    }
    // 地标
    g.save(); g.translate(0, base); g.fillStyle = '#08080d';
    LANDMARKS.forEach(([k, lx, sc]) => landmark(g, k, lx, sc * 0.95));
    g.restore();
    lights.forEach(([wx, wy, a]) => { g.fillStyle = `rgba(255,${180 + 40 * a | 0},110,${0.3 + 0.5 * a})`; g.fillRect(wx, wy, 1.2, 1.5); });
    // 塔顶航标灯
    LANDMARKS.forEach(([k, lx], i) => { const on = Math.sin(t * 3 + i) > 0.3; if (on) { g.fillStyle = 'rgba(255,90,70,0.9)'; g.fillRect(lx - 1, base - [128,122,160,128,140,178,150,146,150,158][i] * 0.95 - 3, 2, 2); } });
    const gr = g.createLinearGradient(0, BASE - 100, 0, BASE + 40);
    gr.addColorStop(0, 'rgba(255,150,80,0)'); gr.addColorStop(1, `rgba(255,140,70,${0.2 * state.cityLights})`);
    g.fillStyle = gr; g.fillRect(0, BASE - 100, W, 140);
  }

  // 四个身份剪影（不对应任何真实人物）：演讲者、首富、芯片掌门、AI 公司 CEO。单位高度 1，脚在 0。
  function elite(g, kind) {
    // 身体：头、颈、躯干（西装外套）、双腿；手臂用圆头粗线
    const limb = (pts, w) => { g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
    g.beginPath(); g.ellipse(0, -0.925, 0.062, 0.078, 0, 0, 7); g.fill();
    g.fillRect(-0.025, -0.86, 0.05, 0.06);
    g.beginPath(); g.moveTo(-0.15, -0.79);
    g.quadraticCurveTo(-0.17, -0.6, -0.13, -0.36); g.lineTo(0.13, -0.36); g.quadraticCurveTo(0.17, -0.6, 0.15, -0.79);
    g.quadraticCurveTo(0, -0.83, -0.15, -0.79); g.fill();
    limb([[-0.06, -0.38], [-0.07, -0.18], [-0.075, -0.01]], 0.085);
    limb([[0.06, -0.38], [0.07, -0.18], [0.075, -0.01]], 0.085);
    g.fillRect(-0.12, -0.03, 0.09, 0.03); g.fillRect(0.03, -0.03, 0.09, 0.03);
    if (kind === 0) { // 演讲者：振臂，身前讲台
      limb([[0.13, -0.76], [0.22, -0.9], [0.27, -1.07]], 0.055); limb([[-0.13, -0.76], [-0.17, -0.58], [-0.19, -0.46]], 0.055);
      g.beginPath(); g.moveTo(-0.24, -0.5); g.lineTo(0.24, -0.5); g.lineTo(0.2, 0); g.lineTo(-0.2, 0); g.closePath(); g.fill();
    } else if (kind === 1) { // 首富：双手插兜，略后仰
      limb([[0.14, -0.76], [0.18, -0.58], [0.11, -0.45]], 0.055); limb([[-0.14, -0.76], [-0.18, -0.58], [-0.11, -0.45]], 0.055);
    } else if (kind === 2) { // 芯片掌门：高举一枚芯片
      limb([[0.13, -0.76], [0.25, -0.7], [0.27, -0.9]], 0.055); g.fillRect(0.22, -1.0, 0.1, 0.08);
      limb([[-0.13, -0.76], [-0.17, -0.56], [-0.15, -0.4]], 0.055);
    } else { // AI 公司 CEO：双臂交叉
      limb([[-0.13, -0.76], [-0.15, -0.62], [0.09, -0.6]], 0.06); limb([[0.13, -0.76], [0.15, -0.64], [-0.09, -0.62]], 0.06);
    }
  }
  function drawPeople(g, state, t, close) {
    const base = BASE;
    // 天台
    g.fillStyle = '#050407';
    g.beginPath(); g.moveTo(860, base + 1); g.lineTo(1060, base + 1); g.lineTo(1075, base + 60); g.lineTo(845, base + 60); g.fill();
    const lg = g.createRadialGradient(960, base - 6, 0, 960, base - 6, 70);
    lg.addColorStop(0, `rgba(255,190,120,${0.35 + 0.15 * close})`); lg.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = lg; g.beginPath(); g.arc(960, base - 6, 70, 0, 7); g.fill();
    [[926, 0, 31], [951, 1, 30], [977, 2, 30.5], [1002, 3, 29.5]].forEach(([x, k, h]) => {
      g.save(); g.translate(x, base); g.scale(h, h);
      if (close > 0) { g.shadowColor = `rgba(255,190,110,${0.9 * close})`; g.shadowBlur = 30 * close; }
      g.fillStyle = '#070506'; g.strokeStyle = '#070506'; g.lineCap = 'round'; g.lineJoin = 'round'; elite(g, k);
      g.restore();
      // 顶光勾边
      g.save(); g.translate(x, base); g.scale(h, h); g.globalCompositeOperation = 'source-atop';
      g.restore();
    });
    // 街头人群
    const r = rng(5); g.fillStyle = '#030305';
    for (let i = 0; i < state.people; i++) {
      const x = 960 + (r() - 0.5) * 1700, s = 3 + 3 * r();
      if (Math.abs(x - 960) < 130) continue;
      person(g, x, base + 28 + 10 * r(), s, 0);
    }
  }
  function person(g, x, y, s, look) {
    g.beginPath(); g.arc(x + look * s * 0.5, y - s * 0.86, s * 0.13, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x - s * 0.13, y - s * 0.7); g.lineTo(x + s * 0.13, y - s * 0.7);
    g.lineTo(x + s * 0.1, y - s * 0.32); g.lineTo(x + s * 0.08, y); g.lineTo(x - s * 0.08, y); g.lineTo(x - s * 0.1, y - s * 0.32);
    g.closePath(); g.fill();
  }

  function drawMotes(g, state, t) {
    if (state.motes <= 0) return;
    const r = rng(77), spr = blob('rgba(150,200,255,1)');
    g.save(); g.globalCompositeOperation = 'lighter';
    const n = Math.round(160 * state.motes);
    for (let i = 0; i < n; i++) {
      const sp = 10 + 30 * r(), x0 = r() * W, ph = r() * 2000;
      const y = H - ((t * sp + ph) % (H + 200)) + 100, x = x0 + 30 * Math.sin(t * 0.5 + i);
      const s = 4 + 14 * r() * r();
      g.globalAlpha = 0.25 + 0.5 * r(); g.drawImage(spr, x - s, y - s, s * 2, s * 2);
    }
    g.restore();
  }

  function caption(g, state, t) {
    if (!state.caption) return;
    const a = clamp((t - (state.captionAt || 0.5)) / 0.6, 0, 1);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${state.captionSize}px "Noto Serif CJK SC","Noto Serif SC","Songti SC",serif`;
    g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 30; g.fillStyle = '#f4efe6';
    g.fillText(state.caption, W / 2, state.captionY || H * 0.5);
    g.restore();
  }

  function draw(g, t, state) {
    state = state || DEFAULT;
    g.save();
    g.setTransform(g.canvas.width / W, 0, 0, g.canvas.height / H, 0, 0);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const cam = camera(state, t);
    // 分层视差：depth=1 跟随镜头全部缩放，depth 越小越远、缩放越少
    const layer = (depth, fn) => {
      const z = Math.exp(Math.log(cam.zoom) * depth);
      const fy = mix(540, cam.fy, Math.min(1, depth * 1.2)), fx = mix(960, cam.fx, depth);
      g.save(); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-fx, -fy); fn(); g.restore();
    };
    const close = cam.close || 0;
    layer(0.15, () => { drawSky(g, state, t); drawRays(g, state, t, 960, -120); });
    const figs = state.figures.slice().sort((a, b) => (a.z || 0) - (b.z || 0) || a.h - b.h);
    layer(0.3, () => {
      if (state.sacred) drawSacred(g, state, t);
      drawClouds(g, state, t, 0);
      figs.forEach((f) => drawFigure(g, f, state, t, state.figures.indexOf(f)));
      drawClouds(g, state, t, 1);
    });
    if (close > 0.001) {
      const hz = g.createLinearGradient(0, 0, 0, H);
      hz.addColorStop(0, `rgba(30,20,18,${0.96 * close})`); hz.addColorStop(0.6, `rgba(150,90,50,${0.92 * close})`); hz.addColorStop(1, `rgba(255,170,90,${0.95 * close})`);
      g.fillStyle = hz; g.fillRect(0, 0, W, H);
    }
    layer(0.62, () => { drawClouds(g, state, t, 2); drawCity(g, state, t); });
    layer(1, () => { drawPeople(g, state, t, close); g.fillStyle = '#050509'; g.fillRect(-W, BASE + 60, W * 3, 600); });
    layer(0.5, () => drawMotes(g, state, t));
    // 暗角
    const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    caption(g, state, t);
    if (state.letterbox) { g.fillStyle = '#000'; g.fillRect(0, 0, W, 56); g.fillRect(0, H - 56, W, 56); }
    g.restore();
  }

  function hit(state, x, y) {
    for (let i = state.figures.length - 1; i >= 0; i--) {
      const f = state.figures[i]; if (!f._prep || f.visible === false) continue;
      const R = figureRect(f);
      if (x >= R.x && x <= R.x + R.w && y >= R.y && y <= R.y + R.h * 0.7) return f;
    }
    return null;
  }

  root.Gods = { W, H, draw, DEFAULT, camera, hit, figureRect, rng, ease, clamp, invalidate: () => CACHE.clear() };
})(typeof window !== 'undefined' ? window : globalThis);
