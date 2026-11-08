// ==============================================================================
// 🌱 Irriga.ai Pro-Duo — Motor Cognitivo Frontend, Clima Real e Estúdio Claude IA
// Suporta 2 Interfaces:
//   • index.html   -> Modo END_USER (Interface limpa, fluida e sem sliders manuais)
//   • dev-gui.html -> Modo DEV_GUI  (Interface de engenharia, simulador e bancada)
// ==============================================================================

const CROP_CATALOG = {
  jerimum: {
    id: "jerimum",
    name: "Jerimum",
    icon: "🎃",
    family: "Cucurbitáceas",
    cycleDays: 110,
    avgMmDay: 4.1,
    defaultLinesOpen: 8,
    nextRecommended: "Feijão Verde (Leguminosas) ou Batata-doce (Convolvuláceas)",
    stages: [
      { fase: 1, nome: "Pegamento Inicial", inicio: 1, fim: 22, kc: 0.45, baseMm: 2.2, prio: "MEDIA", msg: "Início do ciclo do jerimum; regas localizadas no pé da muda." },
      { fase: 2, nome: "Espalhamento de Ramas", inicio: 23, fim: 50, kc: 0.75, baseMm: 3.7, prio: "MEDIA", msg: "Ramas ocupando a área do canteiro; subindo a água gradualmente." },
      { fase: 3, nome: "Floração e Enchimento (CRÍTICA)", inicio: 51, fim: 85, kc: 1.00, baseMm: 5.0, prio: "MAXIMA_CRITICA", msg: "🌸 Jerimuns crescendo rápido! Fase mais sensível à sede: prioridade máxima." },
      { fase: 4, nome: "Maturação Inicial", inicio: 86, fim: 98, kc: 0.70, baseMm: 3.5, prio: "MEDIA", msg: "Casca endurecendo e polpa ganhando cor alaranjada." },
      { fase: 5, nome: "Pré-Colheita (Cura e Conservação Longa)", inicio: 99, fim: 110, kc: 0.35, baseMm: 1.5, prio: "BAIXA", msg: "🎃 Últimos 12 dias: reduzimos 65% da água para o jerimum enxugar e durar meses guardado!" }
    ]
  },
  maxixe: {
    id: "maxixe",
    name: "Maxixe",
    icon: "🥒",
    family: "Cucurbitáceas",
    cycleDays: 100,
    avgMmDay: 4.0,
    defaultLinesOpen: 8,
    nextRecommended: "Feijão Verde (Leguminosas) ou Batata-doce",
    stages: [
      { fase: 1, nome: "Pegamento e Primeiras Folhas", inicio: 1, fim: 20, kc: 0.50, baseMm: 2.5, prio: "MEDIA", msg: "Mudas jovens de maxixe criando raiz: regas leves e constantes." },
      { fase: 2, nome: "Crescimento das Ramas", inicio: 21, fim: 42, kc: 0.80, baseMm: 3.8, prio: "MEDIA", msg: "Ramas espalhando rápido pelo terreno; subindo a água gradualmente." },
      { fase: 3, nome: "Floração e Início da Frutificação (CRÍTICA)", inicio: 43, fim: 60, kc: 1.00, baseMm: 4.8, prio: "MAXIMA_CRITICA", msg: "🌸 Fase mais sensível do maxixe! Prioridade total de água para segurar flores e frutos." },
      { fase: 4, nome: "Colheita Contínua (Apanha a cada 2–3 dias)", inicio: 61, fim: 90, kc: 0.90, baseMm: 4.3, prio: "ALTA", msg: "🧺 Em plena colheita! Mantendo boa umidade para brotarem novos maxixes." },
      { fase: 5, nome: "Final de Ciclo", inicio: 91, fim: 100, kc: 0.65, baseMm: 3.0, prio: "BAIXA", msg: "Finalizando a safra de maxixe; reduzindo rega." }
    ]
  },
  melancia: {
    id: "melancia",
    name: "Melancia",
    icon: "🍉",
    family: "Cucurbitáceas",
    cycleDays: 88,
    avgMmDay: 4.4,
    defaultLinesOpen: 8,
    nextRecommended: "Feijão Verde (para repor nitrogênio no solo)",
    stages: [
      { fase: 1, nome: "Emergência e Pegamento Inicial", inicio: 1, fim: 18, kc: 0.45, baseMm: 2.2, prio: "MEDIA", msg: "Plantinhas pequenas de melancia; rega suave no pé." },
      { fase: 2, nome: "Alongamento de Ramas", inicio: 19, fim: 42, kc: 0.75, baseMm: 3.8, prio: "ALTA", msg: "Ramas correndo pelo terreno (3 a 4 metros); aumentando volume de água." },
      { fase: 3, nome: "Floração e Pegamento de Frutos (CRÍTICA)", inicio: 43, fim: 68, kc: 1.05, baseMm: 5.5, prio: "MAXIMA_CRITICA", msg: "🌸 Melancia florindo e vingando frutos! Proibido passar sede agora." },
      { fase: 4, nome: "Crescimento e Engorda dos Frutos", inicio: 69, fim: 78, kc: 0.75, baseMm: 3.8, prio: "ALTA", msg: "Frutos já grandes; reduzindo um pouco a água para preparar a maturação." },
      { fase: 5, nome: "Reta Final Pré-Colheita — Apurando o Açúcar (°Brix)", inicio: 79, fim: 88, kc: 0.35, baseMm: 1.5, prio: "BAIXA", msg: "🍯 Últimos 10 dias antes da colheita! Água reduzida em 65% para deixar a melancia bem doce e sem rachar." }
    ]
  },
  feijao_verde: {
    id: "feijao_verde",
    name: "Feijão Verde",
    icon: "🫛",
    family: "Leguminosas",
    cycleDays: 68,
    avgMmDay: 4.3,
    defaultLinesOpen: 16,
    nextRecommended: "Jerimum, Melancia, Maxixe ou Milho Verde (aproveita o nitrogênio!)",
    stages: [
      { fase: 1, nome: "Germinação e Primeiras Folhas", inicio: 1, fim: 15, kc: 0.45, baseMm: 2.2, prio: "MEDIA", msg: "Feijão recém-nascido; rega leve nas 2 fileiras por mangueira." },
      { fase: 2, nome: "Crescimento e Fixação de Nitrogênio", inicio: 16, fim: 32, kc: 0.75, baseMm: 3.8, prio: "ALTA", msg: "Plantas crescendo e enriquecendo o solo com nitrogênio." },
      { fase: 3, nome: "Floração e Enchimento de Vagens (CRÍTICA)", inicio: 33, fim: 55, kc: 1.10, baseMm: 5.4, prio: "MAXIMA_CRITICA", msg: "🌸 Florada e vagens enchendo! Não pode faltar água para não cair flor." },
      { fase: 4, nome: "Colheita Escalonada de Vagens Verdes", inicio: 56, fim: 68, kc: 0.80, baseMm: 4.0, prio: "ALTA", msg: "🧺 Ponto de colheita de feijão verde! Mantendo vagens tenras até a última apanha." }
    ]
  },
  batata_doce: {
    id: "batata_doce",
    name: "Batata-doce",
    icon: "🍠",
    family: "Convolvuláceas",
    cycleDays: 130,
    avgMmDay: 3.5,
    defaultLinesOpen: 16,
    nextRecommended: "Jerimum, Melancia, Maxixe ou Feijão Verde",
    stages: [
      { fase: 1, nome: "Pegamento das Ramas", inicio: 1, fim: 20, kc: 0.50, baseMm: 2.5, prio: "MEDIA", msg: "Ramas recém-plantadas criando raízes nas leiras." },
      { fase: 2, nome: "Fechamento de Folhagem", inicio: 21, fim: 30, kc: 0.75, baseMm: 3.5, prio: "MEDIA", msg: "Crescimento das ramas; cuidado sem excesso de água." },
      { fase: 3, nome: "Formação das Raízes / Tuberização (CRÍTICA)", inicio: 31, fim: 75, kc: 1.10, baseMm: 5.0, prio: "MAXIMA_CRITICA", msg: "🚨 Fase crítica (30 a 75 dias): batatas se formando debaixo da terra! Prioridade máxima." },
      { fase: 4, nome: "Engorda das Batatas", inicio: 76, fim: 115, kc: 0.75, baseMm: 3.5, prio: "ALTA", msg: "Raízes ganhando peso; mantendo umidade equilibrada." },
      { fase: 5, nome: "Secagem Pré-Colheita e Cura", inicio: 116, fim: 130, kc: 0.30, baseMm: 1.2, prio: "BAIXA", msg: "🍠 Últimos 15 dias: reduzimos 70% da água para colher batatas enxutas e fáceis de curar!" }
    ]
  },
  milho_verde: {
    id: "milho_verde",
    name: "Milho Verde",
    icon: "🌽",
    family: "Gramíneas",
    cycleDays: 82,
    avgMmDay: 5.3,
    defaultLinesOpen: 16,
    nextRecommended: "Feijão Verde ou Batata-doce",
    stages: [
      { fase: 1, nome: "Emergência", inicio: 1, fim: 18, kc: 0.45, baseMm: 2.5, prio: "MEDIA", msg: "Milho apontando na linha; rega moderada." },
      { fase: 2, nome: "Crescimento de Colmo (Joelho)", inicio: 19, fim: 42, kc: 0.85, baseMm: 4.5, prio: "ALTA", msg: "Milho encorpando rápido; exige boa umidade e adubação." },
      { fase: 3, nome: "Pendoamento e Boneca (CRÍTICA)", inicio: 43, fim: 68, kc: 1.20, baseMm: 6.4, prio: "MAXIMA_CRITICA", msg: "🌽 Soltando pendão e espiga! Sede máxima do milho: prioridade total." },
      { fase: 4, nome: "Grão Leitoso (Ponto de Colheita Verde)", inicio: 69, fim: 82, kc: 0.95, baseMm: 5.0, prio: "ALTA", msg: "Espigas cheias no ponto de milho verde / pamonha!" }
    ]
  },
  macaxeira: {
    id: "macaxeira",
    name: "Macaxeira",
    icon: "🪵",
    family: "Euforbiáceas",
    cycleDays: 300,
    avgMmDay: 2.8,
    defaultLinesOpen: 16,
    nextRecommended: "Feijão Verde",
    stages: [
      { fase: 1, nome: "Pegamento das Manivas (3 Meses Críticos)", inicio: 1, fim: 90, kc: 0.70, baseMm: 3.3, prio: "MAXIMA_CRITICA", msg: "🚨 Primeiros 3 meses da macaxeira: fase mais sensível à falta d'água!" },
      { fase: 2, nome: "Engrossamento de Raízes", inicio: 91, fim: 210, kc: 0.75, baseMm: 3.5, prio: "MEDIA", msg: "Formando raízes tuberosas; cultura já mais resistente." },
      { fase: 3, nome: "Manutenção e Colheita Escalonada", inicio: 211, fim: 300, kc: 0.40, baseMm: 1.8, prio: "BAIXA", msg: "Macaxeira pronta para arrancar conforme a venda." }
    ]
  }
};

// --- Estado Reativo do Aplicativo Pro-Duo ---
const AppState = {
  guiMode: window.IRRIGA_GUI_MODE || "END_USER", // "END_USER" (index.html) | "DEV_GUI" (dev-gui.html)
  viewMode: "mobile", // "mobile" | "desktop"
  activeTab: "home",  // "home" | "zones" | "claude" | "relays" (usado na dev-gui mobile)
  siteCoords: { lat: -6.95325, lon: -36.36853, name: "São Vicente do Seridó – PB" },

  // 🔒 CADEADO DE SEGURANÇA DO CABEÇALHO (Abre TRAVADO por padrão para evitar toques acidentais!)
  // Não afeta os botões físicos na caixa do hardware no campo.
  configLocked: true,

  // 🛰️ Modo de Progressão Automática vs Simulador Manual (Sliders)
  autoProgressionMode: true,
  simulatedReferenceDate: "2026-06-10", // Dia 102 da simulação (Z1 Jerimum D.102 Pré-colheita vs Z2 Jerimum D.52 Floração Crítica!)

  // Estado dos 4 Botões Físicos / Digitais
  paused: false,
  manualPlusHours: 0,
  wishRainClicks: 0, // 0 = OFF, 1 = +25% (24h), 2 = +50% (24h)

  // Caixa 5000L, Cota e Filtro 120 Mesh (Medidos pelos sensores na prática)
  tankLevelPct: 75,
  dailyQuotaMaxLiters: 1000,
  filterEfficiencyPct: 94,

  // Clima do Dia (Lido automaticamente via satélite Open-Meteo em São Vicente do Seridó - PB)
  weather: {
    source: "🛰️ Automático via Satélite (São Vicente do Seridó - PB)",
    et0Mm: 5.4,
    tempMaxC: 34.2,
    hoursAbove32C: 3.0,
    windMaxKmh: 22.5,
    rainYesterdayMm: 0.0,
    rainForecastProbPct: 10,
    rainForecastMm: 0.0
  },

  // Configuração das DUAS Zonas de Plantio (Cenário padrão: Jerimum defasado em 50 dias!)
  zones: {
    zona_1: {
      id: 1,
      name: "Zona 1 — Oeste",
      relayChannel: 2,
      gpio: 16,
      areaM2: 128,
      totalLines: 16,
      openLines: 8,
      flowRefLpm: 6.5,
      cropId: "jerimum",
      plantedDate: "2026-03-01",
      dap: 102, // No dia 102: Pré-colheita (-65% água para curar casca)
      previousFamily: "Leguminosas (Feijão Verde)",
      userTunePct: 0,
      shifts: [
        { time: "05:30", pct: 60 },
        { time: "16:30", pct: 40 }
      ]
    },
    zona_2: {
      id: 2,
      name: "Zona 2 — Leste",
      relayChannel: 3,
      gpio: 17,
      areaM2: 158,
      totalLines: 16,
      openLines: 8,
      flowRefLpm: 7.2,
      cropId: "jerimum",
      plantedDate: "2026-04-20", // Plantado 50 dias depois da Zona 1!
      dap: 52, // No mesmo dia: Floração e Enchimento Crítico (100% água!)
      previousFamily: "Convolvuláceas (Batata-doce)",
      userTunePct: 0,
      shifts: [
        { time: "06:10", pct: 60 },
        { time: "17:00", pct: 40 }
      ]
    }
  },

  // Os 8 Relés da Placa (3 Ativos no MVP + 5 Contabilizados para Expansão)
  relays: [
    { ch: 1, gpio: 4,  key: "valvula_mestre",       name: "Válvula Mestre Geral 12V",          role: "MVP Ativo",   enabled: true,  activeNow: false, desc: "Abre junto com Zona 1 ou Zona 2 (Dupla segurança contra vazamento)" },
    { ch: 2, gpio: 16, key: "valvula_zona_1",       name: "Válvula Zona 1 (Oeste • 128 m²)",   role: "MVP Ativo",   enabled: true,  activeNow: false, desc: "Controlada pela curva da planta da Zona 1" },
    { ch: 3, gpio: 17, key: "valvula_zona_2",       name: "Válvula Zona 2 (Leste • 158 m²)",   role: "MVP Ativo",   enabled: true,  activeNow: false, desc: "Controlada pela curva da planta da Zona 2" },
    { ch: 4, gpio: 18, key: "exp_valvula_zona_3",   name: "Reserva: Futura Válvula Zona 3",    role: "Expansão",    enabled: false, activeNow: false, desc: "Pronto no código p/ futura área (ex: Capim / Pomar)" },
    { ch: 5, gpio: 19, key: "exp_valvula_zona_4",   name: "Reserva: Futura Válvula Zona 4",    role: "Expansão",    enabled: false, activeNow: false, desc: "Pronto no código p/ futura área (ex: Palma / Horta)" },
    { ch: 6, gpio: 23, key: "exp_bomba_auxiliar",   name: "Reserva: Bomba Auxiliar 12V",       role: "Expansão",    enabled: false, activeNow: false, desc: "Quando ativado, liga 2s após abrir válvula e desliga 2s antes" },
    { ch: 7, gpio: 25, key: "exp_iluminacao",       name: "Reserva: Luz / Refletor LED Sítio", role: "Expansão",    enabled: false, activeNow: false, desc: "Permite acender refletor pelo celular ou por horário noturno" },
    { ch: 8, gpio: 5,  key: "exp_camera_acessorio", name: "Reserva: Câmera Wi-Fi / Sirene",    role: "Expansão",    enabled: false, activeNow: false, desc: "Alimentação controlada 12V para câmera rural ou alarme" }
  ],

  oledPage: 0,
  esp32Ip: "192.168.1.120"
};

// ==============================================================================
// 1. PROGRESSÃO AUTOMÁTICA DE IDADE (DAP) E MOTOR COGNITIVO
// ==============================================================================
const PRIO_WEIGHTS = { MAXIMA_CRITICA: 1.5, ALTA: 1.15, MEDIA: 0.9, BAIXA: 0.6 };

