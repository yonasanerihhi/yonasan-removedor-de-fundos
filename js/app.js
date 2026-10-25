const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const ev = (n) => {
  try {
    gtag('event', n);
  } catch (e) {}
};

$('#wm').textContent = 'YONASAN '.repeat(90);

const cv = $('#cv');
const cx = cv.getContext('2d', { willReadFrequently: true });
const st = $('#st');

let W, H, orig, cur, hist = [], redo = [], picks = [], tool = 'wand', mode = 'a', nm = 'img', crop = null, down = 0, last, items = [], cuIt, addMode = 0, sO = 0, bg = '', pick = 0;

const clone = (d) => new ImageData(new Uint8ClampedArray(d.data), d.width, d.height);
const draw = () => {
  sO = 0;
  $$('#orig,#eye').forEach((b) => b.classList.remove('on'));
  cx.putImageData(cur, 0, 0);
};
const snap = () => {
  hist.push(clone(cur));
  if (hist.length > 25) hist.shift();
  redo = [];
};
const toast = (t, ms = 4500) => {
  const e = $('#toast');
  e.innerHTML = t;
  e.style.display = 'block';
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (e.style.display = 'none'), ms);
};

$$('[data-ev]').forEach((a) => a.addEventListener('click', () => ev(a.dataset.ev)));

// ---------- entrada de arquivos ----------
const drop = $('#drop');
const file = $('#file');
drop.onclick = (e) => {
  if (e.target.closest && (e.target.closest('#demo') || e.target.closest('#demo-thumb'))) return;
  // Já tem imagem aberta? Novas entram na lista (não apagam as antigas)
  addMode = !$('#app').hidden ? 1 : 0;
  file.click();
};
file.onchange = () => {
  load(file.files, addMode || !$('#app').hidden);
  file.value = '';
};
['dragenter', 'dragover'].forEach((e) =>
  drop.addEventListener(e, (x) => {
    x.preventDefault();
    drop.classList.add('over');
  })
);
['dragleave', 'drop'].forEach((e) => drop.addEventListener(e, () => drop.classList.remove('over')));
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  e.preventDefault();
  load(e.dataTransfer.files, !$('#app').hidden);
});
addEventListener('paste', (e) => {
  const f = [...e.clipboardData.files];
  if (f.length) load(f, !$('#app').hidden);
});
$('#new').onclick = () => {
  // "Nova imagem" também adiciona à lista, em vez de substituir
  addMode = 1;
  file.click();
};

const decode = (f) =>
  new Promise((r) => {
    const im = new Image();
    im.onerror = () => r(0);
    im.onload = () => {
      let w = im.naturalWidth,
        h = im.naturalHeight;
      let resized = false;
      if (Math.max(w, h) > 3000) {
        const s = 3000 / Math.max(w, h);
        w = Math.round(w * s);
        h = Math.round(h * s);
        resized = true;
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0, w, h);
      let o;
      try {
        o = x.getImageData(0, 0, w, h);
      } catch (err) {
        if (typeof f !== 'string') URL.revokeObjectURL(im.src);
        r(0);
        return;
      }
      if (typeof f !== 'string') URL.revokeObjectURL(im.src);
      r({
        nm: (typeof f === 'string' ? 'exemplo' : f.name || 'img').replace(/\.[^.]+$/, '') || 'img',
        orig: o,
        src0: o,
        cur: clone(o),
        hist: [],
        redo: [],
        picks: [],
        resized,
      });
    };
    im.src = typeof f === 'string' ? f : URL.createObjectURL(f);
  });

function use(it) {
  cuIt = it;
  orig = it.orig;
  cur = it.cur;
  hist = it.hist;
  redo = it.redo;
  picks = it.picks;
  nm = it.nm;
  W = cv.width = orig.width;
  H = cv.height = orig.height;
  crop = null;
  $('#cr').style.display = 'none';
}

function save() {
  const t = cuIt;
  if (!t) return;
  t.orig = orig; // inclui o recorte (antes só o 'cur' era guardado)
  t.cur = cur;
  t.hist = hist;
  t.redo = redo;
  t.picks = picks;
  t.t = null;
}

function thumb(it) {
  const d = it.cur,
    s = 56 / Math.max(d.width, d.height),
    c = document.createElement('canvas'),
    t = document.createElement('canvas');
  c.width = Math.max(1, (d.width * s) | 0);
  c.height = Math.max(1, (d.height * s) | 0);
  t.width = d.width;
  t.height = d.height;
  t.getContext('2d').putImageData(d, 0, 0);
  c.getContext('2d').drawImage(t, 0, 0, c.width, c.height);
  return c.toDataURL();
}

