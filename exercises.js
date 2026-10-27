'use strict';
/* Definición de los ejercicios 19–27 + prueba de validación. */
if (typeof require !== 'undefined' && typeof module !== 'undefined') Object.assign(globalThis, require('./core.js'));

const PI = Math.PI;
const sinh = Math.sinh, cosh = Math.cosh;

/* Perfil del lago: datos DIDÁCTICOS (ilustrativos), no mediciones reales. */
const LAKE_ERIE = [[40, 24], [60, 42], [80, 54], [100, 60], [120, 60], [140, 57], [160, 52], [180, 47], [200, 41], [220, 35], [240, 26], [260, 16]];
const LAKE_TITICACA = [[0, 5], [10, 25], [20, 40], [30, 50], [40, 55], [50, 58], [60, 56], [70, 52], [80, 48], [90, 45], [100, 44], [110, 46], [120, 50], [130, 52], [140, 48], [150, 42], [160, 36], [170, 28], [180, 18], [190, 6]];

const EXERCISES = [
  /* ------------------------------------------------------------------ 19 */
  {
    id: 19, kind: 'table', nav: 'Transporte urbano',
    title: 'Distancia recorrida por un vehículo',
    tema: 'Transporte urbano · datos tabulados',
    resumen: 'Integrar la velocidad v(t) de un vehículo experimental durante 7 s para obtener la distancia.',
    enunciado: 'Un vehículo experimental registra su velocidad durante los primeros siete segundos. Estimar la distancia recorrida integrando v(t).',
    modelo: ['d = ∫₀⁷ v(t) dt', 'v en mi/h y t en s ⇒ la integral queda en mi·s/h; se divide entre 3600 para obtener millas.', 'Con 7 subintervalos (n impar) se combina Simpson 1/3 (4 subintervalos) y Simpson 3/8 (3 subintervalos).'],
    sistemas: 'Telemetría de sensores (IoT / vehículos conectados): la señal de velocidad llega muestreada a 1 Hz y el software debe reconstruir la odometría. Integrar en línea cuesta O(n) en tiempo y O(1) en memoria; el error depende de la frecuencia de muestreo, por eso comparar trapecio y Simpson ayuda a decidir cuánta resolución exige el sistema.',
    xName: 't', xUnit: 's', yName: 'v', yUnit: 'mi/h',
    data: [[0, 0], [1, 14], [2, 39], [3, 69], [4, 95], [5, 114], [6, 129], [7, 139]],
    defMethod: 'AUTO', geo: 'cum',
    integrals: [{
      name: 'Distancia d = ∫ v(t) dt', fn: (xs, ys) => ys, k: 1 / 3600, unit: 'mi', fLabel: 'v (mi/h)',
      rawUnit: 'mi/h·s', kText: '÷ 3600',
      extras: [{ label: 'Distancia en metros', mult: 1609.344, unit: 'm' }],
    }],
    doc: [{ T: 0.147083, S: 0.147072, Skey: 'AUTO', nota: 'Σ ponderada del trapecio = 529.5 mi/h·s; d ≈ 236.69 m.' }],
  },
  /* ------------------------------------------------------------------ 20 */
  {
    id: 20, kind: 'table', nav: 'Banda elástica',
    title: 'Trabajo de una banda elástica',
    tema: 'Ensayo de elasticidad · datos tabulados',
    resumen: 'Calcular el trabajo de la fuerza F(x) al estirar una banda elástica 2.8 in.',
    enunciado: 'Una banda elástica es estirada y se mide la fuerza en distintos desplazamientos. Calcular el trabajo de la fuerza.',
    modelo: ['W = ∫₀²·⁸ F(x) dx', 'x en pulgadas y F en libras ⇒ W en lb·in (1 lb·in ≈ 0.112985 J).', 'n = 7 subintervalos de h = 0.4 in: Simpson 1/3 (4) + Simpson 3/8 (3).'],
    sistemas: 'Adquisición de datos con una celda de carga conectada a un microcontrolador (Arduino/ESP32). El programa registra pares (x, F) y calcula el trabajo en el propio dispositivo; la validación de espaciamiento uniforme evita resultados falsos cuando se pierden muestras.',
    xName: 'x', xUnit: 'in', yName: 'F', yUnit: 'lb',
    data: [[0, 0], [0.4, 0.85], [0.8, 1.30], [1.2, 1.60], [1.6, 1.87], [2.0, 2.14], [2.4, 2.34], [2.8, 2.52]],
    defMethod: 'AUTO', geo: 'cum',
    integrals: [{
      name: 'Trabajo W = ∫ F(x) dx', fn: (xs, ys) => ys, k: 1, unit: 'lb·in', fLabel: 'F (lb)', rawUnit: 'lb·in', kText: '× 1',
      extras: [{ label: 'Trabajo en julios', mult: 0.112984829, unit: 'J' }],
    }],
    doc: [{ T: 4.544, S: 4.577167, Skey: 'AUTO', nota: 'Simpson combinado ≈ 0.517 J.' }],
  },
  /* ------------------------------------------------------------------ 21 */
  {
    id: 21, kind: 'table', nav: 'Perfil topográfico',
    title: 'Área bajo un perfil topográfico',
    tema: 'Perfil topográfico · datos digitalizados',
    resumen: 'Estimar el área bajo un perfil de altura entre x = 1 y x = 10 con coordenadas digitalizadas.',
    enunciado: 'A partir de una gráfica de altura respecto de posición, estimar el área bajo el perfil entre x = 1 y x = 10; registrar las coordenadas digitalizadas.',
    modelo: ['A = ∫₁¹⁰ y(x) dx', 'Son 10 puntos (n = 9 subintervalos, h = 1): n es impar y no múltiplo de 2.', 'Se usa Simpson 1/3 sobre los primeros 8 subintervalos y trapecio en el noveno.'],
    sistemas: 'Sistemas de Información Geográfica (SIG): el perfil se obtiene digitalizando una imagen. El error de digitalización se propaga al área, por eso el software debe permitir corregir datos y revalidarlos al instante. Los datos aquí son ilustrativos (leídos visualmente), no exactos.',
    xName: 'x', xUnit: '', yName: 'y', yUnit: '',
    data: [[1, 1.3], [2, 3.7], [3, 4.6], [4, 4.4], [5, 2.7], [6, 2.5], [7, 3.6], [8, 5.3], [9, 6.0], [10, 5.9]],
    defMethod: 'S13T', geo: 'cum',
    integrals: [{ name: 'Área A = ∫ y(x) dx', fn: (xs, ys) => ys, k: 1, unit: 'u²', fLabel: 'y (u)', rawUnit: 'u²', kText: '× 1' }],
    doc: [{ T: 36.40, S: 36.85, Skey: 'S13T', nota: 'Datos ilustrativos; la precisión depende de la digitalización.' }],
  },
  /* ------------------------------------------------------------------ 22 */
  {
    id: 22, kind: 'func', nav: 'Cable suspendido',
    title: 'Longitud de un cable en catenaria',
    tema: 'Cable suspendido · función matemática',
    resumen: 'Longitud de arco de y = a·cosh(x/a) entre dos apoyos (modelo geométrico simplificado).',
    enunciado: 'Un cable tiene la forma de una catenaria y = a·cosh(x/a). Estimar su longitud entre dos apoyos. Es un modelo geométrico simplificado, no un cálculo de ingeniería del teleférico.',
    modelo: ['y = a·cosh(x/a),  y′ = sinh(x/a)', 'L = ∫ₓ₁ˣ² √(1 + [y′]²) dx = ∫ₓ₁ˣ² cosh(x/a) dx', 'Valor exacto: L = a·[sinh(x₂/a) − sinh(x₁/a)]  (a = 24 ft, x₁ = −12 ft, x₂ = 26 ft).'],
    sistemas: 'Gráficos por computadora y CAD: la longitud de arco sirve para parametrizar curvas, simplificar polilíneas y calcular materiales. El integrando raíz-cuadrada es habitual en motores de render; comparar contra el valor exacto permite verificar la implementación.',
    params: [
      { key: 'a', label: 'a (mínimo de la catenaria)', unit: 'ft', def: 24 },
      { key: 'x1', label: 'x₁ (apoyo izquierdo)', unit: 'ft', def: -12 },
      { key: 'x2', label: 'x₂ (apoyo derecho)', unit: 'ft', def: 26 },
    ],
    defN: 8, defMethod: 'S13',
    validate: p => {
      const e = [];
      if (!(p.a > 0)) e.push({ key: 'a', msg: 'a debe ser mayor que 0.' });
      if (!(p.x2 > p.x1)) e.push({ key: 'x2', msg: 'x₂ debe ser mayor que x₁.' });
      return e;
    },
    setup: p => ({
      a: p.x1, b: p.x2, k: 1, unit: 'ft', xName: 'x', xUnit: 'ft', fLabel: '√(1+y′²) = cosh(x/a)',
      name: 'Longitud L = ∫ √(1+y′²) dx',
      f: x => Math.sqrt(1 + sinh(x / p.a) ** 2),
      exact: p.a * (sinh(p.x2 / p.a) - sinh(p.x1 / p.a)),
    }),
    geo: p => {
      const pts = [], N = 160;
      for (let i = 0; i <= N; i++) { const x = p.x1 + (p.x2 - p.x1) * i / N; pts.push([x, p.a * cosh(x / p.a)]); }
      const y1 = p.a * cosh(p.x1 / p.a), y2 = p.a * cosh(p.x2 / p.a);
      const series = [
        { kind: 'line', pts, color: '--c-S13', width: 2.6, label: 'Cable y = a·cosh(x/a)' },
        { kind: 'line', pts: [[p.x1, 0], [p.x1, y1]], color: '--c-curve', dash: [5, 4], width: 1.5, label: 'Apoyos' },
        { kind: 'line', pts: [[p.x2, 0], [p.x2, y2]], color: '--c-curve', dash: [5, 4], width: 1.5 },
        { kind: 'pts', pts: [[p.x1, y1], [p.x2, y2]], color: '--c-S38', label: 'Puntos de anclaje' },
      ];
      if (p.x1 < 0 && p.x2 > 0) series.push({ kind: 'pts', pts: [[0, p.a]], color: '--c-T', label: 'Mínimo (0, a)' });
      return { title: 'Geometría del cable', xLabel: 'x (ft)', yLabel: 'y (ft)', baseline: true, series };
    },
    doc: [{ T: 44.042044, S: 43.899213, Skey: 'S13', exact: 43.898841, nota: 'Con 8 subintervalos.' }],
  },
  /* ------------------------------------------------------------------ 23 */
  {
    id: 23, kind: 'func', nav: 'Caudal de tubería',
    title: 'Caudal de una tubería circular',
    tema: 'Red de abastecimiento de agua · función matemática',
    resumen: 'Caudal de una tubería con perfil turbulento v(r) = v₀(1 − r/R)^(1/7).',
    enunciado: 'Determinar el caudal de una tubería circular con el perfil turbulento de velocidad especificado.',
    modelo: ['Q = ∫₀ᴿ 2π·r·v(r) dr,  v(r) = v₀·(1 − r/R)^(1/p)', 'Con v₀ = 80, R = 0.25 in, p = 7: Q = 160π ∫₀⁰·²⁵ r(1 − r/0.25)^(1/7) dr', 'Valor exacto: Q = 2π·v₀·R² / [(1 + 1/p)(2 + 1/p)] = 49π/12 ≈ 12.828170 in³/s.'],
    sistemas: 'Simulación y gemelos digitales de redes de agua (SCADA). Cerca de la pared la derivada del perfil crece sin límite, así que la convergencia es lenta: es un buen caso para discutir refinamiento adaptativo de malla y para mostrar por qué más nodos no siempre significan error cero.',
    params: [
      { key: 'v0', label: 'v₀ (velocidad máxima)', unit: 'in/s', def: 80 },
      { key: 'R', label: 'R (radio)', unit: 'in', def: 0.25 },
      { key: 'p', label: 'p (exponente 1/p)', unit: '', def: 7 },
    ],
    defN: 8, defMethod: 'S13',
    validate: p => {
      const e = [];
      if (!(p.v0 > 0)) e.push({ key: 'v0', msg: 'v₀ debe ser mayor que 0.' });
      if (!(p.R > 0)) e.push({ key: 'R', msg: 'R debe ser mayor que 0.' });
      if (!(p.p > 0)) e.push({ key: 'p', msg: 'p debe ser mayor que 0.' });
      return e;
    },
    setup: p => ({
      a: 0, b: p.R, k: 1, unit: 'in³/s', xName: 'r', xUnit: 'in', fLabel: '2π·r·v(r)',
      name: 'Caudal Q = ∫ 2π r v(r) dr',
      f: r => 2 * PI * r * p.v0 * Math.max(0, 1 - r / p.R) ** (1 / p.p),
      exact: 2 * PI * p.v0 * p.R ** 2 / ((1 + 1 / p.p) * (2 + 1 / p.p)),
    }),
    geo: p => {
      const pts = [], N = 160;
      for (let i = 0; i <= N; i++) { const r = -p.R + 2 * p.R * i / N; pts.push([r, p.v0 * Math.max(0, 1 - Math.abs(r) / p.R) ** (1 / p.p)]); }
      return {
        title: 'Perfil de velocidad en la sección', xLabel: 'r (in)', yLabel: 'v (in/s)', baseline: true,
        series: [{ kind: 'fill', pts, color: '--c-T', label: 'v(r) turbulento' }, { kind: 'line', pts, color: '--c-T', width: 2.4 }],
      };
    },
    doc: [{ T: 11.681778, S: 12.151244, Skey: 'S13', exact: 12.828170, nota: 'Con 8 subintervalos; converge lento por la derivada cerca de la pared.' }],
  },
  /* ------------------------------------------------------------------ 24 */
  {
    id: 24, kind: 'func', nav: 'Cardioide',
    title: 'Longitud de una cardioide paramétrica',
    tema: 'Diseño de una trayectoria · curva paramétrica',
    resumen: 'Representar la cardioide x(t), y(t) con b = 5 y estimar su longitud entre t = 0 y 2π.',
    enunciado: 'Representar una cardioide paramétrica con b = 5 y estimar su longitud entre t = 0 y t = 2π.',
    modelo: ['x(t) = 2b·cos t − b·cos 2t,  y(t) = 2b·sin t − b·sin 2t', 'L = ∫₀^(2π) √([x′(t)]² + [y′(t)]²) dt = ∫₀^(2π) 4b·sin(t/2) dt', 'Valor exacto: L = 16b = 80 para b = 5.'],
    sistemas: 'Planificación de trayectorias en robótica y animación: un robot o sprite sigue una curva paramétrica y el sistema necesita su longitud para estimar tiempos y velocidades. La misma integral aparece en curvas de Bézier y splines de cualquier motor gráfico.',
    params: [{ key: 'b', label: 'b (parámetro de la cardioide)', unit: 'u', def: 5 }],
    defN: 8, defMethod: 'S13',
    validate: p => (p.b > 0 ? [] : [{ key: 'b', msg: 'b debe ser mayor que 0.' }]),
    setup: p => ({
      a: 0, b: 2 * PI, k: 1, unit: 'u', xName: 't', xUnit: 'rad', fLabel: '√(x′² + y′²)',
      name: 'Longitud L = ∫ √(x′² + y′²) dt',
      f: t => Math.hypot(-2 * p.b * Math.sin(t) + 2 * p.b * Math.sin(2 * t), 2 * p.b * Math.cos(t) - 2 * p.b * Math.cos(2 * t)),
      exact: 16 * p.b,
    }),
    geo: (p, ctx) => {
      const X = t => 2 * p.b * Math.cos(t) - p.b * Math.cos(2 * t), Y = t => 2 * p.b * Math.sin(t) - p.b * Math.sin(2 * t);
      const pts = [], N = 240;
      for (let i = 0; i <= N; i++) { const t = 2 * PI * i / N; pts.push([X(t), Y(t)]); }
      const series = [{ kind: 'line', pts, color: '--c-S13', width: 2.6, label: 'Cardioide (x(t), y(t))' }];
      if (ctx && ctx.n <= 400) series.push({ kind: 'pts', pts: ctx.xs.map(t => [X(t), Y(t)]), color: '--c-S38', label: 'Nodos tᵢ de la regla' });
      return { title: 'Trayectoria en el plano', xLabel: 'x (u)', yLabel: 'y (u)', equal: true, series };
    },
    doc: [{ T: 78.969264, S: 80.010767, Skey: 'S13', exact: 80, nota: 'Con 8 subintervalos.' }],
  },
  /* ------------------------------------------------------------------ 25 */
  {
    id: 25, kind: 'func', nav: 'Energía gravitatoria',
    title: 'Variación de energía potencial de un satélite',
    tema: 'Energía gravitatoria · función matemática',
    resumen: 'Energía necesaria para elevar un satélite de 500 kg a 800 km de altura.',
    enunciado: 'Estimar la variación de energía potencial de un satélite de 500 kg elevado a 800 km.',
    modelo: ['g(y) = g₀R² / (R + y)²', 'ΔU = ∫₀ʰ m·g(y) dy = m·g₀·R² ∫₀ʰ dy/(R + y)²', 'Valor exacto: ΔU = m·g₀·R·h / (R + h) ≈ 3.486236787×10⁹ J.'],
    sistemas: 'Simulación orbital y software aeroespacial. Aquí hay magnitudes de 10⁶ y 10⁹ mezcladas: se discute precisión doble IEEE-754, notación científica y estabilidad numérica. El integrando casi constante hace que Simpson acierte casi todos los dígitos.',
    params: [
      { key: 'm', label: 'm (masa)', unit: 'kg', def: 500 },
      { key: 'g0', label: 'g₀ (gravedad en superficie)', unit: 'm/s²', def: 9.81 },
      { key: 'R', label: 'R (radio terrestre)', unit: 'm', def: 6371000 },
      { key: 'h', label: 'h (altura)', unit: 'm', def: 800000 },
    ],
    defN: 8, defMethod: 'S13',
    validate: p => {
      const e = [];
      [['m', 'm'], ['g0', 'g₀'], ['R', 'R'], ['h', 'h']].forEach(([k, n]) => { if (!(p[k] > 0)) e.push({ key: k, msg: `${n} debe ser mayor que 0.` }); });
      return e;
    },
    setup: p => ({
      a: 0, b: p.h, k: 1, unit: 'J', xName: 'y', xUnit: 'm', fLabel: 'm·g(y) (N)',
      name: 'ΔU = ∫ m·g(y) dy',
      f: y => p.m * p.g0 * p.R ** 2 / (p.R + y) ** 2,
      exact: p.m * p.g0 * p.R * p.h / (p.R + p.h),
      extras: [{ label: 'En gigajulios', mult: 1e-9, unit: 'GJ' }],
    }),
    geo: p => {
      const pts = [], N = 120;
      for (let i = 0; i <= N; i++) { const y = p.h * i / N; pts.push([y / 1000, p.g0 * p.R ** 2 / (p.R + y) ** 2]); }
      return { title: 'Gravedad g(y) con la altura', xLabel: 'altura y (km)', yLabel: 'g (m/s²)', series: [{ kind: 'line', pts, color: '--c-S38', width: 2.6, label: 'g(y) = g₀R²/(R+y)²' }] };
    },
    doc: [{ T: 3.48662008e9, S: 3.48623690e9, Skey: 'S13', exact: 3.486236787e9, nota: 'Con 8 subintervalos.' }],
  },
  /* ------------------------------------------------------------------ 26 */
  {
    id: 26, kind: 'table', nav: 'Superficie de lago',
    title: 'Superficie de un lago (Erie → Titicaca)',
    tema: 'Superficie de lago · anchuras medidas',
    resumen: 'Estimar el área del lago Erie con anchuras cada 20 millas y proponer una adaptación al Titicaca.',
    enunciado: 'Estimar el área del lago Erie a partir de anchuras medidas en la figura. Proponer posteriormente una adaptación al Titicaca, usando datos geográficos adecuados.',
    modelo: ['A = ∫₄₀²⁶⁰ w(x) dx  (x en millas, w en millas), anchuras cada 20 millas ⇒ 12 puntos, n = 11.', 'Referencia del problema original: 9 940 mi². Error % = 100·|A_num − 9940| / 9940.', 'Sin una tabla oficial de mediciones no existe una única aproximación reproducible: por eso la tabla de abajo es editable y los datos de ejemplo son DIDÁCTICOS.'],
    sistemas: 'SIG y percepción remota: el área de cuerpos de agua se calcula integrando anchuras medidas sobre un mapa. Reproducibilidad: para comparar resultados entre equipos se necesita una tabla común de datos, igual que un dataset versionado en un repositorio. La adaptación al Titicaca cambia unidades (km, km²) y el valor de referencia.',
    xName: 'x', xUnit: 'mi', yName: 'w', yUnit: 'mi',
    data: LAKE_ERIE, defMethod: 'AUTO', geo: 'sil',
    presets: [
      { name: 'Lago Erie (datos didácticos)', data: LAKE_ERIE, xUnit: 'mi', yUnit: 'mi', areaUnit: 'mi²', ref: 9940, refLabel: 'Área de referencia del problema original (9 940 mi²)', note: 'Anchuras ilustrativas, escogidas para ser coherentes con el orden de magnitud del problema original; reemplázalas por tu tabla digitalizada.' },
      { name: 'Lago Titicaca (adaptación, datos didácticos)', data: LAKE_TITICACA, xUnit: 'km', yUnit: 'km', areaUnit: 'km²', ref: 8372, refLabel: 'Área de referencia aproximada citada en la literatura (≈ 8 372 km²; verifica con tu fuente)', note: 'Anchuras ilustrativas cada 10 km a lo largo de ≈190 km. Sustitúyelas por mediciones de un mapa o SIG antes de entregar.' },
    ],
    integrals: [{ name: 'Área A = ∫ w(x) dx', fn: (xs, ys) => ys, k: 1, unit: 'mi²', fLabel: 'w (ancho)', rawUnit: 'mi²', kText: '× 1' }],
    doc: [],
  },
  /* ------------------------------------------------------------------ 27 */
  {
    id: 27, kind: 'table', nav: 'Objeto alargado',
    title: 'Volumen y superficie de un objeto alargado',
    tema: 'Geometría de un objeto alargado · sólido de revolución',
    resumen: 'Volumen a partir de diámetros a lo largo del eje y discusión de la fórmula de área simplificada.',
    enunciado: 'Con datos de diámetro a lo largo del eje, estimar volumen y discutir la diferencia entre la fórmula simplificada y el área real de revolución.',
    modelo: ['r = d/2,  V = π ∫₀¹² r² dz', 'Área simplificada del enunciado: S = 2π ∫ r dz  (omite la pendiente).', 'Área geométrica de revolución: S = 2π ∫ r·√(1 + (r′)²) dz, con r′ estimada por diferencias finitas.'],
    sistemas: 'Modelado 3D, CAD e impresión 3D: el volumen se obtiene de un perfil de revolución para estimar material y peso. Aquí se ve un error típico de implementación: usar una fórmula simplificada y llamarla "área exacta". La discusión es sobre validar modelos, no solo calcular.',
    xName: 'z', xUnit: 'in', yName: 'd', yUnit: 'in',
    data: [[0, 0], [1, 2.6], [2, 3.2], [3, 4.8], [4, 5.6], [5, 6.0], [6, 6.2], [7, 6.0], [8, 5.6], [9, 4.8], [10, 3.3], [11, 2.6], [12, 0]],
    defMethod: 'S13', geo: 'sil',
    integrals: [
      { name: 'Volumen V = π ∫ r² dz', fn: (xs, ys) => ys.map(d => (d / 2) ** 2), k: PI, unit: 'in³', fLabel: 'r² (in²)', rawUnit: 'in³/π', kText: '× π', extras: [{ label: 'Volumen en cm³', mult: 16.387064, unit: 'cm³' }] },
      { name: 'Superficie simplificada S = 2π ∫ r dz', fn: (xs, ys) => ys.map(d => d / 2), k: 2 * PI, unit: 'in²', fLabel: 'r (in)', rawUnit: 'in²/2π', kText: '× 2π', warn: 'Esta fórmula omite la pendiente de la generatriz: no debe llamarse "área superficial exacta".' },
      {
        name: 'Superficie de revolución S = 2π ∫ r√(1+r′²) dz',
        fn: (xs, ys) => {
          const r = ys.map(d => d / 2), n = r.length;
          return r.map((ri, i) => {
            const d = i === 0 ? (r[1] - r[0]) / (xs[1] - xs[0]) : i === n - 1 ? (r[n - 1] - r[n - 2]) / (xs[n - 1] - xs[n - 2]) : (r[i + 1] - r[i - 1]) / (xs[i + 1] - xs[i - 1]);
            return ri * Math.sqrt(1 + d * d);
          });
        },
        k: 2 * PI, unit: 'in²', fLabel: 'r·√(1+r′²) (in)', rawUnit: 'in²/2π', kText: '× 2π',
        warn: 'r′ se estima por diferencias finitas (centradas y laterales en los extremos): es una estimación, no un valor exacto.',
      },
    ],
    doc: [
      { T: 199.404740, S: 201.842092, Skey: 'S13', nota: 'Volumen.' },
      { T: 159.278748, S: 162.315620, Skey: 'S13', nota: 'Fórmula simplificada del enunciado.' },
    ],
  },
  /* ------------------------------------------------------------------ prueba */
  {
    id: 'test', kind: 'func', nav: 'Prueba de validación', navGroup: 'tools', isTest: true,
    title: 'Prueba de validación: f(x) = x² en [0, 2]',
    tema: 'Verificación mínima de código',
    resumen: 'Integra x² de 0 a 2 (exacto 8/3) con n = 4 y n = 8 para comprobar los algoritmos.',
    enunciado: 'Verificación mínima de código: integrar f(x) = x² de 0 a 2; resultado exacto 8/3. Incorporar comparación n = 4 y n = 8 donde corresponda.',
    modelo: ['I = ∫₀² x² dx = 8/3 ≈ 2.666667', 'Simpson es exacto para polinomios de grado ≤ 3, por lo que debe dar 8/3 salvo redondeo.', 'El trapecio tiene error O(h²): al duplicar n el error debe dividirse aproximadamente entre 4.'],
    sistemas: 'Pruebas unitarias numéricas: antes de usar la aplicación con datos reales se verifica con un caso de solución conocida (test oracle). Si esta prueba falla, ningún resultado posterior es confiable.',
    params: [
      { key: 'a', label: 'a (límite inferior)', unit: '', def: 0 },
      { key: 'b', label: 'b (límite superior)', unit: '', def: 2 },
    ],
    defN: 8, defMethod: 'S13',
    validate: p => (p.b > p.a ? [] : [{ key: 'b', msg: 'b debe ser mayor que a.' }]),
    setup: p => ({ a: p.a, b: p.b, k: 1, unit: '', xName: 'x', xUnit: '', fLabel: 'f(x) = x²', name: 'I = ∫ x² dx', f: x => x * x, exact: (p.b ** 3 - p.a ** 3) / 3 }),
    geo: null,
    doc: [{ T: null, S: null, Skey: 'S13', exact: 8 / 3, nota: 'Exacto 8/3.' }],
  },
];

if (typeof module !== 'undefined') module.exports = { EXERCISES };