function computeAutomaticDapFromDates(plantedDateStr, refDateStr) {
  try {
    const p = new Date(plantedDateStr + "T00:00:00");
    const r = refDateStr ? new Date(refDateStr + "T00:00:00") : new Date();
    const diffDays = Math.floor((r - p) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  } catch (_) {
    return 1;
  }
}

function syncAutomaticProgressionIfEnabled() {
  if (!AppState.autoProgressionMode) return;
  for (const zKey of ["zona_1", "zona_2"]) {
    const z = AppState.zones[zKey];
    const crop = CROP_CATALOG[z.cropId];
    const calcDap = computeAutomaticDapFromDates(z.plantedDate, AppState.simulatedReferenceDate);
    z.dap = Math.min(crop.cycleDays, Math.max(1, calcDap));
  }
}

function getStageForDap(crop, dap) {
  for (const st of crop.stages) {
    if (dap >= st.inicio && dap <= st.fim) return st;
  }
  return crop.stages[crop.stages.length - 1];
}

function getRecommendedRotationForZone(crop) {
  // Regra de ouro do guia: nunca plantar a mesma família botânica seguida na mesma zona!
  const safeCrops = Object.values(CROP_CATALOG).filter(c => c.family !== crop.family);
  return safeCrops.map(c => `${c.icon} ${c.name} (${c.family})`).slice(0, 3).join(" ou ");
}

function computeCognitivePlan() {
  syncAutomaticProgressionIfEnabled();

  const w = AppState.weather;
  const heatBonusPct = Math.min(20, Math.max(0, w.hoursAbove32C * 4.0));
  const windBonusPct = w.windMaxKmh >= 20 ? 10.0 : 0.0;
  const wishRainBoostPct = AppState.wishRainClicks === 1 ? 25.0 : (AppState.wishRainClicks >= 2 ? 50.0 : 0.0);
  const effectiveRainYesterdayMm = w.rainYesterdayMm * 0.80;
  const heavyRainForecast = (w.rainForecastProbPct >= 75 && w.rainForecastMm >= 5.0);

  const calcZones = {};
  for (const zKey of ["zona_1", "zona_2"]) {
    const z = AppState.zones[zKey];
    const crop = CROP_CATALOG[z.cropId];
    const stage = getStageForDap(crop, z.dap);

    let baseMm = w.et0Mm * stage.kc;
    let afterRainMm = Math.max(0, baseMm - effectiveRainYesterdayMm);

    let rainStatus = "NORMAL";
    if (heavyRainForecast) {
      if (stage.prio === "MAXIMA_CRITICA") {
        afterRainMm *= 0.50;
        rainStatus = "GARANTIA_50%_FASE_CRITICA";
      } else {
        afterRainMm = 0;
        rainStatus = "ADIADA_POR_CHUVA_PREVISTA";
      }
    }

    const envMultiplier = 1 + ((heatBonusPct + windBonusPct + z.userTunePct) / 100.0);
    const wishRainMultiplier = 1 + (wishRainBoostPct / 100.0);
    const finalMm = afterRainMm * envMultiplier * wishRainMultiplier;

    const lineRatio = z.openLines / Math.max(1, z.totalLines);
    const areaFactor = lineRatio < 1.0 ? Math.max(0.65, lineRatio) : 1.0;
    const rawLiters = (finalMm * z.areaM2 * areaFactor) / 0.90;

    calcZones[zKey] = {
      ...z,
      crop,
      stage,
      progressPct: Math.min(100, Math.round((z.dap / crop.cycleDays) * 100)),
      baseMm: Number(baseMm.toFixed(2)),
      finalMm: Number(finalMm.toFixed(2)),
      rawLiters: Number(rawLiters.toFixed(1)),
      approvedLiters: Number(rawLiters.toFixed(1)),
      rainStatus,
      safeRotationText: getRecommendedRotationForZone(crop)
    };
  }

  // Guardião da Cota Diária
  let effectiveQuota = AppState.dailyQuotaMaxLiters;
  if (wishRainBoostPct > 0 && AppState.tankLevelPct >= 50) {
    effectiveQuota = Math.round(effectiveQuota * 1.15);
  }

  const totalRequested = calcZones.zona_1.rawLiters + calcZones.zona_2.rawLiters;
  let quotaCutApplied = false;

  if (totalRequested > effectiveQuota && totalRequested > 0) {
    quotaCutApplied = true;
    const excess = totalRequested - effectiveQuota;
    const inv1 = 1 / (PRIO_WEIGHTS[calcZones.zona_1.stage.prio] || 1);
    const inv2 = 1 / (PRIO_WEIGHTS[calcZones.zona_2.stage.prio] || 1);
    const sumInv = inv1 + inv2;
    const cut1 = Math.min(calcZones.zona_1.rawLiters * 0.5, excess * (inv1 / sumInv));
    const cut2 = excess - cut1;
    calcZones.zona_1.approvedLiters = Number(Math.max(0, calcZones.zona_1.rawLiters - cut1).toFixed(1));
    calcZones.zona_2.approvedLiters = Number(Math.max(0, calcZones.zona_2.rawLiters - cut2).toFixed(1));
  }

  // ============================================================================
  // 🌅🌇 JANELA ELÁSTICA INTELIGENTE (ALVORADA + CREPÚSCULO) & FILTRO 120 MESH
  // ============================================================================
  // 1) Calcula vazão real corrigida pelo Filtro 120 Mesh e minutos de cada turno
  const filterFactor = Math.max(0.5, AppState.filterEfficiencyPct / 100.0);
  const minsToHHMM = (totalMins) => {
    const clamped = ((Math.round(totalMins) % 1440) + 1440) % 1440;
    const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
    const mm = String(clamped % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  for (const zKey of ["zona_1", "zona_2"]) {
    const cz = calcZones[zKey];
    const realFlowLpm = Number((cz.flowRefLpm * filterFactor).toFixed(1));
    cz.realFlowLpm = realFlowLpm;

    // Física real da mangueira gotejadora (furos a cada 30 cm | 1,6 L/h nominal por furo a 10 m.c.a.)
    const activeMeters = Math.round((cz.areaM2 / Math.max(1, cz.totalLines)) * cz.openLines);
    const activeEmitters = Math.round(activeMeters / 0.30); // 3,33 furos por metro linear
    const pipeHoldVolumeLiters = Number((activeMeters * 0.145).toFixed(1)); // ~0,145 L/m dentro do tubo PEBD 16mm
    const purgeMins = Number((pipeHoldVolumeLiters / Math.max(0.5, realFlowLpm)).toFixed(1));
    const realLphPerHole = Number(((realFlowLpm * 60) / Math.max(1, activeEmitters)).toFixed(2));
    cz.dripPhysics = {
      activeMeters,
      activeEmitters,
      pipeHoldVolumeLiters,
      purgeMins,
      realLphPerHole
    };

    cz.rawShiftMinutes = cz.shifts.map((s) => {
      const liters = Number((cz.approvedLiters * (s.pct / 100)).toFixed(1));
      // Permite até 240 min (4h) por turno caso a vazão por gravidade seja baixa
      const minutes = liters > 0 ? Math.min(240, Math.max(1, Math.round(liters / Math.max(0.5, realFlowLpm)))) : 0;
      return { pct: s.pct, liters, minutes, baseTime: s.time };
    });
  }

  // 2) Turno 1 — Janela Elástica da Alvorada c/ Recuo Adaptativo p/ Vazão Baixa (02:30 às 06:45):
  //    Ancora o término da Zona 1 às 05:45 (nascer do sol). Se os tempos de rega forem muito longos
  //    (ex: gravidade baixa), recua automaticamente na madrugada (até 02:30) para que a Zona 2
  //    também termine antes do sol esquentar (06:40), sem jamais colidir no filtro 120 Mesh!
  const z1Morn = calcZones.zona_1.rawShiftMinutes[0];
  const z2Morn = calcZones.zona_2.rawShiftMinutes[0];
  const sunriseTargetMins = 5 * 60 + 45; // 05:45 BRT em São Vicente do Seridó - PB
  const maxMorningFinishMins = 6 * 60 + 40; // Teto ideal p/ Zona 2 terminar antes do sol forte (06:40)
  const combinedMorningMins = z1Morn.minutes + 5 + z2Morn.minutes;

  let z1IdealStart = sunriseTargetMins - z1Morn.minutes;
  if (z1IdealStart + combinedMorningMins > maxMorningFinishMins) {
    // Recua mais na madrugada se o tempo total (Z1 + Z2) for longo por baixa vazão
    z1IdealStart = maxMorningFinishMins - combinedMorningMins;
  }
  const z1MornStartMins = Math.max(2 * 60 + 30, Math.min(5 * 60 + 30, z1IdealStart));
  const z1MornEndMins = z1MornStartMins + z1Morn.minutes;
  const z2MornStartMins = z1MornEndMins + 5; // +5 min de folga hidráulica após Zona 1 fechar
  const z2MornEndMins = z2MornStartMins + z2Morn.minutes;

  // 3) Turno 2 — Janela Elástica do Fim da Tarde / Crepúsculo (16:00 às 18:45):
  //    - Sol extremo (>=34°C ou >=3h >32°C): desloca p/ Crepúsculo (17:05) -> esfria os ~10-20L da mangueira PEBD (-12°C) e reduz evaporação (-7%).
  //      Se a rega for muito longa (>90m somados), antecipa levemente p/ 16:40 para não invadir a noite escura (>19:00).
  //    - Calor moderado (>=32°C ou vento >=20 km/h): desloca p/ Fim de Tarde (16:35)
  //    - Dia ameno (<32°C): antecipa p/ 16:00 -> folha e colo secam antes da noite (prevenção de fungos/oídio)
  const z1Aft = calcZones.zona_1.rawShiftMinutes[1];
  const z2Aft = calcZones.zona_2.rawShiftMinutes[1];
  const combinedAftMins = z1Aft.minutes + 5 + z2Aft.minutes;

  let z1AftStartMins = 16 * 60 + 0; // 16:00
  let aftWindowLabel = "🌇 Tarde (Anti-Fungo)";
  let aftReasonZ1 = "16:00 p/ secar folha antes da noite";
  let elasticAfternoonInsight = "";

  if (w.tempMaxC >= 34.0 || w.hoursAbove32C >= 3.0) {
    // Se o tempo somado Z1+Z2 for longo, equilibra entre esfriar o tubo (após 16:40) e terminar antes das 19:00
    z1AftStartMins = combinedAftMins > 100 ? (16 * 60 + 40) : (17 * 60 + 5);
    aftWindowLabel = "🌇 Crepúsculo (Tubo Frio)";
    aftReasonZ1 = `Tubo PEBD frio + purga em ${calcZones.zona_1.dripPhysics.purgeMins}m`;
    elasticAfternoonInsight = `🌇 Janela Elástica Crepúsculo: Com pico de ${w.tempMaxC}°C hoje, o turno da tarde inicia às ${minsToHHMM(z1AftStartMins)} (a mangueira preta já esfriou ~12°C e os ${calcZones.zona_1.dripPhysics.pipeHoldVolumeLiters}L internos renovam em ${calcZones.zona_1.dripPhysics.purgeMins} min).`;
  } else if (w.tempMaxC >= 32.0 || w.windMaxKmh >= 20.0) {
    z1AftStartMins = 16 * 60 + 35; // 16:35
    aftWindowLabel = "🌇 Fim da Tarde (Brisa)";
    aftReasonZ1 = "Ajustado p/ queda do sol e vento";
  }

  const z1AftEndMins = z1AftStartMins + z1Aft.minutes;
  const z2AftStartMins = z1AftEndMins + 5; // Entra 5 min após a Zona 1 terminar
  const z2AftEndMins = z2AftStartMins + z2Aft.minutes;

  calcZones.zona_1.computedShifts = [
    {
      index: 1,
      time: minsToHHMM(z1MornStartMins),
      endTime: minsToHHMM(z1MornEndMins),
      pct: z1Morn.pct,
      liters: z1Morn.liters,
      minutes: z1Morn.minutes,
      windowLabel: "🌅 Alvorada Ótima",
      shiftReason: "Termina ao nascer do sol (05:45)"
    },
    {
      index: 2,
      time: minsToHHMM(z1AftStartMins),
      endTime: minsToHHMM(z1AftEndMins),
      pct: z1Aft.pct,
      liters: z1Aft.liters,
      minutes: z1Aft.minutes,
      windowLabel: aftWindowLabel,
      shiftReason: aftReasonZ1
    }
  ];

  calcZones.zona_2.computedShifts = [
    {
      index: 1,
      time: minsToHHMM(z2MornStartMins),
      endTime: minsToHHMM(z2MornEndMins),
      pct: z2Morn.pct,
      liters: z2Morn.liters,
      minutes: z2Morn.minutes,
      windowLabel: "🌅 Alvorada (Seq. Z1)",
      shiftReason: "Entra 5m após Z1 (100% pressão)"
    },
    {
      index: 2,
      time: minsToHHMM(z2AftStartMins),
      endTime: minsToHHMM(z2AftEndMins),
      pct: z2Aft.pct,
      liters: z2Aft.liters,
      minutes: z2Aft.minutes,
      windowLabel: aftWindowLabel,
      shiftReason: "Entra 5m após Z1 (100% pressão)"
    }
  ];

  const totalApproved = Number((calcZones.zona_1.approvedLiters + calcZones.zona_2.approvedLiters).toFixed(1));

  // Frases humanas do dia
  const humanInsights = [];
  if (AppState.paused) {
    humanInsights.push("⏸️ Irrigações planejadas estão PAUSADAS. Toque em 'Continuar' quando quiser retomar a agenda.");
  }
  if (w.hoursAbove32C > 0) {
    humanInsights.push(`☀️ Exposição ao calor medida automaticamente (${w.hoursAbove32C}h acima de 32°C, pico ${w.tempMaxC}°C): +${heatBonusPct.toFixed(0)}% de água fresca.`);
  }
  if (elasticAfternoonInsight) {
    humanInsights.push(elasticAfternoonInsight);
  }
  if (windBonusPct > 0) {
    humanInsights.push(`💨 Vento seco de ${w.windMaxKmh} km/h medido hoje: proteção de +${windBonusPct.toFixed(0)}% ativada automaticamente.`);
  }
  if (wishRainBoostPct > 0) {
    humanInsights.push(`🌧️ Botão "Era bom que chovesse" ativo (${AppState.wishRainClicks}x): todas as regas das próximas 24h estão com +${wishRainBoostPct}% de água!`);
  }
  if (quotaCutApplied) {
    humanInsights.push(`🪣 Guardião da Cota: Pedido de ${totalRequested.toFixed(0)} L ajustado para ${effectiveQuota} L/dia, priorizando a zona em estágio crítico.`);
  }
  if (AppState.filterEfficiencyPct < 80) {
    humanInsights.push(`🧹 Sensor de Vazão SF1 detectou Filtro 120 Mesh a ${AppState.filterEfficiencyPct}%: o sistema aumentou os minutos sozinho e recomenda lavar o filtro.`);
  }
  if (humanInsights.length === 0) {
    humanInsights.push("✅ Clima ameno hoje em São Vicente do Seridó. As duas zonas seguem automaticamente a curva da planta.");
  }

  return {
    heatBonusPct,
    windBonusPct,
    wishRainBoostPct,
    effectiveQuota,
    totalRequested: Number(totalRequested.toFixed(1)),
    totalApproved,
    quotaCutApplied,
    humanInsights,
    zones: calcZones
  };
}

// ==============================================================================
// 2. CONSULTA METEOROLÓGICA REAL AUTOMÁTICA (API OPEN-METEO)
// ==============================================================================
async function fetchLiveOpenMeteoWeather(silent = false) {
  const btn = document.getElementById("btn-fetch-weather");
  if (btn) btn.textContent = "⏳ Atualizando satélite...";
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${AppState.siteCoords.lat}&longitude=${AppState.siteCoords.lon}&daily=et0_fao_evapotranspiration,temperature_2m_max,wind_speed_10m_max,precipitation_sum,precipitation_probability_max&hourly=temperature_2m&timezone=America%2FFortaleza&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Falha HTTP");
    const data = await res.json();

    const tempMax = data.daily.temperature_2m_max?.[0] ?? 34.0;
    const et0 = data.daily.et0_fao_evapotranspiration?.[0] ?? 5.4;
    const windMax = data.daily.wind_speed_10m_max?.[0] ?? 22.0;
    const rainProb = data.daily.precipitation_probability_max?.[0] ?? 10;
    const rainMm = data.daily.precipitation_sum?.[0] ?? 0.0;

    let hoursOver32 = 0;
    if (Array.isArray(data.hourly?.temperature_2m)) {
      hoursOver32 = data.hourly.temperature_2m.slice(0, 24).filter(t => t >= 32.0).length;
    }

    AppState.weather = {
      source: "🟢 Satélite Open-Meteo Ao Vivo (São Vicente do Seridó - PB)",
      et0Mm: Number(et0.toFixed(1)),
      tempMaxC: Number(tempMax.toFixed(1)),
      hoursAbove32C: hoursOver32,
      windMaxKmh: Number(windMax.toFixed(1)),
      rainYesterdayMm: 0.0,
      rainForecastProbPct: Math.round(rainProb),
      rainForecastMm: Number(rainMm.toFixed(1))
    };
    if (!silent) showToast("🌦️ Clima real de São Vicente do Seridó atualizado automaticamente!");
  } catch (_) {
    AppState.weather.source = "🛰️ Clima Histórico Seridó-PB (Offline / Sem Rede)";
    if (!silent) showToast("ℹ️ Usando dados climáticos locais de São Vicente do Seridó.");
  }
  renderApp();
}

// ==============================================================================
// 3. GERADOR E IMPORTADOR DO ARQUIVO PADRONIZADO YAML (100% FIEL AO PERFIL ATUAL)
// ==============================================================================
function generateStandardYamlFromState(planSnapshot) {
  const plan = planSnapshot || computeCognitivePlan();
  const z1 = plan.zones.zona_1;
  const z2 = plan.zones.zona_2;
  const c1 = z1.crop;
  const c2 = z2.crop;
  const w = AppState.weather;

  const formatStagesYaml = (stages) => stages.map(s =>
`      - fase: ${s.fase}
        nome: "${s.nome}"
        dia_inicio: ${s.inicio}
        dia_fim: ${s.fim}
        fator_kc: ${s.kc.toFixed(2)}
        lamina_base_mm_dia: ${s.baseMm.toFixed(1)}
        prioridade_cota: "${s.prio}"
        mensagem_humana: "${s.msg}"`
  ).join("\n");

  const formatComputedShiftsYaml = (shifts) => shifts.map(s =>
`      - turno: ${s.index}
        horario_inicio: "${s.time}"
        horario_termino_estimado: "${s.endTime || s.time}"
        janela_elastica_aplicada: "${s.windowLabel || ''}"
        motivo_escolha_horario: "${s.shiftReason || ''}"
        proporcao_do_dia_pct: ${s.pct}
        volume_calculado_hoje_litros: ${s.liters}
        tempo_valvula_aberta_hoje_min: ${s.minutes}`
  ).join("\n");

  return `# ==============================================================================
# 🌱 IRRIGA.AI PRO-DUO — PERFIL ATUAL COMPLETO E DIAGNÓSTICO (IrrigaPlan v1.0)
# ==============================================================================
# 🧠 INSTRUÇÕES DIRETAS PARA A IA (CLAUDE):
# 1. SEU PAPEL: Você é o Engenheiro Agrônomo Sênior (especialista em fitotecnia e
#    irrigação por gotejamento no Semiárido Paraibano — São Vicente do Seridó, PB)
#    e Engenheiro de Sistemas do projeto Irriga.ai Pro-Duo.
# 2. O QUE VAI ACONTECER AGORA: O usuário acabou de compartilhar este arquivo com
#    você diretamente do iPhone dele. Nesta mensagem (ou no próximo prompt), ele
#    vai relatar algo que está acontecendo no plantio (ex: murcha, sintomas nas
#    folhas, pragas, excesso/falta de água, mudança no tempo) ou pedir uma
#    modificação no plano de irrigação ou troca de cultura.
# 3. COMO VOCÊ DEVE AGIR:
#    a) Analise a seção 'diagnostico_tempo_real_hoje' e 'zonas_de_plantio' abaixo
#       como um perito agrônomo. Dê um diagnóstico claro, humano e prático.
#    b) Quando fizer ajustes ou criar um novo plano, devolva o código YAML completo
#       dentro de um bloco \`\`\`yaml ... \`\`\` (ou arquivo .yaml) mantendo EXATAMENTE
#       os nomes das chaves abaixo para que o usuário possa colar ou importar de
#       volta no aplicativo sem erros.
#    c) TRAVAS DE SEGURANÇA OBRIGATÓRIAS (GUARDRAILS):
#       - NUNCA altere os GPIOs dos relés para os pinos proibidos [13, 14, 26, 27,
#         32, 33, 12, 15, 34] (reservados para botões/boias no GND e sensor Hall).
#       - Mantenha 'cota_diaria_maxima_litros' entre 10 e 5000 L.
#       - Culturas suportadas em 'id_catalogo': "jerimum", "maxixe", "melancia",
#         "feijao_verde", "batata_doce", "milho_verde", "macaxeira".
#       - Nunca recomende plantar a mesma família botânica seguida na mesma zona.
# ==============================================================================
versao_padrao: "1.0"
sistema: "Irriga.ai Pro-Duo"
data_referencia_sistema: "${AppState.simulatedReferenceDate || new Date().toISOString().slice(0, 10)}"
modo_progressao_idade_clima: "${AppState.autoProgressionMode ? "AUTOMATICO_RTC_SATELITE_SENSOR" : "SIMULACAO_MANUAL_DEV"}"

instrucoes_perito_ia_claude:
  papel_da_ia: "Engenheiro Agrônomo Sênior (Semiárido PB) e Arquiteto do Sistema Irriga.ai Pro-Duo"
  alerta_proximo_prompt: "O usuário vai pedir um diagnóstico do plantio ou solicitar ajustes neste perfil. Analise o estado atual abaixo com rigor técnico e devolva o YAML completo atualizado se houver mudanças."
  chaves_editaveis_principais:
    - "cotas_e_seguranca.cota_diaria_maxima_litros (10 a 5000)"
    - "zonas_de_plantio.zona_1 / zona_2 -> cultura_atual.id_catalogo, data_plantio, dia_atual_ciclo_dap"
    - "zonas_de_plantio.zona_1 / zona_2 -> mangueiras_16mm_abertas_agora (1 a 30)"
    - "zonas_de_plantio.zona_1 / zona_2 -> ajuste_fino_usuario_pct (-50 a +50)"
    - "zonas_de_plantio.zona_1 / zona_2 -> turnos_diarios (horario_inicio 'HH:MM' e proporcao_do_dia_pct)"
    - "arquitetura_8_reles_e_expansao.rele_4..8 -> ativo_no_hardware (true/false)"

localizacao_sitio:
  nome: "${AppState.siteCoords.name}"
  latitude: ${AppState.siteCoords.lat}
  longitude: ${AppState.siteCoords.lon}
  fuso_horario: "America/Fortaleza"

# ------------------------------------------------------------------------------
# 📊 1. DIAGNÓSTICO EM TEMPO REAL DO SÍTIO HOJE (PARA O CLAUDE ANALISAR PROBLEMAS)
# ------------------------------------------------------------------------------
diagnostico_tempo_real_hoje:
  status_painel: "${AppState.paused ? "PAUSADO_PELO_USUARIO" : (AppState.manualPlusHours > 0 ? `LIGA_TUDO_MANUAL_ATIVO_${AppState.manualPlusHours}H` : "AUTOMATICO_ATIVO")}"
  botao_era_bom_que_chovesse_cliques: ${AppState.wishRainClicks}
  boost_extra_24h_pct: ${plan.wishRainBoostPct}
  clima_exposicao_hoje:
    fonte_dados: "${w.source}"
    et0_evapotranspiracao_mm: ${w.et0Mm}
    temperatura_maxima_c: ${w.tempMaxC}
    horas_calor_acima_32c: ${w.hoursAbove32C}
    bonus_calor_aplicado_pct: ${plan.heatBonusPct}
    vento_maximo_kmh: ${w.windMaxKmh}
    bonus_vento_aplicado_pct: ${plan.windBonusPct}
    chuva_ontem_mm: ${w.rainYesterdayMm}
    previsao_chuva_hoje_prob_pct: ${w.rainForecastProbPct}
    previsao_chuva_hoje_mm: ${w.rainForecastMm}
  hidraulica_e_caixa_5000l:
    nivel_atual_caixa_pct: ${AppState.tankLevelPct}
    cota_diaria_configurada_litros: ${AppState.dailyQuotaMaxLiters}
    cota_diaria_efetiva_hoje_litros: ${plan.effectiveQuota}
    volume_bruto_pedido_zonas_litros: ${plan.totalRequested}
    volume_final_aprovado_hoje_litros: ${plan.totalApproved}
    rateio_cota_acionado_hoje: ${plan.quotaCutApplied}
    eficiencia_filtro_120_mesh_sensor_sf1_pct: ${AppState.filterEfficiencyPct}

# ------------------------------------------------------------------------------
# 🛡️ 2. COTAS E REGRAS DE SEGURANÇA HIDRÁULICA
# ------------------------------------------------------------------------------
cotas_e_seguranca:
  capacidade_caixa_litros: 5000
  cota_diaria_maxima_litros: ${AppState.dailyQuotaMaxLiters}
  nivel_minimo_seguranca_caixa_pct: 25
  modo_rateio_quando_atingir_cota: "PRIORIZAR_FASE_CRITICA"
  tempo_maximo_valvula_aberta_min: 180
  filtro_unico_120_mesh:
    alerta_limpeza_abaixo_de_pct: 80

inteligencia_climatica:
  exposicao_ao_calor_diurno:
    ativo: true
    temperatura_limite_estresse_c: 32.0
    bonus_rega_tarde_por_hora_quente_pct: 4.0
  exposicao_ao_vento:
    ativo: true
    vento_forte_acima_kmh: 20.0
    bonus_protecao_vento_pct: 10.0

# ------------------------------------------------------------------------------
# 🌱 3. PERFIL ATUAL DETALHADO DAS 2 ZONAS DE PLANTIO
# ------------------------------------------------------------------------------
zonas_de_plantio:
  zona_1:
    id: 1
    nome: "${z1.name}"
    ativa: true
    canal_rele: 2
    gpio_esp32: 16
    area_total_m2: ${z1.areaM2}
    mangueiras_16mm_totais: ${z1.totalLines}
    mangueiras_16mm_abertas_agora: ${z1.openLines}
    vazao_nominal_referencia_lpm: ${z1.flowRefLpm}
    vazao_real_atual_compensada_lpm: ${z1.realFlowLpm}
    cultura_atual:
      id_catalogo: "${c1.id}"
      nome_exibicao: "${c1.name}"
      familia_botanica: "${c1.family}"
      data_plantio: "${z1.plantedDate}"
      dia_atual_ciclo_dap: ${z1.dap}
      ciclo_previsto_dias: ${c1.cycleDays}
      cultura_anterior_na_zona: "${z1.previousFamily}"
      proxima_rotacao_recomendada: "${c1.nextRecommended}"
    estado_fenologico_ativo_hoje:
      fase_numero: ${z1.stage.fase}
      fase_nome: "${z1.stage.nome}"
      fator_kc_atual: ${z1.stage.kc.toFixed(2)}
      prioridade_cota_atual: "${z1.stage.prio}"
      lamina_final_hoje_mm: ${z1.finalMm}
      volume_aprovado_hoje_litros: ${z1.approvedLiters}
    ajuste_fino_usuario_pct: ${z1.userTunePct}
    turnos_diarios:
${formatComputedShiftsYaml(z1.computedShifts)}
    fases_fenologicas:
${formatStagesYaml(c1.stages)}

  zona_2:
    id: 2
    nome: "${z2.name}"
    ativa: true
    canal_rele: 3
    gpio_esp32: 17
    area_total_m2: ${z2.areaM2}
    mangueiras_16mm_totais: ${z2.totalLines}
    mangueiras_16mm_abertas_agora: ${z2.openLines}
    vazao_nominal_referencia_lpm: ${z2.flowRefLpm}
    vazao_real_atual_compensada_lpm: ${z2.realFlowLpm}
    cultura_atual:
      id_catalogo: "${c2.id}"
      nome_exibicao: "${c2.name}"
      familia_botanica: "${c2.family}"
      data_plantio: "${z2.plantedDate}"
      dia_atual_ciclo_dap: ${z2.dap}
      ciclo_previsto_dias: ${c2.cycleDays}
      cultura_anterior_na_zona: "${z2.previousFamily}"
      proxima_rotacao_recomendada: "${c2.nextRecommended}"
    estado_fenologico_ativo_hoje:
      fase_numero: ${z2.stage.fase}
      fase_nome: "${z2.stage.nome}"
      fator_kc_atual: ${z2.stage.kc.toFixed(2)}
      prioridade_cota_atual: "${z2.stage.prio}"
      lamina_final_hoje_mm: ${z2.finalMm}
      volume_aprovado_hoje_litros: ${z2.approvedLiters}
    ajuste_fino_usuario_pct: ${z2.userTunePct}
    turnos_diarios:
${formatComputedShiftsYaml(z2.computedShifts)}
    fases_fenologicas:
${formatStagesYaml(c2.stages)}

# ------------------------------------------------------------------------------
# 🔌 4. PLACA DE 8 RELÉS (3 MVP + 5 EXPANSÃO)
# ------------------------------------------------------------------------------
arquitetura_8_reles_e_expansao:
${AppState.relays.map(r => `  rele_${r.ch}: { gpio: ${r.gpio}, chave: "${r.key}", nome: "${r.name}", ativo_no_hardware: ${r.enabled} }`).join("\n")}
`;
}

function applyEditedYamlFromClaude(yamlText) {
  if (AppState.configLocked) {
    alert("🔒 As configurações estão TRAVADAS no cabeçalho!\n\nToque no botão '🔒 Travado' no topo do aplicativo para destravar antes de aplicar um novo plano do Claude.");
    return;
  }

  const feedbackEl = document.getElementById("yaml-validation-feedback");
  try {
    const changes = [];

    // Extrai cota_diaria_maxima_litros
    const mQuota = yamlText.match(/cota_diaria_maxima_litros:\s*(\d+(\.\d+)?)/);
    if (mQuota) {
      const q = Number(mQuota[1]);
      if (q < 10 || q > 5000) throw new Error(`Cota diária (${q} L) fora dos limites seguros (10 a 5000 L).`);
      if (q !== AppState.dailyQuotaMaxLiters) {
        changes.push(`Cota diária: ${AppState.dailyQuotaMaxLiters} L → ${q} L`);
        AppState.dailyQuotaMaxLiters = q;
      }
    }

    // Verifica travas de segurança de GPIOs proibidos
    const forbiddenPins = [13, 14, 26, 27, 32, 33, 12, 15, 34];
    for (let ch = 1; ch <= 8; ch++) {
      const rePin = new RegExp(`rele_${ch}:[^\\n]*gpio:\\s*(\\d+)`);
      const mPin = yamlText.match(rePin);
      if (mPin && forbiddenPins.includes(Number(mPin[1]))) {
        throw new Error(`Trava Elétrica Acionada: O Relé ${ch} tentou usar o GPIO ${mPin[1]}, que é reservado para Botão/Boia no GND!`);
      }
    }

    // Extrai dados da zona_1 e zona_2
    const z1Block = yamlText.split("zona_1:")[1]?.split("zona_2:")[0] || "";
    const z2Block = yamlText.split("zona_2:")[1]?.split("arquitetura_8_reles_e_expansao:")[0] || "";

    const parseZoneBlock = (block, zKey, label) => {
      if (!block) return;
      const z = AppState.zones[zKey];

      const mCrop = block.match(/id_catalogo:\s*"?([a-z0-9_]+)"?/i);
      if (mCrop && CROP_CATALOG[mCrop[1].toLowerCase()]) {
        const newCropId = mCrop[1].toLowerCase();
        if (newCropId !== z.cropId) {
          changes.push(`${label}: Cultura → ${CROP_CATALOG[newCropId].name}`);
          z.cropId = newCropId;
        }
      }

      const mDate = block.match(/data_plantio:\s*"?(\d{4}-\d{2}-\d{2})"?/);
      if (mDate && mDate[1] !== z.plantedDate) {
        changes.push(`${label}: Data plantio → ${mDate[1]}`);
        z.plantedDate = mDate[1];
      }

      const mDap = block.match(/dia_atual_ciclo_dap:\s*(\d+)/);
      if (mDap) {
        const newDap = Number(mDap[1]);
        if (newDap !== z.dap) {
          AppState.autoProgressionMode = false; // Respeita o DAP editado manualmente/pelo Claude
          changes.push(`${label}: Idade (DAP) → Dia ${newDap}`);
          z.dap = newDap;
        }
      }

      const mLines = block.match(/mangueiras_16mm_abertas_agora:\s*(\d+)/);
      if (mLines) {
        const nl = Math.min(30, Math.max(1, Number(mLines[1])));
        if (nl !== z.openLines) {
          changes.push(`${label}: Fitas abertas → ${nl}`);
          z.openLines = nl;
        }
      }

      const mTune = block.match(/ajuste_fino_usuario_pct:\s*(-?\d+(\.\d+)?)/);
      if (mTune) {
        const nt = Number(mTune[1]);
        if (nt !== z.userTunePct) {
          changes.push(`${label}: Ajuste fino → ${nt >= 0 ? "+" : ""}${nt}%`);
          z.userTunePct = nt;
        }
      }

      // Extrai horários e proporções de turnos se o Claude ajustou
      const shiftTimes = [...block.matchAll(/horario_inicio:\s*"?(\d{2}:\d{2})"?/g)].map(m => m[1]);
      const shiftPcts = [...block.matchAll(/proporcao_do_dia_pct:\s*(\d+)/g)].map(m => Number(m[1]));
      if (shiftTimes.length >= 2 && shiftPcts.length >= 2) {
        if (shiftTimes[0] !== z.shifts[0].time || shiftPcts[0] !== z.shifts[0].pct || shiftTimes[1] !== z.shifts[1].time) {
          z.shifts[0] = { time: shiftTimes[0], pct: shiftPcts[0] };
          z.shifts[1] = { time: shiftTimes[1], pct: shiftPcts[1] };
          changes.push(`${label}: Turnos → ${shiftTimes[0]} (${shiftPcts[0]}%) e ${shiftTimes[1]} (${shiftPcts[1]}%)`);
        }
      }
    };

    parseZoneBlock(z1Block, "zona_1", "Zona 1");
    parseZoneBlock(z2Block, "zona_2", "Zona 2");

    // Verifica ativação de Relés de expansão (4 a 8)
    for (const r of AppState.relays) {
      const reEn = new RegExp(`rele_${r.ch}:[^\\n]*ativo_no_hardware:\\s*(true|false)`);
      const mEn = yamlText.match(reEn);
      if (mEn) {
        const newVal = mEn[1] === "true";
        if (newVal !== r.enabled) {
          changes.push(`Relé ${r.ch} (${r.name}): ${newVal ? "ATIVADO" : "Desativado"}`);
          r.enabled = newVal;
        }
      }
    }

    renderApp();
    const updatedFeedback = document.getElementById("yaml-validation-feedback");
    if (updatedFeedback) {
      updatedFeedback.className = "mt-3 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-sm";
      updatedFeedback.innerHTML = `<strong>✅ Validação Guardrails Aprovada! Ajustes do Claude aplicados:</strong><br>` +
        (changes.length ? `• ${changes.join("<br>• ")}` : "Estrutura conferida e sincronizada com sucesso.");
    }
    showToast("✅ Novo perfil do Claude validado e aplicado!");
  } catch (err) {
    if (feedbackEl) {
      feedbackEl.className = "mt-3 p-3 rounded-xl bg-rose-950/90 border border-rose-500 text-rose-200 text-sm";
      feedbackEl.innerHTML = `<strong>🚨 Bloqueado pelas Travas de Segurança:</strong> ${err.message}`;
    }
  }
}

// ==============================================================================
// 4. CADEADO DE SEGURANÇA, CONFIRMAÇÃO DOS BOTÕES DIGITAIS E BEEP SONORO
// ==============================================================================
const CROP_ECONOMICS = {
  jerimum:     { yieldKgM2: 1.20, producerPriceKg: 2.25, inputsRSM2: 0.60 },
  maxixe:      { yieldKgM2: 1.20, producerPriceKg: 4.50, inputsRSM2: 0.70 },
  melancia:    { yieldKgM2: 3.00, producerPriceKg: 1.80, inputsRSM2: 1.20 },
  batata_doce: { yieldKgM2: 1.60, producerPriceKg: 2.25, inputsRSM2: 0.55 },
  feijao_verde:{ yieldKgM2: 0.35, producerPriceKg: 5.62, inputsRSM2: 0.45 },
  milho_verde: { yieldKgM2: 2.00, producerPriceKg: 1.04, inputsRSM2: 0.90 },
  macaxeira:   { yieldKgM2: 2.00, producerPriceKg: 1.88, inputsRSM2: 0.50 }
};

function playBuzzerBeep(freq = 2400, durationMs = 75, count = 1) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * ((durationMs + 60) / 1000);
      osc.start(start);
      osc.stop(start + durationMs / 1000);
    }
  } catch (_) {}
}