function strip() {
  $('#strip').innerHTML =
    items
      .map(
        (it, i) =>
          `<img data-i="${i}" class="${it === cuIt ? 'on' : ''}" src="${it.t || (it.t = thumb(it))}">`
      )
      .join('') + '<b id="plus" title="Adicionar mais imagens">＋</b>';
  $('#dz').hidden = $('#da').hidden = items.length < 2;
}

function sel(i) {
  save();
  use(items[i]);
  draw();
  resetZoom();
  rsw();
  strip();
}

$('#strip').onclick = (e) => {
  const i = e.target.dataset.i;
  if (i != null) sel(+i);
  else if (e.target.id == 'plus') {
    addMode = 1;
    file.click();
  }
};

// Depois de carregar imagens: encolhe a área de upload e rola até o editor
function miniDrop() {
  if (!document.getElementById('mini-drop-css')) {
    const st = document.createElement('style');
    st.id = 'mini-drop-css';
    st.textContent =
      '#drop.mini{min-height:0!important;height:48px!important;padding:0 14px!important;margin-bottom:10px!important;' +
      'display:flex!important;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden}' +
      '#drop.mini small,#drop.mini .btn-demo,#drop.mini #demo-thumb{display:none!important}' +
      '#drop.mini .drop-main{font-size:.9rem;margin:0}';
    document.head.append(st);
  }
  drop.hidden = false;
  drop.classList.add('mini');
  const m = drop.querySelector('.drop-main');
  if (m) m.textContent = '＋ Arraste, cole (Ctrl+V) ou toque para adicionar mais imagens';
}

