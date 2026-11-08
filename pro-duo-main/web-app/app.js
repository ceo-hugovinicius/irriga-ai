/* ============================================================================
 * Irriga.ai Pro-Duo · v1.5.2-Argon — App Simplificado & Humano
 * "Simplicidade de uso sem perda de funcionalidade"
 *
 * Novidades v1.5.2-Argon:
 *   - Fim do "chutômetro" de umidade do solo sem sensor físico: usa Rega Diária
 *     Garantida + Mecanismo de Decisão Inteligente para culturas com restrição
 *     hídrica na reta final (Melancia, Melão, Jerimum, Batata-doce).
 *   - 2 Turnos de Rega por dia: 🌅 Manhã Cedo (04:00–05:30) e 🌇 Fim da Tarde
 *     (16:00–17:30), facilitando a reposição da caixa de 5.000 L pelo poço artesiano.
 *   - Contador "Pedido Real das Plantas vs. Liberado na Cota" (indicador de sede).
 *   - Medição hidráulica direta por Metros de Fita, Espaçamento entre Gotejadores
 *     (cm) e Vazão por Gotejador (L/h).
 *   - "💧 Regar Agora" como Override / Little Treat ("Flex" do agricultor):
 *     botão físico B2 adiciona +1h (30 min Zona 1 + 30 min Zona 2) mesmo acima
 *     da cota, e no PC/celular converte Horas ⇄ Litros em tempo real.
 *   - Separação clara entre "📖 Ver Culturas e Espaçamentos" (consulta segura)
 *     e "🔄 Confirmar Troca de Cultura" (com dupla confirmação).
 * ========================================================================== */
const C = window.IrrigaCore;
const KEY = 'irriga_argon_v1_5_2';

/* ---------------- Estado persistente ---------------- */
let S = carregar();
let deferredPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPwaPrompt = e; render(); });

function novoEstado() {
  const base = C.estadoPadrao();
  base.versao = '1.6.0-argon';
  base.zones[0].crop = null;
  base.zones[1].crop = null;
  return Object.assign(base, {
    historico: [], auditoria: [], pauseLog: [], boostLog: [], chuvaLocal: {}, manual: null,
    weather: { fetched: null, days: [], erro: null }, filtro: { pct: 96 },
    ui: { locked: true, dark: false },
    security: { pin: '1234', enabled: true },
    device: { url: '', online: false, lastSeen: null, status: null, telemetry: null },
    ultimoDiaFechado: C.addDays(hoje(), -1),
  });
}

function migrarZona(z, idx) {
  if (!z.tape_meters || z.tape_meters <= 0) {
    z.tape_meters = Math.round((z.lines_open || 8) * (z.line_length_m || (idx === 0 ? 12.5 : 15))) || (idx === 0 ? 100 : 120);
  }
  if (!z.emitter_spacing_cm || z.emitter_spacing_cm <= 0) {
    z.emitter_spacing_cm = Math.round((z.emitter_spacing_m || 0.30) * 100) || 30;
  }
  if (!z.emitter_flow_lph || z.emitter_flow_lph <= 0) {
    z.emitter_flow_lph = z.emitter_q_lph || 1.2;
  }
  if (!z.restricao_modo) z.restricao_modo = 'auto';
  if (z.crop && (!z.crop.id || !C.CROPS[z.crop.id])) {
    z.crop = null;
  }
  return z;
}

function carregar() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem('irriga_argon_v1_6') || localStorage.getItem('irriga_argon_v1_5');
    if (raw) {
      const st = Object.assign(novoEstado(), JSON.parse(raw));
      st.versao = '1.6.0-argon';
      st.zones = (st.zones || []).map((z, i) => migrarZona(z, i));
      if (!st.windows || !st.windows.dawn_start) {
        st.windows = { dawn_start: '04:00', end_dawn: '05:30', evening: '16:00', evening_hot: '16:30', pulse_max_min: 90, gap_min: 5 };
      }
      if (!st.security) st.security = { pin: '1234', enabled: true };
      st.auditoria = (st.auditoria || []).map((a, idx) => ({
        id: a.id || ('ev_' + (a.ts || Date.now()) + '_' + idx),
        ...a,
      }));
      return st;
    }
  } catch (e) { /* estado novo */ }
  return novoEstado();
}
window.MQTT_CLIENT_ID = 'irriga-web-' + Math.random().toString(16).substring(2, 10);

function salvarLocal() {
  localStorage.setItem(KEY, JSON.stringify(S));
}

let debounceCloudTimer = null;
function agendarSincronizacaoNuvem() {
  if (debounceCloudTimer) clearTimeout(debounceCloudTimer);
  debounceCloudTimer = setTimeout(() => {
    salvarConfigCloud();
    sincronizarEsp32();
  }, 120);
}

function salvar() {
  salvarLocal();
  agendarSincronizacaoNuvem();
}
window.addEventListener('storage', (e) => { if (e.key === KEY) { S = carregar(); render(); } });

function salvarConfigCloud() {
  salvarLocal();
  if (window.MQTT_CLIENT && window.MQTT_CONNECTED) {
    try {
      const cfgPayload = {
        senderId: window.MQTT_CLIENT_ID,
        ts: Date.now(),
        zones: S.zones.map((z) => ({
          id: z.id,
          nome: z.nome,
          crop: z.crop ? {
            id: z.crop.id,
            plantio: z.crop.plantio,
            anterior: z.crop.anterior || null,
          } : null,
          tape_meters: z.tape_meters,
          emitter_spacing_cm: z.emitter_spacing_cm,
          emitter_flow_lph: z.emitter_flow_lph,
          mulch: !!z.mulch,
          fine_pct: z.fine_pct || 0,
          restricao_modo: z.restricao_modo || 'auto',
        })),
        quota: S.quota,
        soil: S.soil,
        site: S.site,
        security: S.security,
        manual: S.manual,
        boost: S.boost,
        pause: S.pause,
        chuvaLocal: S.chuvaLocal,
      };
      const msg = new Paho.MQTT.Message(JSON.stringify(cfgPayload));
      msg.destinationName = MQTT_TOPIC_CONFIG;
      msg.retained = true;
      msg.qos = 1;
      window.MQTT_CLIENT.send(msg);
      console.log('☁️ [MQTT] Configuração retida sincronizada na nuvem!');
    } catch (e) {
      console.warn('Erro ao sincronizar config via MQTT:', e);
    }
  }
}