function playWishRainMelodyAudio() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [1760, 2093, 2637, 3136];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t0 = ctx.currentTime + idx * 0.08;
      osc.start(t0);
      osc.stop(t0 + 0.07);
    });
  } catch (_) {}
}

function showToast(msg) {
  const el = document.getElementById("toast-banner");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.add("hidden"), 4200);
}

// ==============================================================================
// 4. SISTEMA DE ACTION SHEETS iOS, TEMA CLARO PADRÃO E COMPARTILHAMENTO NATIVO
// ==============================================================================
AppState.darkMode = false; // Tema Claro ("Apple Daylight") é o padrão!

window.toggleThemeMode = function () {
  AppState.darkMode = !AppState.darkMode;
  document.documentElement.classList.toggle("dark-mode", AppState.darkMode);
  playBuzzerBeep(2100, 40, 1);
  renderApp();
};

window.closeIosModal = function () {
  const modalRoot = document.getElementById("ios-modal-root");
  if (modalRoot) modalRoot.innerHTML = "";
};

window.showIosActionSheet = function ({ icon, title, subtitle, confirmText, confirmColorClass, onConfirm }) {
  const modalRoot = document.getElementById("ios-modal-root");
  if (!modalRoot) {
    if (confirm(`${title}\n\n${subtitle}`)) onConfirm();
    return;
  }
  window._pendingIosConfirmAction = () => {
    closeIosModal();
    onConfirm();
  };
  modalRoot.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-md transition-opacity" onclick="if(event.target===this) closeIosModal()">
      <div class="ios-sheet-animate apple-sheet w-full max-w-sm rounded-[28px] p-6 text-center space-y-4">
        <div class="w-14 h-14 mx-auto rounded-2xl apple-subcard flex items-center justify-center text-3xl shadow-sm">
          ${icon || "🌱"}
        </div>
        <div class="space-y-1.5">
          <h3 class="text-base font-extrabold tracking-tight">${title}</h3>
          <p class="text-xs apple-text-secondary leading-relaxed">${subtitle}</p>
        </div>
        <div class="pt-1 space-y-2">
          <button onclick="window._pendingIosConfirmAction()"
            class="apple-btn-press w-full py-3 rounded-2xl font-bold text-sm text-white shadow-md transition ${confirmColorClass || 'bg-emerald-600 hover:bg-emerald-500'}">
            ${confirmText || "Confirmar"}
          </button>
          <button onclick="closeIosModal()"
            class="apple-btn-press w-full py-2.5 rounded-2xl apple-subcard font-semibold text-xs apple-text-secondary transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;
};