function scrollToEditor() {
  setTimeout(() => {
    const top = drop.getBoundingClientRect().top + window.scrollY - 8;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, 80);
}

async function load(fs, add) {
  const list = [...fs];
  const fromFiles = list.filter((f) => f && f.type && f.type.startsWith('image/')).slice(0, 20);
  const fromUrl = list.filter((f) => typeof f === 'string').slice(0, 20);
  const inputs = fromFiles.length ? fromFiles : fromUrl;
  if (!inputs.length) return;
  save();
  toast('Processando…');
  const ns = [];
  let anyResized = false;
  for (const f of inputs) {
    const it = await decode(f);
    if (it) {
      if (it.resized) anyResized = true;
      ns.push(it);
    }
  }
  if (!ns.length) return;
  if (!add) items = [];
  const first = items.length;
  for (const it of ns) {
    items.push(it);
    use(it);
    runAuto();
    save();
    await new Promise((r) => setTimeout(r));
  }
  miniDrop();
  $('#app').hidden = false;
  const steps = document.querySelector('.steps');
  if (steps) steps.hidden = true;
  sel(first);
  scrollToEditor();
  glowEye();
  let msg =
    ns.length > 1
      ? ns.length + ' imagens prontas! Ajuste uma a uma ou baixe tudo.'
      : 'Pronto! Ajuste nos modos ou baixe o PNG.';
  if (anyResized) {
    msg +=
      ' (Imagem muito grande — reduzimos um pouco para o navegador não travar.)';
  }
  toast(msg);
}


/**
 * Exemplo — mesmo jeito do antigo exemplo.png.
 * Arquivo: img/exemplo-site.jpg  (SEM espaço no nome!)
 * Fallback: gera no canvas se o arquivo não puder ser lido (file://).
 */
function makeDemoBlob() {
  const w = 720, h = 480;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#bae6c4';
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#1e78dc';
  x.beginPath();
  x.ellipse(300, 200, 90, 95, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#fff';
  x.beginPath();
  x.ellipse(275, 185, 16, 20, 0, 0, Math.PI * 2);
  x.ellipse(325, 185, 16, 20, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#1a2850';
  x.beginPath();
  x.ellipse(275, 188, 7, 9, 0, 0, Math.PI * 2);
  x.ellipse(325, 188, 7, 9, 0, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#1964c8';
  x.beginPath();
  const rr = (x0, y0, ww, hh, r) => {
    x.beginPath();
    x.moveTo(x0 + r, y0);
    x.arcTo(x0 + ww, y0, x0 + ww, y0 + hh, r);
    x.arcTo(x0 + ww, y0 + hh, x0, y0 + hh, r);
    x.arcTo(x0, y0 + hh, x0, y0, r);
    x.arcTo(x0, y0, x0 + ww, y0, r);
    x.closePath();
    x.fill();
  };
  x.fillStyle = '#1964c8';
  rr(240, 280, 120, 140, 24);
  x.fillStyle = '#fff';
  rr(400, 150, 260, 180, 12);
  x.fillStyle = '#e11';
  rr(420, 175, 100, 80, 8);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

// Só em file:// (uso local) carrega a imagem embutida; online não baixa nada extra
function loadDemoData() {
  return new Promise((res) => {
    if (window.DEMO_IMAGE_DATA_URL || location.protocol !== 'file:') return res();
    const sc = document.createElement('script');
    sc.src = 'js/demo-data.js';
    sc.onload = sc.onerror = () => res();
    document.head.append(sc);
  });
}

async function runDemo(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  ev('click_demo');
  const before = items.length;

  // 1) Imagem embutida (js/demo-data.js): funciona em uso local (file://)
  await loadDemoData();
  if (window.DEMO_IMAGE_DATA_URL) {
    await load([window.DEMO_IMAGE_DATA_URL], !$('#app').hidden);
    if (items.length > before) return;
  }

  // Igual ao antigo exemplo.png — só muda o nome do arquivo
  await load(['img/exemplo-site.jpg'], !$('#app').hidden);
  if (items.length > before) return;

  await load(['img/exemplo site.jpg'], !$('#app').hidden);
  if (items.length > before) return;

  // O que fazia o antigo "sempre funcionar" em file://: pixels criados no canvas (File)
  const blob = await makeDemoBlob();
  const f = new File([blob], 'exemplo.png', { type: 'image/png' });
  await load([f], !$('#app').hidden);
}

$('#demo')?.addEventListener('click', runDemo);
$('#demo-thumb')?.addEventListener('click', runDemo);

// ---------- núcleo ----------
const tol = () => +$('#tol').value;
const dst = (s, i, cols) => {
  let m = 1e9;
  for (const c of cols) {
    const v = Math.hypot(s[i] - c[0], s[i + 1] - c[1], s[i + 2] - c[2]);
    if (v < m) m = v;
  }
  return m;
};
const fade = (d, i, v, t) => {
  const a = (255 * (v - t)) / (t * 0.4);
  if (a < d[i + 3]) d[i + 3] = a;
};
const px = (d, x, y) => {
  const i = (y * W + x) * 4;
  return [d[i], d[i + 1], d[i + 2]];
};

function flood(src, out, seeds, cols, t) {
  const s = src.data,
    d = out.data,
    seen = new Uint8Array(W * H),
    q = [];
  const add = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const k = y * W + x;
    if (!seen[k]) {
      seen[k] = 1;
      q.push(x, y);
    }
  };
  seeds.forEach((p) => add(p[0], p[1]));
  while (q.length) {
    const y = q.pop(),
      x = q.pop(),
      i = (y * W + x) * 4;
    const v = s[i + 3] < 10 ? 0 : dst(s, i, cols);
    if (v <= t) {
      d[i + 3] = 0;
      add(x + 1, y);
      add(x - 1, y);
      add(x, y + 1);
      add(x, y - 1);
    } else if (v < t * 1.4) fade(d, i, v, t);
  }
}

function edges() {
  const a = [];
  for (let x = 0; x < W; x++) a.push([x, 0], [x, H - 1]);
  for (let y = 0; y < H; y++) a.push([0, y], [W - 1, y]);
  return a;
}

function checker() {
  const n = Math.min(48, W, H),
    d = orig.data;
  let lo = null,
    hi = null,
    ll = 999,
    hl = -1;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const c = px(d, x, y),
        l = c[0] + c[1] + c[2];
      if (Math.abs(c[0] - c[1]) > 14 || Math.abs(c[1] - c[2]) > 14) return null;
      if (l < ll) {
        ll = l;
        lo = c;
      }
      if (l > hl) {
        hl = l;
        hi = c;
      }
    }
  return (hl - ll) / 3 >= 6 && hl / 3 > 110 ? [lo, hi] : null;
}

function runAuto() {
  const ck = checker();
  let cols,
    t = tol();
  if (ck) {
    cols = ck;
    t = Math.max(6, t * 0.5);
  } else {
    const c = [
      [0, 0],
      [W - 1, 0],
      [0, H - 1],
      [W - 1, H - 1],
    ].map((p) => px(orig.data, p[0], p[1]));
    cols = [[0, 1, 2].map((k) => c.reduce((a, b) => a + b[k], 0) / 4)];
  }
  snap();
  cur = clone(orig);
  flood(orig, cur, edges(), cols, t);
  draw();
}

function runSel() {
  snap();
  cur = clone(orig);
  const t = tol();
  if (picks.length) {
    const cols = picks.map((p) => p.c);
    if ($('#gl').checked) {
      const s = orig.data,
        d = cur.data;
      for (let i = 0; i < s.length; i += 4) {
        const v = dst(s, i, cols);
        if (v <= t) d[i + 3] = 0;
        else if (v < t * 1.4) fade(d, i, v, t);
      }
    } else {
      const seeds = [];
      let manual = false;
      picks.forEach((p) => (p.x == null ? (manual = true) : seeds.push([p.x, p.y])));
      if (manual) seeds.push(...edges()); // cor do seletor: remove a partir das bordas
      flood(orig, cur, seeds, cols, t);
    }
  }
  draw();
}

function rsw() {
  $('#swl').innerHTML = picks.length
    ? picks
        .map(
          (p, i) =>
            `<b data-i="${i}" title="Tocar para remover" style="background:rgb(${p.c})"></b>`
        )
        .join('')
    : '<span class="hint">Nenhuma ainda</span>';
}

$('#swl').onclick = (e) => {
  const i = e.target.dataset.i;
  if (i == null) return;
  picks.splice(i, 1);
  rsw();
  runSel();
};

const modal = (t, bs) =>
  new Promise((r) => {
    $('#mt').textContent = t;
    const w = $('#mbtn');
    w.innerHTML = '';
    bs.forEach((b, i) => {
      const e = document.createElement('button');
      e.textContent = b;
      if (i && i == bs.length - 1) e.className = 'o';
      e.onclick = () => {
        $('#md').hidden = true;
        r(i);
      };
      w.append(e);
    });
    $('#md').hidden = false;
  });

function setPick(v) {
  pick = v;
  $('#pk').classList.toggle('on', !!v);
  st.classList.toggle('armed', !!v);
  $('#pkh').hidden = !v;
}

$('#pk').onclick = async () => {
  if (pick) return setPick(0);
  if ($('#al').checked) {
    const r = await modal(
      'Toque na imagem, em cima da cor do fundo que você quer remover.',
      ['Entendido', 'Não repetir a mensagem', 'Cancelar']
    );
    if (r == 2) return;
    if (r == 1) $('#al').checked = false;
  }
  setPick(1);
};

$('#gl').onchange = runSel;
$('#tol').oninput = () => ($('#tv').textContent = tol());
$('#tol').onchange = () => {
  if (!orig) return;
  if (mode == 'a') runAuto();
  else if (mode == 's') runSel();
};

// ---------- modos e ferramentas ----------
function ta() {
  cv.style.touchAction =
    panMode || (mode == 'e' && (tool == 'er' || tool == 'rs' || tool == 'cp')) ? 'none' : 'auto';
  cv.style.cursor = panMode ? 'grab' : '';
}

$$('.tabs button[data-m]').forEach(
  (b) =>
    (b.onclick = () => {
      mode = b.dataset.m;
      $$('.tabs button[data-m]').forEach((x) => x.classList.toggle('on', x == b));
      $$('.pn').forEach((p) => p.classList.toggle('on', p.dataset.m == mode));
      $('#hv').hidden = mode == 'a';
      if (mode != 's') setPick(0);
      ta();
    })
);

$$('#tools button').forEach(
  (b) =>
    (b.onclick = () => {
      tool = b.dataset.t;
      $$('#tools button').forEach((x) => x.classList.toggle('on', x == b));
      $('#apr').style.display = tool == 'cp' ? '' : 'none';
      $('#bsr').style.display = tool == 'er' || tool == 'rs' ? '' : 'none';
      ta();
    })
);

const pt = (e) => {
  const r = cv.getBoundingClientRect();
  return {
    x: Math.min(W - 1, Math.max(0, Math.floor(((e.clientX - r.left) * W) / r.width))),
    y: Math.min(H - 1, Math.max(0, Math.floor(((e.clientY - r.top) * H) / r.height))),
  };
};

function stroke(a, b) {
  const r = (+$('#bs').value * W) / cv.getBoundingClientRect().width / 2,
    d = cur.data,
    o = orig.data,
    er = tool == 'er';
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (r / 2)));
  for (let k = 0; k <= n; k++) {
    const cxp = a.x + ((b.x - a.x) * k) / n,
      cyp = a.y + ((b.y - a.y) * k) / n;
    for (let y = Math.max(0, Math.floor(cyp - r)); y <= Math.min(H - 1, cyp + r); y++)
      for (let x = Math.max(0, Math.floor(cxp - r)); x <= Math.min(W - 1, cxp + r); x++) {
        if ((x - cxp) ** 2 + (y - cyp) ** 2 > r * r) continue;
        const i = (y * W + x) * 4;
        if (er) d[i + 3] = 0;
        else {
          d[i] = o[i];
          d[i + 1] = o[i + 1];
          d[i + 2] = o[i + 2];
          d[i + 3] = o[i + 3];
        }
      }
  }
}

function showCrop() {
  if (!crop) return;
  const s = cv.clientWidth / W,
    e = $('#cr');
  e.style.display = 'block';
  e.style.left = Math.min(crop.x0, crop.x1) * s + 'px';
  e.style.top = Math.min(crop.y0, crop.y1) * s + 'px';
  e.style.width = Math.abs(crop.x1 - crop.x0) * s + 'px';
  e.style.height = Math.abs(crop.y1 - crop.y0) * s + 'px';
}

cv.onpointerdown = (e) => {
  if (!orig) return;
  if (panMode) {
    panning = { x: e.clientX, y: e.clientY, l: st.scrollLeft, t: st.scrollTop };
    cv.setPointerCapture(e.pointerId);
    cv.style.cursor = 'grabbing';
    return;
  }
  const p = pt(e);
  if (mode == 's') {
    if (!pick) {
      toast('Toque em “Selecionar na imagem” antes 👆');
      return;
    }
    picks.push({ x: p.x, y: p.y, c: px(orig.data, p.x, p.y) });
    rsw();
    runSel();
    return;
  }
  if (mode != 'e') return;
  if (tool == 'wand') {
    snap();
    flood(cur, cur, [[p.x, p.y]], [px(cur.data, p.x, p.y)], tol());
    draw();
    return;
  }
  cv.setPointerCapture(e.pointerId);
  down = 1;
  if (tool == 'cp') {
    crop = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    showCrop();
  } else {
    snap();
    last = p;
    stroke(p, p);
    draw();
  }
};

cv.onpointermove = (e) => {
  if (panning) {
    st.scrollLeft = panning.l - (e.clientX - panning.x);
    st.scrollTop = panning.t - (e.clientY - panning.y);
    return;
  }
  if (!down) return;
  const p = pt(e);
  if (tool == 'cp') {
    crop.x1 = p.x;
    crop.y1 = p.y;
    showCrop();
  } else {
    stroke(last, p);
    last = p;
    draw();
  }
};

cv.onpointerup = cv.onpointercancel = () => {
  down = 0;
  if (panning) {
    panning = null;
    cv.style.cursor = panMode ? 'grab' : '';
  }
};

const sub = (d, x, y, w, h) => {
  const o = new ImageData(w, h);
  for (let r = 0; r < h; r++)
    o.data.set(
      d.data.subarray(((y + r) * d.width + x) * 4, ((y + r) * d.width + x + w) * 4),
      r * w * 4
    );
  return o;
};

function doCrop(x, y, w, h) {
  if (w < 4 || h < 4) return;
  orig = sub(orig, x, y, w, h);
  cur = sub(cur, x, y, w, h);
  W = cv.width = w;
  H = cv.height = h;
  hist = [];
  redo = [];
  picks = [];
  rsw();
  crop = null;
  $('#cr').style.display = 'none';
  draw();
  resetZoom();
}

$('#ap').onclick = () => {
  if (crop)
    doCrop(
      Math.min(crop.x0, crop.x1),
      Math.min(crop.y0, crop.y1),
      Math.abs(crop.x1 - crop.x0),
      Math.abs(crop.y1 - crop.y0)
    );
};

$('#trim').onclick = () => {
  const d = cur.data;
  let x0 = W,
    y0 = H,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return toast('Imagem vazia');
  doCrop(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  toast('Espaço vazio cortado');
};

function morph(m) {
  snap();
  const s = cur.data,
    o = new Uint8ClampedArray(s),
    od = orig.data;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let mn = 255,
        mx = 0,
        sm = 0,
        n = 0;
      for (let j = -1; j < 2; j++)
        for (let k = -1; k < 2; k++) {
          const X = x + k,
            Y = y + j;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const a = s[(Y * W + X) * 4 + 3];
          if (a < mn) mn = a;
          if (a > mx) mx = a;
          sm += a;
          n++;
        }
      const i = (y * W + x) * 4,
        v = m == 'c' ? mn : m == 'x' ? mx : sm / n;
      if (v > s[i + 3]) {
        o[i] = od[i];
        o[i + 1] = od[i + 1];
        o[i + 2] = od[i + 2];
      }
      o[i + 3] = v;
    }
  s.set(o);
  draw();
}

$$('[data-r]').forEach((b) => (b.onclick = () => morph(b.dataset.r)));

// ---------- zoom ----------
let zoom = 1, panMode = false, panning = null;

function applyZoom() {
  const bx = $('#st');
  ['width', 'height', 'maxWidth', 'maxHeight'].forEach((k) => {
    cv.style[k] = '';
    bx.style[k] = '';
  });
  cv.style.removeProperty('max-width');
  cv.style.removeProperty('max-height');
  bx.style.overflow = '';
  bx.style.boxSizing = '';
  const label = $('#zr');
  if (label) label.textContent = Math.round(zoom * 100) + '%';
  if (zoom <= 1.001) return;
  const fw = cv.clientWidth, fh = cv.clientHeight;
  if (!fw || !fh) return;
  bx.style.boxSizing = 'content-box';
  bx.style.width = fw + 'px';
  bx.style.height = fh + 'px';
  bx.style.maxWidth = 'none';
  bx.style.overflow = 'auto';
  cv.style.setProperty('max-width', 'none', 'important');
  cv.style.setProperty('max-height', 'none', 'important');
  cv.style.width = fw * zoom + 'px';
  cv.style.height = fh * zoom + 'px';
}

function setZoom(z, cx, cy) {
  if (!orig) return;
  z = Math.min(8, Math.max(1, z));
  const bx = $('#st');
  const r = cv.getBoundingClientRect();
  if (cx == null) {
    const b = bx.getBoundingClientRect();
    cx = b.left + b.width / 2;
    cy = b.top + b.height / 2;
  }
  const fx = r.width ? (cx - r.left) / r.width : 0.5;
  const fy = r.height ? (cy - r.top) / r.height : 0.5;
  zoom = z;
  applyZoom();
  if (zoom > 1.001) {
    const r2 = cv.getBoundingClientRect();
    bx.scrollLeft += r2.left + fx * r2.width - cx;
    bx.scrollTop += r2.top + fy * r2.height - cy;
  } else if (panMode) {
    $('#zp').click();
  }
  if (crop) showCrop();
}

function resetZoom() {
  zoom = 1;
  if (panMode) {
    panMode = false;
    $('#zp')?.classList.remove('on');
    ta();
  }
  applyZoom();
}

$('#zi').onclick = () => setZoom(zoom * 1.5);
$('#zo').onclick = () => setZoom(zoom / 1.5);
$('#zr').onclick = () => setZoom(1);
$('#zp').onclick = () => {
  panMode = !panMode;
  $('#zp').classList.toggle('on', panMode);
  ta();
  if (panMode && zoom <= 1.001) toast('Aumente o zoom (＋) para poder mover a imagem 🔍');
};
st.addEventListener(
  'wheel',
  (e) => {
    if (!orig || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY);
  },
  { passive: false }
);
let rzT;
addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => zoom > 1.001 && applyZoom(), 150);
});