/* ---------------- Utilidades ---------------- */
function hoje() { return C.isoDate(new Date()); }
const agoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const absTs = (dateStr, min) => new Date(dateStr + 'T00:00:00').getTime() + min * 60000;
const fmtL = (l) => `${Math.round(l).toLocaleString('pt-BR')} L`;
const fmtMin = (m) => {
  const minTotal = Math.max(1, Math.round(m));
  if (minTotal >= 60) {
    const h = Math.floor(minTotal / 60);
    const r = minTotal % 60;
    return r > 0 ? `${h}h ${String(r).padStart(2, '0')}min` : `${h}h`;
  }
  return `${minTotal} min`;
};
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const fmtData = (s) => { const d = new Date(s + 'T12:00:00'); return `${d.getDate()}/${MESES[d.getMonth()]}`; };
const diaSemana = (s) => SEM[new Date(s + 'T12:00:00').getDay()];
const quando = (ts) => {
  const d = new Date(ts), h = C.minToHhmm(d.getHours() * 60 + d.getMinutes()), ds = C.isoDate(d), t = hoje();
  if (ds === t) return `hoje às ${h}`;
  if (ds === C.addDays(t, 1)) return `amanhã às ${h}`;
  return `${diaSemana(ds)} ${fmtData(ds)} às ${h}`;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/** Registra um evento com ID único e metadados para permitir cancelar/deletar depois. */
function audit(origem, texto, tipo = 'info', meta = null) {
  const id = 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  S.auditoria.unshift({ id, ts: Date.now(), origem, texto, tipo, meta });
  S.auditoria = S.auditoria.slice(0, 100);
  salvar();
  return id;
}

/* ---------------- Clima silencioso em segundo plano (Open-Meteo) ---------------- */
async function buscarClima(avisarUsuario = false) {
  const { lat, lon } = S.site;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=et0_fao_evapotranspiration,precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min,wind_speed_10m_max&timezone=America%2FFortaleza&past_days=7&forecast_days=8`;
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { signal: ctl.signal }); const j = await r.json(); const d = j.daily;
    S.weather = { fetched: Date.now(), erro: null, days: d.time.map((t, i) => ({
      date: t, et0: d.et0_fao_evapotranspiration[i] ?? C.climatologia(t).et0, rain: d.precipitation_sum[i] ?? 0,
      rain_prob: d.precipitation_probability_max[i] ?? (t < hoje() ? 100 : 0), tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i], wind: d.wind_speed_10m_max[i] })) };
    salvar();
    if (avisarUsuario) toast('🛰️ Clima atualizado via satélite!');
  } catch (e) {
    S.weather.erro = 'offline';
    if (avisarUsuario) toast('📡 Sem internet: usando clima médio do Seridó.');
  }
  render();
}
const previsao = () => S.weather.days || [];
const climaDo = (dt) => previsao().find((w) => w.date === dt) || C.climatologia(dt);

/* ---------------- Execução e fechamento diário ---------------- */
const pausadoEm = (ts) => S.pauseLog.some((p) => ts >= p.de && ts < (p.ate ?? Infinity));
function fecharDiasPendentes() {
  const alvo = C.addDays(hoje(), -1);
  let d = C.addDays(S.ultimoDiaFechado, 1), n = 0;
  if (C.daysBetween(d, alvo) > 30) d = C.addDays(alvo, -30);
  while (d <= alvo && n++ < 31) {
    const local = S.chuvaLocal[d] || 0;
    const plano = C.planejarDia(S, previsao(), d, local);
    const entregue = S.zones.map(() => 0);
    plano.eventos.forEach((e) => { if (!pausadoEm(absTs(d, e.inicioMin))) entregue[S.zones.findIndex((z) => z.id === e.zona)] += e.litros; });
    const obs = climaDo(d).rain || 0;
    C.fecharDia(S, plano, Math.max(0, obs - local), entregue);
    const total = entregue.reduce((a, b) => a + b, 0);
    S.tank.level_L = Math.max(0, (S.tank.level_L ?? S.tank.capacity) - total);
    S.historico.unshift({
      date: d, litros: entregue, chuva: Math.max(obs, local), local, et0: climaDo(d).et0,
      chuvaAproveitadaL: S.zones.reduce((s, z) => s + C.chuvaEfetiva(Math.max(obs, local)) * z.area_m2, 0),
      pulou: plano.totalL < 1,
    });
    S.historico = S.historico.slice(0, 120);
    S.ultimoDiaFechado = d; d = C.addDays(d, 1);
  }
  if (S.pause.until && Date.parse(S.pause.until) < Date.now() && !S.pause.indefinite) retomar('sistema', true);
  salvar();
}

function planos() {
  const t = hoje();
  const chuvaHojeMm = S.chuvaLocal[t] || 0;
  const pHoje = C.planejarDia(S, previsao(), t, chuvaHojeMm);
  const clone = JSON.parse(JSON.stringify(S));
  C.fecharDia(clone, pHoje, (climaDo(t).rain_prob ?? 0) >= 50 ? (climaDo(t).rain || 0) : 0);
  const am = C.addDays(t, 1);
  const pAmanha = C.planejarDia(clone, previsao(), am, S.chuvaLocal[am] || 0);
  return { pHoje, pAmanha };
}

function linhaDoTempo(P) {
  const t = hoje(), am = C.addDays(t, 1);
  const ev = [
    ...P.pHoje.eventos.map((e) => ({ ...e, ts: absTs(t, e.inicioMin), te: absTs(t, e.fimMin) })),
    ...P.pAmanha.eventos.map((e) => ({ ...e, ts: absTs(am, e.inicioMin), te: absTs(am, e.fimMin) })),
  ];
  if (S.manual && S.manual.fim > Date.now()) ev.push(...S.manual.eventos);
  return ev.sort((a, b) => a.ts - b.ts);
}

function regandoAgora(ev) {
  const n = Date.now();
  return ev.find((e) => e.ts <= n && e.te > n && (e.manual || !pausadoEm(e.ts))) || null;
}

const manualLitrosHoje = () => (S.manual && S.manual.dia === hoje() ? (S.manual.litrosTotal || 0) : 0);

const usadoHoje = () => {
  const P = planos(), t = hoje(), n = Date.now();
  let l = P.pHoje.eventos.filter((e) => absTs(t, e.inicioMin) < n && !pausadoEm(absTs(t, e.inicioMin)))
    .reduce((s, e) => s + e.litros * Math.min(1, (n - absTs(t, e.inicioMin)) / (e.minutos * 60000)), 0);
  l += manualLitrosHoje();
  return l;
};

/* ---------------- Os 4 Controles Rápidos + Override Manual ("Flex") ---------------- */
function pausar(horas, origem = 'app') {
  const ate = horas ? Date.now() + horas * 3600e3 : null;
  const aberta = S.pauseLog.find((p) => p.ate === null || p.ate > Date.now());
  if (aberta) aberta.ate = ate; else S.pauseLog.push({ de: Date.now(), ate });
  S.pause = { until: ate ? new Date(ate).toISOString() : null, indefinite: !horas, origem };
  if (S.manual) S.manual.fim = Date.now();
  audit(origem, horas ? `⏸️ Pausou regas por ${horas} h` : '⏸️ Pausou regas sem prazo', 'pausa', { horas });
  enviarComando({ acao: 'pausar', horas: horas || 0 });
  salvarConfigCloud();
  sincronizarEsp32();
  salvarLocal();
  render();
}

function retomar(origem = 'app', silencioso) {
  S.pauseLog.forEach((p) => { if (p.ate === null || p.ate > Date.now()) p.ate = Date.now(); });
  S.pause = { until: null, indefinite: false, origem: null };
  if (!silencioso) audit(origem, '▶️ Retomou o piloto automático', 'retomar');
  enviarComando({ acao: 'retomar' });
  salvarConfigCloud();
  sincronizarEsp32();
  salvarLocal();
  render();
}
const pausado = () => S.pause.indefinite || (S.pause.until && Date.parse(S.pause.until) > Date.now());

/**
 * OVERRIDE MANUAL ("Little Treat / Flex"):
 * Liga a rega a qualquer momento por X minutos ou Y litros em 1 ou 2 zonas.
 * É contabilizado no painel de água do dia, mas PODE derramar água mesmo quando
 * a cota diária já foi atingida!
 */
function acionarOverrideRega({ zonasIdx = [0, 1], minutosPorZona = null, litrosPorZona = null, origem = 'app', rotulo = null }) {
  if (pausado()) retomar(origem, true);
  const agora = Date.now();
  const baseStart = (S.manual && S.manual.fim > agora) ? S.manual.fim : agora;
  let cursor = baseStart;
  const novosEventos = [];

  zonasIdx.forEach((idx) => {
    const z = S.zones[idx];
    if (!z) return;
    const vazLpm = Math.max(0.1, C.vazaoZona(z, S.soil));
    let min = 30;
    let lit = 30 * vazLpm;
    if (minutosPorZona && minutosPorZona[idx] > 0) {
      min = minutosPorZona[idx];
      lit = min * vazLpm;
    } else if (litrosPorZona && litrosPorZona[idx] > 0) {
      lit = litrosPorZona[idx];
      min = lit / vazLpm;
    }
    novosEventos.push({
      zona: z.id,
      litros: lit,
      minutos: min,
      ts: cursor,
      te: cursor + min * 60000,
      manual: true,
    });
    cursor += (min + 1) * 60000;
  });

  const addLitros = novosEventos.reduce((s, e) => s + e.litros, 0);
  const addMin = novosEventos.reduce((s, e) => s + e.minutos, 0);

  if (S.manual && S.manual.dia === hoje() && S.manual.fim > agora) {
    S.manual.eventos.push(...novosEventos);
    S.manual.litrosTotal += addLitros;
    S.manual.fim = cursor;
  } else {
    const jaGastoHoje = (S.manual && S.manual.dia === hoje()) ? (S.manual.litrosTotal || 0) : 0;
    S.manual = {
      dia: hoje(),
      eventos: novosEventos,
      litrosTotal: jaGastoHoje + addLitros,
      ultimoAddLitros: addLitros,
      fim: cursor,
    };
  }

  S.tank.level_L = Math.max(0, (S.tank.level_L ?? S.tank.capacity) - addLitros);
  const descZonas = novosEventos.map((e) => `Zona ${e.zona}: ${fmtMin(e.minutos)} (${fmtL(e.litros)})`).join(' + ');
  const msgAudit = rotulo
    ? `${rotulo}: ${descZonas}`
    : `💧 Override Regar Agora: ${descZonas}`;

  audit(origem, msgAudit, 'regar_agora', { litrosTotal: addLitros, minutosTotal: addMin });
  enviarComando({
    acao: 'override_regar_agora',
    origem,
    zonas: novosEventos.map((e) => ({ zona: e.zona, minutos: Math.round(e.minutos), litros: Math.round(e.litros) })),
  });
  salvarConfigCloud();
  sincronizarEsp32();
  return { addLitros, addMin, eventos: novosEventos };
}

/**
 * Botão Físico B2 ("Flex" de +1 Hora = 30 min Zona 1 + 30 min Zona 2):
 * Cada aperto adiciona +1h de água (30 min em cada zona), mesmo acima da cota!
 */
function botaoFisicoFlex1Hora(origem = 'fisico') {
  const res = acionarOverrideRega({
    zonasIdx: [0, 1],
    minutosPorZona: { 0: 30, 1: 30 },
    origem,
    rotulo: '🔥 Botão +1h Flex (30 min Z1 + 30 min Z2)',
  });
  toast(`🔥 +1 hora de rega ativada (30 min Zona 1 + 30 min Zona 2 = ${fmtL(res.addLitros)})!`);
}

/* Mantido para compatibilidade caso chamado diretamente */
function regarAgora(extraMm = 0, zonasSel, origem = 'app') {
  if (origem === 'fisico') {
    botaoFisicoFlex1Hora('fisico');
    return;
  }
  const alvos = Array.isArray(zonasSel) && zonasSel.length ? zonasSel : [0, 1];
  const minMap = {};
  alvos.forEach((idx) => { minMap[idx] = 30; });
  acionarOverrideRega({ zonasIdx: alvos, minutosPorZona: minMap, origem });
}

function cancelarRegaManual(ev) {
  if (ev) ev.stopPropagation();
  if (S.manual) {
    S.tank.level_L = Math.min(S.tank.capacity, (S.tank.level_L || 0) + (S.manual.litrosTotal || 0));
    S.manual = null;
  }
  S.auditoria = S.auditoria.filter((a) => a.tipo !== 'regar_agora');
  enviarComando({ acao: 'parar_rega' });
  salvarConfigCloud();
  sincronizarEsp32();
  salvarLocal(); render();
  toast('✕ Rega manual cancelada e válvulas fechadas!');
}

function removerDaFila(zonaId) {
  if (S.ui.locked) {
    solicitarDestravamentoComPin(() => removerDaFila(zonaId));
    return;
  }
  const telemetry = S.device?.telemetry;
  if (telemetry && telemetry.active_zone === zonaId) {
    cancelarRegaManual();
    return;
  }
  if (S.manual && Array.isArray(S.manual.eventos)) {
    S.manual.eventos = S.manual.eventos.filter((e) => e.zona !== zonaId);
    if (!S.manual.eventos.length) S.manual = null;
  }
  enviarComando({ acao: 'remover_fila', zona: zonaId });
  salvarConfigCloud();
  sincronizarEsp32();
  salvarLocal(); render();
  toast(`✕ Zona ${zonaId} removida da fila de rega!`);
}

function cancelarBoost(ev) {
  if (ev) ev.stopPropagation();
  S.boost = { pct: 0, until: null };
  S.auditoria = S.auditoria.filter((a) => a.tipo !== 'boost');
  enviarComando({ acao: 'boost', pct: 0 });
  salvarConfigCloud();
  sincronizarEsp32();
  salvarLocal(); render();
  toast('✕ Reforço "Era bom chover" cancelado!');
}

function choveuAqui(mm, origem = 'app') {
  const t = hoje();
  S.chuvaLocal[t] = (S.chuvaLocal[t] || 0) + mm;
  const ef = C.chuvaEfetiva(mm);
  S.zones.forEach((z) => { z.Dr_mm = Math.max(0, (z.Dr_mm || 0) - ef); });
  audit(origem, `☔ Choveu aqui: +${mm} mm registrados`, 'chuva', { date: t, mm, ef });
  enviarComando({ acao: 'chuva_local', mm });
  salvarConfigCloud();
  sincronizarEsp32();
  salvarLocal(); render();
}

function cancelarChuvaHoje(ev) {
  if (ev) ev.stopPropagation();
  const t = hoje();
  const mm = S.chuvaLocal[t] || 0;
  if (mm > 0) {
    const ef = C.chuvaEfetiva(mm);
    S.zones.forEach((z) => { z.Dr_mm = (z.Dr_mm || 0) + ef; });
    delete S.chuvaLocal[t];
  }
  S.auditoria = S.auditoria.filter((a) => !(a.tipo === 'chuva' && a.meta?.date === t));
  salvarConfigCloud();
  sincronizarEsp32();
  salvarLocal(); render();
  toast('✕ Registro de chuva de hoje desfeito!');
}

/** Altera o modo de decisão da Restrição Hídrica de Reta Final direto no cartão da zona. */
function mudarModoRestricao(zoneIdx, novoModo) {
  S.zones[zoneIdx].restricao_modo = novoModo;
  const nomes = {
    auto: 'Automático (Clima/Chuva)',
    normal_maturacao: 'Redução Normal de Maturação',
    corte_forte: 'Corte Forte (Só Pulso da Manhã)',
    corte_total_hoje: 'Corte Total Hoje (0 L)',
  };
  audit('app', `🍯 Zona ${S.zones[zoneIdx].id}: restrição hídrica em modo "${nomes[novoModo] || novoModo}"`);
  salvarConfigCloud();
  sincronizarEsp32();
  salvarLocal();
  render();
  toast(`🍯 Restrição da Zona ${S.zones[zoneIdx].id}: ${nomes[novoModo]}`);
}

/** Cancela e apaga qualquer evento registrado na lista (revertendo seu efeito se for ativo). */
function cancelarEventoRegistrado(id) {
  const idx = S.auditoria.findIndex((a) => a.id === id);
  if (idx < 0) return;
  const item = S.auditoria[idx];

  if (item.tipo === 'pausa' && pausado()) {
    S.pause = { until: null, indefinite: false, origem: null };
    S.pauseLog.forEach((p) => { if (p.ate === null || p.ate > Date.now()) p.ate = Date.now(); });
  } else if (item.tipo === 'boost' && S.boost?.pct > 0) {
    S.boost = { pct: 0, until: null };
  } else if (item.tipo === 'chuva' && item.meta) {
    const dt = item.meta.date || hoje();
    const mm = item.meta.mm || 0;
    if (S.chuvaLocal[dt]) {
      S.chuvaLocal[dt] = Math.max(0, S.chuvaLocal[dt] - mm);
      if (S.chuvaLocal[dt] === 0) delete S.chuvaLocal[dt];
    }
    const ef = item.meta.ef ?? C.chuvaEfetiva(mm);
    S.zones.forEach((z) => { z.Dr_mm = (z.Dr_mm || 0) + ef; });
  } else if (item.tipo === 'regar_agora') {
    if (item.meta?.litrosTotal) {
      S.tank.level_L = Math.min(S.tank.capacity, (S.tank.level_L || 0) + item.meta.litrosTotal);
      if (S.manual) {
        S.manual.litrosTotal = Math.max(0, (S.manual.litrosTotal || 0) - item.meta.litrosTotal);
        if (S.manual.litrosTotal <= 1) S.manual = null;
      }
    } else if (S.manual) {
      S.manual = null;
    }
  }

  S.auditoria.splice(idx, 1);
  salvar();
  render();
  toast('🗑️ Evento cancelado e removido!');
}

function limparHistoricoEventos() {
  S.auditoria = [];
  salvar();
  render();
  toast('🗑️ Histórico de eventos limpo!');
}

/* ---------------- Conexão Nuvem MQTT (HiveMQ) & ESP32 ---------------- */
const MQTT_TOPIC_CMD = 'irriga-ai/ceo-hugovinicius/cmd';
const MQTT_TOPIC_STATUS = 'irriga-ai/ceo-hugovinicius/status';
const MQTT_TOPIC_PLAN = 'irriga-ai/ceo-hugovinicius/plan';
const MQTT_TOPIC_CONFIG = 'irriga-ai/ceo-hugovinicius/config';
let mqttReconectarTimer = null;

function iniciarMqttNuvem() {
  if (typeof Paho === 'undefined' || !Paho.MQTT) {
    console.warn('Paho MQTT não disponível');
    return;
  }
  if (window.MQTT_CLIENT && (window.MQTT_CONNECTED || window.MQTT_CONNECTING)) return;

  if (!window.MQTT_CLIENT_ID) {
    window.MQTT_CLIENT_ID = 'irriga-web-' + Math.random().toString(16).substring(2, 10);
  }
  const client = new Paho.MQTT.Client('broker.hivemq.com', 8884, window.MQTT_CLIENT_ID);
  window.MQTT_CLIENT = client;
  window.MQTT_CONNECTING = true;

  client.onConnectionLost = (resp) => {
    window.MQTT_CONNECTED = false;
    window.MQTT_CONNECTING = false;
    console.log('☁️ [MQTT] Conexão com a nuvem perdida. Reconectando em 4s...');
    if (!mqttReconectarTimer) {
      mqttReconectarTimer = setTimeout(() => {
        mqttReconectarTimer = null;
        iniciarMqttNuvem();
      }, 4000);
    }
    render();
  };

  client.onMessageArrived = (message) => {
    try {
      const data = JSON.parse(message.payloadString);
      if (message.destinationName === MQTT_TOPIC_STATUS) {
        console.log('📩 [MQTT] Telemetria recebida do ESP32:', data);
        S.device = { ...S.device, online: true, lastSeen: Date.now(), status: data, telemetry: data };
        if (typeof data.tank_L === 'number') S.tank.level_L = data.tank_L;
        if (typeof data.filter_pct === 'number') S.filtro.pct = data.filter_pct;
        salvarLocal();
        render();
      } else if (message.destinationName === MQTT_TOPIC_CONFIG) {
        if (data && data.senderId && data.senderId === window.MQTT_CLIENT_ID) {
          // Ignora o próprio eco enviado por esta aba
          return;
        }
        console.log('🔄 [MQTT] Configuração compartilhada recebida da nuvem:', data);
        if (data && Array.isArray(data.zones)) {
          data.zones.forEach((remoteZ, idx) => {
            if (S.zones[idx]) {
              S.zones[idx].crop = remoteZ.crop || null;
              if (remoteZ.tape_meters) S.zones[idx].tape_meters = remoteZ.tape_meters;
              if (remoteZ.emitter_spacing_cm) S.zones[idx].emitter_spacing_cm = remoteZ.emitter_spacing_cm;
              if (remoteZ.emitter_flow_lph) S.zones[idx].emitter_flow_lph = remoteZ.emitter_flow_lph;
              if (typeof remoteZ.mulch === 'boolean') S.zones[idx].mulch = remoteZ.mulch;
              if (typeof remoteZ.fine_pct === 'number') S.zones[idx].fine_pct = remoteZ.fine_pct;
              if (remoteZ.restricao_modo) S.zones[idx].restricao_modo = remoteZ.restricao_modo;
            }
          });
          if (data.quota) S.quota = { ...S.quota, ...data.quota };
          if (data.soil) S.soil = data.soil;
          if (data.site) S.site = { ...S.site, ...data.site };
          if (data.security) S.security = { ...S.security, ...data.security };
          if (data.hasOwnProperty('manual')) S.manual = data.manual;
          if (data.boost) S.boost = { ...S.boost, ...data.boost };
          if (data.pause) S.pause = { ...S.pause, ...data.pause };
          if (data.chuvaLocal) S.chuvaLocal = { ...S.chuvaLocal, ...data.chuvaLocal };
          salvarLocal();
          render();
        }
      }
    } catch (e) {
      console.error('Erro ao ler mensagem MQTT:', e);
    }
  };

  client.connect({
    useSSL: true,
    timeout: 5,
    keepAliveInterval: 30,
    cleanSession: true,
    onSuccess: () => {
      window.MQTT_CONNECTED = true;
      window.MQTT_CONNECTING = false;
      console.log('✅ [MQTT] WebApp conectado com sucesso à nuvem HiveMQ!');
      client.subscribe(MQTT_TOPIC_STATUS);
      client.subscribe(MQTT_TOPIC_CONFIG);
      // Envia o plano diário atual para o ESP32 assim que conecta
      setTimeout(() => {
        try {
          const planMsg = new Paho.MQTT.Message(JSON.stringify(compilarPacoteEsp32()));
          planMsg.destinationName = MQTT_TOPIC_PLAN;
          planMsg.qos = 1;
          client.send(planMsg);
        } catch (e) {}
      }, 1000);
      render();
    },
    onFailure: (err) => {
      window.MQTT_CONNECTED = false;
      window.MQTT_CONNECTING = false;
      console.warn('⚠️ [MQTT] Falha na conexão com a nuvem:', err);
      if (!mqttReconectarTimer) {
        mqttReconectarTimer = setTimeout(() => {
          mqttReconectarTimer = null;
          iniciarMqttNuvem();
        }, 5000);
      }
      render();
    }
  });
}

async function enviarComando(cmd) {
  salvar(); render();
  // 1. Envia via Nuvem MQTT (chega em qualquer lugar do mundo em ~0.1s)
  if (window.MQTT_CLIENT && window.MQTT_CONNECTED) {
    try {
      const msg = new Paho.MQTT.Message(JSON.stringify(cmd));
      msg.destinationName = MQTT_TOPIC_CMD;
      msg.qos = 1;
      window.MQTT_CLIENT.send(msg);
      console.log('☁️ [MQTT] Comando enviado para o ESP32 via nuvem:', cmd);
    } catch (e) {
      console.warn('Erro ao despachar comando MQTT:', e);
    }
  }
  // 2. Envia via HTTP local (caso configurado IP manual)
  if (S.device.url) {
    try {
      await fetch(S.device.url.replace(/\/$/, '') + '/api/cmd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd)
      });
    } catch (e) { /* silencioso offline */ }
  }
}

function compilarPacoteEsp32() {
  return {
    v: 3, soil_taw_mm_m: C.SOLOS[S.soil].taw_mm_m, soil_wet_m: C.SOLOS[S.soil].faixa_molhada_m,
    quota_L: S.quota.daily_L, reserve_pct: S.tank.reserve_pct, tank_L: S.tank.capacity,
    dawn_start: S.windows.dawn_start || '04:00', end_dawn: S.windows.end_dawn || '05:30',
    evening: S.windows.evening || '16:00', pulse_max: S.windows.pulse_max_min,
    zones: S.zones.map((z) => {
      const c = z.crop && C.CROPS[z.crop.id]; const g = C.geometria(z, S.soil);
      return {
        id: z.id, on: !!(z.enabled && c), area: z.area_m2,
        tape_m: g.metros, spacing_cm: g.espacamentoCm, emitter_lph: g.vazaoFuroLph,
        flow_lpm: +C.vazaoZona(z, S.soil).toFixed(2),
        plant: z.crop ? z.crop.plantio : null, days: c ? c.dias : null, kc: c ? c.kc : null,
        mulch: !!z.mulch, fine: z.fine_pct || 0, restricao_modo: z.restricao_modo || 'auto',
      };
    }),
    weather: previsao().filter((w) => w.date >= hoje()).slice(0, 7).map((w) => [w.date, +w.et0.toFixed(2), +(w.rain || 0).toFixed(1), w.rain_prob || 0]),
  };
}

async function sincronizarEsp32() {
  // Se estiver conectado via MQTT, o status já é atualizado por evento em tempo real
  if (window.MQTT_CLIENT && window.MQTT_CONNECTED) {
    try {
      const planMsg = new Paho.MQTT.Message(JSON.stringify(compilarPacoteEsp32()));
      planMsg.destinationName = MQTT_TOPIC_PLAN;
      planMsg.qos = 1;
      window.MQTT_CLIENT.send(planMsg);
    } catch (e) {}
  }
  if (!S.device.url) return;
  const base = S.device.url.replace(/\/$/, '');
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 2500);
    const st = await (await fetch(base + '/api/status', { signal: ctl.signal })).json();
    S.device = { ...S.device, online: true, lastSeen: Date.now(), status: st };
    if (typeof st.tank_L === 'number') S.tank.level_L = st.tank_L;
    if (typeof st.filter_pct === 'number') S.filtro.pct = st.filter_pct;
    await fetch(base + '/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(compilarPacoteEsp32()) });
  } catch (e) { if (!window.MQTT_CONNECTED) S.device.online = false; }
  salvar();
}

/* ============================================================================
 * LUZES DE ESPIA ENXUTAS (ESTILO PAINEL DE CARRO — CLICÁVEIS MESMO TRAVADO)
 * ========================================================================== */
function gerarLuzesEspia(P) {
  const espias = [];
  const w = P.pHoje.clima || climaDo(hoje());
  const tmax = w.tmax ?? 33.5;
  const wind = w.wind ?? 22.0;

  // 1. Calor forte (só acende se >= 31.5 °C)
  if (tmax >= 31.5) {
    const calorPct = Math.min(20, Math.max(5, Math.round((tmax - 30) * 4.5)));
    espias.push({
      id: 'calor',
      cor: calorPct >= 15 ? 'amber' : 'blue',
      ic: '☀️',
      curto: `Calor forte +${calorPct}%`,
      titulo: `☀️ Calor forte hoje (+${calorPct}% de demanda)`,
      resumo: `A máxima hoje chega a <b>${tmax.toFixed(1)} °C</b>. As plantas transpiram cerca de <b>+${calorPct}%</b> a mais que num dia ameno.`,
      detalhe: `O sistema divide a água em 2 turnos: <b>60% de manhã cedo (04:00–05:30)</b> para atravessar o calor do dia e <b>40% no fim da tarde (após as 16:30)</b> quando a fita preta já esfriou.`,
    });
  }

  // 2. Vento seco (só acende se >= 19 km/h)
  if (wind >= 19) {
    const ventoPct = wind >= 26 ? 15 : 10;
    espias.push({
      id: 'vento',
      cor: 'blue',
      ic: '💨',
      curto: `Vento seco +${ventoPct}%`,
      titulo: `💨 Vento seco (${Math.round(wind)} km/h · +${ventoPct}%)`,
      resumo: `Vento de <b>${Math.round(wind)} km/h</b> acelera a evaporação na superfície do canteiro.`,
      detalhe: `Como regamos por gotejamento direto no pé da planta às 04:00 da manhã e às 16:00 da tarde, o vento não desvia o jato d'água.`,
    });
  }

  // 3. Limite de cota atingido!! (só acende se o pedido real superou a cota ou override ultrapassou)
  const planoRef = P.pHoje;
  const gastoComOverride = planoRef.totalL + manualLitrosHoje();
  if (planoRef.passandoSede || gastoComOverride > S.quota.daily_L) {
    const cortes = planoRef.porZona.filter((z) => z.cortePct > 1).map((z) => `Zona ${z.zona} (−${Math.round(z.cortePct)}%)`).join(', ');
    espias.push({
      id: 'cota',
      cor: 'red',
      ic: '🚨',
      curto: 'Limite de cota atingido!!',
      titulo: '🚨 Limite de cota diária atingido!!',
      resumo: planoRef.passandoSede
        ? `As plantas pedem <b>${fmtL(planoRef.pedidoRealL)}</b> hoje, mas a cota trava em <b>${fmtL(S.quota.daily_L)}</b> (faltam <b>${fmtL(planoRef.deficitSedeL)}</b>).`
        : `Com a rega manual (override), o volume de hoje chegou a <b>${fmtL(gastoComOverride)}</b> (cota de ${fmtL(S.quota.daily_L)}).`,
      detalhe: planoRef.passandoSede
        ? `O Guardião da Água priorizou a cultura na fase mais sensível${cortes ? ` (${cortes})` : ''}. Se o poço artesiano permitir, você pode subir a cota diária em Ajustes.`
        : `O override manual ("Regar Agora") tem permissão para entregar água extra mesmo com a cota cheia.`,
      acao: ['Ajustar cota diária', 'fecharModal();abrirAjustes();'],
    });
  }

  // 4. Janela elástica 2 turnos ativada
  if (planoRef.eventos.length > 0) {
    const evM = planoRef.turnoManha?.eventos || [];
    const evT = planoRef.turnoTarde?.eventos || [];
    const txtM = evM.length ? `Manhã ${C.minToHhmm(evM[0].inicioMin)}–${C.minToHhmm(evM[evM.length - 1].fimMin)}` : '';
    const txtT = evT.length ? `Tarde ${C.minToHhmm(evT[0].inicioMin)}–${C.minToHhmm(evT[evT.length - 1].fimMin)}` : '';
    espias.push({
      id: 'janela_elastica',
      cor: 'violet',
      ic: '🌅',
      curto: 'Janela elástica ativada',
      titulo: '🌅 Janela Elástica em 2 Turnos (Manhã + Tarde)',
      resumo: `Rega dividida em 2 partes: <b>${[txtM, txtT].filter(Boolean).join(' · ')}</b>.`,
      detalhe: `Dividir a água entre o começo da manhã (04:00–05:30) e o fim da tarde (16:00–17:30) mantém as plantas frescas o dia inteiro e dá tempo de sobra para o <b>poço artesiano repor a caixa de 5.000 L</b>!`,
    });
  }

  if (S.filtro.pct < 80) {
    espias.push({
      id: 'filtro',
      cor: S.filtro.pct < 50 ? 'red' : 'amber',
      ic: '🧽',
      curto: `Limpar filtro (${Math.round(S.filtro.pct)}%)`,
      titulo: '🧽 Filtro 120 Mesh precisa de limpeza',
      resumo: `A passagem de água no filtro está em <b>${Math.round(S.filtro.pct)}%</b> do normal.`,
      detalhe: `Abra o copo do filtro, lave os discos em água corrente e toque no botão abaixo.`,
      acao: ['Já lavei o filtro (100%)', 'S.filtro.pct=100;audit("app","🧽 Filtro limpo (100%)");salvar();render();fecharModal();toast("🧽 Filtro restaurado para 100%!");'],
    });
  }

  if (espias.length === 0) {
    espias.push({
      id: 'tudo_ok',
      cor: 'green',
      ic: '✅',
      curto: 'Clima ameno · Tudo em ordem',
      titulo: '✅ Clima ameno e sistema em ordem',
      resumo: 'Nenhum alerta de calor extremo, vento forte ou limite de cota neste momento.',
      detalhe: 'Os 2 turnos diários (manhã cedo e fim da tarde) seguem programados normalmente.',
    });
  }

  window.ULTIMAS_ESPIAS = espias;
  return espias;
}

