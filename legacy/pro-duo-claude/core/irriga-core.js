/* ============================================================================
 * Irriga.ai Pro-Duo · edição Claude — MOTOR AGRONÔMICO ÚNICO (irriga-core.js)
 * ----------------------------------------------------------------------------
 * O mesmo arquivo roda no app (navegador) e no simulador (Node). O firmware do
 * ESP32 espelha estas fórmulas em C++ (ver docs/ESPEC_MOTOR.md).
 *
 * Ideia central: balanço hídrico do solo (FAO-56, "modelo do balde").
 *   - O solo da zona é uma caixa d'água pequena: capacidade = água disponível
 *     (TAW) na faixa molhada pelo gotejo, até a profundidade da raiz.
 *   - Todo dia a planta gasta ETc = ET0 × Kc × Kr. Chuva e rega devolvem.
 *   - Só regamos quando o gasto chega perto do limite sem estresse (RAW) e
 *     devolvemos apenas o que falta. Chuva fica guardada no solo; nada escorre.
 * Unidade interna: mm sobre a área da zona (1 mm = 1 L/m²).
 * ========================================================================== */
(function (root) {
  const Crops = (typeof module !== 'undefined' && module.exports)
    ? require('./crops.js') : root.IrrigaCrops;
  const { CROPS, ROTACAO, MOTIVO_ROTACAO } = Crops;

  /* ---------- Constantes físicas ---------- */
  const SOLOS = {
    arenoso:        { nome: 'Arenoso',        taw_mm_m: 70,  faixa_molhada_m: 0.50 },
    franco_arenoso: { nome: 'Franco-arenoso', taw_mm_m: 100, faixa_molhada_m: 0.70 },
    franco:         { nome: 'Franco',         taw_mm_m: 140, faixa_molhada_m: 0.90 },
    argiloso:       { nome: 'Argiloso',       taw_mm_m: 170, faixa_molhada_m: 1.10 },
  };
  // Normais aproximadas do Seridó Oriental (PB). Usadas offline e no simulador.
  const CLIMA_SERIDO = {
    et0_mm_dia: [5.8, 5.4, 5.0, 4.6, 4.2, 3.9, 4.2, 5.0, 5.9, 6.4, 6.5, 6.2],
    chuva_mm_mes: [40, 60, 100, 90, 45, 25, 15, 5, 2, 2, 5, 15],
    tmax_c: [33, 32, 31, 30, 29, 28, 28, 30, 32, 33, 34, 34],
  };
  const EFICIENCIA_GOTEJO = 0.88;      // aplicação × uniformidade por gravidade
  const VOLUME_MANGUEIRA_L_M = 0.145;  // PEBD 16 mm (DI ≈ 13,6 mm)
  const EXPOENTE_GOTEJADOR = 0.5;      // não autocompensante: q ∝ H^0,5
  const FRACAO_SOLO_FUNDO = 0.5;       // umidade relativa do solo novo explorado pela raiz

  /* ---------- Tempo ---------- */
  const DAY_MS = 86400000;
  const toDate = (s) => (s instanceof Date ? s : new Date(String(s).slice(0, 10) + 'T12:00:00'));
  const isoDate = (d) => { const x = toDate(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const addDays = (s, n) => isoDate(new Date(toDate(s).getTime() + n * DAY_MS));
  const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY_MS);
  const hhmmToMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
  const minToHhmm = (m) => { const t = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);

  /* ---------- Clima climatológico (curva suave entre meses) ---------- */
  function climatologia(dateStr) {
    const d = toDate(dateStr);
    const m = d.getMonth(), dia = d.getDate(), dim = new Date(d.getFullYear(), m + 1, 0).getDate();
    const t = (dia - 15) / dim;
    const viz = t >= 0 ? (m + 1) % 12 : (m + 11) % 12;
    const mix = (arr) => lerp(arr[m], arr[viz], Math.abs(t));
    return { date: isoDate(d), et0: mix(CLIMA_SERIDO.et0_mm_dia), tmax: mix(CLIMA_SERIDO.tmax_c),
      chuva_media_dia: mix(CLIMA_SERIDO.chuva_mm_mes) / 30, fonte: 'climatologia' };
  }

  /* ---------- Planta no dia ---------- */
  function cropDay(cropId, dap, opts = {}) {
    const c = CROPS[cropId];
    if (!c) return null;
    const [Li, Ld, Lm, Ll] = c.dias;
    const ciclo = Li + Ld + Lm + Ll;
    const d = clamp(dap, 1, ciclo);
    let kc, fase;
    if (d <= Li) { kc = c.kc[0]; fase = 0; }
    else if (d <= Li + Ld) { kc = lerp(c.kc[0], c.kc[1], (d - Li) / Ld); fase = 1; }
    else if (d <= Li + Ld + Lm) { kc = c.kc[1]; fase = (d - Li - Ld) <= Lm * 0.45 ? 2 : 3; }
    else { kc = lerp(c.kc[1], c.kc[2], (d - Li - Ld - Lm) / Ll); fase = 4; }
    // Cobertura do solo cresce até o meio do ciclo → Kr (Keller/Decroix) para gotejo localizado
    const cobertura = lerp(0.08, c.cobertura, (d - 1) / (Li + Ld + Lm * 0.3));
    const kr = clamp(0.1 + cobertura, 0.15, 1);
    // Cobertura morta (palhada) corta evaporação do solo molhado
    const fatorPalhada = opts.palhada ? (fase <= 1 ? 0.85 : 0.95) : 1;
    const zr = lerp(c.raiz_m[0], c.raiz_m[1], (d - 1) / (Li + Ld));
    const rf = c.reta_final;
    const retaFinal = !!(rf && dap > ciclo - rf.dias);
    return {
      id: cropId, crop: c, dap, ciclo, fase, nomeFase: c.fases[fase],
      kc, kr, kcEf: kc * kr * fatorPalhada, zr, p: c.p, ky: c.ky[fase],
      critica: c.ky[fase] >= 1.0, retaFinal, reposicao: retaFinal ? rf.reposicao : 1,
      diasParaColher: Math.max(0, ciclo - dap), progresso: clamp(dap / ciclo, 0, 1),
      terminou: dap > ciclo,
    };
  }

  /* ---------- Geometria e hidráulica da zona ---------- */
  function geometria(zone, soilKey) {
    const solo = SOLOS[soilKey] || SOLOS.franco_arenoso;
    const largura = zone.lines_total * (zone.line_spacing_full_m || 1.0);
    const compLinha = zone.line_length_m || zone.area_m2 / largura;
    const espacamento = largura / Math.max(1, zone.lines_open);
    const metros = zone.lines_open * compLinha;
    const gotejadores = Math.round(metros / (zone.emitter_spacing_m || 0.3));
    const fw = clamp(solo.faixa_molhada_m / espacamento, 0.1, 1);
    return { solo, compLinha, espacamento, metros, gotejadores, fw,
      volumeMangueiraL: metros * VOLUME_MANGUEIRA_L_M + (zone.manifold_m || 10) * 0.3 };
  }
  const kGotejador = (z) => (z.emitter_q_lph || 1.6) / Math.pow(z.emitter_h_ref_m || 10, EXPOENTE_GOTEJADOR);
  function vazaoTeorica(zone, soilKey, cargaM) {
    const g = geometria(zone, soilKey);
    return g.gotejadores * kGotejador(zone) * Math.pow(Math.max(0.1, cargaM), EXPOENTE_GOTEJADOR) / 60;
  }
  /** Vazão usada no cálculo: a medida pelo SF1 se calibrada, senão a teórica. */
  function vazaoZona(zone, soilKey) {
    return zone.flow_cal_lpm > 0 ? zone.flow_cal_lpm : vazaoTeorica(zone, soilKey, zone.head_m_est || 1.8);
  }
  /** Autocalibração: a partir da vazão medida, descobre a pressão efetiva no gotejador. */
  function diagnosticoHidraulico(zone, soilKey, vazaoMedidaLpm) {
    const g = geometria(zone, soilKey);
    const qFuro = vazaoMedidaLpm * 60 / Math.max(1, g.gotejadores);
    const carga = Math.pow(qFuro / kGotejador(zone), 1 / EXPOENTE_GOTEJADOR);
    const nominal = vazaoTeorica(zone, soilKey, zone.emitter_h_ref_m || 10);
    let leitura;
    if (carga < 0.8) leitura = 'Pressão muito baixa: confira filtro, registro e se a caixa está alta o bastante.';
    else if (carga < 3) leitura = 'Normal para gravidade pura. O motor já compensa com o tempo de rega.';
    else if (carga < 12) leitura = 'Boa pressão — próxima da nominal dos gotejadores.';
    else leitura = 'Pressão acima do nominal: possível vazamento ou linha rompida. Verifique.';
    return { gotejadores: g.gotejadores, qFuroLph: qFuro, cargaEfetivaM: carga,
      vazaoNominalLpm: nominal, rendimentoPct: 100 * vazaoMedidaLpm / nominal, leitura };
  }

  /* ---------- O "balde" do solo ---------- */
  function balde(zone, soilKey, cd) {
    const g = geometria(zone, soilKey);
    const taw = g.solo.taw_mm_m * cd.zr * g.fw;
    return { taw, raw: cd.p * taw, fw: g.fw };
  }
  const chuvaEfetiva = (mm) => (mm > 2 ? 0.8 * (mm - 2) : 0);

  /** Avança 1 dia no balanço. Ordem: rega (madrugada) → chuva → consumo. */
  function passoDia(Dr, b, etc, chuvaMm, regaLiquidaMm) {
    let d = Dr - regaLiquidaMm - chuvaEfetiva(chuvaMm);
    let perda = 0;
    if (d < 0) { perda = -d; d = 0; }
    const ks = d > b.raw ? clamp((b.taw - d) / Math.max(0.01, b.taw - b.raw), 0, 1) : 1;
    const eta = etc * ks;
    d = Math.min(b.taw, d + eta);
    return { Dr: d, perdaMm: perda, ks, etaMm: eta, estresse: ks < 0.999 };
  }

  /* ---------- Decisão de rega de uma zona ---------- */
  function decidirZona(zone, ctx) {
    const { soil, dateStr, hoje, amanha } = ctx;
    if (!zone.enabled || !zone.crop || !zone.crop.id) return { zona: zone.id, liquidoMm: 0, motivo: 'Zona desligada.' };
    const dap = daysBetween(zone.crop.plantio, dateStr) + 1;
    if (dap < 1) return { zona: zone.id, liquidoMm: 0, motivo: 'Plantio ainda não começou.' };
    const cd = cropDay(zone.crop.id, dap, { palhada: zone.mulch });
    if (cd.terminou) return { zona: zone.id, cd, liquidoMm: 0, motivo: 'Ciclo encerrado — hora de colher e planejar a próxima cultura.' };
    const b = balde(zone, soil, cd);
    const etc = hoje.et0 * cd.kcEf * (1 + (zone.fine_pct || 0) / 100);
    const Dr = zone.Dr_mm || 0;
    // Gotejo = alta frequência: repõe diariamente o que foi gasto (bulbo sempre úmido,
    // cota diária suave). Exceção: reta final aceita leve estresse controlado.
    const limite = cd.retaFinal ? b.raw * 1.25 : Math.min(0.9 * b.raw, Math.max(0.3 * b.raw, 1.5));
    // Espaço para a chuva provável (sem nunca passar do limite sem estresse)
    const prev = [hoje, amanha].filter(Boolean)
      .map((w) => chuvaEfetiva(w.rain || 0) * clamp((w.rain_prob ?? 0) / 100, 0, 1));
    const chuvaEsperada = Math.max(0, ...prev);
    const espaco = Math.min(chuvaEsperada, 0.5 * b.raw);
    const base = { zona: zone.id, cd, balde: b, etcMm: etc, DrMm: Dr,
      reservaPct: 100 * (1 - Dr / Math.max(0.01, b.taw)) };
    if (Dr < limite && Dr + etc <= 0.9 * b.raw * (cd.retaFinal ? 1.4 : 1)) {
      return { ...base, liquidoMm: 0, tardeMm: 0,
        motivo: `Solo com ${Math.round(base.reservaPct)}% da água disponível — não precisa regar hoje.` };
    }
    let liq = Math.max(0, Dr - espaco) * cd.reposicao;
    // Balde pequeno (muda nova / solo arenoso): o dia sozinho esgota a reserva → pulso extra à tarde
    let tarde = Math.max(0, espaco + etc - 0.85 * b.raw) * cd.reposicao;
    if (liq < 0.4 && tarde < 0.4) return { ...base, liquidoMm: 0, tardeMm: 0,
      motivo: espaco > 0.3 ? 'Chuva provável vai repor o solo — rega adiada.' : `Solo com ${Math.round(base.reservaPct)}% da água disponível — não precisa regar hoje.` };
    const partes = [];
    if (espaco > 0.3) partes.push(`deixei ${espaco.toFixed(1)} mm de espaço para a chuva prevista`);
    if (cd.retaFinal) partes.push(`reta final: só ${Math.round(cd.reposicao * 100)}% da reposição para ${cd.crop.reta_final.motivo}`);
    if (tarde > 0) partes.push('balde raso: metade do dia vai num pulso ao entardecer');
    return { ...base, liquidoMm: liq, tardeMm: tarde,
      motivo: `Repor ${(liq + tarde).toFixed(1)} mm que a planta já usou${partes.length ? ' · ' + partes.join(' · ') : ''}.` };
  }

  /* ---------- Divisão de água escassa (Ky — FAO-33) ---------- */
  function ratearCota(itens, disponivelL) {
    let total = itens.reduce((s, i) => s + i.litros, 0);
    if (total <= disponivelL) return { itens: itens.map((i) => ({ ...i, cortePct: 0 })), cortou: false };
    // Na escassez, o déficit acumulado acima do limite não se recupera num dia:
    // cada zona pede no máximo o consumo de hoje + 20% (evita a "espiral" de pedidos).
    const pedido = itens.map((i) => (i.litrosDia ? Math.min(i.litros, i.litrosDia * 1.2) : i.litros));
    total = pedido.reduce((s, l) => s + l, 0);
    const piso = Math.min(0.4, disponivelL / Math.max(1, total));
    let resto = disponivelL;
    const out = itens.map((i, k) => { const l = Math.min(pedido[k] * piso, resto); resto -= l; return { ...i, alocado: l, pedido: pedido[k] }; });
    [...out].sort((a, b) => b.ky - a.ky).forEach((i) => {
      const add = Math.min(i.pedido - i.alocado, resto); i.alocado += add; resto -= add;
    });
    return { itens: out.map((i) => ({ ...i, cortePct: 100 * (1 - i.alocado / Math.max(0.01, i.litros)), litros: i.alocado })), cortou: true };
  }

  /* ---------- Montagem da agenda (pulsos intercalados, nunca 2 zonas juntas) ---------- */
  function montarAgenda(pedidos, cfg) {
    const fim = hhmmToMin(cfg.end_dawn || '05:30');
    const cedo = hhmmToMin(cfg.earliest || '18:30') - 1440;
    const pulso = cfg.pulse_max_min || 90, gap = cfg.gap_min || 5;
    const fila = pedidos.filter((p) => p.minutos >= 1).map((p) => ({ ...p, resta: p.minutos }));
    const pulsos = [];
    while (fila.some((p) => p.resta > 0.5)) {
      for (const p of fila) if (p.resta > 0.5) { const m = Math.min(pulso, p.resta); pulsos.push({ zona: p.zona, minutos: m, litros: m * p.vazao }); p.resta -= m; }
    }
    let total = pulsos.reduce((s, p) => s + p.minutos + gap, 0) - (pulsos.length ? gap : 0);
    let inicio = fim - total;
    const avisos = [];
    if (inicio < cedo) {
      avisos.push(`A noite não comporta tudo (${Math.round(total / 60 * 10) / 10} h de rega). Considere a bomba auxiliar (Relé 6) ou abrir menos linhas.`);
      inicio = cedo;
    }
    let t = inicio;
    const eventos = pulsos.map((p) => { const e = { ...p, inicioMin: t, fimMin: t + p.minutos }; t += p.minutos + gap; return e; });
    return { eventos, avisos, inicioMin: inicio, fimMin: t - gap };
  }

  /* ---------- Plano completo de um "dia de rega" ---------- */
  function planejarDia(state, previsao, dateStr) {
    const hoje = previsao.find((w) => w.date === dateStr) || climatologia(dateStr);
    const amanha = previsao.find((w) => w.date === addDays(dateStr, 1)) || null;
    const ctx = { soil: state.soil, dateStr, hoje, amanha };
    const boostAtivo = state.boost && state.boost.pct > 0 && Date.parse(state.boost.until) > toDate(dateStr).getTime() - 12 * 3600e3;
    const mult = boostAtivo ? 1 + state.boost.pct / 100 : 1;
    const decisoes = state.zones.map((z) => decidirZona(z, ctx));
    const itens = [];
    decisoes.forEach((d, i) => {
      const z = state.zones[i];
      if (!d.liquidoMm && !d.tardeMm) return;
      const fator = z.area_m2 / EFICIENCIA_GOTEJO * mult;
      itens.push({ zona: z.id, idx: i, turno: 'noite', ky: d.cd.ky, litros: d.liquidoMm * fator, litrosDia: d.etcMm * fator });
      if (d.tardeMm > 0) itens.push({ zona: z.id, idx: i, turno: 'tarde', ky: d.cd.ky, litros: d.tardeMm * fator });
    });
    const tankL = state.tank.level_L ?? state.tank.capacity;
    const reservaL = state.tank.capacity * (state.tank.reserve_pct || 25) / 100;
    const margem = boostAtivo && tankL >= state.tank.capacity * 0.5 ? (state.quota.boost_margin_pct || 15) / 100 : 0;
    const disponivel = Math.max(0, Math.min(state.quota.daily_L * (1 + margem), tankL - reservaL));
    const rateio = ratearCota(itens, disponivel);
    const avisos = [];
    if (rateio.cortou) {
      const cortadas = rateio.itens.filter((i) => i.cortePct > 1).map((i) => `Zona ${i.zona} −${Math.round(i.cortePct)}%`);
      avisos.push(tankL - reservaL < state.quota.daily_L
        ? `Caixa perto da reserva: água dividida pela sensibilidade de cada planta (${cortadas.join(', ')}).`
        : `Demanda acima da cota de ${state.quota.daily_L} L: protegi a planta mais sensível (${cortadas.join(', ')}).`);
    }
    const vaz = state.zones.map((z) => vazaoZona(z, state.soil));
    const termico = state.thermal || {};
    const noite = montarAgenda(rateio.itens.filter((i) => i.turno === 'noite')
      .map((i) => ({ zona: i.zona, vazao: vaz[i.idx], minutos: i.litros / vaz[i.idx] })), state.windows || {});
    // Pulso da tarde: começa após a guarda térmica, mangueira já fria
    const tardeIni = Math.max(hhmmToMin((state.windows || {}).evening || '17:15'), hhmmToMin(termico.end || '16:30') + 30);
    let t = tardeIni;
    const tarde = rateio.itens.filter((i) => i.turno === 'tarde').map((i) => {
      const m = i.litros / vaz[i.idx]; const e = { zona: i.zona, minutos: m, litros: i.litros, inicioMin: t, fimMin: t + m, tarde: true };
      t += m + ((state.windows || {}).gap_min || 5); return e;
    });
    avisos.push(...noite.avisos);
    const porZona = state.zones.map((z, i) => {
      const it = rateio.itens.filter((x) => x.idx === i);
      return { ...decisoes[i], litros: it.reduce((s, x) => s + x.litros, 0), cortePct: Math.max(0, ...it.map((x) => x.cortePct || 0)), vazaoLpm: vaz[i] };
    });
    return { date: dateStr, clima: hoje, boostMult: mult, porZona, eventos: [...noite.eventos, ...tarde],
      totalL: porZona.reduce((s, z) => s + z.litros, 0), disponivelL: disponivel, avisos };
  }

  /** Aplica o dia ao estado (após a rega executada). Retorna métricas. */
  function fecharDia(state, plano, chuvaRealMm, litrosEntreguesPorZona) {
    const res = [];
    state.zones.forEach((z, i) => {
      const d = plano.porZona[i];
      if (!d.cd || d.cd.terminou) { res.push(null); return; }
      const entregue = litrosEntreguesPorZona ? litrosEntreguesPorZona[i] : d.litros;
      const liq = entregue * EFICIENCIA_GOTEJO / z.area_m2;
      // Raiz cresceu: solo novo entra parcialmente seco
      const ontem = cropDay(z.crop.id, d.cd.dap - 1, { palhada: z.mulch });
      if (ontem && d.cd.dap > 1) {
        const g = geometria(z, state.soil);
        z.Dr_mm = (z.Dr_mm || 0) + Math.max(0, d.cd.zr - ontem.zr) * g.solo.taw_mm_m * g.fw * FRACAO_SOLO_FUNDO;
      }
      const r = passoDia(z.Dr_mm || 0, d.balde, d.etcMm, chuvaRealMm, liq);
      z.Dr_mm = r.Dr;
      res.push({ ...r, litros: entregue });
    });
    return res;
  }

  /* ---------- Projeção de 7 dias (agenda futura + autonomia da caixa) ---------- */
  function projetarSemana(state, previsao, inicioStr, dias = 7) {
    const s = JSON.parse(JSON.stringify(state));
    const out = [];
    let tank = s.tank.level_L ?? s.tank.capacity;
    for (let k = 0; k < dias; k++) {
      const dt = addDays(inicioStr, k);
      s.tank.level_L = tank;
      if (k > 0) s.boost = { pct: 0 };
      const p = planejarDia(s, previsao, dt);
      const chuva = (p.clima.rain || 0) * ((p.clima.rain_prob ?? 100) >= 50 ? 1 : 0.3);
      fecharDia(s, p, chuva);
      tank -= p.totalL;
      out.push({ date: dt, litros: p.totalL, clima: p.clima, tankL: tank, zonas: p.porZona.map((z) => z.litros) });
    }
    const media = out.reduce((a, d) => a + d.litros, 0) / dias;
    const reserva = state.tank.capacity * (state.tank.reserve_pct || 25) / 100;
    const util = (state.tank.level_L ?? state.tank.capacity) - reserva;
    return { dias: out, mediaL: media, autonomiaDias: media > 1 ? util / media : Infinity };
  }

  /* ---------- Prévia de safra: quanto a cultura vai pedir antes de plantar ---------- */
  function previaSafra(zoneBase, soil, cropId, plantio) {
    const c = CROPS[cropId];
    const ciclo = c.dias.reduce((a, b) => a + b, 0);
    const z = { ...zoneBase, enabled: true, crop: { id: cropId, plantio }, Dr_mm: 0, fine_pct: 0 };
    const s = { soil, zones: [z], tank: { capacity: 1e9, level_L: 1e9, reserve_pct: 0 }, quota: { daily_L: 1e9 }, windows: {} };
    let total = 0, pico = 0, diaPico = null;
    const serie = [];
    for (let k = 0; k < ciclo; k++) {
      const dt = addDays(plantio, k);
      const cl = climatologia(dt);
      const p = planejarDia(s, [{ ...cl, rain: 0, rain_prob: 0 }], dt);
      fecharDia(s, p, cl.chuva_media_dia * 0); // conservador: sem chuva
      total += p.totalL; serie.push(p.totalL);
    }
    // pico = média móvel de 7 dias (dias com rega alternada não enganam)
    for (let k = 6; k < serie.length; k++) { const m = serie.slice(k - 6, k + 1).reduce((a, b) => a + b, 0) / 7; if (m > pico) { pico = m; diaPico = addDays(plantio, k); } }
    return { totalL: total, picoLDia: pico, diaPico, ciclo, colheita: addDays(plantio, ciclo), serie };
  }

  /** Melhor data de plantio p/ não estourar a cota somando com a(s) outra(s) zona(s). */
  function sugerirDataPlantio(state, zoneIdx, cropId, hojeStr, janelaDias = 60) {
    const outras = state.zones.filter((z, i) => i !== zoneIdx && z.enabled && z.crop && z.crop.id)
      .map((z) => ({ prev: previaSafra(z, state.soil, z.crop.id, z.crop.plantio), plantio: z.crop.plantio }));
    const opcoes = [];
    for (let off = 0; off <= janelaDias; off += 5) {
      const pl = addDays(hojeStr, off);
      const pv = previaSafra(state.zones[zoneIdx], state.soil, cropId, pl);
      let pico = 0;
      for (let k = 6; k < pv.serie.length; k++) {
        let soma = 0;
        for (let j = k - 6; j <= k; j++) {
          soma += pv.serie[j];
          for (const o of outras) { const idx = daysBetween(o.plantio, addDays(pl, j)); if (idx >= 0 && idx < o.prev.serie.length) soma += o.prev.serie[idx]; }
        }
        pico = Math.max(pico, soma / 7);
      }
      opcoes.push({ plantio: pl, offset: off, picoCombinadoL: pico, cabeNaCota: pico <= state.quota.daily_L, colheita: pv.colheita, totalL: pv.totalL });
    }
    const melhor = opcoes.find((o) => o.cabeNaCota) || opcoes.reduce((a, b) => (b.picoCombinadoL < a.picoCombinadoL ? b : a));
    return { opcoes, melhor };
  }

  /* ---------- Rotação ---------- */
  function sugerirRotacao(familiaAnterior) {
    const ordem = ROTACAO[familiaAnterior] || Object.keys(MOTIVO_ROTACAO);
    return Object.entries(CROPS)
      .filter(([, c]) => c.familia !== familiaAnterior)
      .map(([id, c]) => ({ id, ...c, rank: ordem.indexOf(c.familia) === -1 ? 9 : ordem.indexOf(c.familia), motivo: MOTIVO_ROTACAO[c.familia] || '' }))
      .sort((a, b) => a.rank - b.rank);
  }

  /* ---------- Guarda térmica para regas manuais de dia ---------- */
  function guardaTermica(state, zone, minutoDoDia, litros) {
    const t = state.thermal || {};
    const ini = hhmmToMin(t.start || '09:30'), fim = hhmmToMin(t.end || '16:30');
    if (minutoDoDia < ini || minutoDoDia > fim) return { ok: true, litros };
    const vol = geometria(zone, state.soil).volumeMangueiraL;
    const minimo = vol * (t.min_hose_multiple || 5);
    if (litros >= minimo) return { ok: true, litros, aviso: `Os primeiros ${Math.round(vol)} L saem quentes da mangueira, mas são < 20% da dose.` };
    return { ok: false, litros: minimo, volMangueira: vol,
      aviso: `Sol forte: uma rega de ${Math.round(litros)} L só empurraria ${Math.round(vol)} L de água a ~50 °C no pé da planta. Rego ${Math.round(minimo)} L agora ou deixo para as ${t.end ? minToHhmm(fim + 30) : '17:00'}?` };
  }

  /* ---------- Estado padrão do sítio (São Vicente do Seridó – PB) ---------- */
  function estadoPadrao() {
    const zona = (id, nome, area, comp, cropId, plantio, anterior) => ({
      id, nome, area_m2: area, lines_total: 16, lines_open: 8, line_length_m: comp, line_spacing_full_m: 1.0,
      emitter_spacing_m: 0.30, emitter_q_lph: 1.6, emitter_h_ref_m: 10, head_m_est: 1.8, manifold_m: 10,
      flow_cal_lpm: 0, flow_baseline_lpm: 0, enabled: true, mulch: false, fine_pct: 0, Dr_mm: 0,
      crop: { id: cropId, plantio, anterior },
    });
    return {
      versao: '2.0-claude',
      site: { nome: 'Sítio — São Vicente do Seridó (PB)', lat: -6.95325, lon: -36.36853, tz: 'America/Fortaleza' },
      soil: 'franco_arenoso',
      tank: { capacity: 5000, level_L: 3750, reserve_pct: 25 },
      quota: { daily_L: 1000, boost_margin_pct: 15 },
      windows: { end_dawn: '05:30', earliest: '18:30', evening: '17:15', pulse_max_min: 90, gap_min: 5 },
      thermal: { start: '09:30', end: '16:30', min_hose_multiple: 5 },
      boost: { pct: 0, until: null },
      pause: { until: null, indefinite: false, origem: null },
      zones: [
        zona(1, 'Zona 1 — Oeste', 128, 8.0, 'maxixe', '2026-09-20', 'Leguminosas'),
        zona(2, 'Zona 2 — Leste', 158, 9.875, 'melancia', '2026-08-18', 'Convolvuláceas'),
      ],
    };
  }

  const api = {
    estadoPadrao, SOLOS, CLIMA_SERIDO, CROPS, EFICIENCIA_GOTEJO, VOLUME_MANGUEIRA_L_M,
    isoDate, addDays, daysBetween, hhmmToMin, minToHhmm, clamp,
    climatologia, cropDay, geometria, vazaoTeorica, vazaoZona, diagnosticoHidraulico,
    balde, chuvaEfetiva, passoDia, decidirZona, ratearCota, montarAgenda,
    planejarDia, fecharDia, projetarSemana, previaSafra, sugerirDataPlantio,
    sugerirRotacao, guardaTermica,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IrrigaCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