// ---------- seletor de cor (modo "Selecionar fundo") ----------
$('#cpk').addEventListener('change', (e) => {
  if (!orig) return;
  const h = e.target.value;
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  picks.push({ x: null, y: null, c });
  rsw();
  runSel();
  toast('Cor adicionada — removida a partir das bordas. Ative “Remover em toda a imagem” para tirar de todo lugar.');
});

// ---------- histórico e visual ----------
function undo() {
  if (hist.length) {
    redo.push(cur);
    cur = hist.pop();
    draw();
  }
}
function rdo() {
  if (redo.length) {
    hist.push(cur);
    cur = redo.pop();
    draw();
  }
}
$('#un').onclick = undo;
$('#re').onclick = rdo;
$('#rst').onclick = () => {
  snap();
  cur = clone(orig);
  picks = [];
  rsw();
  draw();
};

addEventListener('keydown', (e) => {
  if (!orig || !(e.ctrlKey || e.metaKey)) return;
  if (e.key == 'z') {
    e.preventDefault();
    undo();
  }
  if (e.key == 'y') {
    e.preventDefault();
    rdo();
  }
});

const BG = [
  ['', 'Transparente'],
  ['#00ff00', 'Verde'],
  ['#00b140', 'Verde escuro'],
  ['#ff0000', 'Vermelho'],
  ['#0000ff', 'Azul'],
  ['#00ffff', 'Ciano'],
  ['#ffff00', 'Amarelo'],
  ['#ff8800', 'Laranja'],
  ['#ff00ff', 'Rosa'],
  ['#ffffff', 'Branco'],
  ['#808080', 'Cinza'],
  ['#000000', 'Preto'],
];