function renderFilaIrrigacao(agora, ev) {
  const telemetry = S.device?.telemetry;
  const activeZoneId = (telemetry && typeof telemetry.active_zone === 'number') ? telemetry.active_zone : (agora ? agora.zona : 0);
  const activeRemL = (telemetry && typeof telemetry.active_rem_L === 'number') ? telemetry.active_rem_L : (agora ? Math.round(agora.litrosRestantes || agora.litros || 0) : 0);
  const queueZ1 = (telemetry && typeof telemetry.queue_z1_L === 'number') ? telemetry.queue_z1_L : 0;
  const queueZ2 = (telemetry && typeof telemetry.queue_z2_L === 'number') ? telemetry.queue_z2_L : 0;

  const itens = [];

  // 1. Zona ativa no momento
  if (activeZoneId > 0) {
    const zObj = S.zones.find((z) => z.id === activeZoneId);
    const nomeZ = zObj ? zObj.nome.split('—')[0].trim() : `Zona ${activeZoneId}`;
    const cropNome = zObj?.crop && C.CROPS[zObj.crop.id] ? `${C.CROPS[zObj.crop.id].emoji} ${C.CROPS[zObj.crop.id].nome}` : '🟫 Canteiro livre';
    itens.push({
      tipo: 'ativa',
      zona: activeZoneId,
      titulo: `${nomeZ} · ${cropNome}`,
      sub: `Em irrigação agora · Restam ~${fmtL(activeRemL)}`,
      badge: '💧 Regando',
      badgeClass: 'blue',
      acaoBtn: '✕ Parar',
      btnClass: 'red',
      onclick: 'cancelarRegaManual(event)',
    });
  }

  // 2. Fila do ESP32 (Override / Fila)
  const filaEsp = [
    { id: 1, litros: Math.round(queueZ1) },
    { id: 2, litros: Math.round(queueZ2) },
  ];
  filaEsp.forEach((f) => {
    if (f.litros >= 2 && f.id !== activeZoneId) {
      const zObj = S.zones.find((z) => z.id === f.id);
      const nomeZ = zObj ? zObj.nome.split('—')[0].trim() : `Zona ${f.id}`;
      const cropNome = zObj?.crop && C.CROPS[zObj.crop.id] ? `${C.CROPS[zObj.crop.id].emoji} ${C.CROPS[zObj.crop.id].nome}` : '🟫 Canteiro';
      itens.push({
        tipo: 'fila',
        zona: f.id,
        titulo: `${nomeZ} · ${cropNome}`,
        sub: `Na fila (aguardando vez) · Volume: ${fmtL(f.litros)}`,
        badge: '⏳ Na Fila',
        badgeClass: 'amber',
        acaoBtn: '✕ Cancelar',
        btnClass: '',
        onclick: `removerDaFila(${f.id})`,
      });
    }
  });

  // 3. Se não houver nada irrigando nem na fila do override, mostra os próximos turnos automáticos
  if (!itens.length) {
    const horaAgoraMin = new Date().getHours() * 60 + new Date().getMinutes();
    const manhaMin = C.hhmmToMin(S.windows?.dawn_start || '04:00');
    const tardeMin = C.hhmmToMin(S.windows?.evening || '16:00');

    if (horaAgoraMin < manhaMin) {
      itens.push({
        tipo: 'turno',
        titulo: `🌅 Turno da Manhã Cedo (${S.windows?.dawn_start || '04:00'})`,
        sub: 'Programado pelo Piloto Automático',
        badge: 'Agendado',
        badgeClass: 'green',
      });
    }
    if (horaAgoraMin < tardeMin) {
      itens.push({
        tipo: 'turno',
        titulo: `🌇 Turno do Fim de Tarde (${S.windows?.evening || '16:00'})`,
        sub: 'Programado pelo Piloto Automático',
        badge: 'Agendado',
        badgeClass: 'green',
      });
    }
  }

  return `
    <section class="card" style="margin-bottom:16px;border-left:4px solid ${activeZoneId > 0 ? 'var(--blue)' : 'var(--green)'}">
      <div class="row between" style="margin-bottom:10px">
        <div class="row" style="gap:8px;align-items:center">
          <span style="font-size:18px">📋</span>
          <div>
            <div class="t14 b">Fila de Irrigação</div>
            <div class="t12 mute">${activeZoneId > 0 ? 'Válvula mestra aberta · Irrigando em sequência' : 'Piloto automático em prontidão'}</div>
          </div>
        </div>
        ${activeZoneId > 0 ? '<span class="pill blue"><span class="live"></span>Irrigando</span>' : '<span class="pill green">Pronto</span>'}
      </div>

      <div style="display:grid;gap:8px">
        ${itens.length ? itens.map((it) => `
          <div class="card" style="padding:10px 14px;background:var(--sub);border:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:10px">
            <div style="flex:1;min-width:0">
              <div class="row" style="gap:6px;align-items:center;flex-wrap:wrap">
                <span class="pill ${it.badgeClass}" style="font-size:11px;padding:2px 6px">${it.badge}</span>
                <span class="t13 b" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.titulo)}</span>
              </div>
              <div class="t12 mute" style="margin-top:3px">${esc(it.sub)}</div>
            </div>
            ${it.acaoBtn ? `
              <button class="btn sm ${it.btnClass}" style="padding:6px 12px;font-size:12px;white-space:nowrap" onclick="${it.onclick}">
                ${esc(it.acaoBtn)}
              </button>
            ` : ''}
          </div>
        `).join('') : `
          <div class="t13 mute" style="padding:4px 0">Todos os turnos de hoje já foram concluídos com sucesso.</div>
        `}
      </div>
    </section>
  `;
}

