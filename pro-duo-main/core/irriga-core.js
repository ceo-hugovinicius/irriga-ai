/* ============================================================================
 * Irriga.ai Pro-Duo · v1.5.2-Argon — MOTOR AGRONÔMICO ÚNICO (irriga-core.js)
 * ----------------------------------------------------------------------------
 * O mesmo arquivo roda no app (navegador) e no simulador (Node). O firmware do
 * ESP32 espelha estas fórmulas em C++ (ver docs/ESPEC_MOTOR.md).
 *
 * Mudanças-chave v1.5.2-Argon:
 *   1. Fim do "chutômetro" de umidade do solo sem sensor físico: usamos
 *      Rega Diária Garantida (repondo todo dia a necessidade real ETc da planta
 *      dentro da cota diária).
 *   2. Tomada de decisão inteligente para culturas com Restrição Hídrica na
 *      Reta Final (Melancia, Melão, Jerimum, Batata-doce): reduz a rega para
 *      concentrar açúcar (°Brix) e aplica corte forte automático (só pulso leve
 *      de manhã) quando há clima ameno ou chance de chuva.
 *   3. Divisão da rega em 2 Turnos Diários:
 *      - 🌅 Manhã Cedo (04:00–05:30): ~60% da água para atravessar o calor do dia.
 *      - 🌇 Fim da Tarde (16:00–17:30): ~40% da água no entardecer, dividindo o
 *        uso da caixa de 5.000 L para facilitar a reposição pelo poço artesiano.
 *   4. Medição hidráulica direta por Metros de Fita de Gotejamento, Espaçamento
 *      entre Gotejadores (cm) e Vazão por Gotejador (L/h).
 *   5. Contador de Pedido Real das Plantas vs. Água Liberada pela Cota (indicador
 *      de "passando sede").
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
    vento_kmh: [20, 18, 16, 16, 17, 19, 21, 23, 24, 24, 23, 21],
  };
  const EFICIENCIA_GOTEJO = 0.88;      // aplicação × uniformidade por gravidade
  const VOLUME_MANGUEIRA_L_M = 0.145;  // PEBD 16 mm (DI ≈ 13,6 mm)
  const EXPOENTE_GOTEJADOR = 0.5;      // não autocompensante: q ∝ H^0,5
  const FRACAO_SOLO_FUNDO = 0.5;       // mantido p/ compatibilidade do simulador

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
    return {
      date: isoDate(d),
      et0: mix(CLIMA_SERIDO.et0_mm_dia),
      tmax: mix(CLIMA_SERIDO.tmax_c),
      tmin: mix(CLIMA_SERIDO.tmax_c) - 11,
      wind: mix(CLIMA_SERIDO.vento_kmh),
      chuva_media_dia: mix(CLIMA_SERIDO.chuva_mm_mes) / 30,
      fonte: 'climatologia',
    };
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
    const cobertura = lerp(0.12, c.cobertura, (d - 1) / (Li + Ld + Lm * 0.3));
    const kr = clamp(0.15 + cobertura, 0.22, 1);
    // Cobertura morta (palhada) corta evaporação do solo molhado (-15% nas fases iniciais)
    const fatorPalhada = opts.palhada ? (fase <= 1 ? 0.85 : 0.92) : 1;
    const zr = lerp(c.raiz_m[0], c.raiz_m[1], (d - 1) / (Li + Ld));
    const rf = c.reta_final;
    const retaFinal = !!(rf && dap > ciclo - rf.dias);
    return {
      id: cropId, crop: c, dap, ciclo, fase, nomeFase: c.fases[fase],
      kc, kr, kcEf: kc * kr * fatorPalhada, zr, p: c.p, ky: c.ky[fase],
      critica: c.ky[fase] >= 1.0, retaFinal,
      reposicao: retaFinal ? rf.reposicao : 1,
      reposicaoAmenoChuva: retaFinal ? (rf.reposicao_ameno_chuva ?? rf.reposicao * 0.6) : 1,
      diasParaColher: Math.max(0, ciclo - dap), progresso: clamp(dap / ciclo, 0, 1),
      terminou: dap > ciclo,
    };
  }

  /* ---------- Geometria e hidráulica da zona (por Metros de Fita) ---------- */
  function geometria(zone, soilKey) {
    const solo = SOLOS[soilKey] || SOLOS.franco_arenoso;
    // Suporte direto a tape_meters (v1.5.2) com fallback p/ estados antigos (lines_open * line_length_m)
    const metros = zone.tape_meters > 0
      ? Number(zone.tape_meters)
      : Math.round((zone.lines_open || 8) * (zone.line_length_m || 12.5));
    const espacamentoCm = zone.emitter_spacing_cm > 0
      ? Number(zone.emitter_spacing_cm)
      : Math.round((zone.emitter_spacing_m || 0.30) * 100);
    const espacamentoM = Math.max(0.10, espacamentoCm / 100);
    const vazaoFuroLph = zone.emitter_flow_lph > 0
      ? Number(zone.emitter_flow_lph)
      : Number(zone.emitter_q_lph || 1.2);
    const gotejadores = Math.max(1, Math.round(metros / espacamentoM));
    const vazaoLph = gotejadores * vazaoFuroLph;
    const vazaoLpm = vazaoLph / 60;
    const areaEfetivaM2 = zone.area_m2 || Math.round(metros * 1.25);
    const espacamentoRuas = areaEfetivaM2 / Math.max(1, metros);
    const fw = clamp(solo.faixa_molhada_m / Math.max(0.4, espacamentoRuas), 0.15, 1);
    return {
      solo,
      metros,
      espacamentoCm,
      espacamentoM,
      vazaoFuroLph,
      gotejadores,
      vazaoLph,
      vazaoLpm,
      fw,
      volumeMangueiraL: metros * VOLUME_MANGUEIRA_L_M + (zone.manifold_m || 10) * 0.3,
    };
  }

  const kGotejador = (z) => (z.emitter_flow_lph || z.emitter_q_lph || 1.2) / Math.pow(z.emitter_h_ref_m || 10, EXPOENTE_GOTEJADOR);

  function vazaoTeorica(zone, soilKey) {
    return geometria(zone, soilKey).vazaoLpm;
  }

  /** Vazão usada no cálculo (L/min): a medida pelo sensor SF1 se calibrada, ou a calculada pela fita. */
  function vazaoZona(zone, soilKey) {
    return zone.flow_cal_lpm > 0 ? zone.flow_cal_lpm : geometria(zone, soilKey).vazaoLpm;
  }

  /** Autocalibração: a partir da vazão medida pelo SF1, descobre a vazão real por gotejador. */
  function diagnosticoHidraulico(zone, soilKey, vazaoMedidaLpm) {
    const g = geometria(zone, soilKey);
    const qFuro = (vazaoMedidaLpm * 60) / Math.max(1, g.gotejadores);
    const nominalLpm = g.vazaoLpm;
    const rendPct = (100 * vazaoMedidaLpm) / Math.max(0.1, nominalLpm);
    let leitura;
    if (qFuro < 0.45) leitura = 'Vazão muito baixa por furo: confira o filtro de 120 mesh, registros e altura da caixa.';
    else if (qFuro <= 1.5) leitura = 'Fluxo excelente e uniforme para gravidade. O sistema ajustou o tempo de rega.';
    else if (qFuro <= 2.6) leitura = 'Boa pressão — vazão forte nos gotejadores.';
    else leitura = 'Vazão muito acima do esperado: verifique se há fim de linha aberto ou fita rompida.';
    return {
      gotejadores: g.gotejadores,
      metros: g.metros,
      qFuroLph: qFuro,
      cargaEfetivaM: Math.max(0.5, (qFuro / Math.max(0.4, g.vazaoFuroLph)) * 1.8),
      vazaoNominalLpm: nominalLpm,
      rendimentoPct: rendPct,
      leitura,
    };
  }

  /* ---------- Reserva de referência (mantida para simulador e compatibilidade) ---------- */
  function balde(zone, soilKey, cd) {
    const g = geometria(zone, soilKey);
    const taw = g.solo.taw_mm_m * cd.zr * g.fw;
    return { taw, raw: cd.p * taw, fw: g.fw };
  }
  const chuvaEfetiva = (mm) => (mm > 2 ? 0.8 * (mm - 2) : 0);

  function passoDia(Dr, b, etc, chuvaMm, regaLiquidaMm) {
    let d = Dr - regaLiquidaMm - chuvaEfetiva(chuvaMm);
    let perda = 0;
    if (d < 0) { perda = -d; d = 0; }
    const ks = d > b.raw ? clamp((b.taw - d) / Math.max(0.01, b.taw - b.raw), 0, 1) : 1;
    const eta = etc * ks;
    d = Math.min(b.taw, d + eta);
    return { Dr: d, perdaMm: perda, ks, etaMm: eta, estresse: ks < 0.999 };
  }

  /* ---------- Decisão de rega diária garantida + Restrição Hídrica Inteligente ---------- */
  function decidirZona(zone, ctx) {
    const { soil, dateStr, hoje, amanha, chuvaLocalMm = 0 } = ctx;
    if (!zone.enabled || !zone.crop || !zone.crop.id) {
      return { zona: zone.id, liquidoMm: 0, manhaMm: 0, tardeMm: 0, motivo: 'Zona desligada.' };
    }
    const dap = daysBetween(zone.crop.plantio, dateStr) + 1;
    if (dap < 1) {
      return { zona: zone.id, liquidoMm: 0, manhaMm: 0, tardeMm: 0, motivo: 'Plantio ainda não começou.' };
    }
    const cd = cropDay(zone.crop.id, dap, { palhada: zone.mulch });
    if (cd.terminou) {
      return {
        zona: zone.id, cd, liquidoMm: 0, manhaMm: 0, tardeMm: 0,
        motivo: 'Ciclo encerrado — hora de colher e confirmar a próxima cultura.',
      };
    }

    const b = balde(zone, soil, cd);
    const etc = hoje.et0 * cd.kcEf * (1 + (zone.fine_pct || 0) / 100);
    const chuvaConfirmadaMm = chuvaEfetiva(chuvaLocalMm);

    // 1. Demanda diária garantida (sem "chutômetro" de pular dia porque o balde virtual diz 88%)
    let demandaBaseMm = Math.max(0, etc - chuvaConfirmadaMm);

    // Se há previsão muito forte de chuva hoje (>= 75% e >= 8 mm), desconta apenas até 30% por prudência
    const probChuvaHoje = hoje.rain_prob ?? 0;
    const mmChuvaPrev = hoje.rain ?? 0;
    let descontoPrevisaoMm = 0;
    if (!cd.retaFinal && probChuvaHoje >= 75 && mmChuvaPrev >= 8) {
      descontoPrevisaoMm = Math.min(demandaBaseMm * 0.30, chuvaEfetiva(mmChuvaPrev) * 0.35);
      demandaBaseMm = Math.max(0, demandaBaseMm - descontoPrevisaoMm);
    }

    // 2. Mecanismo de Tomada de Decisão para Culturas com Restrição Hídrica (Melancia, Melão, Jerimum, Batata-doce)
    let fatorRestricao = 1.0;
    let restricaoInfo = null;
    if (cd.retaFinal && cd.crop.reta_final) {
      const modo = zone.restricao_modo || 'auto'; // 'auto' | 'corte_forte' | 'corte_total_hoje' | 'normal_maturacao'
      const climaAmeno = (hoje.tmax || 32) < 30.5;
      const chanceChuva = (probChuvaHoje >= 50 && mmChuvaPrev >= 2.0) || ((amanha?.rain_prob ?? 0) >= 65 && (amanha?.rain ?? 0) >= 4.0);
      const choveuLocal = chuvaLocalMm >= 2.0;
      const condicaoAmenaOuChuva = climaAmeno || chanceChuva || choveuLocal;

      const razoesClima = [];
      if (choveuLocal) razoesClima.push(`chuva registrada (${Math.round(chuvaLocalMm)} mm)`);
      if (climaAmeno) razoesClima.push(`clima ameno (${Math.round(hoje.tmax)}°C)`);
      if (chanceChuva) razoesClima.push(`chance de chuva (${Math.round(probChuvaHoje)}%)`);

      if (modo === 'corte_total_hoje') {
        fatorRestricao = 0;
      } else if (modo === 'corte_forte' || (modo === 'auto' && condicaoAmenaOuChuva)) {
        fatorRestricao = cd.reposicaoAmenoChuva;
      } else {
        fatorRestricao = cd.reposicao;
      }

      const cortePct = Math.round((1 - fatorRestricao) * 100);
      let explicacao;
      if (fatorRestricao === 0) {
        explicacao = `Corte total hoje (0 L) para ${cd.crop.reta_final.motivo}.`;
      } else if (modo === 'corte_forte' || (modo === 'auto' && condicaoAmenaOuChuva)) {
        explicacao = `Restrição forte (−${cortePct}%): ${razoesClima.length ? razoesClima.join(' + ') : 'modo corte forte ativo'} → só pulso leve de manhã para ${cd.crop.reta_final.motivo}.`;
      } else {
        explicacao = `Reta final (−${cortePct}%): rega reduzida controlada para ${cd.crop.reta_final.motivo}.`;
      }

      restricaoInfo = {
        ativa: true,
        modo,
        climaAmeno,
        chanceChuva,
        choveuLocal,
        condicaoAmenaOuChuva,
        fatorRestricao,
        cortePct,
        motivoFruto: cd.crop.reta_final.motivo,
        explicacao,
      };
    }

    const totalLiquidoMm = demandaBaseMm * fatorRestricao;

    // 3. Divisão em 2 Turnos: Manhã Cedo (04:00–05:30, 60%) e Fim da Tarde (16:00–17:30, 40%)
    // Se estiver em corte forte de reta final (<= 35% da água), aplica 100% de manhã cedo e 0 à tarde
    let manhaMm = 0;
    let tardeMm = 0;
    if (totalLiquidoMm >= 0.15) {
      if (restricaoInfo && restricaoInfo.fatorRestricao <= 0.35) {
        manhaMm = totalLiquidoMm;
        tardeMm = 0;
      } else {
        manhaMm = totalLiquidoMm * 0.60;
        tardeMm = totalLiquidoMm * 0.40;
      }
    }

    const base = {
      zona: zone.id,
      cd,
      balde: b,
      etcMm: etc,
      DrMm: zone.Dr_mm || 0,
      reservaPct: 100,
      restricaoInfo,
      liquidoMm: manhaMm,
      manhaMm,
      tardeMm,
      totalMm: manhaMm + tardeMm,
    };

    if (totalLiquidoMm < 0.15) {
      let motivoZero = 'Demanda suprida hoje.';
      if (chuvaConfirmadaMm >= etc) motivoZero = `Chuva local (${Math.round(chuvaLocalMm)} mm) já supriu a necessidade das plantas hoje.`;
      else if (restricaoInfo && restricaoInfo.fatorRestricao === 0) motivoZero = restricaoInfo.explicacao;
      return { ...base, liquidoMm: 0, manhaMm: 0, tardeMm: 0, totalMm: 0, motivo: motivoZero };
    }

    const partes = [];
    if (restricaoInfo) {
      partes.push(restricaoInfo.explicacao);
    } else {
      partes.push(`Rega diária garantida (${totalLiquidoMm.toFixed(1)} mm) dividida em 2 turnos (60% manhã cedo + 40% fim da tarde)`);
    }
    if (chuvaConfirmadaMm > 0.2) partes.push(`descontados ${chuvaConfirmadaMm.toFixed(1)} mm de chuva local`);
    if (descontoPrevisaoMm > 0.2) partes.push(`reduzido por chuva muito provável hoje`);

    return {
      ...base,
      motivo: partes.join(' · '),
    };
  }

  /* ---------- Divisão de água escassa (Ky — FAO-33) ---------- */
  function ratearCota(itens, disponivelL) {
    let total = itens.reduce((s, i) => s + i.litros, 0);
    if (total <= disponivelL + 0.5) {
      return { itens: itens.map((i) => ({ ...i, cortePct: 0 })), cortou: false };
    }
    const pedido = itens.map((i) => i.litros);
    total = pedido.reduce((s, l) => s + l, 0);
    const piso = Math.min(0.45, disponivelL / Math.max(1, total));
    let resto = disponivelL;
    const out = itens.map((i, k) => {
      const l = Math.min(pedido[k] * piso, resto);
      resto -= l;
      return { ...i, alocado: l, pedido: pedido[k] };
    });
    [...out].sort((a, b) => b.ky - a.ky).forEach((i) => {
      const add = Math.min(i.pedido - i.alocado, resto);
      i.alocado += add;
      resto -= add;
    });
    return {
      itens: out.map((i) => ({
        ...i,
        cortePct: 100 * (1 - i.alocado / Math.max(0.01, i.litros)),
        litros: i.alocado,
      })),
      cortou: true,
    };
  }

  /* ---------- Montagem de um turno (Manhã Cedo 04:00–05:30 ou Fim da Tarde 16:00–17:30) ---------- */
  function montarTurno(pedidos, cfgTurno) {
    const gap = cfgTurno.gap_min || 5;
    const pulsoMax = cfgTurno.pulse_max_min || 90;
    const fila = pedidos.filter((p) => p.minutos >= 1).map((p) => ({ ...p, resta: p.minutos }));
    const pulsos = [];
    while (fila.some((p) => p.resta > 0.5)) {
      for (const p of fila) {
        if (p.resta > 0.5) {
          const m = Math.min(pulsoMax, p.resta);
          pulsos.push({ zona: p.zona, minutos: m, litros: m * p.vazao, turno: cfgTurno.turno });
          p.resta -= m;
        }
      }
    }
    const total = pulsos.reduce((s, p) => s + p.minutos + gap, 0) - (pulsos.length ? gap : 0);
    if (!pulsos.length) return { eventos: [], avisos: [], inicioMin: cfgTurno.inicioPadraoMin, fimMin: cfgTurno.inicioPadraoMin, totalMin: 0 };

    let inicio = cfgTurno.inicioPadraoMin;
    if (cfgTurno.alinharPeloFim && cfgTurno.fimAlvoMin) {
      // Ex.: terminar até 05:30, mas preferindo começar a partir das 04:00 sempre que couber
      inicio = Math.min(cfgTurno.inicioPadraoMin, cfgTurno.fimAlvoMin - total);
      if (cfgTurno.inicioMinimoMin !== undefined) {
        inicio = Math.max(cfgTurno.inicioMinimoMin, inicio);
      }
    }
    let t = inicio;
    const eventos = pulsos.map((p) => {
      const e = {
        ...p,
        inicioMin: t,
        fimMin: t + p.minutos,
        manha: cfgTurno.turno === 'manha',
        tarde: cfgTurno.turno === 'tarde',
      };
      t += p.minutos + gap;
      return e;
    });
    return { eventos, avisos: [], inicioMin: inicio, fimMin: t - gap, totalMin: Math.max(0, total) };
  }

  /* Mantido por compatibilidade caso algum script externo chame montarAgenda */
  function montarAgenda(pedidos, cfg) {
    return montarTurno(pedidos, {
      turno: 'manha',
      inicioPadraoMin: hhmmToMin((cfg && cfg.dawn_start) || '04:00'),
      fimAlvoMin: hhmmToMin((cfg && cfg.end_dawn) || '05:30'),
      inicioMinimoMin: hhmmToMin('03:00'),
      alinharPeloFim: true,
      pulse_max_min: (cfg && cfg.pulse_max_min) || 90,
      gap_min: (cfg && cfg.gap_min) || 5,
    });
  }

  /* ---------- Plano completo de um "dia de rega" (2 Turnos + Contador de Sede) ---------- */
  function planejarDia(state, previsao, dateStr, chuvaLocalMm = 0) {
    const hoje = (previsao || []).find((w) => w.date === dateStr) || climatologia(dateStr);
    const amanha = (previsao || []).find((w) => w.date === addDays(dateStr, 1)) || null;
    const ctx = { soil: state.soil, dateStr, hoje, amanha, chuvaLocalMm };
    const boostAtivo = state.boost && state.boost.pct > 0 && Date.parse(state.boost.until) > toDate(dateStr).getTime() - 12 * 3600e3;
    const mult = boostAtivo ? 1 + state.boost.pct / 100 : 1;

    const decisoes = state.zones.map((z) => decidirZona(z, ctx));
    const itens = [];
    const pedidoRealPorZonaL = state.zones.map(() => 0);

    decisoes.forEach((d, i) => {
      const z = state.zones[i];
      const fator = (z.area_m2 / EFICIENCIA_GOTEJO) * mult;
      const manhaL = (d.manhaMm || 0) * fator;
      const tardeL = (d.tardeMm || 0) * fator;
      pedidoRealPorZonaL[i] = manhaL + tardeL;

      if (manhaL >= 1) {
        itens.push({ zona: z.id, idx: i, turno: 'manha', ky: d.cd.ky, litros: manhaL, litrosDia: d.etcMm * fator });
      }
      if (tardeL >= 1) {
        itens.push({ zona: z.id, idx: i, turno: 'tarde', ky: d.cd.ky, litros: tardeL, litrosDia: d.etcMm * fator });
      }
    });

    const tankL = state.tank.level_L ?? state.tank.capacity;
    const reservaL = (state.tank.capacity * (state.tank.reserve_pct || 25)) / 100;
    const margem = boostAtivo && tankL >= state.tank.capacity * 0.5 ? (state.quota.boost_margin_pct || 15) / 100 : 0;
    const disponivel = Math.max(0, Math.min(state.quota.daily_L * (1 + margem), tankL - reservaL));

    const pedidoRealL = itens.reduce((s, x) => s + x.litros, 0);
    const rateio = ratearCota(itens, disponivel);
    const avisos = [];
    if (rateio.cortou) {
      const cortadas = [];
      state.zones.forEach((z, idx) => {
        const itZ = rateio.itens.filter((x) => x.idx === idx);
        const cPct = itZ.length ? Math.max(...itZ.map((x) => x.cortePct || 0)) : 0;
        if (cPct > 1) cortadas.push(`Zona ${z.id} −${Math.round(cPct)}%`);
      });
      avisos.push(
        tankL - reservaL < state.quota.daily_L
          ? `Caixa perto da reserva: água dividida pela sensibilidade de cada planta (${cortadas.join(', ')}).`
          : `Pedido das plantas (${Math.round(pedidoRealL)} L) acima da cota de ${state.quota.daily_L} L: priorizei a fase mais sensível (${cortadas.join(', ')}).`
      );
    }

    const filterFactor = state.filtro && typeof state.filtro.pct === 'number' ? Math.max(0.45, state.filtro.pct / 100) : 1;
    const vaz = state.zones.map((z) => vazaoZona(z, state.soil) * filterFactor);
    const win = state.windows || {};
    const gapMin = win.gap_min || 5;

    // Turno 1: 🌅 Manhã Cedo (04:00 às 05:30)
    const manha = montarTurno(
      rateio.itens
        .filter((i) => i.turno === 'manha')
        .map((i) => ({ zona: i.zona, vazao: vaz[i.idx], minutos: i.litros / Math.max(0.1, vaz[i.idx]) })),
      {
        turno: 'manha',
        inicioPadraoMin: hhmmToMin(win.dawn_start || '04:00'),
        fimAlvoMin: hhmmToMin(win.end_dawn || '05:30'),
        inicioMinimoMin: hhmmToMin('03:00'),
        alinharPeloFim: true,
        pulse_max_min: win.pulse_max_min || 90,
        gap_min: gapMin,
      }
    );

    // Turno 2: 🌇 Fim da Tarde (16:00 em dias normais, 16:30 em dias >= 32,5 °C após esfriar a fita PEBD)
    const tardeInicioMin = (hoje.tmax || 31) >= 32.5
      ? hhmmToMin(win.evening_hot || '16:30')
      : hhmmToMin(win.evening || '16:00');
    const tarde = montarTurno(
      rateio.itens
        .filter((i) => i.turno === 'tarde')
        .map((i) => ({ zona: i.zona, vazao: vaz[i.idx], minutos: i.litros / Math.max(0.1, vaz[i.idx]) })),
      {
        turno: 'tarde',
        inicioPadraoMin: tardeInicioMin,
        alinharPeloFim: false,
        pulse_max_min: win.pulse_max_min || 90,
        gap_min: gapMin,
      }
    );

    const eventos = [...manha.eventos, ...tarde.eventos];

    const porZona = state.zones.map((z, i) => {
      const itManha = rateio.itens.filter((x) => x.idx === i && x.turno === 'manha');
      const itTarde = rateio.itens.filter((x) => x.idx === i && x.turno === 'tarde');
      const litrosManha = itManha.reduce((s, x) => s + x.litros, 0);
      const litrosTarde = itTarde.reduce((s, x) => s + x.litros, 0);
      const litrosTotal = litrosManha + litrosTarde;
      const pedidoZonaL = pedidoRealPorZonaL[i];
      const deficitZonaL = Math.max(0, pedidoZonaL - litrosTotal);
      const evManha = manha.eventos.filter((e) => e.zona === z.id);
      const evTarde = tarde.eventos.filter((e) => e.zona === z.id);
      const geom = geometria(z, state.soil);

      return {
        ...decisoes[i],
        geometria: geom,
        pedidoRealL: pedidoZonaL,
        litros: litrosTotal,
        litrosManha,
        litrosTarde,
        minutosManha: litrosManha / Math.max(0.1, vaz[i]),
        minutosTarde: litrosTarde / Math.max(0.1, vaz[i]),
        janelaManha: evManha.length ? `${minToHhmm(evManha[0].inicioMin)}–${minToHhmm(evManha[evManha.length - 1].fimMin)}` : null,
        janelaTarde: evTarde.length ? `${minToHhmm(evTarde[0].inicioMin)}–${minToHhmm(evTarde[evTarde.length - 1].fimMin)}` : null,
        deficitSedeL: deficitZonaL,
        cortePct: pedidoZonaL > 1 ? Math.max(0, 100 * (1 - litrosTotal / pedidoZonaL)) : 0,
        vazaoLpm: vaz[i],
        vazaoLph: vaz[i] * 60,
      };
    });

    const totalL = porZona.reduce((s, z) => s + z.litros, 0);
    const deficitSedeL = Math.max(0, pedidoRealL - totalL);

    return {
      date: dateStr,
      clima: hoje,
      boostMult: mult,
      porZona,
      eventos,
      turnoManha: manha,
      turnoTarde: tarde,
      totalL,
      pedidoRealL,
      pedidoBrutoL: pedidoRealL, // alias p/ compatibilidade
      deficitSedeL,
      passandoSede: deficitSedeL >= 5,
      cortouCota: rateio.cortou,
      disponivelL: disponivel,
      avisos,
    };
  }

  /** Aplica o dia ao estado (após a rega executada). Retorna métricas. */
  function fecharDia(state, plano, chuvaRealMm, litrosEntreguesPorZona) {
    const res = [];
    state.zones.forEach((z, i) => {
      const d = plano.porZona[i];
      if (!d.cd || d.cd.terminou) { res.push(null); return; }
      const entregue = litrosEntreguesPorZona ? litrosEntreguesPorZona[i] : d.litros;
      const liq = (entregue * EFICIENCIA_GOTEJO) / z.area_m2;
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
      out.push({ date: dt, litros: p.totalL, pedidoRealL: p.pedidoRealL, clima: p.clima, tankL: tank, zonas: p.porZona.map((z) => z.litros) });
    }
    const media = out.reduce((a, d) => a + d.litros, 0) / dias;
    const reserva = (state.tank.capacity * (state.tank.reserve_pct || 25)) / 100;
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
      fecharDia(s, p, 0);
      total += p.totalL;
      serie.push(p.totalL);
    }
    for (let k = 6; k < serie.length; k++) {
      const m = serie.slice(k - 6, k + 1).reduce((a, b) => a + b, 0) / 7;
      if (m > pico) { pico = m; diaPico = addDays(plantio, k); }
    }
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
          for (const o of outras) {
            const idx = daysBetween(o.plantio, addDays(pl, j));
            if (idx >= 0 && idx < o.prev.serie.length) soma += o.prev.serie[idx];
          }
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

  /* ---------- Guarda térmica informativa para regas manuais de dia ---------- */
  function guardaTermica(state, zone, minutoDoDia, litros) {
    const t = state.thermal || {};
    const ini = hhmmToMin(t.start || '09:30'), fim = hhmmToMin(t.end || '16:00');
    if (minutoDoDia < ini || minutoDoDia > fim) return { ok: true, litros };
    const vol = geometria(zone, state.soil).volumeMangueiraL;
    const minimo = vol * (t.min_hose_multiple || 5);
    if (litros >= minimo) return { ok: true, litros, aviso: `Nota: os primeiros ${Math.round(vol)} L saem mornos da fita, seguidos por água fresca da caixa.` };
    return {
      ok: false,
      litros: minimo,
      volMangueira: vol,
      aviso: `Sol forte agora: na fita há ~${Math.round(vol)} L de água aquecida pelo sol. Uma rega de pelo menos ${Math.round(minimo)} L garante água fresca no pé da planta.`,
    };
  }

  /* ---------- Estado padrão do sítio (São Vicente do Seridó – PB) ---------- */
  function estadoPadrao() {
    const zona = (id, nome, area, tapeMeters, spacingCm, flowLph, cropId, plantio, anterior) => ({
      id,
      nome,
      area_m2: area,
      // Novos parâmetros hidráulicos diretos por fita de gotejamento (v1.5.2)
      tape_meters: tapeMeters,
      emitter_spacing_cm: spacingCm,
      emitter_flow_lph: flowLph,
      // Campos legados mantidos sincronizados p/ compatibilidade
      lines_total: 16,
      lines_open: 8,
      line_length_m: Math.round((tapeMeters / 8) * 10) / 10,
      line_spacing_full_m: 1.0,
      emitter_spacing_m: spacingCm / 100,
      emitter_q_lph: flowLph,
      emitter_h_ref_m: 10,
      head_m_est: 1.8,
      manifold_m: 10,
      flow_cal_lpm: 0,
      flow_baseline_lpm: 0,
      enabled: true,
      mulch: false,
      fine_pct: 0,
      restricao_modo: 'auto',
      Dr_mm: 0,
      crop: { id: cropId, plantio, anterior },
    });
    return {
      versao: '1.5.2-argon',
      site: { nome: 'Sítio — São Vicente do Seridó (PB)', lat: -6.95325, lon: -36.36853, tz: 'America/Fortaleza' },
      soil: 'franco_arenoso',
      tank: { capacity: 5000, level_L: 3750, reserve_pct: 25 },
      quota: { daily_L: 1000, boost_margin_pct: 15 },
      windows: {
        dawn_start: '04:00',
        end_dawn: '05:30',
        evening: '16:00',
        evening_hot: '16:30',
        pulse_max_min: 90,
        gap_min: 5,
      },
      thermal: { start: '09:30', end: '16:00', min_hose_multiple: 5 },
      boost: { pct: 0, until: null },
      pause: { until: null, indefinite: false, origem: null },
      zones: [
        zona(1, 'Zona 1 — Oeste', 128, 100, 30, 1.2, 'maxixe', '2026-09-20', 'Leguminosas'),
        zona(2, 'Zona 2 — Leste', 158, 120, 30, 1.2, 'melancia', '2026-08-25', 'Convolvuláceas'),
      ],
    };
  }

  const api = {
    estadoPadrao, SOLOS, CLIMA_SERIDO, CROPS, EFICIENCIA_GOTEJO, VOLUME_MANGUEIRA_L_M,
    isoDate, addDays, daysBetween, hhmmToMin, minToHhmm, clamp,
    climatologia, cropDay, geometria, vazaoTeorica, vazaoZona, diagnosticoHidraulico,
    balde, chuvaEfetiva, passoDia, decidirZona, ratearCota, montarTurno, montarAgenda,
    planejarDia, fecharDia, projetarSemana, previaSafra, sugerirDataPlantio,
    sugerirRotacao, guardaTermica,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IrrigaCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
