'use strict';
/* Núcleo numérico: reglas de integración compuestas, sin dependencias del DOM. */

const METHODS = ['T', 'S13', 'S38', 'AUTO', 'S13T'];
const METHOD_NAME = {
  T: 'Trapecio compuesto',
  S13: 'Simpson 1/3',
  S38: 'Simpson 3/8',
  AUTO: 'Combinado Simpson 1/3 + 3/8',
  S13T: 'Simpson 1/3 + trapecio final',
};
const FACTOR = { T: 1 / 2, S13: 1 / 3, S38: 3 / 8 };
const FACTOR_LABEL = { T: 'h/2', S13: 'h/3', S38: '3h/8' };

const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', '+': '' };
function sup(s) { return String(s).split('').map(c => SUP[c] ?? c).join(''); }

/* Formato con al menos seis decimales; notación científica para magnitudes extremas. */
function f6(v, d = 6) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e7 || a < 1e-5)) {
    const [m, e] = v.toExponential(8).split('e');
    return `${m}×10${sup(parseInt(e, 10))}`;
  }
  return v.toFixed(d);
}
function pct(v) { return Number.isFinite(v) ? v.toFixed(6) + ' %' : '—'; }

/* ¿Se puede aplicar el método con n subintervalos? Devuelve null si sí, o el motivo. */
function methodCheck(method, n) {
  if (!Number.isInteger(n) || n < 1) return 'n debe ser un entero positivo.';
  switch (method) {
    case 'T': return null;
    case 'S13': return n % 2 ? `Simpson 1/3 requiere n par (n = ${n}).` : null;
    case 'S38': return n % 3 ? `Simpson 3/8 requiere n múltiplo de 3 (n = ${n}).` : null;
    case 'AUTO': return n < 2 ? 'El combinado requiere n ≥ 2.' : null;
    case 'S13T': return n < 2 ? 'Simpson 1/3 + trapecio requiere n ≥ 2.' : null;
    default: return 'Método desconocido.';
  }
}

function segmentsFor(method, n) {
  switch (method) {
    case 'T': return [{ k: 'T', i0: 0, i1: n }];
    case 'S13': return [{ k: 'S13', i0: 0, i1: n }];
    case 'S38': return [{ k: 'S38', i0: 0, i1: n }];
    case 'AUTO':
      if (n % 2 === 0) return [{ k: 'S13', i0: 0, i1: n }];
      if (n === 3) return [{ k: 'S38', i0: 0, i1: 3 }];
      return [{ k: 'S13', i0: 0, i1: n - 3 }, { k: 'S38', i0: n - 3, i1: n }];
    case 'S13T':
      if (n % 2 === 0) return [{ k: 'S13', i0: 0, i1: n }];
      return [{ k: 'S13', i0: 0, i1: n - 1 }, { k: 'T', i0: n - 1, i1: n }];
  }
  return [];
}

function segCoefs(kind, m) {
  const c = new Array(m + 1);
  for (let i = 0; i <= m; i++) {
    if (i === 0 || i === m) c[i] = 1;
    else if (kind === 'T') c[i] = 2;
    else if (kind === 'S13') c[i] = i % 2 ? 4 : 2;
    else c[i] = i % 3 === 0 ? 2 : 3;
  }
  return c;
}

/* Pesos efectivos w_i de la regla (ya multiplicados por h y por el factor del método). */
function buildRule(method, n, h) {
  const segs = segmentsFor(method, n);
  const w = new Array(n + 1).fill(0);
  const labels = Array.from({ length: n + 1 }, () => []);
  const coefs = new Array(n + 1).fill(0);
  for (const s of segs) {
    const c = segCoefs(s.k, s.i1 - s.i0);
    c.forEach((cj, j) => {
      w[s.i0 + j] += cj * FACTOR[s.k] * h;
      labels[s.i0 + j].push(`${cj}·${FACTOR_LABEL[s.k]}`);
      coefs[s.i0 + j] += cj * FACTOR[s.k];
    });
  }
  return { segs, w, labels, coefs };
}

/* Desarrollo paso a paso de un segmento (para mostrar el cálculo manual). */
function segSteps(seg, fs, h) {
  const m = seg.i1 - seg.i0;
  const f = fs.slice(seg.i0, seg.i1 + 1);
  const ends = f[0] + f[m];
  const range = `[nodo ${seg.i0} → ${seg.i1}]`;
  let a = 0, b = 0, val;
  if (seg.k === 'T') {
    for (let i = 1; i < m; i++) a += f[i];
    val = h * (ends / 2 + a);
    return { val, text: `Trapecio ${range}: h·[(f₀+fₙ)/2 + Σfᵢ] = ${f6(h)}·[${f6(ends)}/2 + ${f6(a)}] = ${f6(val)}` };
  }
  if (seg.k === 'S13') {
    for (let i = 1; i < m; i++) (i % 2 ? (a += f[i]) : (b += f[i]));
    val = (h / 3) * (ends + 4 * a + 2 * b);
    return { val, text: `Simpson 1/3 ${range}: (h/3)·[f₀+fₙ + 4·Σimpares + 2·Σpares] = (${f6(h)}/3)·[${f6(ends)} + 4·${f6(a)} + 2·${f6(b)}] = ${f6(val)}` };
  }
  for (let i = 1; i < m; i++) (i % 3 ? (a += f[i]) : (b += f[i]));
  val = (3 * h / 8) * (ends + 3 * a + 2 * b);
  return { val, text: `Simpson 3/8 ${range}: (3h/8)·[f₀+fₙ + 3·Σ(no múltiplos de 3) + 2·Σ(múltiplos de 3)] = (3·${f6(h)}/8)·[${f6(ends)} + 3·${f6(a)} + 2·${f6(b)}] = ${f6(val)}` };
}

/* Aplica un método. ctx = { fs, n, h, k }. Devuelve { err } o { value, raw, rule, steps }. */
function runMethod(ctx, method) {
  const err = methodCheck(method, ctx.n);
  if (err) return { err };
  const rule = buildRule(method, ctx.n, ctx.h);
  let raw = 0;
  for (let i = 0; i <= ctx.n; i++) raw += rule.w[i] * ctx.fs[i];
  const steps = rule.segs.map(s => segSteps(s, ctx.fs, ctx.h));
  return { value: ctx.k * raw, raw, rule, steps };
}

/* Interpolante de Lagrange (para dibujar el polinomio de cada bloque). */
function lagrange(xs, ys, x) {
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    let t = ys[i];
    for (let j = 0; j < xs.length; j++) if (j !== i) t *= (x - xs[j]) / (xs[i] - xs[j]);
    s += t;
  }
  return s;
}

/* Bloques de interpolación (grado 1, 2 o 3) que representan geométricamente cada regla. */
function blocksFor(method, n) {
  const out = [];
  for (const s of segmentsFor(method, n)) {
    const step = s.k === 'T' ? 1 : s.k === 'S13' ? 2 : 3;
    for (let i = s.i0; i < s.i1; i += step) out.push({ k: s.k, i0: i, i1: i + step });
  }
  return out;
}

function mkCtx(xs, fs, k) {
  const n = xs.length - 1;
  return { xs, fs, n, h: (xs[n] - xs[0]) / n, k };
}

if (typeof module !== 'undefined') {
  module.exports = { METHODS, METHOD_NAME, FACTOR_LABEL, f6, pct, sup, methodCheck, segmentsFor, buildRule, runMethod, lagrange, blocksFor, mkCtx };
}