function setBg(b) {
  bg = b;
  st.classList.toggle('ck', !b);
  st.style.background = b;
  $$('#bgs i').forEach((i) => i.classList.toggle('on', i.dataset.b == b));
  $('#bgn').textContent = 'Fundo: ' + BG.find((x) => x[0] == b)[1];
}

$('#bgs').innerHTML = BG.map(
  (c) =>
    `<i data-b="${c[0]}" title="${c[1]}" class="${c[0] ? '' : 'ck'}" style="${c[0] ? 'background:' + c[0] : ''}"></i>`
).join('');
$('#bgs').onclick = (e) => {
  if (e.target.tagName == 'I') setBg(e.target.dataset.b);
};
setBg('');

const showOrig = (on) => {
  if (!orig) return;
  sO = !!on;
  cx.putImageData(sO ? orig : cur, 0, 0);
  $$('#orig,#eye').forEach((b) => b.classList.toggle('on', sO));
  $('#orig').classList.toggle('hold-on', sO);
  $('#eye')?.classList.remove('glow');
};
// Clique = alternar | Segurar = ver original até soltar
const bindOrig = (btn) => {
  let tmr = 0,
    held = false,
    locked = false;
  btn.addEventListener('pointerdown', (e) => {
    if (!orig) return;
    held = false;
    locked = false;
    tmr = setTimeout(() => {
      held = true;
      showOrig(true);
    }, 320);
  });
  const end = () => {
    clearTimeout(tmr);
    if (held) {
      showOrig(false);
      locked = true;
    }
    held = false;
  };
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointerleave', end);
  btn.addEventListener('pointercancel', end);
  btn.addEventListener('click', (e) => {
    if (locked) {
      e.preventDefault();
      locked = false;
      return;
    }
    showOrig(!sO);
  });
};
['#orig', '#eye'].forEach((q) => {
  const b = $(q);
  if (b) bindOrig(b);
});