/* ---------------- Renderização Principal ---------------- */
function render() {
  document.documentElement.classList.toggle('dark', !!S.ui.dark);
  const P = planos();
  const ev = linhaDoTempo(P);
  const agora = regandoAgora(ev);
  const proxima = ev.find((e) => e.ts > Date.now() && (e.manual || !pausadoEm(e.ts)));
  const semana = C.projetarSemana(S, previsao(), hoje());
  const usado = usadoHoje();
  const espias = gerarLuzesEspia(P);

  const app = document.getElementById('app');
  app.innerHTML = `
    ${renderCabecalho()}
    ${renderHero(P, agora, proxima, semana, usado, espias)}
    ${renderQuatroBotoes(agora)}
    ${renderFilaIrrigacao(agora, ev)}
    <section class="zones-grid">
      ${S.zones.map((z, i) => renderCardZona(z, i, P, ev, agora)).join('')}
    </section>
    <section class="bottom-grid">
      ${renderSafraERotacao(P)}
      ${renderEventosRegistrados()}
    </section>
    <p class="mute t12" style="text-align:center;margin-top:4px">
      Irriga.ai Pro-Duo · <b>v1.6.0-Argon</b> · <a href="./dev-gui.html" style="color:var(--blue);font-weight:750;text-decoration:none">🛠️ Bancada de Testes (Dev-GUI)</a>
    </p>
  `;
}