// 🔒 Alterna o Cadeado de Segurança do Cabeçalho com iOS Action Sheet
window.toggleHeaderLock = function () {
  if (AppState.configLocked) {
    showIosActionSheet({
      icon: "🔓",
      title: "Destravar Edição das Zonas?",
      subtitle: "Isso libera a troca de plantas, datas de plantio e importação de ajustes do Claude. (Os 4 botões físicos na caixa do hardware no sítio funcionam sempre, independente deste cadeado).",
      confirmText: "Destravar Configurações",
      confirmColorClass: "bg-emerald-600 hover:bg-emerald-500",
      onConfirm: () => {
        AppState.configLocked = false;
        playBuzzerBeep(2200, 60, 1);
        showToast("🔓 Edição destravada. Toque no cadeado para travar quando terminar.");
        renderApp();
      }
    });
  } else {
    AppState.configLocked = true;
    playBuzzerBeep(1800, 80, 1);
    showToast("🔒 Configurações travadas contra toques acidentais.");
    renderApp();
  }
};

// Os 4 Botões Digitais (Sempre acessíveis, mas protegidos por iOS Action Sheet na tela)
window.triggerButton1Pause = function () {
  showIosActionSheet({
    icon: "⏸️",
    title: "Pausar Irrigações Planejadas?",
    subtitle: "A Válvula Mestre e as duas zonas ficarão fechadas até você tocar em 'Continuar'. Na caixa física do ESP32 (GPIO 13), o botão age direto sem pedir confirmação.",
    confirmText: "Sim, Pausar Agora",
    confirmColorClass: "bg-amber-600 hover:bg-amber-500",
    onConfirm: () => {
      playBuzzerBeep(1800, 110, 2);
      AppState.paused = true;
      AppState.manualPlusHours = 0;
      AppState.relays[0].activeNow = false;
      AppState.relays[1].activeNow = false;
      AppState.relays[2].activeNow = false;
      showToast("⏸️ Irrigações planejadas pausadas.");
      renderApp();
    }
  });
};

window.triggerButton2Resume = function () {
  showIosActionSheet({
    icon: "▶️",
    title: "Retomar Piloto Automático?",
    subtitle: "O sistema voltará a seguir a curva inteligente de crescimento das plantas e os horários de manhã e tarde.",
    confirmText: "Retomar Agenda Automática",
    confirmColorClass: "bg-emerald-600 hover:bg-emerald-500",
    onConfirm: () => {
      playBuzzerBeep(2600, 65, 2);
      AppState.paused = false;
      AppState.manualPlusHours = 0;
      AppState.relays[0].activeNow = false;
      AppState.relays[1].activeNow = false;
      AppState.relays[2].activeNow = false;
      showToast("▶️ Piloto automático retomado!");
      renderApp();
    }
  });
};

window.triggerButton3Plus1h = function () {
  const nextHours = Math.min(4, AppState.manualPlusHours + 1);
  showIosActionSheet({
    icon: "💦",
    title: `Ligar Irrigação por ${nextHours} Hora(s)?`,
    subtitle: `Abre a Válvula Mestre e alterna 30 min por zona para manter pressão alta, respeitando a reserva mínima de 25% da caixa de 5.000 L.`,
    confirmText: `Ligar Agora (+${nextHours}h)`,
    confirmColorClass: "bg-sky-600 hover:bg-sky-500",
    onConfirm: () => {
      playBuzzerBeep(2400, 90, 1);
      AppState.paused = false;
      AppState.manualPlusHours = nextHours;
      AppState.relays[0].activeNow = true;
      AppState.relays[1].activeNow = true;
      showToast(`💦 Irrigando manualmente por ${AppState.manualPlusHours} hora(s)!`);
      renderApp();
    }
  });
};

window.triggerButton4WishRain = function () {
  const nextClicks = (AppState.wishRainClicks + 1) % 3;
  const titleMap = {
    1: "Ativar 'Era bom que chovesse' (+25%)?",
    2: "Subir Reforço de Chuva para +50%?",
    0: "Desativar Reforço 'Era bom que chovesse'?"
  };
  const subMap = {
    1: "Adiciona um mimo de +25% de água fresca em todas as irrigações planejadas das próximas 24 horas.",
    2: "Segundo clique lúdico: eleva para +50% de água extra nas próximas 24 horas (respeitando a cota segura da caixa).",
    0: "O volume de rega voltará imediatamente para 100% da curva padrão da planta."
  };
  showIosActionSheet({
    icon: nextClicks === 0 ? "☀️" : "🌧️",
    title: titleMap[nextClicks],
    subtitle: subMap[nextClicks],
    confirmText: nextClicks === 0 ? "Voltar ao Normal (0%)" : `Ativar +${nextClicks === 1 ? 25 : 50}% por 24h`,
    confirmColorClass: nextClicks === 0 ? "bg-slate-700 hover:bg-slate-600" : "bg-indigo-600 hover:bg-indigo-500",
    onConfirm: () => {
      AppState.wishRainClicks = nextClicks;
      if (AppState.wishRainClicks === 1) {
        playWishRainMelodyAudio();
        showToast("🌧️ 'Era bom que chovesse' ativo: +25% de água por 24h!");
      } else if (AppState.wishRainClicks === 2) {
        playWishRainMelodyAudio();
        showToast("🌧️🌧️ 'Era bom que chovesse' (2x): +50% de água por 24h!");
      } else {
        playBuzzerBeep(1600, 120, 1);
        showToast("☀️ Reforço de chuva desativado.");
      }
      renderApp();
    }
  });
};

// Sheet iOS de Troca de Cultura e Plantio com Inteligência de Rotação Botânica
window.openIosCropRotationSheet = function (zKey) {
  if (AppState.configLocked) {
    toggleHeaderLock();
    return;
  }
  const modalRoot = document.getElementById("ios-modal-root");
  if (!modalRoot) return;
  const z = AppState.zones[zKey];
  const currentCrop = CROP_CATALOG[z.cropId];
  const todayIso = AppState.simulatedReferenceDate || new Date().toISOString().slice(0, 10);

  const cropCardsHtml = Object.values(CROP_CATALOG).map(c => {
    const isCurrent = c.id === z.cropId;
    const isSameFamily = !isCurrent && c.family === currentCrop.family;
    const badge = isCurrent
      ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300">Plantada Agora</span>`
      : isSameFamily
        ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">⚠️ Mesma Família</span>`
        : `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">✨ Ideal p/ Rotação</span>`;

    return `
      <button onclick="selectCropFromIosSheet('${zKey}', '${c.id}')"
        class="apple-btn-press w-full p-3.5 rounded-2xl text-left transition flex items-center justify-between gap-2 ${isCurrent ? 'ring-2 ring-sky-500 apple-subcard' : 'apple-subcard hover:opacity-90'}">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${c.icon}</span>
          <div>
            <div class="text-sm font-extrabold">${c.name}</div>
            <div class="text-[11px] apple-text-muted">${c.family} • Ciclo ~${c.cycleDays} dias • ${c.defaultLinesOpen} fitas</div>
          </div>
        </div>
        ${badge}
      </button>
    `;
  }).join("");

  modalRoot.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-md" onclick="if(event.target===this) closeIosModal()">
      <div class="ios-sheet-animate apple-sheet w-full max-w-md rounded-[30px] p-5 sm:p-6 space-y-4 max-h-[88vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-extrabold">🌱 Configurar ${z.name}</h3>
            <p class="text-xs apple-text-muted">Escolha a cultura e a data em que foi plantada</p>
          </div>
          <button onclick="closeIosModal()" class="w-8 h-8 rounded-full apple-subcard text-sm font-bold">✕</button>
        </div>

        <div class="p-3.5 rounded-2xl apple-subcard space-y-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold">📅 Data do Plantio:</span>
            <button onclick="document.getElementById('sheet-date-input').value='${todayIso}'; updateZonePlantedDate('${zKey}', '${todayIso}'); closeIosModal();"
              class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] shadow-sm">
              Marcar Plantado Hoje
            </button>
          </div>
          <input id="sheet-date-input" type="date" value="${z.plantedDate}"
            onchange="updateZonePlantedDate('${zKey}', this.value)"
            class="w-full apple-card text-sm font-bold rounded-xl px-3 py-2 outline-none" />
        </div>

        <div class="space-y-2">
          <div class="text-[11px] font-bold apple-text-muted uppercase tracking-wider">Catálogo Inteligente (Rotação de Solo)</div>
          ${cropCardsHtml}
        </div>
      </div>
    </div>
  `;
};

window.selectCropFromIosSheet = function (zKey, newCropId) {
  const prevCrop = CROP_CATALOG[AppState.zones[zKey].cropId];
  AppState.zones[zKey].previousFamily = `${prevCrop.family} (${prevCrop.name})`;
  updateZoneCrop(zKey, newCropId);
  closeIosModal();
};

// ==============================================================================
// 📤 COMPARTILHAMENTO NATIVO iOS (WEB SHARE API) + UPLOAD DE ARQUIVO YAML PURO
// ==============================================================================
window.shareProfileWithClaude = async function () {
  const plan = computeCognitivePlan();
  const yaml = generateStandardYamlFromState(plan);
  const introText = `Segue em anexo meu arquivo 'plano_irrigacao_sitio.yaml' do sistema Irriga.ai Pro-Duo (São Vicente do Seridó - PB) com o diagnóstico em tempo real de hoje e as instruções de perito agrônomo. Vou te relatar o que está acontecendo na plantação para você diagnosticar e ajustar o YAML:`;
  const fullClipboardFallback = `${introText}\n\n\`\`\`yaml\n${yaml}\n\`\`\`\n\nMEU RELATO / PEDIDO AGORA:\n- `;

  // Copia preventivamente para a área de transferência também
  try {
    await navigator.clipboard.writeText(fullClipboardFallback);
  } catch (_) {}

  // Tenta abrir o menu nativo "Compartilhar" do iPhone (iOS Share Sheet) com o arquivo .yaml anexado!
  if (navigator.share) {
    try {
      const yamlFile = new File([yaml], "plano_irrigacao_sitio.yaml", { type: "text/yaml" });
      if (navigator.canShare && navigator.canShare({ files: [yamlFile] })) {
        await navigator.share({
          files: [yamlFile],
          title: "Irriga.ai Pro-Duo — Perfil e Diagnóstico Atual",
          text: introText
        });
        showToast("📤 Arquivo compartilhado! (Também copiado p/ a área de transferência).");
        return;
      }
      // Caso o navegador suporte navigator.share apenas para texto
      await navigator.share({
        title: "Irriga.ai Pro-Duo — Perfil e Diagnóstico Atual",
        text: fullClipboardFallback
      });
      showToast("📤 Perfil compartilhado com sucesso!");
      return;
    } catch (err) {
      if (err && err.name === "AbortError") {
        showToast("📋 Compartilhamento fechado (mas o perfil já ficou copiado na área de transferência!).");
        return;
      }
    }
  }

  showToast("📋 Perfil + Instruções copiados para a área de transferência! Basta colar no Claude.");
};

window.copyClaudePromptAndYaml = window.shareProfileWithClaude;

window.triggerYamlFileUpload = function () {
  const inputEl = document.getElementById("hidden-yaml-file-input");
  if (inputEl) {
    inputEl.value = "";
    inputEl.click();
  }
};

window.handleYamlFileUpload = function (event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = String(e.target?.result || "");
    if (!content.trim()) {
      showToast("⚠️ O arquivo selecionado está vazio.");
      return;
    }
    if (AppState.configLocked) {
      AppState.configLocked = false;
    }
    const box = document.getElementById("yaml-editor-box");
    if (box) box.value = content;
    applyEditedYamlFromClaude(content);
  };
  reader.readAsText(file);
};

window.pasteClipboardIntoClaudeBox = async function () {
  try {
    const text = await navigator.clipboard.readText();
    const box = document.getElementById("yaml-editor-box");
    if (box && text) {
      box.value = text;
      showToast("📋 Código colado da área de transferência! Toque em Validar e Aplicar.");
    } else {
      showToast("ℹ️ Segure o dedo na caixa de texto e toque em 'Colar'.");
    }
  } catch (_) {
    showToast("ℹ️ Segure o dedo na caixa de texto abaixo e toque em 'Colar'.");
  }
};

// Sheet iOS do Concierge Claude IA (Com campo de colar VAZIO + Upload de arquivo .YAML puro!)
window.openClaudeConciergeSheet = function () {
  const modalRoot = document.getElementById("ios-modal-root");
  if (!modalRoot) return;
  const plan = computeCognitivePlan();
  const yaml = generateStandardYamlFromState(plan);

  modalRoot.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-900/55 backdrop-blur-md" onclick="if(event.target===this) closeIosModal()">
      <div class="ios-sheet-animate apple-sheet w-full max-w-lg rounded-[30px] p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-sm">✨</span>
            <div>
              <h3 class="text-base font-extrabold">Receber Ajuste do Claude IA</h3>
              <p class="text-xs apple-text-muted">Cole o código YAML ou envie o arquivo .yaml puro</p>
            </div>
          </div>
          <button onclick="closeIosModal()" class="w-8 h-8 rounded-full apple-subcard text-sm font-bold">✕</button>
        </div>

        <!-- Opção A: Enviar Arquivo .YAML Puro ou Colar em 1 Toque -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button onclick="triggerYamlFileUpload()"
            class="apple-btn-press py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition">
            <span>📂</span> <span>Enviar Arquivo .YAML Puro</span>
          </button>
          <button onclick="pasteClipboardIntoClaudeBox()"
            class="apple-btn-press py-3 px-4 rounded-2xl apple-subcard hover:opacity-90 font-bold text-xs flex items-center justify-center gap-2 transition">
            <span>📋</span> <span>Colar da Área de Transferência</span>
          </button>
        </div>

        <!-- Opção B: Campo VAZIO pronto para colar o código do Claude -->
        <div>
          <label class="block text-xs font-bold mb-1.5">Ou cole abaixo o código YAML que o Claude respondeu:</label>
          <textarea id="yaml-editor-box" rows="8" spellcheck="false"
            placeholder="Cole aqui o código YAML gerado pelo Claude..."
            class="w-full font-mono text-xs bg-slate-950 text-emerald-300 placeholder:text-slate-500 p-3.5 rounded-2xl border border-slate-700 focus:border-emerald-500 outline-none"
          ></textarea>
        </div>

        <button onclick="if(AppState.configLocked){ AppState.configLocked=false; } applyEditedYamlFromClaude(document.getElementById('yaml-editor-box').value);"
          class="apple-btn-press w-full py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-sm shadow-lg transition">
          ✅ Validar Segurança e Aplicar Ajuste
        </button>

        <div id="yaml-validation-feedback"></div>

        <!-- Gaveta opcional para apenas visualizar ou baixar o YAML atual -->
        <details class="pt-2 border-t border-slate-200/40 text-xs">
          <summary class="cursor-pointer font-semibold apple-text-muted flex items-center justify-between">
            <span>🔍 Ver ou baixar meu arquivo YAML atual completo</span>
            <button type="button" onclick="event.stopPropagation(); downloadYamlFile()" class="underline font-bold text-emerald-600">Baixar .yaml</button>
          </summary>
          <pre class="mt-2 p-3 rounded-xl bg-slate-950 text-slate-300 font-mono text-[10px] overflow-x-auto max-h-40">${yaml.replace(/</g, "&lt;")}</pre>
        </details>
      </div>
    </div>
  `;
};

// ==============================================================================
// 📲 INSTALAÇÃO NATIVA NA TELA INICIAL (PWA OFFLINE PARA ANDROID & iPHONE iOS)
// ==============================================================================
window.deferredPwaPrompt = null;

window.isRunningStandalone = function () {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
};

window.addEventListener("beforeinstallprompt", (e) => {
  // Captura o prompt nativo do Chrome / Samsung Internet no Android!
  e.preventDefault();
  window.deferredPwaPrompt = e;
  renderApp();
});

window.addEventListener("appinstalled", () => {
  window.deferredPwaPrompt = null;
  showToast("🎉 Aplicativo Irriga.ai instalado com sucesso na tela inicial do celular!");
  renderApp();
});

window.triggerPwaInstall = async function () {
  // Se o Android (Chrome/Edge/Samsung) já disponibilizou o instalador em 1 toque:
  if (window.deferredPwaPrompt) {
    try {
      window.deferredPwaPrompt.prompt();
      const { outcome } = await window.deferredPwaPrompt.userChoice;
      if (outcome === "accepted") {
        window.deferredPwaPrompt = null;
        showToast("📲 Instalando o aplicativo Irriga.ai no seu Android...");
      }
      return;
    } catch (_) {}
  }
  // Caso contrário, abre o guia visual inteligente para Android e iPhone:
  openPwaInstallSheet();
};

window.openPwaInstallSheet = function () {
  const modalRoot = document.getElementById("ios-modal-root");
  if (!modalRoot) return;
  const ua = navigator.userAgent || "";
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/i.test(ua);

  modalRoot.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-900/55 backdrop-blur-md" onclick="if(event.target===this) closeIosModal()">
      <div class="ios-sheet-animate apple-sheet w-full max-w-md rounded-[30px] p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-sm">📲</span>
            <div>
              <h3 class="text-base font-extrabold">Instalar na Tela Inicial</h3>
              <p class="text-xs apple-text-muted">Funciona offline no Sítio em Android e iPhone</p>
            </div>
          </div>
          <button onclick="closeIosModal()" class="w-8 h-8 rounded-full apple-subcard text-sm font-bold">✕</button>
        </div>

        <!-- Card Android (Prioritário para os operadores do sítio) -->
        <div class="p-4 rounded-2xl apple-subcard space-y-2.5 ${isAndroid ? 'ring-2 ring-emerald-500' : ''}">
          <div class="flex items-center justify-between">
            <span class="text-sm font-extrabold flex items-center gap-1.5">🤖 No Celular Android (Chrome / Samsung)</span>
            ${isAndroid ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">Seu Aparelho</span>' : ''}
          </div>
          ${window.deferredPwaPrompt ? `
            <button onclick="triggerPwaInstall(); closeIosModal();"
              class="apple-btn-press w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow">
              ⚡ Instalar Agora em 1 Toque (Android)
            </button>
          ` : `
            <ol class="text-xs apple-text-secondary space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>Toque nos <strong>3 pontinhos (⋮)</strong> no canto superior direito do Chrome (ou no menu inferior da Samsung).</li>
              <li>Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</li>
              <li>Pronto! O ícone <strong>🌱 Irriga.ai</strong> ficará na tela do celular igual a um app da Play Store e abre mesmo sem internet.</li>
            </ol>
          `}
        </div>

        <!-- Card iPhone (iOS Safari) -->
        <div class="p-4 rounded-2xl apple-subcard space-y-2.5 ${isIos ? 'ring-2 ring-sky-500' : ''}">
          <div class="flex items-center justify-between">
            <span class="text-sm font-extrabold flex items-center gap-1.5">🍎 No iPhone (Safari iOS)</span>
            ${isIos ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300">Seu iPhone</span>' : ''}
          </div>
          <ol class="text-xs apple-text-secondary space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>Toque no botão <strong>Compartilhar (⬆️ quadrado com seta)</strong> na barra do Safari.</li>
            <li>Role a lista para baixo e toque em <strong>"Adicionar à Tela de Início" (➕)</strong>.</li>
            <li>Toque em <strong>Adicionar</strong> no canto superior direito. Ele abrirá em tela cheia!</li>
          </ol>
        </div>

        <button onclick="closeIosModal()" class="apple-btn-press w-full py-3 rounded-2xl apple-subcard font-bold text-xs">
          Entendi, fechar
        </button>
      </div>
    </div>
  `;
};