// Faz o olho brilhar por alguns segundos quando entram imagens novas
function glowEye() {
  const e = $('#eye');
  if (!e) return;
  e.classList.remove('glow');
  void e.offsetWidth;
  e.classList.add('glow');
  clearTimeout(glowEye.t);
  glowEye.t = setTimeout(() => e.classList.remove('glow'), 4200);
}

// ---------- exportar ----------
const blob = () =>
  new Promise((r) => {
    draw();
    if (!bg) return cv.toBlob(r, 'image/png');
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);
    x.drawImage(cv, 0, 0);
    c.toBlob(r, 'image/png');
  });

const dlink = (b, n) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = n;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

const thanks = () => {
  ev('use_tool_success');
  if (document.body.classList.contains('electron-app')) {
    toast('✅ PNG pronto! Obrigado por apoiar o canal 💙');
    return;
  }
  let msg =
    '✅ PNG pronto! Vale salvar o site nos favoritos. Curtiu? Apoie com um Pix ou ';
  try {
    if (!sessionStorage.getItem('yona_desk_tip')) {
      sessionStorage.setItem('yona_desk_tip', '1');
      msg =
        '✅ PNG pronto! Membros têm <a onclick="ev(\'click_seja_membro\')" style="color:#fff" target="_blank" href="https://www.youtube.com/@YonasanErihhi/join">versão desktop no PC</a> (a partir de R$ 3,99*) · ou mande um Pix 💙<br><small>*Valor de 24/10/2026, sujeito a mudanças.</small>';
    } else {
      msg +=
        '<a onclick="ev(\'click_seja_membro\')" style="color:#fff" target="_blank" href="https://www.youtube.com/@YonasanErihhi/join">vire membro (R$ 3,99*)</a> 💙<br><small>*Valor de 24/10/2026, sujeito a mudanças.</small>';
    }
  } catch (e) {
    msg +=
      '<a onclick="ev(\'click_seja_membro\')" style="color:#fff" target="_blank" href="https://www.youtube.com/@YonasanErihhi/join">vire membro</a> 💙';
  }
  toast(msg, 8000);
};