function renderCabecalho() {
  return `<header class="top">
    <div class="brand-box">
      <div class="brand-logo">🌱</div>
      <div>
        <div class="brand-title">
          <span>Irriga.ai</span>
          <span class="pill green" style="font-size:11px;padding:2px 8px">1.6.0-Argon</span>
        </div>
        <div class="brand-sub">📍 ${esc(S.site.nome)}</div>
      </div>
    </div>
    <div class="top-actions">
      <span class="pill ${window.MQTT_CONNECTED ? 'green' : 'amber'}" style="font-size:11px;padding:3px 8px;display:inline-flex;align-items:center;gap:4px" title="${window.MQTT_CONNECTED ? 'Conectado à Nuvem em Tempo Real' : 'Conectando à Nuvem...'}">
        <span class="live" style="width:6px;height:6px;background:currentColor"></span>
        <span>${window.MQTT_CONNECTED ? 'Nuvem' : 'Conectando'}</span>
      </span>
      <button class="top-btn ${S.ui.locked ? 'locked' : 'unlocked'}" onclick="alternarCadeado()" title="${S.ui.locked ? 'Toque para destravar com o PIN' : 'Toque para travar'}">
        <span>${S.ui.locked ? '🔒 Travado' : '🔓 Destravado'}</span>
      </button>
      <button class="top-btn" onclick="abrirClaude()" title="Consultar ou enviar arquivo para o Claude">
        <span>🤖 Claude</span>
      </button>
      <button class="top-btn" onclick="abrirAjustes()" title="Ajustes gerais do sistema">
        <span>⚙️ Ajustes</span>
      </button>
    </div>
  </header>`;
}

