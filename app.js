'use strict';
/* Interfaz: navegación, formularios, validaciones, resultados y gráficas. */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const METHOD_ORDER = ['T', 'S13', 'S38', 'AUTO', 'S13T'];
const CONV_NS = [4, 6, 8, 12, 24, 48, 96];
const MAX_N = 200000;

const STATE = {};
let CHARTS = [];

/* ================================================================ estado */
function initState(ex) {
  if (ex.kind === 'table') {
    return { rows: ex.data.map(([x, y]) => ({ x: String(x), y: String(y) })), method: ex.defMethod, integral: 0, preset: 0, importMsg: '' };
  }
  const params = {};
  ex.params.forEach(p => (params[p.key] = String(p.def)));
  return { params, n: String(ex.defN), method: ex.defMethod };
}
function getState(ex) { return STATE[ex.id] || (STATE[ex.id] = initState(ex)); }
function exById(id) { return EXERCISES.find(e => String(e.id) === String(id)); }

/* ================================================================ parseo y validación */
function parseNum(s) {
  if (s === null || s === undefined) return NaN;
  const t = String(s).trim().replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return NaN;
  return Number(t);
}

/* Datos tabulados → contexto de integración o lista de errores */
function analyseTable(ex, st) {
  const errors = [];
  const xs = [], ys = [];
  const names = { x: ex.xName, y: ex.yName };
  st.rows.forEach((r, i) => {
    for (const c of ['x', 'y']) {
      const raw = r[c];
      if (String(raw).trim() === '') { errors.push({ row: i, col: c, msg: `Nodo ${i}: el valor de ${names[c]} está vacío.` }); continue; }
      const v = parseNum(raw);
      if (Number.isNaN(v)) errors.push({ row: i, col: c, msg: `Nodo ${i}: «${raw}» no es un número válido en ${names[c]}.` });
      else (c === 'x' ? xs : ys)[i] = v;
    }
  });
  if (st.rows.length < 2) errors.push({ msg: 'Se necesitan al menos 2 puntos (1 subintervalo).' });
  if (errors.length) return { errors };
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] <= xs[i - 1]) errors.push({ row: i, col: 'x', msg: `${ex.xName} no es estrictamente creciente en el nodo ${i} (${xs[i]} ≤ ${xs[i - 1]}).` });
  }
  if (errors.length) return { errors };
  const n = xs.length - 1, h = (xs[n] - xs[0]) / n;
  let bad = 0;
  for (let i = 1; i <= n; i++) {
    if (Math.abs(xs[i] - xs[i - 1] - h) > 1e-6 * Math.abs(h)) {
      if (bad++ < 3) errors.push({ row: i, col: 'x', msg: `Espaciamiento no uniforme en el nodo ${i}: Δ${ex.xName} = ${f6(xs[i] - xs[i - 1])} ≠ h = ${f6(h)}. Las reglas compuestas exigen nodos igualmente espaciados.` });
    }
  }
  if (bad > 3) errors.push({ msg: `… y ${bad - 3} nodo(s) más con espaciamiento no uniforme.` });
  if (errors.length) return { errors };
  const integ = ex.integrals[st.integral];
  const pre = ex.presets ? ex.presets[st.preset] : null;
  const fs = integ.fn(xs, ys);
  const ctx = mkCtx(xs, fs, integ.k);
  ctx.ys = ys;
  ctx.unit = pre ? pre.areaUnit : integ.unit;
  ctx.exact = pre ? pre.ref : null;
  ctx.exactLabel = pre ? pre.refLabel : '';
  ctx.integ = integ;
  ctx.xName = ex.xName;
  ctx.xUnit = pre ? pre.xUnit : ex.xUnit;
  ctx.yUnit = pre ? pre.yUnit : ex.yUnit;
  ctx.extras = integ.extras || [];
  return { ctx, errors };
}

/* Función matemática → contexto de integración con n subintervalos */
function funcContext(ex, p, n) {
  const s = ex.setup(p);
  const h = (s.b - s.a) / n;
  const xs = Array.from({ length: n + 1 }, (_, i) => (i === n ? s.b : s.a + i * h));
  const fs = xs.map(s.f);
  const ctx = { xs, fs, n, h, k: s.k, unit: s.unit, exact: s.exact, exactLabel: 'Valor exacto (solución analítica)', xName: s.xName, xUnit: s.xUnit, extras: s.extras || [], integ: { name: s.name, fLabel: s.fLabel, rawUnit: s.unit, kText: '' }, setup: s };
  return ctx;
}

function analyseFunc(ex, st) {
  const errors = [], p = {};
  ex.params.forEach(q => {
    const raw = st.params[q.key];
    if (String(raw).trim() === '') errors.push({ key: q.key, msg: `${q.label}: el valor está vacío.` });
    else {
      const v = parseNum(raw);
      if (Number.isNaN(v)) errors.push({ key: q.key, msg: `${q.label}: «${raw}» no es un número válido.` });
      else p[q.key] = v;
    }
  });
  const nRaw = String(st.n).trim();
  const n = parseNum(nRaw);
  if (nRaw === '') errors.push({ key: 'n', msg: 'n: el número de subintervalos está vacío.' });
  else if (Number.isNaN(n) || !Number.isInteger(n)) errors.push({ key: 'n', msg: `n debe ser un entero positivo (recibido «${nRaw}»).` });
  else if (n < 1) errors.push({ key: 'n', msg: 'n debe ser al menos 1.' });
  else if (n > MAX_N) errors.push({ key: 'n', msg: `n es demasiado grande (máximo ${MAX_N}).` });
  if (errors.length) return { errors };
  const v = ex.validate(p);
  if (v.length) return { errors: v };
  const ctx = funcContext(ex, p, n);
  if (ctx.fs.some(x => !Number.isFinite(x))) return { errors: [{ msg: 'La función no es finita en alguno de los nodos del intervalo.' }] };
  ctx.p = p;
  return { ctx, errors: [] };
}