window.toggleRemoteDesktopCenter = function () {
  AppState.showRemoteCenter = !AppState.showRemoteCenter;
  renderApp();
};

// Cenários Prontos do Benchmark de Jerimum (50 dias de defasagem) para testar em 1 clique na Dev-GUI
window.loadBenchmarkPreset = function (presetId) {
  if (presetId === "jerimum_50d_conflito") {
    AppState.autoProgressionMode = true;
    AppState.simulatedReferenceDate = "2026-06-10"; // Dia 102
    AppState.zones.zona_1.cropId = "jerimum";
    AppState.zones.zona_1.plantedDate = "2026-03-01";
    AppState.zones.zona_1.openLines = 8;
    AppState.zones.zona_2.cropId = "jerimum";
    AppState.zones.zona_2.plantedDate = "2026-04-20"; // +50 dias!
    AppState.zones.zona_2.openLines = 8;
    AppState.weather.tempMaxC = 32.5;
    AppState.weather.hoursAbove32C = 1.5;
    AppState.weather.windMaxKmh = 19.5;
    showToast("🎃 Cenário Dia 102 carregado: Zona 1 em Pré-Colheita (-65%) vs Zona 2 em Floração Crítica (100%)!");
  } else if (presetId === "pos_colheita_rotacao") {
    AppState.autoProgressionMode = true;
    AppState.simulatedReferenceDate = "2026-08-07"; // Dia 160
    AppState.zones.zona_1.cropId = "feijao_verde";
    AppState.zones.zona_1.plantedDate = "2026-07-04";
    AppState.zones.zona_1.openLines = 16;
    AppState.zones.zona_1.previousFamily = "Cucurbitáceas (Jerimum)";
    AppState.zones.zona_2.cropId = "jerimum";
    AppState.zones.zona_2.plantedDate = "2026-04-20";
    AppState.zones.zona_2.openLines = 8;
    AppState.weather.tempMaxC = 34.8;
    AppState.weather.hoursAbove32C = 4.0;
    AppState.weather.windMaxKmh = 24.4;
    showToast("🫛 Cenário Dia 160 carregado: Zona 1 em Feijão Verde (Floração) + Zona 2 colhendo 2º Jerimum!");
  } else if (presetId === "auge_seca_novembro") {
    AppState.autoProgressionMode = true;
    AppState.simulatedReferenceDate = "2026-10-11"; // Dia 225
    AppState.zones.zona_1.cropId = "batata_doce";
    AppState.zones.zona_1.plantedDate = "2026-09-25";
    AppState.zones.zona_1.openLines = 16;
    AppState.zones.zona_2.cropId = "batata_doce";
    AppState.zones.zona_2.plantedDate = "2026-08-23";
    AppState.zones.zona_2.openLines = 16;
    AppState.weather.tempMaxC = 36.3;
    AppState.weather.hoursAbove32C = 5.5;
    AppState.weather.windMaxKmh = 30.6;
    showToast("☀️ Cenário Auge da Seca carregado: Batata-doce em Tuberização + Guardião de Cota ativo!");
  }
  renderApp();
};