$('#dl').onclick = async () => {
  dlink(await blob(), nm + '-yonasan.png');
  thanks();
};

$('#da').onclick = async () => {
  save();
  const keep = cuIt;
  for (let i = 0; i < items.length; i++) {
    use(items[i]);
    dlink(await blob(), `${items[i].nm}-${i + 1}-yonasan.png`);
    await new Promise((r) => setTimeout(r, 450));
  }
  use(keep);
  draw();
  thanks();
};

function zip(fs) {
  const T = [...Array(256)].map((_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const crc = (d) => {
    let c = -1;
    for (const b of d) c = T[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const P = [],
    C = [],
    E = new TextEncoder();
  let off = 0,
    cs = 0;
  for (const f of fs) {
    const n = E.encode(f.n),
      c = crc(f.d),
      L = f.d.length,
      h = new DataView(new ArrayBuffer(30)),
      e = new DataView(new ArrayBuffer(46));
    h.setUint32(0, 0x04034b50, 1);
    h.setUint16(4, 20, 1);
    h.setUint16(6, 0x800, 1);
    h.setUint32(14, c, 1);
    h.setUint32(18, L, 1);
    h.setUint32(22, L, 1);
    h.setUint16(26, n.length, 1);
    e.setUint32(0, 0x02014b50, 1);
    e.setUint16(4, 20, 1);
    e.setUint16(6, 20, 1);
    e.setUint16(8, 0x800, 1);
    e.setUint32(16, c, 1);
    e.setUint32(20, L, 1);
    e.setUint32(24, L, 1);
    e.setUint16(28, n.length, 1);
    e.setUint32(42, off, 1);
    P.push(h.buffer, n, f.d);
    C.push(e.buffer, n);
    off += 30 + n.length + L;
    cs += 46 + n.length;
  }
  const z = new DataView(new ArrayBuffer(22));
  z.setUint32(0, 0x06054b50, 1);
  z.setUint16(8, fs.length, 1);
  z.setUint16(10, fs.length, 1);
  z.setUint32(12, cs, 1);
  z.setUint32(16, off, 1);
  return new Blob([...P, ...C, z.buffer], { type: 'application/zip' });
}

$('#dz').onclick = async () => {
  save();
  const keep = cuIt,
    fs = [];
  toast('Gerando ZIP…');
  for (let i = 0; i < items.length; i++) {
    use(items[i]);
    const b = await blob();
    fs.push({
      n: `${items[i].nm}-${i + 1}-yonasan.png`,
      d: new Uint8Array(await b.arrayBuffer()),
    });
  }
  use(keep);
  draw();
  dlink(zip(fs), 'remover-de-fundos-imagens.zip');
  thanks();
};

$('#rall').onclick = async () => {
  if (
    (await modal(
      'Resetar tudo? Todas as imagens voltam ao original e as edições serão perdidas.',
      ['Resetar tudo', 'Cancelar']
    )) != 0
  )
    return;
  save();
  const keep = cuIt;
  $('#tol').value = 40;
  $('#tv').textContent = 40;
  setBg('');
  setPick(0);
  $('.tabs button').click();
  $('#tools button').click();
  for (const it of items) {
    it.orig = it.src0;
    it.cur = clone(it.src0);
    it.hist = [];
    it.redo = [];
    it.picks = [];
    use(it);
    runAuto();
    save();
  }
  use(keep);
  draw();
  rsw();
  strip();
  toast('Tudo resetado ✔');
};

// ---------- Termos de Uso ----------
const termsModal = $('#terms-modal');
const openTerms = () => {
  termsModal.hidden = false;
  document.body.style.overflow = 'hidden';
};
const closeTerms = () => {
  termsModal.hidden = true;
  document.body.style.overflow = '';
};
$('#open-terms')?.addEventListener('click', openTerms);
$('#close-terms')?.addEventListener('click', closeTerms);
termsModal?.addEventListener('click', (e) => {
  if (e.target === termsModal) closeTerms();
});

rsw();