/* Texto pegado → filas de la tabla */
function importText(ex, st, text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return 'No hay datos para importar.';
  const split = l => l.split(/[;\t ,]+/).filter(Boolean);
  const toks = lines.map(split);
  if (lines.length === 2 && (toks[0].length !== 2 || toks[1].length !== 2) && toks[0].length > 1) {
    if (toks[0].length !== toks[1].length) return `Listas desiguales: la primera lista tiene ${toks[0].length} valores y la segunda ${toks[1].length}.`;
    st.rows = toks[0].map((x, i) => ({ x, y: toks[1][i] }));
    return '';
  }
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].length !== 2) return `Línea ${i + 1}: se esperaban 2 valores (x, y) y se encontraron ${toks[i].length}.`;
  }
  st.rows = toks.map(t => ({ x: t[0], y: t[1] }));
  return '';
}

/* ================================================================ gráficas */
function niceTicks(lo, hi, target = 6) {
  const span = hi - lo || 1;
  const raw = span / target, mag = 10 ** Math.floor(Math.log10(raw)), norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const t = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) t.push(+v.toPrecision(12));
  return t;
}
function tickLabel(v) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-4) return v.toExponential(1).replace('e+', 'e');
  return String(+v.toPrecision(6));
}

function drawChart(cv, spec) {
  const css = getComputedStyle(document.documentElement);
  const col = n => css.getPropertyValue(n).trim() || '#888';
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const M = { l: 62, r: 16, t: 14, b: 44 };
  const pw = W - M.l - M.r, ph = H - M.t - M.b;

  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  spec.series.forEach(s => s.pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }));
  if (spec.baseline || spec.series.some(s => s.kind === 'fill')) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
  if (x1 === x0) { x1 += 1; x0 -= 1; }
  if (y1 === y0) { y1 += 1; y0 -= 1; }
  const xp = (x1 - x0) * 0.04;
  x0 -= xp; x1 += xp;
  const yTop = (y1 - y0) * 0.08;
  y1 += yTop;
  if (!(y0 === 0 && (spec.baseline || spec.series.some(s => s.kind === 'fill')))) y0 -= (y1 - y0) * 0.05;
  if (spec.equal) {
    const s = Math.min(pw / (x1 - x0), ph / (y1 - y0));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = cx - pw / s / 2; x1 = cx + pw / s / 2; y0 = cy - ph / s / 2; y1 = cy + ph / s / 2;
  }
  const X = x => M.l + (x - x0) / (x1 - x0) * pw;
  const Y = y => M.t + ph - (y - y0) / (y1 - y0) * ph;

  g.font = '12px "Segoe UI", system-ui, sans-serif';
  g.lineWidth = 1;
  const xt = niceTicks(x0, x1, Math.max(3, Math.floor(pw / 90))), yt = niceTicks(y0, y1, 6);
  g.strokeStyle = col('--line'); g.fillStyle = col('--muted');
  g.textAlign = 'center'; g.textBaseline = 'top';
  xt.forEach(v => { const px = Math.round(X(v)) + .5; g.beginPath(); g.moveTo(px, M.t); g.lineTo(px, M.t + ph); g.stroke(); g.fillText(tickLabel(v), px, M.t + ph + 6); });
  g.textAlign = 'right'; g.textBaseline = 'middle';
  yt.forEach(v => { const py = Math.round(Y(v)) + .5; g.beginPath(); g.moveTo(M.l, py); g.lineTo(M.l + pw, py); g.stroke(); g.fillText(tickLabel(v), M.l - 8, py); });
  g.strokeStyle = col('--muted');
  g.strokeRect(M.l + .5, M.t + .5, pw, ph);
  if (y0 < 0 && y1 > 0) { g.beginPath(); g.moveTo(M.l, Y(0)); g.lineTo(M.l + pw, Y(0)); g.stroke(); }
  if (x0 < 0 && x1 > 0) { g.beginPath(); g.moveTo(X(0), M.t); g.lineTo(X(0), M.t + ph); g.stroke(); }

  g.fillStyle = col('--muted'); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText(spec.xLabel || '', M.l + pw / 2, H - 6);
  g.save(); g.translate(14, M.t + ph / 2); g.rotate(-Math.PI / 2); g.fillText(spec.yLabel || '', 0, 0); g.restore();

  g.save();
  g.beginPath(); g.rect(M.l, M.t, pw, ph); g.clip();
  const hits = [];
  spec.series.forEach(s => {
    const color = col(s.color || '--c-curve');
    if (s.kind === 'fill') {
      g.beginPath();
      s.pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
      const last = s.pts[s.pts.length - 1], first = s.pts[0];
      g.lineTo(X(last[0]), Y(0)); g.lineTo(X(first[0]), Y(0)); g.closePath();
      g.globalAlpha = s.alpha || 0.22; g.fillStyle = color; g.fill(); g.globalAlpha = 1;
    } else if (s.kind === 'poly') {
      g.beginPath();
      s.pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
      g.closePath();
      g.globalAlpha = s.alpha || 0.2; g.fillStyle = color; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = color; g.lineWidth = s.width || 2; g.stroke();
    } else if (s.kind === 'line') {
      g.beginPath();
      s.pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
      g.setLineDash(s.dash || []); g.strokeStyle = color; g.lineWidth = s.width || 2; g.lineJoin = 'round'; g.stroke(); g.setLineDash([]);
    } else if (s.kind === 'pts') {
      s.pts.forEach(([x, y]) => {
        g.beginPath(); g.arc(X(x), Y(y), 4, 0, 2 * Math.PI);
        g.fillStyle = color; g.fill(); g.lineWidth = 1.5; g.strokeStyle = col('--surface'); g.stroke();
        hits.push({ px: X(x), py: Y(y), x, y });
      });
    }
  });
  g.restore();
  cv._hits = hits;
  cv._spec = spec;
}

function legendHtml(spec) {
  const seen = new Set(), out = [];
  spec.series.forEach(s => {
    if (!s.label || seen.has(s.label)) return;
    seen.add(s.label);
    out.push(`<span><i style="background:var(${s.color || '--c-curve'})"></i>${esc(s.label)}</span>`);
  });
  return `<div class="legend">${out.join('')}</div>`;
}