window.downloadYamlFile = function () {
  const yaml = generateStandardYamlFromState();
  const blob = new Blob([yaml], { type: "text/yaml;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "plano_irrigacao_sitio.yaml";
  a.click();
  showToast("💾 Arquivo plano_irrigacao_sitio.yaml baixado!");
};

window.syncPlanToEsp32OverWifi = async function () {
  const ip = prompt("Digite o endereço IP local do seu ESP32 na rede Wi-Fi do sítio:", AppState.esp32Ip);
  if (!ip) return;
  AppState.esp32Ip = ip;
  const plan = computeCognitivePlan();
  try {
    const res = await fetch(`http://${ip}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quota_max_l: plan.effectiveQuota,
        boost_24h_pct: plan.wishRainBoostPct,
        z1_liters: plan.zones.zona_1.approvedLiters,
        z2_liters: plan.zones.zona_2.approvedLiters
      })
    });
    if (res.ok) {
      showToast(`✅ Plano enviado via Wi-Fi direto para o ESP32 (${ip})!`);
    } else {
      throw new Error("Status HTTP " + res.status);
    }
  } catch (_) {
    showToast(`ℹ️ Simulação: Quando o ESP32 (${ip}) estiver ligado na tomada, este botão grava direto na memória Flash dele!`);
  }
};

// ==============================================================================
// 5. COMPONENTES VISUAIS COMPARTILHADOS E DISTINTOS (END-USER vs DEV-GUI)
// ==============================================================================
function renderHeaderLockBadge() {
  if (AppState.configLocked) {
    return `
      <button onclick="toggleHeaderLock()" title="Configurações protegidas contra toque acidental. Clique para destravar."
        class="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 text-xs font-bold flex items-center gap-1.5 transition shadow">
        <span>🔒</span> <span>Config. Travadas</span>
      </button>
    `;
  }
  return `
    <button onclick="toggleHeaderLock()" title="Modo de edição aberto. Clique para travar novamente."
      class="px-3 py-1.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-400/60 text-xs font-bold flex items-center gap-1.5 transition shadow">
      <span>🔓</span> <span>Edição Destravada</span>
    </button>
  `;
}

function renderFourButtonsBar(plan) {
  return `
    <section class="mb-4 p-3.5 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-md">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-slate-300">🎛️ Comandos Rápidos (Com Confirmação anti-toque acidental)</span>
          <span class="block text-[11px] text-slate-400">Os 4 botões físicos na caixa do hardware continuam livres e diretos no campo.</span>
        </div>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${AppState.paused ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : (AppState.manualPlusHours > 0 ? "bg-sky-500/20 text-sky-300 border border-sky-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40")}">
          ${AppState.paused ? "⏸️ PAUSADO" : (AppState.manualPlusHours > 0 ? `💦 LIGA TUDO (+${AppState.manualPlusHours}h)` : "🟢 PILOTO AUTOMÁTICO")}
        </span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button onclick="triggerButton1Pause()" class="p-3 rounded-xl border ${AppState.paused ? "bg-amber-600/30 border-amber-400 text-amber-200" : "bg-slate-800/90 border-slate-700 text-slate-100 hover:bg-slate-800"} text-left transition">
          <div class="text-sm font-bold">⏸️ Pausar</div>
          <div class="text-[11px] text-slate-400">Para planejadas</div>
        </button>
        <button onclick="triggerButton2Resume()" class="p-3 rounded-xl border ${!AppState.paused && AppState.manualPlusHours === 0 ? "bg-emerald-600/25 border-emerald-500/60 text-emerald-200" : "bg-slate-800/90 border-slate-700 text-slate-100 hover:bg-slate-800"} text-left transition">
          <div class="text-sm font-bold">▶️ Continuar</div>
          <div class="text-[11px] text-slate-400">Retoma agenda</div>
        </button>
        <button onclick="triggerButton3Plus1h()" class="p-3 rounded-xl border ${AppState.manualPlusHours > 0 ? "bg-sky-600/30 border-sky-400 text-sky-200" : "bg-slate-800/90 border-slate-700 text-slate-100 hover:bg-slate-800"} text-left transition">
          <div class="text-sm font-bold">💦 Liga +1h ${AppState.manualPlusHours > 0 ? `(${AppState.manualPlusHours}h)` : ""}</div>
          <div class="text-[11px] text-slate-400">Soma +1h por toque</div>
        </button>
        <button onclick="triggerButton4WishRain()" class="p-3 rounded-xl border ${AppState.wishRainClicks > 0 ? "bg-indigo-600/35 border-indigo-400 text-indigo-200" : "bg-slate-800/90 border-slate-700 text-slate-100 hover:bg-slate-800"} text-left transition">
          <div class="text-sm font-bold">🌧️ Era bom chover ${AppState.wishRainClicks > 0 ? `(+${plan.wishRainBoostPct}%)` : ""}</div>
          <div class="text-[11px] text-slate-400">+Água por 24h</div>
        </button>
      </div>
    </section>
  `;
}

function renderZoneCard(zKey, zData, isEndUserMode) {
  const isZ1 = zKey === "zona_1";
  const borderAccent = isZ1 ? "border-sky-500/40" : "border-amber-500/40";
  const badgeBg = isZ1 ? "bg-sky-500/20 text-sky-300" : "bg-amber-500/20 text-amber-300";
  const lockedAttr = AppState.configLocked ? "disabled" : "";
  const lockedStyle = AppState.configLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer";

  const prioBadge = {
    MAXIMA_CRITICA: `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/25 text-rose-300 border border-rose-500/40">🚨 Fase Crítica (Prioridade Máxima)</span>`,
    ALTA: `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/25 text-amber-300">⚡ Prioridade Alta</span>`,
    MEDIA: `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">🌱 Fase Estável</span>`,
    BAIXA: `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/25 text-purple-200 border border-purple-400/40">🍯 Pré-Colheita (-65% Água)</span>`
  }[zData.stage.prio] || "";

  const cropOptions = Object.values(CROP_CATALOG).map(c =>
    `<option value="${c.id}" ${c.id === zData.cropId ? "selected" : ""}>${c.icon} ${c.name} (${c.family} • ~${c.cycleDays}d)</option>`
  ).join("");

  return `
    <div class="rounded-2xl bg-slate-900/95 border ${borderAccent} p-4 shadow-lg flex flex-col justify-between">
      <div>
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-1 rounded-lg text-xs font-bold ${badgeBg}">${isZ1 ? "Zona 1" : "Zona 2"}</span>
            <h3 class="text-base font-bold text-white">${zData.name} (${zData.areaM2} m²)</h3>
          </div>
          ${prioBadge}
        </div>

        <!-- Seleção da Planta e Data de Plantio (Protegidos pelo Cadeado 🔒) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800/90">
          <div>
            <div class="flex justify-between text-xs text-slate-400 mb-1">
              <span>Cultura Plantada:</span>
              <span>${AppState.configLocked ? "🔒 Travado" : "🔓 Editável"}</span>
            </div>
            <select ${lockedAttr} onchange="updateZoneCrop('${zKey}', this.value)"
              class="w-full bg-slate-800 text-white text-sm font-semibold rounded-lg px-2.5 py-1.5 border border-slate-700 ${lockedStyle}">
              ${cropOptions}
            </select>
          </div>
          <div>
            <div class="flex justify-between text-xs text-slate-400 mb-1">
              <span>Plantado em (${zData.plantedDate}):</span>
              <strong class="text-emerald-300">Dia ${zData.dap} de ${zData.crop.cycleDays}</strong>
            </div>
            <input type="date" ${lockedAttr} value="${zData.plantedDate}"
              onchange="updateZonePlantedDate('${zKey}', this.value)"
              class="w-full bg-slate-800 text-white text-sm rounded-lg px-2.5 py-1 border border-slate-700 ${lockedStyle}" />
          </div>
        </div>

        ${(!isEndUserMode && !AppState.autoProgressionMode) ? `
          <!-- Slider Manual de DAP (Exclusivo para Simulação na Dev-GUI quando em modo manual) -->
          <div class="mb-3 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs">
            <div class="flex justify-between text-indigo-200 mb-1">
              <span>🧪 Simulador Manual de Idade (DAP):</span>
              <strong>Dia ${zData.dap} (${zData.progressPct}%)</strong>
            </div>
            <input type="range" min="1" max="${zData.crop.cycleDays}" value="${zData.dap}"
              oninput="updateZoneDap('${zKey}', Number(this.value))"
              class="w-full accent-indigo-400 cursor-pointer" />
          </div>
        ` : ""}

        <!-- Barra Visual da Fase Fenológica Atual -->
        <div class="mb-3">
          <div class="flex justify-between text-xs text-slate-300 mb-1">
            <span><strong>Fase ${zData.stage.fase}:</strong> ${zData.stage.nome}</span>
            <span class="text-slate-400">Kc = ${zData.stage.kc} (${zData.progressPct}%)</span>
          </div>
          <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300" style="width: ${zData.progressPct}%"></div>
          </div>
        </div>

        <!-- Explicação Humana Empática -->
        <div class="p-3 rounded-xl bg-slate-800/70 border border-slate-700/80 text-sm text-slate-100 mb-3">
          💬 <em>"${zData.stage.msg}"</em>
        </div>
      </div>

      <!-- Resumo de Litros, Turnos do Dia e Próxima Rotação -->
      <div class="pt-2.5 border-t border-slate-800">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div>
            <span class="text-xs text-slate-400 block">Água Programada p/ Hoje</span>
            <span class="text-xl font-extrabold text-emerald-400">${zData.approvedLiters} Litros</span>
            <span class="text-xs text-slate-400 ml-1">(${zData.finalMm} mm • ${zData.openLines} fitas)</span>
          </div>
          <div class="text-right">
            <span class="text-xs text-slate-400 block">🔄 Após colher ${zData.crop.name}, plante:</span>
            <span class="text-xs text-amber-300 font-semibold">${zData.crop.nextRecommended}</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${zData.computedShifts.map(s => `
            <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs">
              <div class="flex justify-between text-slate-300 font-semibold">
                <span>${s.windowLabel || (s.index === 1 ? "🌅 Alvorada" : "🌇 Tarde")}</span>
                <span class="font-mono text-emerald-300">${s.time}–${s.endTime || ""}</span>
              </div>
              <div class="text-sm font-bold text-white mt-0.5">
                ${s.liters} L <span class="text-emerald-300 font-semibold">(~${s.minutes} min)</span>
              </div>
              <div class="text-[10px] text-slate-400 mt-0.5">${s.shiftReason || ""}</div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

// ==============================================================================
// 6. RENDERIZADOR "APPLE DAYLIGHT EXPERIENCE" PARA O USUÁRIO FINAL (index.html)
// Tema Claro por Padrão • Contraste Perfeito • Compartilhamento Nativo iPhone
// ==============================================================================
function renderAppleZoneWidget(zKey, zData) {
  const isZ1 = zKey === "zona_1";
  const accentBar = isZ1 ? "from-sky-500 to-emerald-500" : "from-amber-500 to-emerald-500";
  const daysRemaining = Math.max(0, zData.crop.cycleDays - zData.dap);
  const dk = AppState.darkMode;

  const stagePillMap = {
    MAXIMA_CRITICA: `<span class="px-3 py-1 rounded-full text-[11px] font-bold ${dk ? 'bg-rose-500/20 text-rose-200 border-rose-400/40' : 'bg-rose-100 text-rose-900 border-rose-300'} border">🌸 Fase Crítica • Prioridade Máxima</span>`,
    ALTA:           `<span class="px-3 py-1 rounded-full text-[11px] font-bold ${dk ? 'bg-amber-500/20 text-amber-200 border-amber-400/40' : 'bg-amber-100 text-amber-900 border-amber-300'} border">⚡ Prioridade Alta</span>`,
    MEDIA:          `<span class="px-3 py-1 rounded-full text-[11px] font-bold ${dk ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' : 'bg-emerald-100 text-emerald-900 border-emerald-300'} border">🌱 Desenvolvimento Estável</span>`,
    BAIXA:          `<span class="px-3 py-1 rounded-full text-[11px] font-bold ${dk ? 'bg-purple-500/20 text-purple-200 border-purple-400/40' : 'bg-purple-100 text-purple-900 border-purple-300'} border">🍯 Pré-Colheita • -65% Água</span>`
  };
  const stageBadge = stagePillMap[zData.stage.prio] || "";

  // Barra Segmentada das Fases Fenológicas (Estilo Apple Health)
  const segmentedStagesHtml = zData.crop.stages.map(st => {
    const isActive = st.fase === zData.stage.fase;
    const isPast = st.fase < zData.stage.fase;
    const barClass = isActive
      ? `bg-gradient-to-r ${accentBar} shadow-sm scale-y-125`
      : isPast
        ? (dk ? "bg-emerald-500/50" : "bg-emerald-500/70")
        : (dk ? "bg-slate-800" : "bg-slate-200");
    const labelClass = isActive
      ? (dk ? "font-extrabold text-emerald-400" : "font-extrabold text-emerald-700")
      : "apple-text-muted font-medium";
    return `
      <div class="flex-1 flex flex-col gap-1" title="Fase ${st.fase}: ${st.nome} (Dias ${st.inicio}–${st.fim})">
        <div class="h-2.5 rounded-full transition-all ${barClass}"></div>
        <span class="text-[10px] text-center ${labelClass}">F${st.fase}</span>
      </div>
    `;
  }).join("");

  return `
    <div class="apple-card rounded-[28px] p-5 sm:p-6 flex flex-col justify-between space-y-5">
      <div class="space-y-4">
        <!-- Topo do Widget da Zona -->
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3.5">
            <div class="w-14 h-14 rounded-2xl apple-subcard flex items-center justify-center text-3xl shadow-sm shrink-0">
              ${zData.crop.icon}
            </div>
            <div>
              <span class="text-[11px] font-bold uppercase tracking-wider apple-text-muted block">${zData.name} • ${zData.areaM2} m²</span>
              <h3 class="text-xl font-extrabold tracking-tight">${zData.crop.name}</h3>
              <p class="text-xs apple-text-secondary mt-0.5">
                Dia <strong class="${dk ? 'text-emerald-400' : 'text-emerald-700'} font-extrabold">${zData.dap}</strong> de ${zData.crop.cycleDays}
                • ${daysRemaining > 0 ? `Colheita em ~${daysRemaining} dias` : 'Ponto de colheita!'}
              </p>
            </div>
          </div>
          <button onclick="openIosCropRotationSheet('${zKey}')"
            class="apple-btn-press px-3.5 py-2 rounded-full apple-subcard text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-sm hover:opacity-90 transition">
            <span>${AppState.configLocked ? "🔒" : "🌱"}</span>
            <span>${AppState.configLocked ? "Trocar" : "Editar"}</span>
          </button>
        </div>

        <!-- Pílula Semântica da Fase Atual + Mensagem Empática -->
        <div class="space-y-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            ${stageBadge}
            <span class="text-xs font-bold apple-text-secondary">Fase ${zData.stage.fase}: ${zData.stage.nome}</span>
          </div>

          <!-- 5 Segmentos Visuais do Ciclo da Planta -->
          <div class="flex items-center gap-1.5 pt-1">
            ${segmentedStagesHtml}
          </div>

          <div class="p-3.5 rounded-2xl apple-subcard text-xs sm:text-sm leading-relaxed apple-text-secondary font-medium">
            “${zData.stage.msg}”
          </div>
        </div>
      </div>

      <!-- Rodapé do Widget: Litros de Hoje, Turnos Manhã/Tarde e Próxima Rotação -->
      <div class="pt-4 border-t ${dk ? 'border-white/10' : 'border-slate-200/80'} space-y-3.5">
        <div class="flex items-baseline justify-between gap-2">
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider apple-text-muted block">Dose Calculada Hoje</span>
            <div class="flex items-baseline gap-1.5">
              <span class="text-2xl sm:text-3xl font-extrabold tracking-tight ${dk ? 'text-emerald-400' : 'text-emerald-700'}">${zData.approvedLiters} L</span>
              <span class="text-xs font-medium apple-text-muted">(${zData.finalMm} mm • ${zData.openLines} fitas • ${zData.dripPhysics.activeEmitters} furos 30cm)</span>
            </div>
          </div>
          <div class="text-right">
            <span class="text-[10px] font-bold uppercase tracking-wider apple-text-muted block">Próxima Safra Ideal</span>
            <span class="text-xs font-extrabold ${dk ? 'text-amber-300' : 'text-amber-800'}">${zData.crop.nextRecommended.split(" (")[0]}</span>
          </div>
        </div>

        <!-- Cartões de Turno c/ Janela Elástica Inteligente (Alvorada & Crepúsculo) Estilo Apple Home -->
        <div class="grid grid-cols-2 gap-2.5">
          ${zData.computedShifts.map(s => `
            <div class="p-3 rounded-2xl apple-subcard space-y-1">
              <div class="flex items-center justify-between text-[11px] apple-text-muted">
                <span class="font-extrabold apple-text-secondary">${s.windowLabel || (s.index === 1 ? "🌅 Alvorada" : "🌇 Crepúsculo")}</span>
                <span class="font-mono font-extrabold ${dk ? 'text-emerald-400' : 'text-emerald-700'}">${s.time}–${s.endTime || ""}</span>
              </div>
              <div class="text-base font-extrabold tracking-tight">
                ${s.liters} L <span class="text-xs font-bold ${dk ? 'text-emerald-400' : 'text-emerald-700'}">• ${s.minutes} min</span>
              </div>
              <div class="text-[10px] font-medium apple-text-muted leading-tight">
                ${s.shiftReason || ""}
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderEndUserApp(root, plan) {
  const quotaPct = Math.min(100, Math.round((plan.totalApproved / plan.effectiveQuota) * 100));
  const w = AppState.weather;
  const tankLitersNow = Math.round((AppState.tankLevelPct / 100) * 5000);
  const dk = AppState.darkMode;

  // Calcula geometria do Anel Circular SVG (Estilo Apple Fitness Ring)
  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (quotaPct / 100) * ringCircumference;
  const ringStrokeColor = plan.quotaCutApplied ? "#d97706" : "#059669";

  // Descobre o próximo turno do dia para mostrar no Hero
  const z1Next = plan.zones.zona_1.computedShifts[1] || plan.zones.zona_1.computedShifts[0];
  const statusHeadline = AppState.paused
    ? "Irrigações Planejadas em Pausa"
    : AppState.manualPlusHours > 0
      ? `Regando Agora por +${AppState.manualPlusHours}h`
      : "Piloto Automático Cuidando do Sítio";

  const statusDotColor = AppState.paused
    ? "bg-amber-500"
    : AppState.manualPlusHours > 0
      ? "bg-sky-500"
      : "bg-emerald-500";

  root.className = "max-w-4xl mx-auto px-4 sm:px-6 py-5 pb-24 space-y-6 transition-all";
  root.innerHTML = `
    <!-- 1. TOP NAVIGATION BAR + DYNAMIC ISLAND PILL -->
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl apple-card flex items-center justify-center text-2xl">
          🌱
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-lg sm:text-xl font-extrabold tracking-tight">Irriga.ai <span class="${dk ? 'text-emerald-400' : 'text-emerald-700'} font-extrabold">Pro-Duo</span></h1>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${dk ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}">v1.0-Argon</span>
          </div>
          <p class="text-xs font-medium apple-text-muted">📍 ${AppState.siteCoords.name}</p>
        </div>
      </div>

      <!-- Controles do Cabeçalho: Instalar App (Android/iOS) + Cadeado + Tema Claro/Escuro + Link Dev -->
      <div class="flex flex-wrap items-center gap-2">
        ${!isRunningStandalone() ? `
          <button onclick="triggerPwaInstall()" title="Instalar aplicativo na tela inicial do Android ou iPhone (Funciona Offline)"
            class="apple-btn-press px-3.5 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition">
            <span>📲</span>
            <span>Instalar no Celular</span>
          </button>
        ` : ""}

        <button onclick="toggleHeaderLock()"
          class="apple-btn-press px-3.5 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 border shadow-sm transition ${AppState.configLocked ? (dk ? 'bg-amber-500/20 border-amber-400/50 text-amber-200' : 'bg-amber-100 border-amber-300 text-amber-900') : (dk ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200' : 'bg-emerald-100 border-emerald-300 text-emerald-900')}">
          <span>${AppState.configLocked ? "🔒" : "🔓"}</span>
          <span>${AppState.configLocked ? "Travado" : "Destravado"}</span>
        </button>

        <button onclick="toggleThemeMode()" title="Alternar Tema Claro / Escuro"
          class="apple-btn-press px-3 py-2 rounded-full apple-card text-xs font-bold flex items-center gap-1.5">
          <span>${dk ? "☀️" : "🌙"}</span>
          <span class="hidden sm:inline">${dk ? "Tema Claro" : "Modo Noite"}</span>
        </button>

        <a href="./dev-gui.html" title="Abrir Bancada de Engenharia (Dev-GUI)"
          class="apple-btn-press px-3 py-2 rounded-full apple-card text-xs font-bold apple-text-secondary hover:opacity-80">
          🛠️ Dev
        </a>
      </div>
    </header>

    <!-- 2. BENTO HERO: CLIMA INTELIGENTE (ESQUERDA) + ANEL DE COTA & CAIXA 5.000L (DIREITA) -->
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-4">

      <!-- Card Clima & Decisão Humana Hoje (7 Colunas) -->
      <div class="lg:col-span-7 apple-card rounded-[30px] p-5 sm:p-6 flex flex-col justify-between space-y-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full apple-subcard text-xs font-bold">
              <span class="w-2.5 h-2.5 rounded-full ${statusDotColor} live-dot"></span>
              <span>${statusHeadline}</span>
            </div>
            <button id="btn-fetch-weather" onclick="fetchLiveOpenMeteoWeather()"
              class="apple-btn-press px-2.5 py-1 rounded-full apple-subcard text-xs font-bold ${dk ? 'text-emerald-400' : 'text-emerald-700'} flex items-center gap-1">
              <span>🔄</span> <span>Atualizar Clima</span>
            </button>
          </div>

          <div class="flex items-baseline justify-between pt-1">
            <div>
              <div class="text-4xl sm:text-5xl font-extrabold tracking-tighter">${w.tempMaxC}°C</div>
              <div class="text-xs font-medium apple-text-secondary mt-0.5">Pico de hoje • Próxima rega às <strong>${z1Next.time}</strong></div>
            </div>
            <div class="text-right space-y-1">
              <span class="inline-block px-3 py-1 rounded-full border text-xs font-bold ${dk ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'bg-amber-100 border-amber-300 text-amber-900'}">
                ☀️ +${plan.heatBonusPct.toFixed(0)}% Calor
              </span>
              ${plan.windBonusPct > 0 ? `
                <span class="block px-3 py-1 rounded-full border text-xs font-bold ${dk ? 'bg-sky-500/20 border-sky-400/40 text-sky-200' : 'bg-sky-100 border-sky-300 text-sky-900'}">
                  💨 +${plan.windBonusPct.toFixed(0)}% Vento
                </span>
              ` : ""}
            </div>
          </div>

          <!-- Insights Humanos do Dia -->
          <div class="space-y-1.5 pt-1 text-xs sm:text-sm font-medium apple-text-secondary leading-relaxed">
            ${plan.humanInsights.map(msg => `<div class="p-3 rounded-2xl apple-subcard">${msg}</div>`).join("")}
          </div>
        </div>

        <!-- Tira de Pílulas Climáticas (Somente Leitura — Sem Sliders!) -->
        <div class="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
          <div class="p-2.5 rounded-2xl apple-subcard">
            <span class="apple-text-muted font-semibold block text-[11px]">Sol &gt;32°C</span>
            <strong class="text-sm font-extrabold">${w.hoursAbove32C} horas</strong>
          </div>
          <div class="p-2.5 rounded-2xl apple-subcard">
            <span class="apple-text-muted font-semibold block text-[11px]">Vento Seco</span>
            <strong class="text-sm font-extrabold">${w.windMaxKmh} km/h</strong>
          </div>
          <div class="p-2.5 rounded-2xl apple-subcard">
            <span class="apple-text-muted font-semibold block text-[11px]">Chuva Hoje</span>
            <strong class="text-sm font-extrabold">${w.rainForecastProbPct}%</strong>
          </div>
        </div>
      </div>

      <!-- Card Anel de Cota Diária + Caixa 5.000 L + Filtro 120 Mesh (5 Colunas) -->
      <div class="lg:col-span-5 apple-card rounded-[30px] p-5 sm:p-6 flex flex-col justify-between space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider apple-text-muted">Guardião da Água</span>
            <h2 class="text-base font-extrabold">Cota & Caixa 5.000 L</h2>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[11px] font-bold border ${AppState.filterEfficiencyPct < 80 ? (dk ? 'bg-amber-500/20 text-amber-200 border-amber-400/40' : 'bg-amber-100 text-amber-900 border-amber-300') : (dk ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' : 'bg-emerald-100 text-emerald-900 border-emerald-300')}">
            🔍 Filtro ${AppState.filterEfficiencyPct}%
          </span>
        </div>

        <!-- Anel Circular Estilo Apple Fitness -->
        <div class="flex items-center gap-4 py-1">
          <div class="relative w-28 h-28 flex items-center justify-center shrink-0">
            <svg class="w-28 h-28 -rotate-90" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="${ringRadius}" stroke="var(--ring-track)" stroke-width="10" fill="none" />
              <circle cx="55" cy="55" r="${ringRadius}" stroke="${ringStrokeColor}" stroke-width="10" fill="none"
                stroke-linecap="round" stroke-dasharray="${ringCircumference}" stroke-dashoffset="${ringOffset}"
                style="transition: stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1);" />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span class="text-xl font-extrabold tracking-tight">${quotaPct}%</span>
              <span class="text-[10px] font-bold apple-text-muted">da cota</span>
            </div>
          </div>

          <div class="space-y-2.5 text-xs flex-1">
            <div>
              <span class="apple-text-muted font-semibold block">Planejado Hoje (Z1 + Z2)</span>
              <strong class="text-xl font-extrabold ${dk ? 'text-emerald-400' : 'text-emerald-700'}">${plan.totalApproved} L</strong>
              <span class="apple-text-muted font-semibold"> / ${plan.effectiveQuota} L</span>
            </div>
            <div class="p-3 rounded-2xl apple-subcard">
              <div class="flex justify-between text-[11px] mb-1.5">
                <span class="apple-text-muted font-bold">🪣 Caixa 5.000 L</span>
                <strong class="${dk ? 'text-sky-300' : 'text-sky-800'} font-extrabold">${AppState.tankLevelPct}% (~${tankLitersNow} L)</strong>
              </div>
              <div class="w-full h-2 ${dk ? 'bg-slate-800' : 'bg-slate-200'} rounded-full overflow-hidden">
                <div class="h-full bg-sky-500 rounded-full" style="width: ${AppState.tankLevelPct}%"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="text-[11px] font-semibold apple-text-muted flex items-center justify-between pt-2 border-t ${dk ? 'border-white/10' : 'border-slate-200/80'}">
          <span>Sensor de Vazão Hall SF1 ativo</span>
          <span class="${dk ? 'text-emerald-400' : 'text-emerald-700'} font-bold">✓ Proteção Hidráulica</span>
        </div>
      </div>

    </section>

    <!-- 3. OS 4 TILES TÁTEIS ESTILO APPLE HOMEKIT (COM LEGIBILIDADE PERFEITA NO TEMA CLARO) -->
    <section class="space-y-2.5">
      <div class="flex flex-wrap items-center justify-between gap-1 px-1">
        <h2 class="text-xs font-extrabold uppercase tracking-wider apple-text-muted">Controles Rápidos do Sítio</h2>
        <span class="text-[11px] font-medium apple-text-muted">Toque para confirmar • Botões físicos na caixa sempre ativos</span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <!-- Tile 1: Pausar -->
        <button onclick="triggerButton1Pause()"
          class="apple-tile p-4 text-left flex flex-col justify-between min-h-[108px] ${AppState.paused ? (dk ? 'ring-2 ring-amber-400 bg-amber-500/20' : 'ring-2 ring-amber-500 bg-amber-50') : 'hover:opacity-95'}">
          <div class="flex items-center justify-between">
            <span class="w-10 h-10 rounded-2xl ${AppState.paused ? 'bg-amber-500 text-white shadow-sm' : 'apple-subcard'} flex items-center justify-center text-lg">⏸️</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${AppState.paused ? (dk ? 'bg-amber-400/20 text-amber-200' : 'bg-amber-200 text-amber-950') : 'apple-text-muted'}">${AppState.paused ? 'Ativo' : 'Pronto'}</span>
          </div>
          <div class="mt-3">
            <div class="text-sm font-extrabold">Pausar Regas</div>
            <div class="text-[11px] font-medium apple-text-muted">Segura a agenda</div>
          </div>
        </button>

        <!-- Tile 2: Continuar -->
        <button onclick="triggerButton2Resume()"
          class="apple-tile p-4 text-left flex flex-col justify-between min-h-[108px] ${!AppState.paused && AppState.manualPlusHours === 0 ? (dk ? 'ring-2 ring-emerald-400 bg-emerald-500/15' : 'ring-2 ring-emerald-600 bg-emerald-50/70') : 'hover:opacity-95'}">
          <div class="flex items-center justify-between">
            <span class="w-10 h-10 rounded-2xl ${!AppState.paused && AppState.manualPlusHours === 0 ? 'bg-emerald-600 text-white shadow-sm' : 'apple-subcard'} flex items-center justify-center text-lg">▶️</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${!AppState.paused && AppState.manualPlusHours === 0 ? (dk ? 'bg-emerald-400/20 text-emerald-200' : 'bg-emerald-200 text-emerald-950') : 'apple-text-muted'}">${!AppState.paused && AppState.manualPlusHours === 0 ? 'Em Curso' : 'Retomar'}</span>
          </div>
          <div class="mt-3">
            <div class="text-sm font-extrabold">Continuar</div>
            <div class="text-[11px] font-medium apple-text-muted">Piloto automático</div>
          </div>
        </button>

        <!-- Tile 3: Liga tudo +1h -->
        <button onclick="triggerButton3Plus1h()"
          class="apple-tile p-4 text-left flex flex-col justify-between min-h-[108px] ${AppState.manualPlusHours > 0 ? (dk ? 'ring-2 ring-sky-400 bg-sky-500/20' : 'ring-2 ring-sky-500 bg-sky-50') : 'hover:opacity-95'}">
          <div class="flex items-center justify-between">
            <span class="w-10 h-10 rounded-2xl ${AppState.manualPlusHours > 0 ? 'bg-sky-600 text-white shadow-sm' : 'apple-subcard'} flex items-center justify-center text-lg">💦</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${AppState.manualPlusHours > 0 ? (dk ? 'bg-sky-400/20 text-sky-200' : 'bg-sky-200 text-sky-950') : 'apple-text-muted'}">${AppState.manualPlusHours > 0 ? `+${AppState.manualPlusHours}h ON` : '+1h / toque'}</span>
          </div>
          <div class="mt-3">
            <div class="text-sm font-extrabold">Liga Tudo +1h</div>
            <div class="text-[11px] font-medium apple-text-muted">Rega imediata</div>
          </div>
        </button>

        <!-- Tile 4: Era bom que chovesse -->
        <button onclick="triggerButton4WishRain()"
          class="apple-tile p-4 text-left flex flex-col justify-between min-h-[108px] ${AppState.wishRainClicks > 0 ? (dk ? 'ring-2 ring-indigo-400 bg-indigo-500/25' : 'ring-2 ring-indigo-500 bg-indigo-50') : 'hover:opacity-95'}">
          <div class="flex items-center justify-between">
            <span class="w-10 h-10 rounded-2xl ${AppState.wishRainClicks > 0 ? 'bg-indigo-600 text-white shadow-sm' : 'apple-subcard'} flex items-center justify-center text-lg">🌧️</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${AppState.wishRainClicks > 0 ? (dk ? 'bg-indigo-400/20 text-indigo-200' : 'bg-indigo-200 text-indigo-950') : 'apple-text-muted'}">${AppState.wishRainClicks > 0 ? `+${plan.wishRainBoostPct}% (24h)` : 'Mimo 24h'}</span>
          </div>
          <div class="mt-3">
            <div class="text-sm font-extrabold">Era bom chover</div>
            <div class="text-[11px] font-medium apple-text-muted">Reforça regas 24h</div>
          </div>
        </button>
      </div>
    </section>

    <!-- 4. WIDGETS DAS DUAS ZONAS DE PLANTIO -->
    <section class="space-y-3">
      <div class="flex items-center justify-between px-1">
        <h2 class="text-xs font-extrabold uppercase tracking-wider apple-text-muted">Zonas de Plantação</h2>
        <span class="text-xs font-medium apple-text-muted">${AppState.configLocked ? "🔒 Configurações protegidas" : "🔓 Toque em Editar na zona para trocar"}</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${renderAppleZoneWidget("zona_1", plan.zones.zona_1)}
        ${renderAppleZoneWidget("zona_2", plan.zones.zona_2)}
      </div>
    </section>

    <!-- 5. CONCIERGE CLAUDE IA (COM BOTÃO "COMPARTILHAR" NATIVO DO IPHONE + CAMPO VAZIO / UPLOAD YAML) -->
    <section class="apple-card rounded-[28px] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div class="flex items-start sm:items-center gap-3.5">
        <div class="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-sm shrink-0">
          ✨
        </div>
        <div>
          <h3 class="text-base font-extrabold tracking-tight">Consultar ou Ajustar com o Claude IA</h3>
          <p class="text-xs apple-text-secondary leading-relaxed mt-0.5">
            Toque em <strong>Compartilhar</strong> para enviar o arquivo <code>.yaml</code> direto para o app do Claude no iPhone (já com as instruções de perito agrônomo). Depois, cole ou envie o ajuste dele.
          </p>
        </div>
      </div>

      <div class="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto shrink-0">
        <button onclick="shareProfileWithClaude()"
          class="apple-btn-press flex-1 sm:flex-initial py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 transition">
          <span>📤</span> <span>Compartilhar c/ Claude</span>
        </button>
        <button onclick="openClaudeConciergeSheet()"
          class="apple-btn-press flex-1 sm:flex-initial py-3 px-4 rounded-2xl apple-subcard hover:opacity-90 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm transition">
          <span>📥</span> <span>Receber Ajuste</span>
        </button>
      </div>
    </section>

    <!-- 6. VISÃO COMPUTADOR (LONGE DO SÍTIO) — COMMAND CENTER ESTRATÉGICO & AUDITORIA REMOTA -->
    ${renderRemoteDesktopCommandCenter(plan)}
  `;
}

// Painel pensado exclusivamente para quando o dono está no computador, longe do sítio:
// Responde: 1) Alguém mexeu nos botões lá na roça? 2) Quantos dias a caixa aguenta? 3) Quando devo viajar p/ colheita?
function renderRemoteDesktopCommandCenter(plan) {
  const dk = AppState.darkMode;
  const tankLitersNow = Math.round((AppState.tankLevelPct / 100) * 5000);
  // Reserva mínima de 25% (1250 L) -> Água útil disponível antes do bloqueio de boia:
  const usableWaterLiters = Math.max(0, tankLitersNow - 1250);
  const dailyConsumption = Math.max(100, plan.totalApproved);
  const autonomyDays = (usableWaterLiters / dailyConsumption).toFixed(1);

  const z1 = plan.zones.zona_1;
  const z2 = plan.zones.zona_2;
  const z1DaysToHarvest = Math.max(0, z1.crop.cycleDays - z1.dap);
  const z2DaysToHarvest = Math.max(0, z2.crop.cycleDays - z2.dap);
  const filterDaysLeft = Math.max(1, Math.round((AppState.filterEfficiencyPct - 80) * 0.6));

  const calcHarvestEcon = (z) => {
    const ec = CROP_ECONOMICS[z.cropId] || CROP_ECONOMICS.jerimum;
    const kg = Math.round(z.areaM2 * ec.yieldKgM2);
    const net = Math.round(z.areaM2 * ec.yieldKgM2 * ec.producerPriceKg * 0.94 - z.areaM2 * ec.inputsRSM2);
    return { kg, net };
  };
  const e1 = calcHarvestEcon(z1);
  const e2 = calcHarvestEcon(z2);

  return `
    <section class="space-y-3 pt-2">
      <div class="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h2 class="text-xs font-extrabold uppercase tracking-wider apple-text-muted flex items-center gap-1.5">
            <span>🖥️</span> <span>Command Center Remoto (Visão Longe do Sítio)</span>
          </h2>
          <p class="text-[11px] apple-text-muted">Auditoria do operador local, autonomia da caixa de 5.000 L e calendário de viagem/colheita</p>
        </div>
        <button onclick="toggleRemoteDesktopCenter()" class="lg:hidden px-3 py-1.5 rounded-full apple-subcard text-xs font-bold">
          ${AppState.showRemoteCenter ? "Ocultar Visão PC" : "Expandir Visão PC"}
        </button>
      </div>

      <div class="${AppState.showRemoteCenter ? 'grid' : 'hidden lg:grid'} grid-cols-1 lg:grid-cols-3 gap-4">

        <!-- Pilar 1: Auditoria Remota do Operador & Saúde Física na Roça -->
        <div class="apple-card rounded-[26px] p-5 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold uppercase tracking-wider apple-text-muted">1. Auditoria no Campo</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${AppState.paused ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'}">
              ${AppState.paused ? '⚠️ Pausa Manual' : '✓ Operação Normal'}
            </span>
          </div>
          <div class="space-y-2 text-xs">
            <div class="p-3 rounded-2xl apple-subcard flex items-center justify-between">
              <span class="apple-text-secondary font-medium">Botões da Caixa Física:</span>
              <strong class="font-extrabold">${AppState.paused ? 'Botão PAUSAR ativo' : (AppState.manualPlusHours > 0 ? `Liga Tudo +${AppState.manualPlusHours}h` : 'Automático Intacto')}</strong>
            </div>
            <div class="p-3 rounded-2xl apple-subcard flex items-center justify-between">
              <span class="apple-text-secondary font-medium">Saúde Filtro 120 Mesh:</span>
              <strong class="font-extrabold ${AppState.filterEfficiencyPct < 80 ? 'text-amber-700' : 'text-emerald-700'}">${AppState.filterEfficiencyPct}% (~${filterDaysLeft}d p/ lavar)</strong>
            </div>
            <div class="p-3 rounded-2xl apple-subcard flex items-center justify-between">
              <span class="apple-text-secondary font-medium">Travas Sensor Hall SF1:</span>
              <strong class="font-extrabold text-emerald-700">✓ Sem Fuga / Cano OK</strong>
            </div>
          </div>
        </div>

        <!-- Pilar 2: Autonomia Real da Caixa 5.000 L & Balanço Hídrico -->
        <div class="apple-card rounded-[26px] p-5 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold uppercase tracking-wider apple-text-muted">2. Autonomia Hídrica</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-900 border border-sky-300">
              🪣 ~${autonomyDays} dias restantes
            </span>
          </div>
          <div class="space-y-2 text-xs">
            <div class="p-3 rounded-2xl apple-subcard flex items-center justify-between">
              <span class="apple-text-secondary font-medium">Água Útil Acima da Reserva:</span>
              <strong class="font-extrabold">${usableWaterLiters} L livres</strong>
            </div>
            <div class="p-3 rounded-2xl apple-subcard flex items-center justify-between">
              <span class="apple-text-secondary font-medium">Ritmo de Consumo Atual:</span>
              <strong class="font-extrabold">${plan.totalApproved} L / dia</strong>
            </div>
            <div class="p-3 rounded-2xl apple-subcard flex items-center justify-between">
              <span class="apple-text-secondary font-medium">Estimativa Colheita (Z1+Z2):</span>
              <strong class="font-extrabold ${dk ? 'text-emerald-400' : 'text-emerald-700'}">~${e1.kg + e2.kg} kg (R$ ${e1.net + e2.net})</strong>
            </div>
          </div>
        </div>

        <!-- Pilar 3: Calendário Estratégico de Safra & Próxima Ida ao Sítio -->
        <div class="apple-card rounded-[26px] p-5 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold uppercase tracking-wider apple-text-muted">3. Agenda de Safra</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-900 border border-indigo-300">
              🗓️ Planejamento
            </span>
          </div>
          <div class="space-y-2 text-xs">
            <div class="p-3 rounded-2xl apple-subcard flex items-center justify-between">
              <span class="apple-text-secondary font-medium">${z1.crop.icon} Colheita ${z1.name.split("—")[0]}:</span>
              <strong class="font-extrabold">${z1DaysToHarvest === 0 ? 'Pronta p/ Colher!' : `Faltam ~${z1DaysToHarvest} dias`}</strong>
            </div>
            <div class="p-3 rounded-2xl apple-subcard flex items-center justify-between">
              <span class="apple-text-secondary font-medium">${z2.crop.icon} Colheita ${z2.name.split("—")[0]}:</span>
              <strong class="font-extrabold">${z2DaysToHarvest === 0 ? 'Pronta p/ Colher!' : `Faltam ~${z2DaysToHarvest} dias`}</strong>
            </div>
            <div class="p-3 rounded-2xl apple-subcard flex items-center justify-between">
              <span class="apple-text-secondary font-medium">Próxima Semente (Rotação):</span>
              <strong class="font-extrabold ${dk ? 'text-amber-300' : 'text-amber-800'}">${z1.crop.nextRecommended.split(" (")[0]}</strong>
            </div>
          </div>
        </div>

      </div>
    </section>
  `;
}

// ==============================================================================
// 7. RENDERIZADOR DA DEV-GUI (dev-gui.html — BANCADA COMPLETA DE DESENVOLVIMENTO)
// ==============================================================================
function renderOledAndHydraulicSimulator(plan) {
  const isFlowing = AppState.manualPlusHours > 0;
  const currentLpm = isFlowing ? plan.zones.zona_1.realFlowLpm : 0.0;

  let oledLines = [];
  if (AppState.oledPage === 0) {
    oledLines = [
      `IRRIGA.AI PRO-DUO [P1]`,
      `----------------------`,
      AppState.paused ? `Status: PAUSADO [||]` : (isFlowing ? `LIGA TUDO: +${AppState.manualPlusHours}h ON` : `Status: AUTOMATICO`),
      `Caixa:${AppState.tankLevelPct}% | Vaz:${currentLpm}L/m`,
      `Cota: ${plan.totalApproved}/${plan.effectiveQuota} L`,
      plan.wishRainBoostPct > 0 ? `Chuva Extra: +${plan.wishRainBoostPct}% 24h` : (AppState.filterEfficiencyPct < 80 ? `AVISO: Limpar Filtro!` : `Filtro 120M: OK (${AppState.filterEfficiencyPct}%)`)
    ];
  } else if (AppState.oledPage === 1) {
    oledLines = [
      `ZONAS DE PLANTIO  [P2]`,
      `----------------------`,
      `Z1: ${plan.zones.zona_1.crop.name} (D.${plan.zones.zona_1.dap})`,
      ` -> Hoje: ${plan.zones.zona_1.approvedLiters} L`,
      `Z2: ${plan.zones.zona_2.crop.name} (D.${plan.zones.zona_2.dap})`,
      ` -> Hoje: ${plan.zones.zona_2.approvedLiters} L`
    ];
  } else {
    oledLines = [
      `RELÉS & EXPANSAO  [P3]`,
      `----------------------`,
      `R1 Mestre: ${isFlowing ? "ABERTA" : "FECHADA"}`,
      `R6 Bomba:  ${AppState.relays[5].enabled ? "ATIVA" : "Reserva"}`,
      `R7 Luz:    ${AppState.relays[6].enabled ? "LIGADA" : "OFF"}`,
      `R8 Camera: ${AppState.relays[7].enabled ? "LIGADA" : "OFF"}`
    ];
  }

  const calcProfit = (z) => {
    const ec = CROP_ECONOMICS[z.cropId] || CROP_ECONOMICS.jerimum;
    const kg = Math.round(z.areaM2 * ec.yieldKgM2);
    const gross = z.areaM2 * ec.yieldKgM2 * ec.producerPriceKg * 0.94;
    const cost = z.areaM2 * ec.inputsRSM2;
    const net = Math.round(gross - cost);
    return { kg, net };
  };
  const p1 = calcProfit(plan.zones.zona_1);
  const p2 = calcProfit(plan.zones.zona_2);

  return `
    <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-slate-300">🖥️ Visor OLED 0.96" do Painel Físico</span>
        <button onclick="AppState.oledPage=(AppState.oledPage+1)%3; renderApp()" class="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
          Trocar Tela (${AppState.oledPage + 1}/3)
        </button>
      </div>
      <div class="p-3 rounded-xl bg-black border-2 border-slate-700 font-mono text-[11px] leading-relaxed text-cyan-300 shadow-inner">
        ${oledLines.map((l, idx) => `<div class="${idx === 0 ? 'text-amber-300 font-bold' : 'text-cyan-300'}">${l}</div>`).join("")}
      </div>

      <div class="grid grid-cols-4 gap-1.5 text-center text-[10px] pt-1">
        <div class="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
          <div class="font-bold text-sky-300">🔍 Filtro 120M</div>
          <div class="text-slate-400">${AppState.filterEfficiencyPct}% Limpo</div>
        </div>
        <div class="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
          <div class="font-bold text-emerald-300">📊 Sensor SF1</div>
          <div class="text-slate-400">${currentLpm} L/min</div>
        </div>
        <div class="p-1.5 rounded-lg bg-slate-950 border ${isFlowing ? 'border-emerald-500 bg-emerald-950/40' : 'border-slate-800'}">
          <div class="font-bold text-white">🔒 R1 Mestre</div>
          <div class="${isFlowing ? 'text-emerald-300 font-bold' : 'text-slate-400'}">${isFlowing ? 'ABERTA' : 'Fechada'}</div>
        </div>
        <div class="p-1.5 rounded-lg bg-slate-950 border ${isFlowing ? 'border-sky-500 bg-sky-950/40' : 'border-slate-800'}">
          <div class="font-bold text-white">🌱 Zonas 1/2</div>
          <div class="${isFlowing ? 'text-sky-300 font-bold' : 'text-slate-400'}">${isFlowing ? 'REGANDO' : 'Em espera'}</div>
        </div>
      </div>

      <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-[11px]">
        <div class="flex items-center justify-between">
          <span class="font-bold text-emerald-300">🛡️ Travas Hidráulicas do Firmware (SF1 + WDT):</span>
          <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">4 ATIVAS</span>
        </div>
        <div class="grid grid-cols-2 gap-1 text-[10px] text-slate-300">
          <div>• Cano Seco: &lt;0.4 L/m (60s)</div>
          <div>• Mangueira Rompida: &gt;15 L/m (10s)</div>
          <div>• Timeout Válvula: Máx 180m</div>
          <div>• Hardware Watchdog: 10s</div>
        </div>
      </div>

      <div class="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span class="text-slate-400 block text-[11px]">💰 Previsão de Colheita & Margem (Z1 + Z2):</span>
          <strong class="text-emerald-300">~${p1.kg + p2.kg} kg totais • Lucro Caixa: ~R$ ${p1.net + p2.net},00/safra</strong>
        </div>
        <button onclick="syncPlanToEsp32OverWifi()" class="px-2.5 py-1.5 rounded-lg bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 text-[11px] font-bold shrink-0">
          📡 Enviar p/ ESP32
        </button>
      </div>
    </div>
  `;
}

function renderDevGuiApp(root, plan) {
  const isDesktop = AppState.viewMode === "desktop";
  root.className = isDesktop
    ? "max-w-7xl mx-auto px-4 py-5 transition-all"
    : "max-w-md mx-auto px-3 py-3 pb-24 transition-all border-x border-slate-800/80 min-h-screen bg-slate-950";

  const quotaPct = Math.min(100, Math.round((plan.totalApproved / plan.effectiveQuota) * 100));

  root.innerHTML = `
    <!-- CABEÇALHO DA DEV-GUI (BANCADA DE ENGENHARIA & SIMULAÇÃO) -->
    <header class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-xl">🛠️</span>
          <h1 class="text-lg font-extrabold tracking-tight text-white">Irriga.ai <span class="text-indigo-400">DEV-GUI</span></h1>
          <span class="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Simulador & Bancada</span>
          <span class="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">💾 Auto-Save Ativo</span>
        </div>
        <p class="text-xs text-slate-400">📍 ${AppState.siteCoords.name} • ESP32 38p V4</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        ${renderHeaderLockBadge()}
        <a href="./index.html" class="px-3 py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 text-xs font-bold transition">
          👤 Ver App Usuário Final
        </a>
        <button onclick="resetToFactoryDefaults()" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-xs font-semibold text-slate-300 hover:text-rose-200 border border-slate-700 transition" title="Restaurar estado inicial de demonstração">
          ♻️ Resetar Padrão
        </button>
        <button onclick="toggleViewMode()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition">
          ${isDesktop ? "📱 Ver Modo Celular" : "🖥️ Abrir 3 Colunas Desktop"}
        </button>
      </div>
    </header>

    <!-- BARRA DE BENCHMARK PRÁTICO (JERIMUM DEFASADO 50 DIAS + ROTAÇÃO) & MODO AUTOMÁTICO vs SIMULADOR -->
    <section class="mb-4 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex flex-wrap items-center justify-between gap-2 text-xs">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-bold text-indigo-200">🎃 Cenários do Benchmark (260d):</span>
        <button onclick="loadBenchmarkPreset('jerimum_50d_conflito')" class="px-2.5 py-1 rounded-lg bg-indigo-600/40 hover:bg-indigo-600/60 text-white border border-indigo-400/50 font-semibold">
          Dia 102: Z1 Jerimum Pré-Colheita (-65%) vs Z2 Jerimum Floração (100%)
        </button>
        <button onclick="loadBenchmarkPreset('pos_colheita_rotacao')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
          Dia 160: Z1 Feijão Verde + Z2 2ª Colheita Jerimum
        </button>
        <button onclick="loadBenchmarkPreset('auge_seca_novembro')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
          Dia 225: Auge da Seca (Batata-doce + Cota)
        </button>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="AppState.autoProgressionMode=!AppState.autoProgressionMode; renderApp()"
          class="px-2.5 py-1 rounded-lg font-bold border ${AppState.autoProgressionMode ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200' : 'bg-amber-600/30 border-amber-400 text-amber-200'}">
          ${AppState.autoProgressionMode ? "🛰️ Progressão: AUTOMÁTICA (Data/Satélite)" : "🧪 Progressão: SIMULADOR MANUAL (Sliders)"}
        </button>
      </div>
    </section>

    <!-- BARRA DOS 4 BOTÕES COM CONFIRMAÇÃO -->
    ${renderFourButtonsBar(plan)}

    <!-- NAVEGAÇÃO POR ABAS MAIS CLARA (NO MODO MOBILE DA DEV-GUI) -->
    ${!isDesktop ? `
      <div class="grid grid-cols-4 gap-1.5 mb-4 p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
        <button onclick="switchTab('home')" class="py-2 rounded-lg ${AppState.activeTab === 'home' ? 'bg-indigo-600 text-white' : 'text-slate-400'}">📊 Painel & Clima</button>
        <button onclick="switchTab('zones')" class="py-2 rounded-lg ${AppState.activeTab === 'zones' ? 'bg-indigo-600 text-white' : 'text-slate-400'}">🌱 Zonas 1 e 2</button>
        <button onclick="switchTab('claude')" class="py-2 rounded-lg ${AppState.activeTab === 'claude' ? 'bg-indigo-600 text-white' : 'text-slate-400'}">🤖 Ajuda Claude</button>
        <button onclick="switchTab('relays')" class="py-2 rounded-lg ${AppState.activeTab === 'relays' ? 'bg-indigo-600 text-white' : 'text-slate-400'}">🔌 Placa 8 Relés</button>
      </div>
    ` : ""}

    <div class="${isDesktop ? "grid grid-cols-12 gap-5" : "space-y-4"}">

      <!-- COLUNA ESQUERDA: DECISÃO DO DIA + SIMULADOR DE CLIMA/COTA/OLED -->
      <div class="${isDesktop ? "col-span-4 space-y-4" : (AppState.activeTab === "home" ? "space-y-4" : "hidden")}">

        <div class="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/90 to-slate-900 border border-emerald-500/30 shadow-lg">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-bold text-emerald-300 uppercase tracking-wide">🧠 Decisão Cognitiva de Hoje</h2>
            <button id="btn-fetch-weather" onclick="fetchLiveOpenMeteoWeather()" class="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40">
              🔄 Ler Satélite Real
            </button>
          </div>
          <ul class="space-y-2 text-sm text-slate-100">
            ${plan.humanInsights.map(msg => `<li class="leading-snug">${msg}</li>`).join("")}
          </ul>
        </div>

        <!-- Simulador de Clima e Data (Explicando claramente que na vida real é automático!) -->
        <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div class="flex justify-between items-center">
            <h3 class="text-sm font-bold text-white">🧪 Bancada de Clima & Tempo (Dev-GUI)</h3>
            <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">No sítio: 100% Automático</span>
          </div>

          <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
            <span class="text-slate-300">📅 Data Simulada Hoje (calcula DAP):</span>
            <input type="date" value="${AppState.simulatedReferenceDate}"
              onchange="AppState.simulatedReferenceDate=this.value; AppState.autoProgressionMode=true; renderApp()"
              class="bg-slate-800 text-emerald-300 font-bold rounded px-2 py-1 border border-slate-700" />
          </div>

          <div class="space-y-2.5 text-xs">
            <div>
              <div class="flex justify-between mb-1">
                <span class="text-slate-300">🌡️ Horas &gt;32°C: <strong>${AppState.weather.hoursAbove32C}h</strong> (Máx ${AppState.weather.tempMaxC}°C)</span>
                <span class="text-amber-300 font-bold">+${plan.heatBonusPct.toFixed(0)}% rega</span>
              </div>
              <input type="range" min="0" max="8" step="0.5" value="${AppState.weather.hoursAbove32C}"
                oninput="AppState.weather.hoursAbove32C=Number(this.value); AppState.weather.tempMaxC=Number((30+Number(this.value)*1.2).toFixed(1)); renderApp()"
                class="w-full accent-amber-500" />
            </div>

            <div>
              <div class="flex justify-between mb-1">
                <span class="text-slate-300">💨 Vento Seco Diurno: <strong>${AppState.weather.windMaxKmh} km/h</strong></span>
                <span class="text-sky-300 font-bold">+${plan.windBonusPct.toFixed(0)}% rega</span>
              </div>
              <input type="range" min="5" max="45" step="1" value="${AppState.weather.windMaxKmh}"
                oninput="AppState.weather.windMaxKmh=Number(this.value); renderApp()"
                class="w-full accent-sky-500" />
            </div>

            <div>
              <div class="flex justify-between mb-1">
                <span class="text-slate-300">🌧️ Previsão Chuva Hoje: <strong>${AppState.weather.rainForecastProbPct}%</strong> (${AppState.weather.rainForecastMm} mm)</span>
                <span class="text-indigo-300 font-bold">${AppState.weather.rainForecastProbPct >= 75 ? "Segura rega" : "Sem chuva"}</span>
              </div>
              <input type="range" min="0" max="100" step="5" value="${AppState.weather.rainForecastProbPct}"
                oninput="AppState.weather.rainForecastProbPct=Number(this.value); AppState.weather.rainForecastMm=this.value>=75?10:0; renderApp()"
                class="w-full accent-indigo-500" />
            </div>
          </div>
        </div>

        <!-- Guardião da Cota + Filtro 120 Mesh -->
        <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 class="text-sm font-bold text-white">🪣 Guardião de Cota (SF1) & Filtro 120 Mesh</h3>
          <div>
            <div class="flex justify-between text-xs mb-1">
              <span class="text-slate-300">Uso Hoje (Z1 + Z2):</span>
              <strong class="${plan.quotaCutApplied ? 'text-amber-300' : 'text-emerald-300'}">${plan.totalApproved} L / Cota ${plan.effectiveQuota} L (${quotaPct}%)</strong>
            </div>
            <div class="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full ${plan.quotaCutApplied ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${quotaPct}%"></div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1 text-xs">
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span class="text-slate-400 block">Limite Cota Diária (L)</span>
              <input type="number" ${AppState.configLocked ? "disabled" : ""} step="50" min="200" max="5000" value="${AppState.dailyQuotaMaxLiters}"
                onchange="AppState.dailyQuotaMaxLiters=Number(this.value); renderApp()"
                class="mt-1 w-full bg-slate-800 text-white font-bold rounded px-2 py-1 border border-slate-700 ${AppState.configLocked ? 'opacity-60' : ''}" />
            </div>
            <div class="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <span class="text-slate-400 block">Simular Filtro 120M (${AppState.filterEfficiencyPct}%)</span>
              <input type="range" min="55" max="100" value="${AppState.filterEfficiencyPct}"
                oninput="AppState.filterEfficiencyPct=Number(this.value); renderApp()"
                class="mt-2 w-full accent-emerald-500" />
            </div>
          </div>
        </div>

        ${renderOledAndHydraulicSimulator(plan)}
      </div>

      <!-- COLUNA CENTRAL: AS DUAS ZONAS DE PLANTIO -->
      <div class="${isDesktop ? "col-span-5 space-y-4" : (AppState.activeTab === "zones" || AppState.activeTab === "home" ? "space-y-4" : "hidden")}">
        ${renderZoneCard("zona_1", plan.zones.zona_1, false)}
        ${renderZoneCard("zona_2", plan.zones.zona_2, false)}
      </div>

      <!-- COLUNA DIREITA: ESTÚDIO CLAUDE IA (COM DIAGNÓSTICO EM TEMPO REAL) + 8 RELÉS -->
      <div class="${isDesktop ? "col-span-3 space-y-4" : ((AppState.activeTab === "claude" || AppState.activeTab === "relays") ? "space-y-4" : "hidden")}">

        <div class="${(!isDesktop && AppState.activeTab === "relays") ? "hidden" : "p-4 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-3"}">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold text-white">🤖 Perfil Atual + Diagnóstico p/ Claude</h3>
            <span class="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">100% Sincronizado</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">
            O código abaixo reflete <strong>exatamente o estado atual das 2 zonas, clima, litros/minutos de hoje e filtro</strong>. Copie e cole no Claude para diagnosticar qualquer problema!
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="copyClaudePromptAndYaml()" class="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition">
              📋 Copiar p/ Claude
            </button>
            <button onclick="downloadYamlFile()" class="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition">
              💾 Baixar .YAML
            </button>
          </div>
          <textarea id="yaml-editor-box" rows="14" spellcheck="false"
            class="w-full font-mono text-[11px] bg-slate-950 text-emerald-300 p-2.5 rounded-xl border border-slate-800 focus:border-emerald-500 outline-none"
          >${generateStandardYamlFromState(plan)}</textarea>
          <button onclick="applyEditedYamlFromClaude(document.getElementById('yaml-editor-box').value)"
            class="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow transition">
            ✅ Validar & Aplicar Ajustes do Claude
          </button>
          <div id="yaml-validation-feedback"></div>
        </div>

        <div class="${(!isDesktop && AppState.activeTab === "claude") ? "hidden" : "p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5"}">
          <h3 class="text-sm font-bold text-white">🔌 Placa de 8 Relés (3 MVP + 5 Expansão)</h3>
          <div class="space-y-2">
            ${AppState.relays.map(r => `
              <div class="p-2.5 rounded-xl bg-slate-950/90 border ${r.enabled ? 'border-emerald-500/40' : 'border-slate-800'} flex items-center justify-between gap-2">
                <div>
                  <div class="text-xs font-bold text-white">Relé ${r.ch} (GPIO ${r.gpio}) — ${r.name}</div>
                  <div class="text-[11px] text-slate-400">${r.desc}</div>
                </div>
                ${r.ch <= 3 ? `
                  <span class="px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 shrink-0">ATIVO MVP</span>
                ` : `
                  <button onclick="toggleExpansionRelay(${r.ch})" class="px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${r.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">
                    ${r.enabled ? "Habilitado" : "Ativar Slot"}
                  </button>
                `}
              </div>
            `).join("")}
          </div>
        </div>

      </div>
    </div>
  `;
}

// ==============================================================================
// 8. HANDLERS DE ATUALIZAÇÃO PROTEGIDOS PELO CADEADO (🔒)
// ==============================================================================
window.updateZoneCrop = function (zKey, newCropId) {
  if (AppState.configLocked) {
    showToast("🔒 Destrave o cadeado no cabeçalho para trocar a cultura da zona.");
    renderApp();
    return;
  }
  const crop = CROP_CATALOG[newCropId];
  if (!crop) return;
  AppState.zones[zKey].cropId = newCropId;
  AppState.zones[zKey].openLines = crop.defaultLinesOpen;
  if (AppState.zones[zKey].dap > crop.cycleDays) {
    AppState.zones[zKey].dap = Math.round(crop.cycleDays / 2);
  }
  showToast(`🌱 ${AppState.zones[zKey].name} atualizada para ${crop.name}!`);
  renderApp();
};

window.updateZonePlantedDate = function (zKey, newDateStr) {
  if (AppState.configLocked) {
    showToast("🔒 Destrave o cadeado no cabeçalho para alterar a data de plantio.");
    renderApp();
    return;
  }
  if (!newDateStr) return;
  AppState.zones[zKey].plantedDate = newDateStr;
  AppState.autoProgressionMode = true;
  showToast(`📅 Data de plantio atualizada (${newDateStr}). Idade DAP recalculada automaticamente!`);
  renderApp();
};

window.updateZoneDap = function (zKey, newDap) {
  AppState.autoProgressionMode = false;
  AppState.zones[zKey].dap = newDap;
  renderApp();
};

window.toggleViewMode = function () {
  AppState.viewMode = AppState.viewMode === "mobile" ? "desktop" : "mobile";
  renderApp();
};

window.switchTab = function (tab) {
  AppState.activeTab = tab;
  renderApp();
};

window.toggleExpansionRelay = function (ch) {
  if (AppState.configLocked) {
    alert("🔒 Destrave o cadeado no cabeçalho antes de ativar/desativar slots de expansão da placa de 8 relés.");
    return;
  }
  const r = AppState.relays.find(x => x.ch === ch);
  if (r && ch >= 4) {
    r.enabled = !r.enabled;
    r.activeNow = r.enabled;
    showToast(`🔌 Relé ${ch} (${r.name}): ${r.enabled ? "Habilitado na arquitetura!" : "Em espera (Reserva)"}`);
    renderApp();
  }
};

// ==============================================================================
// 9. PERSISTÊNCIA AUTOMÁTICA NO NAVEGADOR (localStorage) + SYNC ENTRE JANELAS
// ==============================================================================
const STORAGE_KEY = "irriga_pro_duo_state_v1";

function savePersistedStateToLocalStorage() {
  try {
    const payload = {
      paused: AppState.paused,
      manualPlusHours: AppState.manualPlusHours,
      wishRainClicks: AppState.wishRainClicks,
      tankLevelPct: AppState.tankLevelPct,
      dailyQuotaMaxLiters: AppState.dailyQuotaMaxLiters,
      filterEfficiencyPct: AppState.filterEfficiencyPct,
      autoProgressionMode: AppState.autoProgressionMode,
      simulatedReferenceDate: AppState.simulatedReferenceDate,
      weather: AppState.weather,
      zones: AppState.zones,
      relays: AppState.relays,
      esp32Ip: AppState.esp32Ip
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (_) {}
}

function loadPersistedStateFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.paused === "boolean") AppState.paused = saved.paused;
    if (typeof saved.manualPlusHours === "number") AppState.manualPlusHours = saved.manualPlusHours;
    if (typeof saved.wishRainClicks === "number") AppState.wishRainClicks = saved.wishRainClicks;
    if (typeof saved.tankLevelPct === "number") AppState.tankLevelPct = saved.tankLevelPct;
    if (typeof saved.dailyQuotaMaxLiters === "number") AppState.dailyQuotaMaxLiters = saved.dailyQuotaMaxLiters;
    if (typeof saved.filterEfficiencyPct === "number") AppState.filterEfficiencyPct = saved.filterEfficiencyPct;
    if (typeof saved.autoProgressionMode === "boolean") AppState.autoProgressionMode = saved.autoProgressionMode;
    if (typeof saved.simulatedReferenceDate === "string") AppState.simulatedReferenceDate = saved.simulatedReferenceDate;
    if (saved.weather && typeof saved.weather === "object") {
      AppState.weather = { ...AppState.weather, ...saved.weather };
    }
    if (saved.zones && saved.zones.zona_1 && saved.zones.zona_2) {
      AppState.zones.zona_1 = { ...AppState.zones.zona_1, ...saved.zones.zona_1 };
      AppState.zones.zona_2 = { ...AppState.zones.zona_2, ...saved.zones.zona_2 };
    }
    if (Array.isArray(saved.relays) && saved.relays.length === 8) {
      AppState.relays = saved.relays;
    }
    if (typeof saved.esp32Ip === "string") AppState.esp32Ip = saved.esp32Ip;
  } catch (_) {}
}

window.resetToFactoryDefaults = function () {
  const ok = confirm("♻️ Deseja restaurar os dados salvos no navegador para o padrão inicial de demonstração (Jerimum defasado em 50 dias)?");
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
};

function renderApp() {
  const plan = computeCognitivePlan();
  savePersistedStateToLocalStorage();

  const root = document.getElementById("app-container");
  if (!root) return;

  const mode = window.IRRIGA_GUI_MODE || AppState.guiMode || "END_USER";
  if (mode === "DEV_GUI") {
    renderDevGuiApp(root, plan);
  } else {
    renderEndUserApp(root, plan);
  }
}

window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEY) {
    loadPersistedStateFromLocalStorage();
    renderApp();
  }
});

window.addEventListener("DOMContentLoaded", () => {
  loadPersistedStateFromLocalStorage();
  // Sempre abre com o cadeado TRAVADO por segurança ao abrir o aplicativo!
  AppState.configLocked = true;
  renderApp();

  // Registra o Service Worker Offline-First para instalação nativa no Android e iPhone
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
});