function renderHero(P, agora, proxima, semana, usado, espias) {
  let dotCor = 'var(--green)', titulo, subtitulo;
  if (S.filtro.pct < 50) {
    dotCor = 'var(--red)';
    titulo = '🛑 Rega parada: limpar filtro';
    subtitulo = 'Lave os discos do filtro 120 Mesh para retomar.';
  } else if (agora) {
    dotCor = 'var(--blue)';
    const z = S.zones.find((x) => x.id === agora.zona);
    titulo = `💧 Regando ${esc(z.nome.split('—')[0].trim())} agora ${agora.manual ? '(Override Manual)' : ''}`;
    subtitulo = `Faltam ${fmtMin((agora.te - Date.now()) / 60000)} · ${fmtL(agora.litros)} neste pulso.`;
  } else if (pausado()) {
    dotCor = 'var(--amber)';
    titulo = S.pause.indefinite ? '⏸️ Regas pausadas' : `⏸️ Pausado (volta ${quando(Date.parse(S.pause.until))})`;
    subtitulo = 'Toque no botão "Em Pausa" abaixo quando quiser retomar.';
  } else if (proxima) {
    const turnoNome = proxima.tarde ? '🌇 Turno da Tarde' : '🌅 Turno da Manhã';
    titulo = 'Piloto automático ativo (2 turnos/dia)';
    subtitulo = `Próxima rega: ${turnoNome} ${quando(proxima.ts)} (${fmtL(P.pHoje.totalL)} programados no dia).`;
  } else {
    titulo = 'Piloto automático ativo';
    subtitulo = 'Cota diária pronta para os turnos das 04:00 e 16:00.';
  }

  const w = P.pHoje.clima || climaDo(hoje());
  const tmax = Math.round(w.tmax ?? 34);

  const pedidoRealL = P.pHoje.pedidoRealL || 0;
  const liberadoAutoL = P.pHoje.totalL || 0;
  const manualExtraL = manualLitrosHoje();
  const gastoTotalDiaL = liberadoAutoL + manualExtraL;
  const deficitSedeL = Math.max(0, pedidoRealL - gastoTotalDiaL);
  const passandoSede = deficitSedeL >= 5;

  const pctCota = C.clamp(Math.round((100 * gastoTotalDiaL) / Math.max(1, S.quota.daily_L)), 0, 100);
  const pctCaixa = C.clamp(Math.round((100 * (S.tank.level_L ?? 0)) / S.tank.capacity), 0, 100);
  const aut = semana.autonomiaDias === Infinity ? 'vários' : semana.autonomiaDias.toFixed(1);
  const r = 32, circ = 2 * Math.PI * r, off = circ - (pctCota / 100) * circ;
  const corAnel = passandoSede ? 'var(--red)' : (gastoTotalDiaL > S.quota.daily_L ? 'var(--blue)' : 'var(--green)');

  return `<section class="card">
    <div class="hero-status">
      <div>
        <div class="hero-headline">
          <span class="live" style="color:${dotCor}"></span>
          <span>${titulo}</span>
        </div>
        <div class="hero-sub">${subtitulo}</div>
      </div>
    </div>

    <div class="hero-grid">
      <!-- Esquerda: Temperatura Atual + Luzes de Espia (Enxutas e Clicáveis) -->
      <div class="hero-panel">
        <div class="temp-main">
          <div>
            <div class="temp-val">${iconeClima(w)} ${tmax}°C</div>
            <div class="t12 mute" style="margin-top:3px">Máxima hoje · Regas às 04:00 e 16:00</div>
          </div>
          <span class="t12 mute">Toque no aviso p/ detalhes</span>
        </div>

        <div class="telltales">
          ${espias.map((e) => `
            <button class="espia ${e.cor}" onclick="abrirEspia('${e.id}')">
              <span class="espia-led"></span>
              <span>${e.ic} ${esc(e.curto)}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Direita: Água do Dia (Pedido Real vs. Liberado na Cota + Caixa 5.000 L) -->
      <div class="cota-panel">
        <div class="ring-wrap" onclick="abrirEspia('cota')" title="Toque para ver detalhes da cota">
          <svg viewBox="0 0 78 78">
            <circle cx="39" cy="39" r="${r}" stroke="var(--line)" stroke-width="7" fill="none" />
            <circle cx="39" cy="39" r="${r}" stroke="${corAnel}" stroke-width="7" fill="none"
              stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" />
          </svg>
          <div class="ring-label">
            <span class="rv">${Math.round((100 * gastoTotalDiaL) / Math.max(1, S.quota.daily_L))}%</span>
            <span class="rl">Cota</span>
          </div>
        </div>

        <div style="flex:1;min-width:0">
          <!-- Contador de Sede: Pedido Real das Plantas vs. Gasto/Liberado -->
          <div class="row between t13">
            <span class="mute b">🌱 Pedido real hoje</span>
            <span class="b">${fmtL(pedidoRealL)}</span>
          </div>
          <div class="row between t13" style="margin-top:3px">
            <span class="mute b">🚰 Gasto / Cota</span>
            <span class="b">${fmtL(gastoTotalDiaL)} / ${fmtL(S.quota.daily_L)}</span>
          </div>

          ${passandoSede ? `
            <div class="sede-banner warn">
              <span>⚠️ Passando sede: faltam <b>${fmtL(deficitSedeL)}</b></span>
              <span>−${Math.round((100 * deficitSedeL) / Math.max(1, pedidoRealL))}%</span>
            </div>
          ` : `
            <div class="sede-banner ok">
              <span>✅ Sem sede: 100% do pedido atendido</span>
              ${manualExtraL > 0 ? `<span>+${fmtL(manualExtraL)} extra</span>` : '<span>OK</span>'}
            </div>
          `}

          <div style="margin-top:8px">
            <div class="row between t12">
              <span class="mute b">🪣 Caixa 5.000 L (~${aut}d)</span>
              <span class="b">${pctCaixa}% (${fmtL(S.tank.level_L)})</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${pctCaixa}%"></div></div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderQuatroBotoes(agora) {
  const p = pausado();
  const manualAtivo = (agora && agora.manual) || (S.manual && S.manual.fim > Date.now());
  const bAtivo = S.boost.pct > 0 && Date.parse(S.boost.until) > Date.now();
  const chuvaHoje = S.chuvaLocal[hoje()] || 0;

  return `<section class="tiles">
    <!-- Tile 1: Pausar / Retomar -->
    <div class="tile ${p ? 'active-amber' : ''}" onclick="abrirPausa()" role="button" tabindex="0">
      <div class="tile-top">
        <div class="tile-ic">${p ? '▶️' : '⏸️'}</div>
        ${p ? `<button class="tile-cancel" onclick="event.stopPropagation();retomar('app');toast('▶️ Piloto automático retomado!')">✕ Retomar</button>` : '<span class="t12 mute">2h ou manual</span>'}
      </div>
      <div>
        <div class="tile-title">${p ? 'Em Pausa' : 'Pausar Regas'}</div>
        <div class="tile-sub">${p ? 'Toque para voltar ao auto' : 'Segura a rega e volta só'}</div>
      </div>
    </div>

    <!-- Tile 2: Regar Agora (Override / Flex) -->
    <div class="tile ${manualAtivo ? 'active-blue' : ''}" onclick="abrirRegarAgora()" role="button" tabindex="0">
      <div class="tile-top">
        <div class="tile-ic">💧</div>
        ${manualAtivo
          ? `<button class="tile-cancel" onclick="cancelarRegaManual(event)">✕ Parar</button>`
          : `<button class="pill blue" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();botaoFisicoFlex1Hora('app')" title="Adiciona +1 hora (30 min em cada zona) agora">+1h Flex</button>`}
      </div>
      <div>
        <div class="tile-title">${manualAtivo ? 'Override Ativo' : 'Regar Agora'}</div>
        <div class="tile-sub">${manualAtivo ? `${fmtL(S.manual?.litrosTotal || agora?.litros || 0)} liberados` : 'Por Horas ⇄ Litros ou +1h'}</div>
      </div>
    </div>

    <!-- Tile 3: Era Bom Que Chovesse -->
    <div class="tile ${bAtivo ? 'active-blue' : ''}" onclick="abrirBoost()" role="button" tabindex="0">
      <div class="tile-top">
        <div class="tile-ic">🌧️</div>
        ${bAtivo ? `<button class="tile-cancel" onclick="cancelarBoost(event)">✕ Desligar</button>` : '<span class="t12 mute">Reforço 24h</span>'}
      </div>
      <div>
        <div class="tile-title">Era Bom Chover</div>
        <div class="tile-sub">${bAtivo ? `+${S.boost.pct}% ativo nas regas` : 'Dá +25% ou +50% de água'}</div>
      </div>
    </div>

    <!-- Tile 4: Choveu Aqui -->
    <div class="tile ${chuvaHoje ? 'active-green' : ''}" onclick="abrirChuva()" role="button" tabindex="0">
      <div class="tile-top">
        <div class="tile-ic">☔</div>
        ${chuvaHoje ? `<button class="tile-cancel" onclick="cancelarChuvaHoje(event)">✕ Desfazer</button>` : '<span class="t12 mute">Anotar chuva</span>'}
      </div>
      <div>
        <div class="tile-title">Choveu Aqui</div>
        <div class="tile-sub">${chuvaHoje ? `${chuvaHoje} mm anotados hoje` : 'Desconta chuva na roça'}</div>
      </div>
    </div>
  </section>`;
}

function renderCardZona(z, i, P, ev, agora) {
  const d = P.pHoje.porZona[i];
  if (!z.enabled || !d.cd) {
    return `<section class="card">
      <div class="zone-head">
        <div class="zone-emoji">🟫</div>
        <div style="flex:1">
          <div class="zone-title">${esc(z.nome)}</div>
          <div class="mute t13">${z.area_m2} m² · Canteiro livre (0 L/dia automático)</div>
        </div>
      </div>
      <div class="row" style="margin-top:14px;gap:8px">
        <button class="btn sm" style="flex:1" onclick="abrirZona(${i})">⚙️ Fita e Ajustes</button>
        <button class="btn sm" style="flex:1" onclick="abrirRegarAgora([${i}])">💧 Override nesta zona</button>
      </div>
      <div class="row" style="margin-top:8px;gap:8px">
        <button class="btn sm" style="flex:1" onclick="abrirGuiaCulturas(${i})">📖 Ver Culturas & Espaçamentos</button>
        <button class="btn sm primary" style="flex:1" onclick="abrirPlantio(${i})">🌱 Cadastrar Cultura</button>
      </div>
    </section>`;
  }

  const cd = d.cd;
  const geom = d.geometria || C.geometria(z, S.soil);
  const regando = agora && agora.zona === z.id;
  const rf = d.restricaoInfo;

  const fasePill = cd.terminou
    ? '<span class="pill amber">🧺 Ponto de colheita</span>'
    : cd.critica
      ? `<span class="pill violet">🌸 ${esc(cd.nomeFase)} (Prioridade máxima)</span>`
      : cd.retaFinal
        ? `<span class="pill amber">🍯 ${esc(cd.nomeFase)} (Restrição de maturação)</span>`
        : `<span class="pill green">🌿 ${esc(cd.nomeFase)}</span>`;

  return `<section class="card">
    <div class="zone-head">
      <div class="zone-emoji">${cd.crop.emoji}</div>
      <div style="flex:1;min-width:0">
        <div class="row between">
          <div class="zone-title">${esc(z.nome.split('—')[0].trim())} · ${cd.crop.nome}</div>
          ${regando ? '<span class="pill blue"><span class="live"></span>Regando</span>' : ''}
        </div>
        <div class="mute t13">
          Dia <b>${cd.dap}</b> de ${cd.ciclo} · <b>${geom.metros}m de fita</b> (${geom.gotejadores} furos a ${geom.espacamentoCm}cm) · <b>${d.vazaoLpm.toFixed(1)} L/min</b> (${Math.round(d.vazaoLph)} L/h)
        </div>
      </div>
    </div>

    <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">
      ${fasePill}
      ${z.mulch ? '<span class="pill green">🌾 Com palhada (−15%)</span>' : ''}
      ${z.fine_pct ? `<span class="pill blue">Ajuste fino ${z.fine_pct > 0 ? '+' : ''}${z.fine_pct}%</span>` : ''}
    </div>

    <!-- Balanço Direto da Zona Hoje (Sem "Chutômetro" de % de Solo) -->
    <div class="moisture-box">
      <div class="row between t13">
        <span class="mute b">🌱 Pedido da planta hoje</span>
        <span class="b">${fmtL(d.pedidoRealL)}</span>
      </div>
      <div class="row between t13" style="margin-top:4px">
        <span class="mute b">🚰 Liberado na programação</span>
        <span class="b" style="color:${d.deficitSedeL >= 5 ? 'var(--red)' : 'var(--green)'}">
          ${fmtL(d.litros)} ${d.deficitSedeL >= 5 ? `(faltam ${fmtL(d.deficitSedeL)})` : '✓'}
        </span>
      </div>
    </div>

    <!-- Mecanismo de Tomada de Decisão para Culturas com Restrição Hídrica (Melancia, Melão, Jerimum, Batata-doce) -->
    ${rf ? `
      <div class="restricao-box">
        <div class="row between">
          <span class="t13 b" style="color:var(--amber)">🍯 Decisão de Restrição Hídrica (−${rf.cortePct}%)</span>
          <span class="pill amber" style="background:var(--card)">Faltam ${cd.diasParaColher}d p/ colher</span>
        </div>
        <div class="t12 ink2" style="margin-top:4px">${esc(rf.explicacao)}</div>
        <div class="restricao-chips">
          <button class="r-chip ${rf.modo === 'auto' ? 'sel' : ''}" onclick="mudarModoRestricao(${i},'auto')">
            🤖 Auto (${rf.condicaoAmenaOuChuva ? 'Clima ameno/chuva' : 'Sol'})
          </button>
          <button class="r-chip ${rf.modo === 'normal_maturacao' ? 'sel' : ''}" onclick="mudarModoRestricao(${i},'normal_maturacao')">
            🍯 Reduzir −${Math.round((1 - cd.reposicao) * 100)}%
          </button>
          <button class="r-chip ${rf.modo === 'corte_forte' ? 'sel' : ''}" onclick="mudarModoRestricao(${i},'corte_forte')">
            ☀️ Corte forte −${Math.round((1 - cd.reposicaoAmenoChuva) * 100)}%
          </button>
          <button class="r-chip ${rf.modo === 'corte_total_hoje' ? 'sel' : ''}" onclick="mudarModoRestricao(${i},'corte_total_hoje')">
            🛑 Secar hoje (0 L)
          </button>
        </div>
      </div>
    ` : ''}

    <!-- Os 2 Turnos do Dia: Manhã Cedo (04:00–05:30) e Fim da Tarde (16:00–17:30) -->
    <div class="shifts-grid">
      <div class="shift-box">
        <div class="t12 mute b">🌅 MANHÃ CEDO (${d.janelaManha || '04:00–05:00'})</div>
        <div class="t14 b" style="margin-top:3px;color:var(--blue)">
          ${d.litrosManha >= 1 ? `${fmtL(d.litrosManha)} (${fmtMin(d.minutosManha)})` : '0 L hoje'}
        </div>
        <div class="t12 mute" style="margin-top:2px">Para atravessar o calor do dia</div>
      </div>
      <div class="shift-box">
        <div class="t12 mute b">🌇 FIM DA TARDE (${d.janelaTarde || '16:00–17:00'})</div>
        <div class="t14 b" style="margin-top:3px;color:var(--green)">
          ${d.litrosTarde >= 1
            ? `${fmtL(d.litrosTarde)} (${fmtMin(d.minutosTarde)})`
            : (rf && rf.fatorRestricao <= 0.35 ? 'Cortado (açúcar/cura)' : '0 L hoje')}
        </div>
        <div class="t12 mute" style="margin-top:2px">Alivia a caixa p/ o poço repor</div>
      </div>
    </div>

    <div class="row" style="margin-top:14px;gap:8px">
      <button class="btn sm" style="flex:1" onclick="abrirZona(${i})">⚙️ Fita e Ajustes</button>
      <button class="btn sm" style="flex:1" onclick="abrirRegarAgora([${i}])">💧 Override nesta zona</button>
    </div>
  </section>`;
}

/* ============================================================================
 * SAFRA ATUAL, GUIA DE CULTURAS & ESPAÇAMENTOS (CONSULTA SEGURA) E TROCA
 * ========================================================================== */
function renderSafraERotacao(P) {
  const itens = S.zones.map((z, i) => {
    const d = P.pHoje.porZona[i];
    if (!z.enabled || !d.cd) {
      return `<div class="safra-item">
        <div class="row between">
          <span class="b">${esc(z.nome)}</span>
          <div class="row" style="gap:6px">
            <button class="btn sm" onclick="abrirGuiaCulturas(${i})">📖 Ver culturas</button>
            <button class="btn sm primary" onclick="abrirPlantio(${i})">🌱 Plantar</button>
          </div>
        </div>
      </div>`;
    }
    const cd = d.cd;
    const pctCiclo = Math.round(cd.progresso * 100);
    const dataColheita = fmtData(C.addDays(hoje(), cd.diasParaColher));
    const sug = C.sugerirRotacao(cd.crop.familia)[0];

    return `<div class="safra-item">
      <div class="row between">
        <span class="b t14">${cd.crop.emoji} ${esc(z.nome.split('—')[0].trim())}: ${cd.crop.nome}</span>
        <span class="pill">${pctCiclo}% do ciclo (Dia ${cd.dap}/${cd.ciclo})</span>
      </div>
      <div class="bar-track" style="margin-top:7px">
        <div class="bar-fill" style="width:${pctCiclo}%"></div>
      </div>

      <div class="safra-steps">
        <div class="safra-step">
          <div class="t12 mute b">🧺 QUANDO COLHER ATUAL</div>
          <div class="t14 b" style="margin-top:2px;color:var(--green)">
            ${cd.terminou ? 'Pronto para colher!' : `~${dataColheita} (faltam ${cd.diasParaColher}d)`}
          </div>
          <div class="t12 mute" style="margin-top:3px">
            Espaçamento atual: <b>${esc(cd.crop.espacamento_ruas_m || '1,0 m')}</b> (rua) × <b>${esc(cd.crop.espacamento_plantas_m || '0,3 m')}</b> (planta)
          </div>
        </div>

        <div class="safra-step">
          <div class="t12 mute b">🔄 SUGESTÃO PÓS-COLHEITA</div>
          <div class="t14 b" style="margin-top:2px">${sug.emoji} ${esc(sug.nome)}</div>
          <div class="t12 mute" style="margin-top:3px">
            Rua: <b>${esc(sug.espacamento_ruas_m)}</b> · Entre plantas: <b>${esc(sug.espacamento_plantas_m)}</b>
          </div>
        </div>
      </div>

      <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">
        <button class="btn sm" style="flex:1" onclick="abrirGuiaCulturas(${i},'${sug.id}')">
          📖 Ver culturas e espaçamentos
        </button>
        <button class="btn sm" style="flex:1;border-color:var(--amber-bd);color:var(--amber)" onclick="abrirPlantio(${i},'${sug.id}')">
          🔄 Trocar cultura (encerrar atual)
        </button>
      </div>
    </div>`;
  }).join('');

  return `<section class="card">
    <div class="sec-title">
      <span>🗓️ Safra Atual, Espaçamentos & Rotação</span>
      <span style="text-transform:none;font-weight:600">Consulta segura</span>
    </div>
    ${itens}
  </section>`;
}

/* ============================================================================
 * EVENTOS REGISTRADOS COM BOTÃO DE CANCELAR / DELETAR EM CADA ITEM
 * ========================================================================== */
function renderEventosRegistrados() {
  const ic = { fisico: '🖐️', app: '📱', sistema: '🤖', claude: '🧠' };
  const lista = S.auditoria.slice(0, 8);

  return `<section class="card">
    <div class="sec-title">
      <span>📋 Eventos Registrados (${S.auditoria.length})</span>
      ${S.auditoria.length ? `<button class="del-btn" onclick="limparHistoricoEventos()">🗑️ Limpar tudo</button>` : ''}
    </div>

    ${lista.length ? `
      <div class="event-list">
        ${lista.map((a) => {
          const ehAtivo = (a.tipo === 'pausa' && pausado()) ||
            (a.tipo === 'boost' && S.boost?.pct > 0) ||
            (a.tipo === 'chuva' && a.meta?.date === hoje() && S.chuvaLocal[hoje()] > 0) ||
            (a.tipo === 'regar_agora' && S.manual && S.manual.fim > Date.now());
          return `<div class="event-row">
            <div style="min-width:0;flex:1">
              <div>${ic[a.origem] || '•'} ${esc(a.texto)}</div>
              <div class="t12 mute">${quando(a.ts)}</div>
            </div>
            <button class="del-btn ${ehAtivo ? 'undo' : ''}" onclick="cancelarEventoRegistrado('${a.id}')" title="Cancelar e remover este evento">
              ${ehAtivo ? '✕ Desfazer' : '✕ Apagar'}
            </button>
          </div>`;
        }).join('')}
      </div>
    ` : '<div class="mute t14">Nenhum evento manual registrado no momento.</div>'}

    <div class="t12 mute" style="margin-top:10px">
      Toque em <b>✕ Desfazer / Apagar</b> ao lado de qualquer evento para cancelá-lo e removê-lo.
    </div>
  </section>`;
}

function iconeClima(w) { return (w.rain || 0) >= 5 && (w.rain_prob ?? 100) >= 60 ? '🌧️' : ((w.rain || 0) >= 1 || (w.rain_prob || 0) >= 40) ? '🌦️' : (w.tmax || 0) >= 34 ? '☀️' : '⛅'; }

let timerRelock = null;
function iniciarTimerRelock() {
  if (timerRelock) clearTimeout(timerRelock);
  timerRelock = setTimeout(() => {
    S.ui.locked = true;
    salvar();
    render();
    toast('🔒 Painel travado automaticamente por inatividade.');
  }, 10 * 60 * 1000);
}

function solicitarDestravamentoComPin(onSuccess) {
  if (!S.security || S.security.enabled === false) {
    S.ui.locked = false;
    iniciarTimerRelock();
    salvar();
    render();
    if (typeof onSuccess === 'function') onSuccess();
    return;
  }
  if (typeof abrirModalPin === 'function') {
    abrirModalPin(onSuccess);
  } else {
    S.ui.locked = false;
    salvar();
    render();
    if (typeof onSuccess === 'function') onSuccess();
  }
}

function alternarCadeado() {
  if (S.ui.locked) {
    solicitarDestravamentoComPin();
  } else {
    S.ui.locked = true;
    if (timerRelock) clearTimeout(timerRelock);
    salvar();
    render();
    toast('🔒 Painel travado com sucesso.');
  }
}

async function instalarPwa() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    await deferredPwaPrompt.userChoice;
    deferredPwaPrompt = null;
    render();
  } else {
    toast('📲 No iPhone: toque em Compartilhar no Safari → "Adicionar à Tela de Início".');
  }
}

/* ---------------- Inicialização ---------------- */
async function iniciar() {
  fecharDiasPendentes(); render();
  iniciarMqttNuvem(); // Inicia a conexão MQTT em tempo real via nuvem HiveMQ
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (!S.weather.fetched || Date.now() - S.weather.fetched > 3 * 3600e3) { await buscarClima(); fecharDiasPendentes(); render(); }
  await sincronizarEsp32(); render();
  setInterval(() => { fecharDiasPendentes(); render(); }, 30000);
  setInterval(sincronizarEsp32, 15000);
}
document.addEventListener('DOMContentLoaded', iniciar);