function mountChart(host, spec) {
  host.innerHTML = `<h3>${esc(spec.title)}</h3><div class="chartwrap"><canvas class="chart" role="img" aria-label="${esc(spec.title)}"></canvas><div class="tip"></div></div>${legendHtml(spec)}`;
  const cv = $('canvas', host), tip = $('.tip', host);
  CHARTS.push({ cv, spec });
  cv.addEventListener('mousemove', ev => {
    const r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    let best = null, bd = 14 * 14;
    (cv._hits || []).forEach(h => { const d = (h.px - mx) ** 2 + (h.py - my) ** 2; if (d < bd) { bd = d; best = h; } });
    if (best) {
      tip.style.display = 'block'; tip.style.left = best.px + 'px'; tip.style.top = best.py + 'px';
      tip.textContent = `(${tickLabel(best.x)}, ${tickLabel(best.y)})`;
    } else tip.style.display = 'none';
  });
  cv.addEventListener('mouseleave', () => (tip.style.display = 'none'));
  requestAnimationFrame(() => drawChart(cv, spec));
}
function redrawCharts() { CHARTS.forEach(c => c.cv.isConnected && drawChart(c.cv, c.spec)); }
window.addEventListener('resize', () => { clearTimeout(redrawCharts.t); redrawCharts.t = setTimeout(redrawCharts, 80); });
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => setTimeout(redrawCharts, 30));

/* Gráfica principal: integrando, método aplicado (polinomios de cada bloque) y curva real si existe */
function mainChartSpec(ex, st, ctx, res, method) {
  const unitX = ctx.xUnit ? ` (${ctx.xUnit})` : '';
  const series = [];
  if (ex.kind === 'func') {
    const pts = [], N = 200, a = ctx.xs[0], b = ctx.xs[ctx.n];
    for (let i = 0; i <= N; i++) { const x = a + (b - a) * i / N; pts.push([x, ctx.setup.f(x)]); }
    series.push({ kind: 'line', pts, color: '--c-curve', width: 2, label: 'f(x) real' });
  }
  if (res && !res.err) {
    const colors = { T: '--c-T', S13: '--c-S13', S38: '--c-S38' };
    const names = { T: 'Trapecios', S13: 'Parábolas (Simpson 1/3)', S38: 'Cúbicas (Simpson 3/8)' };
    const maxBlocks = 400;
    blocksFor(method, ctx.n).slice(0, maxBlocks).forEach(bk => {
      const bx = ctx.xs.slice(bk.i0, bk.i1 + 1), by = ctx.fs.slice(bk.i0, bk.i1 + 1);
      const pts = [];
      if (bk.k === 'T') pts.push([bx[0], by[0]], [bx[1], by[1]]);
      else for (let i = 0; i <= 24; i++) { const x = bx[0] + (bx[bx.length - 1] - bx[0]) * i / 24; pts.push([x, lagrange(bx, by, x)]); }
      series.push({ kind: 'fill', pts, color: colors[bk.k], label: `Área: ${names[bk.k]}`, alpha: 0.28 });
      series.push({ kind: 'line', pts, color: colors[bk.k], width: 1.6 });
    });
  } else {
    series.push({ kind: 'line', pts: ctx.xs.map((x, i) => [x, ctx.fs[i]]), color: '--c-S13', width: 2, label: 'Interpolación lineal' });
  }
  if (ctx.n <= 120) series.push({ kind: 'pts', pts: ctx.xs.map((x, i) => [x, ctx.fs[i]]), color: '--c-pt', label: 'Nodos (xᵢ, fᵢ)' });
  return { title: `Integrando ${ctx.integ.fLabel || 'f'} y área bajo la regla`, xLabel: `${ctx.xName}${unitX}`, yLabel: ctx.integ.fLabel || 'f', baseline: true, series };
}

function secondarySpec(ex, st, ctx) {
  if (ex.kind === 'func') return ex.geo ? ex.geo(ctx.p, ctx) : null;
  const half = ctx.ys.map(v => v / 2);
  if (ex.geo === 'cum') {
    const pts = [[ctx.xs[0], 0]];
    let acc = 0;
    for (let i = 1; i <= ctx.n; i++) { acc += ctx.k * ctx.h * (ctx.fs[i - 1] + ctx.fs[i]) / 2; pts.push([ctx.xs[i], acc]); }
    const un = ctx.unit;
    return { title: `Acumulado de la integral (trapecio) en ${un}`, xLabel: `${ctx.xName}${ctx.xUnit ? ` (${ctx.xUnit})` : ''}`, yLabel: un, baseline: true, series: [{ kind: 'fill', pts, color: '--c-T', label: `Acumulado (${un})`, alpha: .18 }, { kind: 'line', pts, color: '--c-T', width: 2.4 }, { kind: 'pts', pts, color: '--c-T' }] };
  }
  if (ex.geo === 'sil') {
    const top = ctx.xs.map((x, i) => [x, half[i]]);
    const poly = top.concat(ctx.xs.map((x, i) => [x, -half[i]]).reverse());
    const label = ex.id === 26 ? 'Silueta del lago (eje central)' : 'Perfil de revolución (r = d/2)';
    return {
      title: ex.id === 26 ? 'Forma aproximada del lago' : 'Silueta del objeto (corte por el eje)',
      xLabel: `${ctx.xName} (${ctx.xUnit})`, yLabel: ex.id === 26 ? `ancho/2 (${ctx.yUnit})` : `radio (${ctx.yUnit})`, equal: ex.id === 27,
      series: [{ kind: 'poly', pts: poly, color: ex.id === 26 ? '--c-S13' : '--c-S38', label, alpha: .22 }, { kind: 'pts', pts: top, color: '--c-pt', label: 'Mediciones' }],
    };
  }
  return null;
}

/* ================================================================ render de resultados */
function methodRows(ctx) {
  return METHOD_ORDER.map(m => ({ m, res: runMethod(ctx, m) }));
}

function resultsHtml(ex, st, ctx) {
  const method = st.method;
  const all = methodRows(ctx);
  const sel = all.find(r => r.m === method).res;
  const ref = ctx.exact, hasRef = ref !== null && ref !== undefined && Number.isFinite(ref) && ref !== 0;
  const un = ctx.unit ? `<span class="k-u">${esc(ctx.unit)}</span>` : '';
  let html = '';

  /* KPI */
  html += `<div class="card"><h2>Resultado <span class="tag">${esc(METHOD_NAME[method])}</span></h2>`;
  if (sel.err) {
    html += `<div class="alert err" role="alert"><strong>Método no aplicable:</strong> ${esc(sel.err)} Elige otro método o ajusta n.</div>`;
  } else {
    const trap = all[0].res;
    html += `<div class="kpis"><div class="kpi main"><div class="k-l">${esc(ctx.integ.name)}</div><div class="k-v">${f6(sel.value)}${un}</div><div class="k-s">n = ${ctx.n} · h = ${f6(ctx.h)}${ctx.xUnit ? ' ' + esc(ctx.xUnit) : ''}</div></div>`;
    if (hasRef) {
      const ea = Math.abs(ref - sel.value);
      html += `<div class="kpi"><div class="k-l">Error absoluto Eₐ</div><div class="k-v">${f6(ea)}${un}</div><div class="k-s">Eₐ = |I_ref − I_aprox|</div></div>`;
      html += `<div class="kpi"><div class="k-l">Error porcentual E%</div><div class="k-v">${pct(100 * ea / Math.abs(ref))}</div><div class="k-s">${esc(ctx.exactLabel)}: ${f6(ref)} ${esc(ctx.unit)}</div></div>`;
    } else {
      html += `<div class="kpi"><div class="k-l">Error verdadero</div><div class="k-v" style="font-size:1rem;font-family:var(--sans)">No calculable</div><div class="k-s">Sin valor exacto o de referencia no se puede calcular el error verdadero.</div></div>`;
      if (method !== 'T' && !trap.err) html += `<div class="kpi"><div class="k-l">Diferencia vs. trapecio</div><div class="k-v">${f6(Math.abs(sel.value - trap.value))}${un}</div><div class="k-s">Solo indica discrepancia entre métodos.</div></div>`;
    }
    ctx.extras.forEach(e => { html += `<div class="kpi"><div class="k-l">${esc(e.label)}</div><div class="k-v">${f6(sel.value * e.mult)}<span class="k-u">${esc(e.unit)}</span></div></div>`; });
    html += '</div>';
    if (ctx.integ.warn) html += `<div class="alert warn">${esc(ctx.integ.warn)}</div>`;
  }
  html += '</div>';

  /* Comparación */
  html += `<div class="card"><h2>Comparación de métodos</h2><div class="data-table-wrap"><table class="data res"><thead><tr><th class="l">Método</th><th>Resultado${ctx.unit ? ' (' + esc(ctx.unit) + ')' : ''}</th>${hasRef ? '<th>Eₐ</th><th>E %</th>' : ''}<th>Δ vs. trapecio</th></tr></thead><tbody>`;
  const trapV = all[0].res.value;
  all.forEach(({ m, res }) => {
    if ((m === 'AUTO' || m === 'S13T') && ctx.n % 2 === 0) return;
    const cls = m === method ? ' class="sel"' : '';
    if (res.err) { html += `<tr${cls}><td class="l">${esc(METHOD_NAME[m])}</td><td class="na" colspan="${hasRef ? 4 : 2}">${esc(res.err)}</td></tr>`; return; }
    const ea = hasRef ? Math.abs(ref - res.value) : null;
    html += `<tr${cls}><td class="l">${esc(METHOD_NAME[m])}</td><td class="num">${f6(res.value)}</td>${hasRef ? `<td class="num">${f6(ea)}</td><td class="num">${pct(100 * ea / Math.abs(ref))}</td>` : ''}<td class="num">${m === 'T' ? '—' : f6(res.value - trapV)}</td></tr>`;
  });
  html += `</tbody></table></div>${hasRef ? '' : '<p class="note">Sin valor de referencia: la columna Δ solo compara un método con otro.</p>'}`;
  if (ex.kind === 'table' && ex.integrals.length > 1) {
    html += `<h3 style="margin-top:14px">Magnitudes del ejercicio (método: ${esc(METHOD_NAME[method])})</h3><div class="data-table-wrap"><table class="data res"><thead><tr><th class="l">Magnitud</th><th>Valor</th></tr></thead><tbody>`;
    ex.integrals.forEach((I, idx) => {
      const xs = ctx.xs, f = I.fn(xs, ctx.ys), r = runMethod(mkCtx(xs, f, I.k), method);
      html += `<tr${idx === st.integral ? ' class="sel"' : ''}><td class="l">${esc(I.name)}</td><td class="num">${r.err ? esc(r.err) : f6(r.value) + ' ' + esc(I.unit)}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  html += '</div>';

  /* Desarrollo y pesos */
  if (!sel.err) {
    html += `<div class="card"><h2>Desarrollo del cálculo</h2><ol class="steps"><li>h = (b − a)/n = (${f6(ctx.xs[ctx.n])} − ${f6(ctx.xs[0])})/${ctx.n} = ${f6(ctx.h)}</li>`;
    sel.steps.forEach(s => (html += `<li>${esc(s.text)}</li>`));
    if (sel.steps.length > 1) html += `<li>Suma de segmentos = ${f6(sel.raw)}</li>`;
    if (ctx.k !== 1) html += `<li>Resultado = ${esc(ctx.integ.kText || 'k')} (k = ${f6(ctx.k)}) · ${f6(sel.raw)} = ${f6(sel.value)} ${esc(ctx.unit)}</li>`;
    else html += `<li>Resultado = ${f6(sel.value)} ${esc(ctx.unit)}</li>`;
    html += '</ol>';
    const n = ctx.n, show = n > 40 ? [...Array(15).keys(), -1, ...Array.from({ length: 4 }, (_, i) => n - 3 + i)] : [...Array(n + 1).keys()];
    html += `<details><summary>Tabla de factores / pesos de integración (${n + 1} nodos)</summary><div class="inner"><table class="data res"><thead><tr><th>i</th><th>${esc(ctx.xName)}ᵢ</th><th>fᵢ</th><th class="l">Coeficiente</th><th>Peso wᵢ</th><th>wᵢ·fᵢ</th></tr></thead><tbody>`;
    show.forEach(i => {
      if (i < 0) { html += '<tr><td colspan="6">⋮</td></tr>'; return; }
      html += `<tr><td>${i}</td><td class="num">${f6(ctx.xs[i])}</td><td class="num">${f6(ctx.fs[i])}</td><td class="l num">${sel.rule.labels[i].join(' + ')}</td><td class="num">${f6(sel.rule.w[i])}</td><td class="num">${f6(sel.rule.w[i] * ctx.fs[i])}</td></tr>`;
    });
    html += `</tbody><tfoot><tr><td colspan="4" class="l"><strong>Σ wᵢ·fᵢ</strong></td><td class="num">${f6(sel.rule.w.reduce((a, b) => a + b, 0))}</td><td class="num"><strong>${f6(sel.raw)}</strong></td></tr></tfoot></table><p class="note">Σ wᵢ = b − a: comprueba que los pesos están bien formados.</p></div></details></div>`;
  }

  /* Convergencia (solo funciones) */
  if (ex.kind === 'func' && hasRef) {
    html += `<div class="card"><h2>Convergencia al aumentar n</h2><div class="data-table-wrap"><table class="data res"><thead><tr><th>n</th><th>h</th><th>Trapecio</th><th>Eₐ trap.</th><th>Simpson 1/3</th><th>Eₐ S 1/3</th><th>Simpson 3/8</th><th>Eₐ S 3/8</th></tr></thead><tbody>`;
    CONV_NS.forEach(n => {
      const c = funcContext(ex, ctx.p, n);
      const cell = m => { const r = runMethod(c, m); return r.err ? '<td class="na">—</td><td class="na">—</td>' : `<td class="num">${f6(r.value)}</td><td class="num">${f6(Math.abs(ref - r.value))}</td>`; };
      html += `<tr><td>${n}</td><td class="num">${f6(c.h)}</td>${cell('T')}${cell('S13')}${cell('S38')}</tr>`;
    });
    html += '</tbody></table></div><p class="note">«—» indica que n no cumple la condición del método (par para 1/3, múltiplo de 3 para 3/8).</p></div>';
  }
  return html;
}

/* Contraste con el solucionario */
function docHtml(ex, st, ctx) {
  if (ex.isTest) return '';
  const idx = ex.kind === 'table' ? st.integral : 0;
  const d = (ex.doc || [])[idx];
  const isDef = ex.kind === 'table'
    ? JSON.stringify(st.rows) === JSON.stringify(initState(ex).rows) && st.preset === 0
    : JSON.stringify(st.params) === JSON.stringify(initState(ex).params) && st.n === String(ex.defN);
  let html = `<div class="card"><h2>Contraste con el solucionario del docente</h2>`;
  if (!d) {
    return html + `<p>El solucionario no fija una única respuesta para este ejercicio: depende de la tabla de anchuras digitalizadas. Referencia del problema original: <strong>9 940 mi²</strong>. Usa una tabla común en el grupo para que los resultados sean comparables.</p></div>`;
  }
  if (!isDef) return html + `<p class="note">Modificaste los datos de entrada: la comparación con el solucionario solo aplica a los datos originales. <button class="btn ghost sm" data-reset>Restablecer datos originales</button></p></div>`;
  const tol = (a, b) => Math.abs(a - b) <= Math.max(6e-7, 3e-8 * Math.abs(b));
  const T = runMethod(ctx, 'T').value, S = runMethod(ctx, d.Skey).value;
  const row = (lab, app, doc) => `<tr><td class="l">${lab}</td><td class="num">${f6(app)}</td><td class="num">${f6(doc)}</td><td>${tol(app, doc) ? '<span class="tag ok">✓ coincide</span>' : '<span class="tag err">✗ difiere</span>'}</td></tr>`;
  html += `<div class="data-table-wrap"><table class="data res"><thead><tr><th class="l">Concepto</th><th>Esta app</th><th>Solucionario</th><th>Estado</th></tr></thead><tbody>${row('Trapecio', T, d.T)}${row(METHOD_NAME[d.Skey], S, d.S)}${d.exact !== undefined ? row('Valor exacto', ctx.exact, d.exact) : ''}</tbody></table></div>`;
  if (d.nota) html += `<p class="note">${esc(d.nota)}</p>`;
  return html + '</div>';
}

/* ================================================================ vistas */
function renderOutputs(ex, st, outEl) {
  CHARTS = CHARTS.filter(c => c.cv.isConnected);
  const analysis = ex.kind === 'table' ? analyseTable(ex, st) : analyseFunc(ex, st);
  const errBox = $('#errs');
  document.querySelectorAll('input.invalid').forEach(i => i.classList.remove('invalid'));
  if (analysis.errors.length) {
    errBox.innerHTML = `<div class="alert err" role="alert"><strong>Revisa los datos de entrada:</strong><ul>${analysis.errors.map(e => `<li>${esc(e.msg)}</li>`).join('')}</ul></div>`;
    analysis.errors.forEach(e => {
      if (e.row !== undefined) { const i = $(`input[data-r="${e.row}"][data-c="${e.col}"]`); if (i) i.classList.add('invalid'); }
      if (e.key) { const i = $(`input[data-key="${e.key}"]`); if (i) i.classList.add('invalid'); }
    });
    outEl.innerHTML = '';
    return;
  }
  errBox.innerHTML = '';
  const ctx = analysis.ctx;
  const res = runMethod(ctx, st.method);
  let html = resultsHtml(ex, st, ctx);
  html += docHtml(ex, st, ctx);
  html = `${html}<div class="card"><h2>Gráficas</h2><div class="charts"><div class="chart-box" id="ch1"></div><div class="chart-box" id="ch2"></div></div></div>`;
  outEl.innerHTML = html;
  const rb = $('[data-reset]', outEl);
  if (rb) rb.addEventListener('click', () => resetExercise(ex));
  mountChart($('#ch1'), mainChartSpec(ex, st, ctx, res, st.method));
  const sec = secondarySpec(ex, st, ctx);
  if (sec) mountChart($('#ch2'), sec); else $('#ch2').remove();
  if (ex.isTest) outEl.insertAdjacentHTML('afterbegin', testHtml(ex, st, ctx));
}

function testHtml(ex, st, ctx) {
  const p = ctx.p, exact = ctx.exact;
  const rows = [], eT = {};
  let pass = true;
  [4, 8, 6, 12].forEach(n => {
    const c = funcContext(ex, p, n), T = runMethod(c, 'T'), S = runMethod(c, 'S13'), S3 = runMethod(c, 'S38');
    eT[n] = Math.abs(T.value - exact);
    const ok13 = !S.err && Math.abs(S.value - exact) < 1e-12, ok38 = !S3.err && Math.abs(S3.value - exact) < 1e-12;
    if (S.err ? false : !ok13) pass = false;
    if (S3.err ? false : !ok38) pass = false;
    rows.push(`<tr><td>${n}</td><td class="num">${f6(T.value)}</td><td class="num">${f6(eT[n])}</td><td class="num">${S.err ? '—' : f6(S.value)}</td><td>${S.err ? '—' : (ok13 ? '<span class="tag ok">exacto</span>' : '<span class="tag err">falla</span>')}</td><td class="num">${S3.err ? '—' : f6(S3.value)}</td><td>${S3.err ? '—' : (ok38 ? '<span class="tag ok">exacto</span>' : '<span class="tag err">falla</span>')}</td></tr>`);
  });
  const ratio = eT[4] / eT[8];
  if (Math.abs(ratio - 4) > 0.05) pass = false;
  return `<div class="card"><h2>Resultado de la prueba ${pass ? '<span class="tag ok">APROBADA</span>' : '<span class="tag err">FALLÓ</span>'}</h2><div class="data-table-wrap"><table class="data res"><thead><tr><th>n</th><th>Trapecio</th><th>Eₐ trap.</th><th>Simpson 1/3</th><th></th><th>Simpson 3/8</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div><p class="note">Valor exacto: ${f6(exact)} (= 8/3 con [0, 2]). Cociente E(n=4)/E(n=8) del trapecio = ${f6(ratio, 4)} ≈ 4, como predice el orden O(h²).</p></div>`;
}

function methodSelect(st) {
  return `<label class="fld">Método de integración<select id="method">${METHOD_ORDER.map(m => `<option value="${m}"${m === st.method ? ' selected' : ''}>${esc(METHOD_NAME[m])}</option>`).join('')}</select></label>`;
}

function renderTableForm(ex, st) {
  const pre = ex.presets ? ex.presets[st.preset] : null;
  const xu = pre ? pre.xUnit : ex.xUnit, yu = pre ? pre.yUnit : ex.yUnit;
  const rows = st.rows.map((r, i) => `<tr><td>${i}</td><td><input type="text" inputmode="decimal" data-r="${i}" data-c="x" value="${esc(r.x)}" aria-label="${ex.xName} nodo ${i}"></td><td><input type="text" inputmode="decimal" data-r="${i}" data-c="y" value="${esc(r.y)}" aria-label="${ex.yName} nodo ${i}"></td><td><button class="icon" data-del="${i}" title="Quitar fila" aria-label="Quitar fila ${i}">×</button></td></tr>`).join('');
  return `<div class="data-table-wrap"><table class="data"><thead><tr><th>i</th><th>${ex.xName}${xu ? ' (' + esc(xu) + ')' : ''}</th><th>${ex.yName}${yu ? ' (' + esc(yu) + ')' : ''}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderExercise(ex) {
  const st = getState(ex);
  CHARTS = [];
  const view = $('#view');
  const isTable = ex.kind === 'table';
  const pre = ex.presets ? ex.presets[st.preset] : null;
  let form = '';
  if (isTable) {
    form += `<div class="grid-form">${methodSelect(st)}${ex.integrals.length > 1 ? `<label class="fld">Magnitud a calcular<select id="integral">${ex.integrals.map((I, i) => `<option value="${i}"${i === st.integral ? ' selected' : ''}>${esc(I.name)}</option>`).join('')}</select></label>` : ''}${ex.presets ? `<label class="fld">Conjunto de datos<select id="preset">${ex.presets.map((p, i) => `<option value="${i}"${i === st.preset ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : ''}</div>`;
    if (pre) form += `<p class="note">${esc(pre.note)}</p>`;
    form += `<div id="tbl">${renderTableForm(ex, st)}</div>
      <div class="row-actions"><button class="btn ghost sm" id="addrow">+ Agregar fila</button><button class="btn ghost sm" id="reset">Restablecer datos</button></div>
      <details><summary>Pegar o escribir datos como texto</summary><div class="inner"><p class="note">Una pareja «x, y» por línea, o dos líneas (primero todos los x, luego todos los y). Separadores: coma, punto y coma, espacio o tabulador. Usa punto como decimal.</p><textarea id="imp" placeholder="0, 0&#10;1, 14&#10;2, 39"></textarea><div class="row-actions"><button class="btn sm" id="doimp">Importar al formulario</button></div><div id="impmsg"></div></div></details>`;
  } else {
    form += `<div class="grid-form">${ex.params.map(q => `<label class="fld">${esc(q.label)}${q.unit ? ` <small>(${esc(q.unit)})</small>` : ''}<input type="text" inputmode="decimal" data-key="${q.key}" value="${esc(st.params[q.key])}"></label>`).join('')}<label class="fld">n (subintervalos)<small>entero ≥ 1 · par para 1/3 · múltiplo de 3 para 3/8</small><input type="text" inputmode="numeric" data-key="n" value="${esc(st.n)}"></label>${methodSelect(st)}</div><div class="row-actions"><button class="btn ghost sm" id="reset">Restablecer valores</button></div>`;
  }
  view.innerHTML = `
    <div class="page-title"><h2>${ex.isTest ? '' : `Ejercicio ${ex.id} · `}${esc(ex.title)}</h2><span class="tag">${esc(ex.tema)}</span></div>
    <div class="card"><h2>Descripción del ejercicio</h2><p>${esc(ex.enunciado)}</p>
      <h3 style="font-size:1rem;margin-top:12px">Modelo matemático</h3><div class="formula">${ex.modelo.map(esc).join('\n')}</div>
      <div class="sys"><strong>Enfoque en Ingeniería de Sistemas:</strong> ${esc(ex.sistemas)}</div></div>
    <div class="card"><h2>Ingreso de datos <span class="tag">teclado</span></h2>${form}<div id="errs" aria-live="polite"></div></div>
    <div id="out"></div>`;
  const out = $('#out'), recalc = () => renderOutputs(ex, st, out);
  $('#method').addEventListener('change', e => { st.method = e.target.value; recalc(); });
  if (isTable) {
    const tbl = $('#tbl');
    tbl.addEventListener('input', e => { const t = e.target; if (t.dataset.r !== undefined) { st.rows[+t.dataset.r][t.dataset.c] = t.value; recalc(); } });
    tbl.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) { st.rows.splice(+d.dataset.del, 1); tbl.innerHTML = renderTableForm(ex, st); recalc(); } });
    $('#addrow').addEventListener('click', () => {
      const last = st.rows[st.rows.length - 1], prev = st.rows[st.rows.length - 2];
      const lx = last ? parseNum(last.x) : NaN, px = prev ? parseNum(prev.x) : NaN;
      const nx = Number.isNaN(lx) ? '0' : String(+(lx + (Number.isNaN(px) ? 1 : lx - px)).toPrecision(12));
      st.rows.push({ x: nx, y: '' });
      tbl.innerHTML = renderTableForm(ex, st); recalc();
      const inp = tbl.querySelector(`input[data-r="${st.rows.length - 1}"][data-c="y"]`); if (inp) inp.focus();
    });
    $('#reset').addEventListener('click', () => resetExercise(ex));
    const integ = $('#integral'); if (integ) integ.addEventListener('change', e => { st.integral = +e.target.value; recalc(); });
    const ps = $('#preset');
    if (ps) ps.addEventListener('change', e => { st.preset = +e.target.value; st.rows = ex.presets[st.preset].data.map(([x, y]) => ({ x: String(x), y: String(y) })); renderExercise(ex); });
    $('#doimp').addEventListener('click', () => {
      const msg = importText(ex, st, $('#imp').value);
      $('#impmsg').innerHTML = msg ? `<div class="alert err" role="alert">${esc(msg)}</div>` : '<div class="alert ok">Datos importados al formulario.</div>';
      if (!msg) { tbl.innerHTML = renderTableForm(ex, st); recalc(); }
    });
  } else {
    view.querySelectorAll('input[data-key]').forEach(i => i.addEventListener('input', e => { const k = e.target.dataset.key; if (k === 'n') st.n = e.target.value; else st.params[k] = e.target.value; recalc(); }));
    $('#reset').addEventListener('click', () => resetExercise(ex));
  }
  recalc();
}

function resetExercise(ex) { STATE[ex.id] = initState(ex); renderExercise(ex); }

/* ---------- inicio, algoritmos, resumen ---------- */
function renderHome() {
  CHARTS = [];
  const list = EXERCISES.filter(e => !e.isTest);
  $('#view').innerHTML = `
    <div class="card"><h2>¿Qué hace esta página?</h2>
      <p>Resuelve los <strong>ejercicios 19 al 27</strong> del desafío de integración numérica con tres métodos compuestos: <strong>trapecio</strong>, <strong>Simpson 1/3</strong> y <strong>Simpson 3/8</strong>, más sus combinaciones para n impar. Cada ejercicio incluye su descripción, el modelo matemático, el enfoque desde la <strong>Ingeniería de Sistemas</strong>, el ingreso de datos por teclado, validaciones, tabla de pesos, errores y gráficas.</p>
      <div class="formula">h = (b − a)/n
Trapecio:    T = h·[(f₀+fₙ)/2 + Σ fᵢ]
Simpson 1/3: S = (h/3)·[f₀+fₙ + 4·Σ impares + 2·Σ pares interiores]   (n par)
Simpson 3/8: S = (3h/8)·[f₀+fₙ + 3·Σ no múltiplos de 3 + 2·Σ múltiplos de 3 interiores]   (n múltiplo de 3)
Eₐ = |I_ref − I_aprox|     E% = 100·Eₐ / |I_ref|</div>
      <p class="note">Los escenarios son adaptaciones didácticas; los datos no son mediciones reales de Bolivia. Los valores de la app se contrastan con el solucionario del docente en la sección <a href="#resumen">Resumen</a>.</p></div>
    <div class="cards">${list.map(e => `<a class="ex-card" href="#e${e.id}"><span class="n">Ejercicio ${e.id}</span><h3>${esc(e.title)}</h3><p>${esc(e.resumen)}</p></a>`).join('')}</div>`;
}

const CODE_JS = `// Regla compuesta genérica (JavaScript)
function trapecio(f, a, b, n) {
  const h = (b - a) / n;
  let s = (f(a) + f(b)) / 2;
  for (let i = 1; i < n; i++) s += f(a + i * h);
  return h * s;
}
function simpson13(f, a, b, n) {            // n par
  if (n % 2) throw new Error("n debe ser par");
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (h / 3) * s;
}
function simpson38(f, a, b, n) {            // n múltiplo de 3
  if (n % 3) throw new Error("n debe ser múltiplo de 3");
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 3 ? 3 : 2);
  return (3 * h / 8) * s;
}`;
const CODE_PY = `# Los mismos métodos en Python (útil para el informe y las pruebas)
def trapecio(f, a, b, n):
    h = (b - a) / n
    return h * ((f(a) + f(b)) / 2 + sum(f(a + i * h) for i in range(1, n)))

def simpson13(f, a, b, n):
    assert n % 2 == 0, "n debe ser par"
    h = (b - a) / n
    s = f(a) + f(b) + sum(f(a + i * h) * (4 if i % 2 else 2) for i in range(1, n))
    return h / 3 * s

def simpson38(f, a, b, n):
    assert n % 3 == 0, "n debe ser múltiplo de 3"
    h = (b - a) / n
    s = f(a) + f(b) + sum(f(a + i * h) * (3 if i % 3 else 2) for i in range(1, n))
    return 3 * h / 8 * s

# Prueba mínima: x^2 en [0, 2] -> 8/3
assert abs(simpson13(lambda x: x * x, 0, 2, 4) - 8 / 3) < 1e-12`;

function renderAlgos() {
  CHARTS = [];
  $('#view').innerHTML = `<div class="page-title"><h2>Algoritmos e implementación</h2><span class="tag">Ingeniería de Sistemas</span></div>
    <div class="card"><h2>Código de los métodos</h2><p>Estos son los algoritmos que usa la aplicación (versión de funciones y versión en Python para contrastar). Cada uno recorre los nodos una sola vez.</p><div class="two"><div><h3>JavaScript</h3><pre class="code">${esc(CODE_JS)}</pre></div><div><h3>Python</h3><pre class="code">${esc(CODE_PY)}</pre></div></div></div>
    <div class="card"><h2>Análisis desde sistemas</h2><div class="data-table-wrap"><table class="data res"><thead><tr><th class="l">Aspecto</th><th class="l">Trapecio</th><th class="l">Simpson 1/3</th><th class="l">Simpson 3/8</th></tr></thead><tbody>
      <tr><td class="l">Complejidad</td><td class="l">O(n) tiempo, O(1) memoria</td><td class="l">O(n), O(1)</td><td class="l">O(n), O(1)</td></tr>
      <tr><td class="l">Orden del error</td><td class="l">O(h²)</td><td class="l">O(h⁴)</td><td class="l">O(h⁴)</td></tr>
      <tr><td class="l">Condición sobre n</td><td class="l">n ≥ 1</td><td class="l">n par</td><td class="l">n múltiplo de 3</td></tr>
      <tr><td class="l">Exacto para</td><td class="l">polinomios de grado ≤ 1</td><td class="l">grado ≤ 3</td><td class="l">grado ≤ 3</td></tr>
      <tr><td class="l">Validaciones de la app</td><td class="l" colspan="3">listas de igual longitud, datos numéricos, x estrictamente creciente, espaciamiento uniforme, n entero y compatible con el método.</td></tr>
    </tbody></table></div><p class="note">Con n impar se combina Simpson 1/3 en los primeros n−3 subintervalos y Simpson 3/8 en los últimos 3 (por ejemplo, n = 7 → 4 + 3).</p></div>`;
}

function renderSummary() {
  CHARTS = [];
  const tol = (a, b) => Math.abs(a - b) <= Math.max(6e-7, 3e-8 * Math.abs(b));
  let rows = '', allOk = true;
  EXERCISES.filter(e => !e.isTest).forEach(ex => {
    const st = initState(ex);
    const nInt = ex.kind === 'table' ? ex.integrals.length : 1;
    for (let k = 0; k < nInt; k++) {
      st.integral = k;
      const a = ex.kind === 'table' ? analyseTable(ex, st) : analyseFunc(ex, st);
      if (!a.ctx) continue;
      const d = (ex.doc || [])[k], ctx = a.ctx;
      const T = runMethod(ctx, 'T').value, S = runMethod(ctx, d ? d.Skey : 'AUTO').value;
      const un = esc(ctx.unit);
      let ok = '—';
      if (d) { const good = tol(T, d.T) && tol(S, d.S) && (d.exact === undefined || tol(ctx.exact, d.exact)); ok = good ? '<span class="tag ok">✓</span>' : '<span class="tag err">✗</span>'; if (!good) allOk = false; }
      const ref = ex.kind === 'func' ? f6(ctx.exact) : (ex.id === 26 ? '9940 (referencia)' : '—');
      rows += `<tr><td>${ex.id}${ex.kind === 'table' && nInt > 1 ? String.fromCharCode(97 + k) : ''}</td><td class="l">${esc(ctx.integ.name)}</td><td class="num">${f6(T)}</td><td class="num">${d ? f6(d.T) : '—'}</td><td class="num">${f6(S)}</td><td class="num">${d ? f6(d.S) : '—'}</td><td class="num">${ref} ${un}</td><td>${ok}</td></tr>`;
    }
  });
  $('#view').innerHTML = `<div class="page-title"><h2>Resumen: la app frente al solucionario</h2><span class="tag ${allOk ? 'ok' : 'err'}">${allOk ? 'Todo coincide' : 'Hay diferencias'}</span></div>
    <div class="card"><p>Se calculó cada ejercicio con sus datos originales (n = 8 en los de función) y se comparó con la matriz de respuestas del solucionario. La columna Simpson usa el método indicado por el solucionario (combinado 1/3 + 3/8; 1/3 + trapecio en el 21; 1/3 en los de función).</p>
    <div class="data-table-wrap"><table class="data res"><thead><tr><th>Ej.</th><th class="l">Magnitud</th><th>Trapecio (app)</th><th>Trapecio (doc)</th><th>Simpson (app)</th><th>Simpson (doc)</th><th>Exacto / ref.</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">El ejercicio 26 depende de la tabla de anchuras digitalizadas: no tiene respuesta única en el solucionario, por eso no se compara.</p></div>`;
}

/* ================================================================ navegación */
function buildNav() {
  const ex = EXERCISES.filter(e => !e.isTest);
  let h = `<a href="#inicio" data-r="inicio"><span class="num">⌂</span><span class="lbl">Inicio</span></a><div class="grp">Ejercicios</div>`;
  ex.forEach(e => (h += `<a href="#e${e.id}" data-r="e${e.id}"><span class="num">${e.id}</span><span class="lbl">${esc(e.nav)}</span></a>`));
  h += `<div class="grp">Herramientas</div><a href="#etest" data-r="etest"><span class="num">✓</span><span class="lbl">Prueba x² (8/3)</span></a><a href="#resumen" data-r="resumen"><span class="num">Σ</span><span class="lbl">Resumen vs. solucionario</span></a><a href="#algoritmos" data-r="algoritmos"><span class="num">{ }</span><span class="lbl">Algoritmos</span></a>`;
  $('#nav').innerHTML = h;
}

function route() {
  const r = (location.hash || '#inicio').slice(1);
  document.querySelectorAll('#nav a').forEach(a => (a.getAttribute('data-r') === r ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  if (r === 'inicio') renderHome();
  else if (r === 'resumen') renderSummary();
  else if (r === 'algoritmos') renderAlgos();
  else { const ex = exById(r.slice(1)); if (ex) renderExercise(ex); else renderHome(); }
  window.scrollTo({ top: 0 });
}

buildNav();
window.addEventListener('hashchange', route);
route();
