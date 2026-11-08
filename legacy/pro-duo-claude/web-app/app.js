/* ============================================================================
 * Irriga.ai Pro-Duo · edição Claude — App (estado, clima, execução, tela)
 * Usa o motor único ../core/irriga-core.js. Modais ficam em sheets.js.
 * ========================================================================== */
const C = window.IrrigaCore;
const KEY = 'irriga_claude_v2';
const RELES = [
  ['V. Mestre', 4, true], ['Zona 1', 16, true], ['Zona 2', 17, true], ['Zona 3', 18, false],
  ['Zona 4', 19, false], ['Bomba 12V', 23, false], ['Refletor', 25, false], ['Câmera', 5, false],
];
const COR_FASE = ['#7FB89A', '#3E9D6E', '#5B3CC4', '#0E7A4B', '#C58A1B'];

/* ---------------- Estado persistente ---------------- */
let S = carregar();
function novoEstado() {
  return Object.assign(C.estadoPadrao(), {
    historico: [], auditoria: [], pauseLog: [], boostLog: [], chuvaLocal: {}, manual: null,
    weather: { fetched: null, days: [], erro: null }, filtro: { pct: 100 },
    ui: { locked: true, dark: false }, device: { url: '', online: false, lastSeen: null, status: null },
    ultimoDiaFechado: C.addDays(hoje(), -1),
  });
}
function carregar() {
  try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(novoEstado(), JSON.parse(raw)); } catch (e) { /* estado novo */ }
  return novoEstado();
}
function salvar() { localStorage.setItem(KEY, JSON.stringify(S)); }
window.addEventListener('storage', (e) => { if (e.key === KEY) { S = carregar(); render(); } }); // sincroniza com dev-gui

/* ---------------- Utilidades ---------------- */
function hoje() { return C.isoDate(new Date()); }
const agoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const absTs = (dateStr, min) => new Date(dateStr + 'T00:00:00').getTime() + min * 60000;
const fmtL = (l) => `${Math.round(l).toLocaleString('pt-BR')} L`;
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}` : `${Math.max(1, Math.round(m))} min`);
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const fmtData = (s) => { const d = new Date(s + 'T12:00:00'); return `${d.getDate()}/${MESES[d.getMonth()]}`; };
const diaSemana = (s) => SEM[new Date(s + 'T12:00:00').getDay()];
const quando = (ts) => {
  const d = new Date(ts), h = C.minToHhmm(d.getHours() * 60 + d.getMinutes()), ds = C.isoDate(d), t = hoje();
  if (ds === t) return `hoje às ${h}`; if (ds === C.addDays(t, 1)) return `${d.getHours() < 12 ? 'amanhã' : 'amanhã'} às ${h}`;
  return `${diaSemana(ds)} ${fmtData(ds)} às ${h}`;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function audit(origem, texto) {
  S.auditoria.unshift({ ts: Date.now(), origem, texto }); S.auditoria = S.auditoria.slice(0, 150); salvar();
}

/* ---------------- Clima (Open-Meteo, com cache e fallback climatológico) ---------------- */
async function buscarClima() {
  const { lat, lon } = S.site;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=et0_fao_evapotranspiration,precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min,wind_speed_10m_max&timezone=America%2FFortaleza&past_days=7&forecast_days=8`;
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, { signal: ctl.signal }); const j = await r.json(); const d = j.daily;
    S.weather = { fetched: Date.now(), erro: null, days: d.time.map((t, i) => ({
      date: t, et0: d.et0_fao_evapotranspiration[i] ?? C.climatologia(t).et0, rain: d.precipitation_sum[i] ?? 0,
      rain_prob: d.precipitation_probability_max[i] ?? (t < hoje() ? 100 : 0), tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i], wind: d.wind_speed_10m_max[i] })) };
    salvar();
  } catch (e) { S.weather.erro = 'offline'; }
}
const previsao = () => S.weather.days || [];
const climaDo = (dt) => previsao().find((w) => w.date === dt) || C.climatologia(dt);
const climaOffline = () => !S.weather.fetched || Date.now() - S.weather.fetched > 36 * 3600e3;

/* ---------------- Execução (modo demonstração) + fechamento diário ---------------- */
const pausadoEm = (ts) => S.pauseLog.some((p) => ts >= p.de && ts < (p.ate ?? Infinity));
function fecharDiasPendentes() {
  const alvo = C.addDays(hoje(), -1);
  let d = C.addDays(S.ultimoDiaFechado, 1), n = 0;
  if (C.daysBetween(d, alvo) > 30) d = C.addDays(alvo, -30);
  while (d <= alvo && n++ < 31) {
    const plano = C.planejarDia(S, previsao(), d);
    const entregue = S.zones.map(() => 0);
    plano.eventos.forEach((e) => { if (!pausadoEm(absTs(d, e.inicioMin))) entregue[S.zones.findIndex((z) => z.id === e.zona)] += e.litros; });
    const obs = climaDo(d).rain || 0, local = S.chuvaLocal[d] || 0;
    C.fecharDia(S, plano, Math.max(0, obs - local), entregue);
    const total = entregue.reduce((a, b) => a + b, 0);
    S.tank.level_L = Math.max(0, (S.tank.level_L ?? S.tank.capacity) - total);
    S.historico.unshift({ date: d, litros: entregue, chuva: Math.max(obs, local), local, et0: climaDo(d).et0,
      chuvaAproveitadaL: S.zones.reduce((s, z) => s + C.chuvaEfetiva(Math.max(obs, local)) * z.area_m2, 0), pulou: plano.totalL < 1 });
    S.historico = S.historico.slice(0, 120);
    S.ultimoDiaFechado = d; d = C.addDays(d, 1);
  }
  if (S.pause.until && Date.parse(S.pause.until) < Date.now() && !S.pause.indefinite) retomar('sistema', true);
  salvar();
}

/* Plano de hoje e de amanhã (para "próxima rega") */
function planos() {
  const t = hoje();
  const pHoje = C.planejarDia(S, previsao(), t);
  const clone = JSON.parse(JSON.stringify(S));
  C.fecharDia(clone, pHoje, climaDo(t).rain_prob >= 50 ? climaDo(t).rain : 0);
  const pAmanha = C.planejarDia(clone, previsao(), C.addDays(t, 1));
  return { pHoje, pAmanha };
}
function linhaDoTempo(P) {
  const t = hoje(), am = C.addDays(t, 1);
  const ev = [...P.pHoje.eventos.map((e) => ({ ...e, ts: absTs(t, e.inicioMin), te: absTs(t, e.fimMin) })),
    ...P.pAmanha.eventos.map((e) => ({ ...e, ts: absTs(am, e.inicioMin), te: absTs(am, e.fimMin) }))];
  if (S.manual && S.manual.fim > Date.now()) ev.push(...S.manual.eventos);
  return ev.sort((a, b) => a.ts - b.ts);
}
function regandoAgora(ev) {
  const n = Date.now();
  return ev.find((e) => e.ts <= n && e.te > n && (e.manual || !pausadoEm(e.ts))) || null;
}
/* Água no solo agora (desconta o que já foi regado hoje e o consumo do dia até agora) */
function soloAgora(i, P) {
  const d = P.pHoje.porZona[i];
  if (!d.balde) return null;
  const n = Date.now(), t = hoje();
  let regado = 0;
  P.pHoje.eventos.filter((e) => e.zona === S.zones[i].id && absTs(t, e.inicioMin) < n && !pausadoEm(absTs(t, e.inicioMin)))
    .forEach((e) => { regado += e.litros * Math.min(1, (n - absTs(t, e.inicioMin)) / (e.minutos * 60000)); });
  const frac = C.clamp((agoraMin() - 360) / 720, 0, 1);
  const Dr = C.clamp(d.DrMm - regado * C.EFICIENCIA_GOTEJO / S.zones[i].area_m2 + d.etcMm * frac, 0, d.balde.taw);
  return { pct: 100 * (1 - Dr / d.balde.taw), confortoPct: 100 * (1 - d.balde.raw / d.balde.taw), Dr, taw: d.balde.taw };
}
const usadoHoje = () => {
  const P = planos(), t = hoje(), n = Date.now();
  let l = P.pHoje.eventos.filter((e) => absTs(t, e.inicioMin) < n && !pausadoEm(absTs(t, e.inicioMin)))
    .reduce((s, e) => s + e.litros * Math.min(1, (n - absTs(t, e.inicioMin)) / (e.minutos * 60000)), 0);
  if (S.manual && S.manual.dia === t) l += S.manual.litrosTotal;
  return l;
};

/* ---------------- Ações (as mesmas dos 4 botões físicos) ---------------- */
function pausar(horas, origem = 'app') {
  const ate = horas ? Date.now() + horas * 3600e3 : null;
  const aberta = S.pauseLog.find((p) => p.ate === null || p.ate > Date.now());
  if (aberta) aberta.ate = ate; else S.pauseLog.push({ de: Date.now(), ate });
  S.pause = { until: ate ? new Date(ate).toISOString() : null, indefinite: !horas, origem };
  if (S.manual) S.manual.fim = Date.now();
  audit(origem, horas ? `⏸️ Pausou por ${horas} h (retoma sozinho ${quando(ate)})` : '⏸️ Pausou sem prazo');
  enviarComando({ acao: 'pausar', horas: horas || 0 });
}
function retomar(origem = 'app', silencioso) {
  S.pauseLog.forEach((p) => { if (p.ate === null || p.ate > Date.now()) p.ate = Date.now(); });
  S.pause = { until: null, indefinite: false, origem: null };
  audit(origem, silencioso ? '▶️ Pausa terminou, voltou ao automático' : '▶️ Retomou o automático');
  enviarComando({ acao: 'retomar' });
}
const pausado = () => S.pause.indefinite || (S.pause.until && Date.parse(S.pause.until) > Date.now());

/** Regar agora: devolve ao solo exatamente o que falta (+extraMm), zona por zona em fila. */
function previaRegarAgora(extraMm = 0, zonasSel) {
  const P = planos();
  const minuto = agoraMin();
  let t = Date.now();
  const eventos = [], avisos = [];
  S.zones.forEach((z, i) => {
    if (zonasSel && !zonasSel.includes(i)) return;
    const solo = soloAgora(i, P); if (!solo) return;
    let litros = (solo.Dr + extraMm) * z.area_m2 / C.EFICIENCIA_GOTEJO;
    if (litros < 5) return;
    const g = C.guardaTermica(S, z, minuto, litros);
    if (!g.ok) { avisos.push(`Zona ${z.id}: ${g.aviso.split('.')[0]}. Ajustei para ${fmtL(g.litros)}.`); litros = g.litros; }
    const vaz = C.vazaoZona(z, S.soil), m = litros / vaz;
    eventos.push({ zona: z.id, litros, minutos: m, ts: t, te: t + m * 60000, manual: true });
    t += (m + 3) * 60000;
  });
  const litrosTotal = eventos.reduce((s, e) => s + e.litros, 0);
  const restante = S.quota.daily_L - usadoHoje();
  if (litrosTotal > restante) avisos.push(`Isso passa a cota de hoje em ${fmtL(litrosTotal - Math.max(0, restante))}. O plano da noite será reduzido.`);
  return { eventos, litrosTotal, avisos, fim: t };
}
function regarAgora(extraMm = 0, zonasSel, origem = 'app') {
  const p = previaRegarAgora(extraMm, zonasSel);
  if (!p.eventos.length) { toast('O solo já está cheio — não precisa regar agora. 🌱'); return; }
  if (pausado()) retomar(origem);
  S.manual = { dia: hoje(), eventos: p.eventos, litrosTotal: p.litrosTotal, fim: p.fim };
  p.eventos.forEach((e) => { const z = S.zones.find((x) => x.id === e.zona); z.Dr_mm = Math.max(0, (z.Dr_mm || 0) - e.litros * C.EFICIENCIA_GOTEJO / z.area_m2); });
  S.tank.level_L = Math.max(0, S.tank.level_L - p.litrosTotal);
  audit(origem, `💧 Regar agora: ${p.eventos.map((e) => `Z${e.zona} ${fmtL(e.litros)}`).join(' → ')}`);
  enviarComando({ acao: 'regar_agora', extra_mm: extraMm, zonas: p.eventos.map((e) => ({ zona: e.zona, litros: Math.round(e.litros) })) });
}
function eraBomQueChovesse(origem = 'app') {
  const prox = S.boost.pct >= 50 ? 0 : (S.boost.pct > 0 && Date.parse(S.boost.until) > Date.now() ? 50 : 25);
  S.boost = prox ? { pct: prox, until: new Date(Date.now() + 24 * 3600e3).toISOString() } : { pct: 0, until: null };
  if (prox) S.boostLog.push(hoje());
  S.boostLog = S.boostLog.slice(-30);
  audit(origem, prox ? `🌧️ Era bom que chovesse: +${prox}% nas regas das próximas 24 h` : '🌧️ Reforço desligado');
  enviarComando({ acao: 'boost', pct: prox });
  return prox;
}
function choveuAqui(mm, origem = 'app') {
  const t = hoje();
  S.chuvaLocal[t] = (S.chuvaLocal[t] || 0) + mm;
  S.zones.forEach((z) => { z.Dr_mm = Math.max(0, (z.Dr_mm || 0) - C.chuvaEfetiva(mm)); });
  audit(origem, `☔ Choveu aqui: ~${mm} mm registrados no solo`);
  enviarComando({ acao: 'chuva_local', mm });
}

/* ---------------- ESP32 (opcional): status e comandos ---------------- */
async function enviarComando(cmd) {
  salvar(); render();
  if (!S.device.url) return;
  try { await fetch(S.device.url.replace(/\/$/, '') + '/api/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) }); }
  catch (e) { toast('ESP32 fora do alcance — comando guardado no app.'); }
}
/** Pacote compacto que o firmware usa para calcular sozinho (ver docs/ESPEC_MOTOR.md). */
function compilarPacoteEsp32() {
  return {
    v: 2, soil_taw_mm_m: C.SOLOS[S.soil].taw_mm_m, soil_wet_m: C.SOLOS[S.soil].faixa_molhada_m,
    quota_L: S.quota.daily_L, reserve_pct: S.tank.reserve_pct, tank_L: S.tank.capacity,
    end_dawn: S.windows.end_dawn, earliest: S.windows.earliest, evening: S.windows.evening, pulse_max: S.windows.pulse_max_min,
    thermal: [S.thermal.start, S.thermal.end, S.thermal.min_hose_multiple],
    zones: S.zones.map((z) => {
      const c = z.crop && C.CROPS[z.crop.id]; const g = C.geometria(z, S.soil);
      return { id: z.id, on: !!(z.enabled && c), area: z.area_m2, fw: +g.fw.toFixed(3), flow_lpm: +C.vazaoZona(z, S.soil).toFixed(2), hose_L: +g.volumeMangueiraL.toFixed(1),
        plant: z.crop ? z.crop.plantio : null, days: c ? c.dias : null, kc: c ? c.kc : null, zr: c ? c.raiz_m : null, p: c ? c.p : null,
        cover: c ? c.cobertura : null, ky: c ? c.ky : null, late: c && c.reta_final ? [c.reta_final.dias, c.reta_final.reposicao] : null,
        mulch: !!z.mulch, fine: z.fine_pct || 0, Dr: +(z.Dr_mm || 0).toFixed(2) };
    }),
    weather: previsao().filter((w) => w.date >= hoje()).slice(0, 7).map((w) => [w.date, +w.et0.toFixed(2), +(w.rain || 0).toFixed(1), w.rain_prob || 0]),
  };
}
async function sincronizarEsp32() {
  if (!S.device.url) return;
  const base = S.device.url.replace(/\/$/, '');
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 2500);
    const st = await (await fetch(base + '/api/status', { signal: ctl.signal })).json();
    S.device = { ...S.device, online: true, lastSeen: Date.now(), status: st };
    if (typeof st.tank_L === 'number') S.tank.level_L = st.tank_L;
    if (typeof st.filter_pct === 'number') S.filtro.pct = st.filter_pct;
    (st.log || []).forEach((l) => { if (!S.auditoria.some((a) => a.ts === l.ts)) S.auditoria.unshift({ ts: l.ts, origem: 'fisico', texto: l.t }); });
    await fetch(base + '/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(compilarPacoteEsp32()) });
  } catch (e) { S.device.online = false; }
  salvar();
}

/* ---------------- Alertas e sugestões inteligentes ---------------- */
function alertas(P, semana) {
  const a = [];
  const add = (tipo, ic, txt, acao) => a.push({ tipo, ic, txt, acao });
  if (pausado()) add('warn', '⏸️', S.pause.indefinite ? 'Irrigação pausada <b>sem prazo</b>. As plantas não recebem água até alguém retomar.' : `Pausado — retoma sozinho ${quando(Date.parse(S.pause.until))}.`, ['Retomar agora', 'retomar("app");']);
  if (S.boost.pct > 0 && Date.parse(S.boost.until) > Date.now()) add('info', '🌧️', `"Era bom que chovesse" ativo: <b>+${S.boost.pct}%</b> por mais ${fmtMin((Date.parse(S.boost.until) - Date.now()) / 60000)}. As plantas agradecem!`);
  if (S.filtro.pct < 50) add('bad', '🛑', `Filtro 120 mesh entupido (vazão ${Math.round(S.filtro.pct)}%). Rega parada por segurança — lave os discos.`);
  else if (S.filtro.pct < 80) add('warn', '🧽', `A água está passando a ${Math.round(S.filtro.pct)}% do normal. Quando puder, lave os discos do filtro 120 mesh.`);
  P.pHoje.avisos.forEach((t) => add('warn', '⚖️', esc(t)));
  if (semana.autonomiaDias < 4) add('bad', '🪣', `Caixa dura só <b>${semana.autonomiaDias.toFixed(1)} dias</b> antes da reserva de ${S.tank.reserve_pct}%. Programe o abastecimento.`);
  S.zones.forEach((z, i) => {
    const d = P.pHoje.porZona[i];
    if (!z.enabled || !d.cd) { add('tip', '🌱', `${esc(z.nome)} está livre. Que tal plantar? Eu sugiro a cultura e a melhor data para caber na cota.`, ['Plantar agora', `abrirPlantio(${i})`]); return; }
    if (d.cd.terminou) add('tip', '🧺', `${d.cd.crop.emoji} ${d.cd.crop.nome} da ${esc(z.nome)} completou o ciclo. Colheu? Planeje a próxima cultura.`, ['Planejar rotação', `abrirPlantio(${i})`]);
    else if (d.cd.diasParaColher <= 10) add('good', '🧺', `${d.cd.crop.emoji} Colheita da ${esc(z.nome)} em ~${d.cd.diasParaColher} dias (${fmtData(C.addDays(hoje(), d.cd.diasParaColher))}). ${esc(d.cd.crop.colheita)}`, ['Planejar próxima', `abrirPlantio(${i})`]);
    if (d.cd.retaFinal && !d.cd.terminou) add('info', '🍯', `${d.cd.crop.nome}: água reduzida <b>de propósito</b> (${Math.round(d.cd.reposicao * 100)}%) para ${esc(d.cd.crop.reta_final.motivo)}. Não é defeito.`);
    if (!z.flow_cal_lpm) add('tip', '📏', `${esc(z.nome)} ainda não foi calibrada. 3 minutos com o sensor de vazão deixam o tempo de rega exato.`, ['Calibrar', `abrirCalibracao(${i})`]);
    if (!z.mulch && d.cd.fase <= 1 && !d.cd.terminou) {
      const eco = d.etcMm * 0.15 * z.area_m2 / C.EFICIENCIA_GOTEJO * 7;
      add('tip', '🌾', `Palhada (cobertura morta) na ${esc(z.nome)} economiza ~<b>${fmtL(eco)}/semana</b> nesta fase e esfria o solo.`, ['Já coloquei', `S.zones[${i}].mulch=true;audit('app','🌾 Palhada registrada na ${esc(z.nome)}');salvar();render();`]);
    }
  });
  const dias = new Set(S.boostLog.filter((d) => C.daysBetween(d, hoje()) < 7));
  if (dias.size >= 3) add('tip', '🧠', `Você apertou "Era bom que chovesse" em ${dias.size} dos últimos 7 dias. Quer aumentar a água em 10% de forma permanente?`, ['Aumentar 10%', 'S.zones.forEach(z=>z.fine_pct=(z.fine_pct||0)+10);S.boostLog=[];audit("app","🧠 Ajuste fino +10% aceito");salvar();render();']);
  if (climaOffline()) add('info', '📡', 'Sem internet: usando o clima médio do Seridó. A rega continua normalmente.');
  return a;
}

/* ---------------- Tela ---------------- */
function render() {
  document.documentElement.classList.toggle('dark', !!S.ui.dark);
  const P = planos();
  const ev = linhaDoTempo(P);
  const agora = regandoAgora(ev);
  const proxima = ev.find((e) => e.ts > Date.now() && (e.manual || !pausadoEm(e.ts)));
  const semana = C.projetarSemana(S, previsao(), hoje());
  const usado = usadoHoje();
  const app = document.getElementById('app');
  app.innerHTML = `
    ${cabecalho()}
    <div class="grid">
      <div class="col">${heroi(P, agora, proxima, semana, usado)}${acoes(agora)}${cardAlertas(alertas(P, semana))}</div>
      <div class="col">${S.zones.map((z, i) => cardZona(z, i, P, ev, agora)).join('')}</div>
      <div class="col">${cardSemana(semana)}${cardEficiencia()}${cardCalendario(P)}${cardReles(agora)}${cardAuditoria()}</div>
    </div>
    <p class="mute t12" style="text-align:center;margin-top:18px">Irriga.ai Pro-Duo · edição Claude · motor FAO-56 · ${S.device.online ? 'ESP32 conectado' : 'modo demonstração'}</p>`;
}
function cabecalho() {
  const con = S.device.online ? '<span class="pill green"><span class="live"></span>ESP32</span>' : '<span class="pill amber">Demonstração</span>';
  return `<header class="top">
    <div style="flex:1;min-width:0"><div class="brand">Irriga.ai</div><div class="site">${esc(S.site.nome)}</div></div>
    ${con}
    <button class="iconbtn" title="Diagnóstico com o Claude" onclick="abrirClaude()">🤖</button>
    <button class="iconbtn" title="Ajustes" onclick="abrirAjustes()">⚙️</button>
    <button class="iconbtn" title="${S.ui.locked ? 'Configurações travadas' : 'Configurações liberadas'}" onclick="alternarCadeado()">${S.ui.locked ? '🔒' : '🔓'}</button>
  </header>`;
}
function heroi(P, agora, proxima, semana, usado) {
  let big, small, cls = '';
  if (S.filtro.pct < 50) { big = '🛑 Rega parada: filtro entupido'; small = 'Lave os discos do filtro 120 mesh e aperte ▶️ para voltar.'; }
  else if (agora) {
    const z = S.zones.find((x) => x.id === agora.zona);
    big = `💧 Regando a ${esc(z.nome.split('—')[0].trim())} agora`;
    small = `Faltam ${fmtMin((agora.te - Date.now()) / 60000)} · ${fmtL(agora.litros)} neste pulso${agora.manual ? ' (rega manual)' : ''}.`;
  } else if (pausado()) {
    big = S.pause.indefinite ? '⏸️ Irrigação pausada' : `⏸️ Pausado até ${C.minToHhmm(new Date(S.pause.until).getHours() * 60 + new Date(S.pause.until).getMinutes())}`;
    small = S.pause.indefinite ? 'Sem prazo — toque em ⏯️ para voltar ao automático.' : 'Volta sozinho ao automático, ninguém precisa lembrar.';
  } else if (proxima) {
    const totalProx = ev24(P, proxima);
    big = `Tudo certo. Próxima rega ${quando(proxima.ts)}.`;
    small = `${fmtL(totalProx)} no total, ${S.zones.length > 1 ? 'uma zona de cada vez' : ''} — o solo e a previsão decidiram.`;
  } else { big = '🌱 Solo com água de sobra.'; small = 'Nenhuma rega necessária nas próximas 48 h.'; }
  const pctCaixa = 100 * (S.tank.level_L ?? 0) / S.tank.capacity;
  const aut = semana.autonomiaDias === Infinity ? '∞' : semana.autonomiaDias.toFixed(1);
  return `<section class="card hero ${cls}">
    <div class="big">${big}</div><div class="small">${small}</div>
    <div class="stats">
      <div class="stat"><div class="v">${Math.round(pctCaixa)}%</div><div class="l">Caixa · ${fmtL(S.tank.level_L)}</div></div>
      <div class="stat"><div class="v">${aut} <span class="t12 mute">dias</span></div><div class="l">Autonomia da caixa</div></div>
      <div class="stat"><div class="v">${Math.round(100 * usado / S.quota.daily_L)}%</div><div class="l">Cota hoje · ${fmtL(usado)}</div></div>
    </div></section>`;
}
function ev24(P, prox) { return linhaDoTempo(P).filter((e) => e.ts >= prox.ts && e.ts < prox.ts + 14 * 3600e3).reduce((s, e) => s + e.litros, 0); }
function acoes(agora) {
  const p = pausado(), bAtivo = S.boost.pct > 0 && Date.parse(S.boost.until) > Date.now();
  const chuvaHoje = S.chuvaLocal[hoje()] || 0;
  return `<section class="actions">
    <button class="act ${p ? 'warn' : ''}" onclick="abrirPausa()"><span class="e">${p ? '▶️' : '⏯️'}</span><span class="n">${p ? 'Retomar' : 'Pausar'}</span><span class="s">${p ? 'volta ao auto' : '2 h, volta só'}</span></button>
    <button class="act ${agora && agora.manual ? 'on' : ''}" onclick="abrirRegarAgora()"><span class="e">💧</span><span class="n">Regar agora</span><span class="s">só o que falta</span></button>
    <button class="act ${bAtivo ? 'on' : ''}" onclick="abrirBoost()"><span class="e">🌧️</span><span class="n">Era bom que chovesse</span><span class="s">${bAtivo ? `+${S.boost.pct}% ativo` : '+25% por 24 h'}</span></button>
    <button class="act ${chuvaHoje ? 'on' : ''}" onclick="abrirChuva()"><span class="e">☔</span><span class="n">Choveu aqui</span><span class="s">${chuvaHoje ? `${chuvaHoje} mm hoje` : 'credita no solo'}</span></button>
  </section>`;
}
function cardAlertas(lista) {
  if (!lista.length) return '<section class="card"><h2>Avisos</h2><div class="alert good"><span class="ic">✅</span><div>Nada pedindo sua atenção. Pode cuidar da vida.</div></div></section>';
  return `<section class="card"><h2>Avisos e sugestões <span class="pill">${lista.length}</span></h2>${lista.map((x) => `
    <div class="alert ${x.tipo}"><span class="ic">${x.ic}</span><div>${x.txt}${x.acao ? `<div><button class="link" onclick='${x.acao[1]}'>${x.acao[0]} →</button></div>` : ''}</div></div>`).join('')}</section>`;
}
function cardZona(z, i, P, ev, agora) {
  const d = P.pHoje.porZona[i];
  if (!z.enabled || !d.cd) return `<section class="card zone"><div class="head"><div class="emoji">🟫</div><div style="flex:1"><div class="name">${esc(z.nome)}</div><div class="mute t14">${z.area_m2} m² · sem cultura</div></div></div>
    <button class="btn primary full" style="margin-top:14px" onclick="abrirPlantio(${i})">🌱 Plantar nesta zona</button></section>`;
  const cd = d.cd, solo = soloAgora(i, P);
  const prox = ev.find((e) => e.zona === z.id && e.te > Date.now() && (e.manual || !pausadoEm(e.ts)));
  const doDia = prox ? ev.filter((e) => e.zona === z.id && e.ts >= prox.ts && e.ts < prox.ts + 14 * 3600e3) : [];
  const regando = agora && agora.zona === z.id;
  const faseBadge = cd.terminou ? '<span class="pill amber">Ciclo encerrado</span>' : cd.critica ? `<span class="pill violet">${esc(cd.nomeFase)} · crítica</span>` : cd.retaFinal ? `<span class="pill amber">${esc(cd.nomeFase)}</span>` : `<span class="pill green">${esc(cd.nomeFase)}</span>`;
  const soloCor = solo.pct >= solo.confortoPct ? 'green' : solo.pct >= solo.confortoPct * 0.6 ? 'amber' : 'red';
  return `<section class="card zone">
    <div class="head"><div class="emoji">${cd.crop.emoji}</div>
      <div style="flex:1;min-width:0"><div class="name">${esc(z.nome)}</div><div class="mute t14">${cd.crop.nome} · ${cd.dap}º dia · ${z.area_m2} m² · ${z.lines_open}/${z.lines_total} linhas</div></div>
      ${regando ? '<span class="pill blue"><span class="live"></span>regando</span>' : ''}</div>
    <div style="margin-top:10px">${faseBadge} <span class="pill">🧺 ${cd.terminou ? 'pronto' : `colheita ~${fmtData(C.addDays(hoje(), cd.diasParaColher))}`}</span></div>
    <div class="phases">${[0, 1, 2, 3, 4].map((f) => `<i class="${f < cd.fase ? 'done' : f === cd.fase ? 'now' + (cd.critica ? ' crit' : '') : ''}"></i>`).join('')}</div>
    <div class="soil">
      <div class="row between t14"><span class="b">Água no solo</span><span class="pill ${soloCor}">${Math.round(solo.pct)}%</span></div>
      <div class="soilbar" style="margin-top:6px"><div class="ok" style="left:${solo.confortoPct}%"></div><div class="fill" style="width:calc(${solo.pct}% - 4px)"></div><div class="mark" style="left:${solo.confortoPct}%"></div></div>
      <div class="row between t12 mute" style="margin-top:4px"><span>seco</span><span>conforto acima de ${Math.round(solo.confortoPct)}%</span><span>cheio</span></div>
    </div>
    <div class="next">
      ${prox ? `<div class="row between"><span class="b">Próxima rega</span><span class="t14">${quando(prox.ts)}</span></div>
      <div class="t14 ink2">${fmtL(doDia.reduce((s, e) => s + e.litros, 0))} em ${doDia.length} pulso${doDia.length > 1 ? 's' : ''} · ${fmtMin(doDia.reduce((s, e) => s + e.minutos, 0))} · ${d.vazaoLpm.toFixed(1)} L/min${z.flow_cal_lpm ? ' medidos' : ' estimados'}</div>`
        : '<div class="b">Sem rega nas próximas 48 h</div>'}
      <div class="why">💡 ${esc(d.motivo)}${d.cortePct > 1 ? ` <b>Cota: −${Math.round(d.cortePct)}%.</b>` : ''}</div>
    </div>
    <div class="row" style="margin-top:12px;gap:8px">
      <button class="btn sm" style="flex:1" onclick="abrirZona(${i})">Detalhes</button>
      <button class="btn sm" style="flex:1" onclick="abrirRegarAgora([${i}])">💧 Regar só esta</button>
    </div></section>`;
}
function iconeClima(w) { return (w.rain || 0) >= 5 && (w.rain_prob ?? 100) >= 60 ? '🌧️' : ((w.rain || 0) >= 1 || (w.rain_prob || 0) >= 40) ? '🌦️' : (w.tmax || 0) >= 34 ? '🔥' : '☀️'; }
function cardSemana(sem) {
  const max = Math.max(S.quota.daily_L, ...sem.dias.map((d) => d.litros));
  return `<section class="card"><h2>Próximos 7 dias <span class="t12 mute" style="text-transform:none">${fmtL(sem.dias.reduce((s, d) => s + d.litros, 0))}</span></h2>
    <div class="week">${sem.dias.map((d, k) => `<div>
      <div class="d">${k === 0 ? 'hoje' : diaSemana(d.date)}</div><div style="font-size:20px">${iconeClima(d.clima)}</div>
      <div class="t12 b">${d.clima.tmax ? Math.round(d.clima.tmax) + '°' : '–'}</div>
      <div class="t12 mute">${(d.clima.rain || 0) >= 0.5 ? (d.clima.rain).toFixed(0) + ' mm' : '&nbsp;'}</div>
      <div class="barbox"><div class="bar ${d.litros < 1 ? 'z0' : ''}" style="height:${Math.max(4, 66 * d.litros / max)}px" title="${fmtL(d.litros)}"></div></div>
      <div class="t12 b">${d.litros < 1 ? '—' : Math.round(d.litros)}</div></div>`).join('')}</div>
    <div class="t12 mute" style="margin-top:8px">Litros previstos por dia. Dias de chuva provável ficam mais baixos: o solo guarda a água.</div></section>`;
}
function cardEficiencia() {
  const h = S.historico.slice(0, 30);
  if (!h.length) return `<section class="card"><h2>Uso da água</h2><div class="mute t14">O histórico aparece a partir de amanhã.</div></section>`;
  const tot = h.reduce((s, x) => s + x.litros.reduce((a, b) => a + b, 0), 0);
  const chuva = h.reduce((s, x) => s + (x.chuvaAproveitadaL || 0), 0);
  const pulos = h.filter((x) => x.pulou).length;
  return `<section class="card"><h2>Uso da água · ${h.length} dias</h2>
    <div class="stats" style="margin-top:0">
      <div class="stat"><div class="v">${fmtL(tot / h.length)}</div><div class="l">média por dia</div></div>
      <div class="stat"><div class="v">${fmtL(chuva)}</div><div class="l">chuva aproveitada</div></div>
      <div class="stat"><div class="v">${pulos}</div><div class="l">dias sem precisar regar</div></div>
    </div></section>`;
}
function cardCalendario(P) {
  const ini = C.addDays(hoje(), -20), span = 150;
  const pos = (dt) => C.clamp(100 * C.daysBetween(ini, dt) / span, 0, 100);
  const linhas = S.zones.map((z, i) => {
    const d = P.pHoje.porZona[i];
    if (!d.cd) return `<div class="tl-row"><span class="b">Zona ${z.id}</span><div class="tl-track"></div></div>`;
    let acc = z.crop.plantio;
    const segs = d.cd.crop.dias.flatMap((n, k) => {
      if (k === 2) { const a = Math.round(n * 0.45); return [[a, 2], [n - a, 3]]; } return [[n, k === 3 ? 4 : k]];
    }).map(([n, f]) => { const a = acc; acc = C.addDays(acc, n); const l = pos(a), r = pos(acc); return r > l ? `<div class="tl-seg" style="left:${l}%;width:${r - l}%;background:${COR_FASE[f]}" title="${esc(d.cd.crop.fases[f])}"></div>` : ''; }).join('');
    const sug = C.sugerirRotacao(d.cd.crop.familia)[0];
    const l2 = pos(acc), r2 = pos(C.addDays(acc, 75));
    const prox = r2 > l2 ? `<div class="tl-seg" style="left:${l2}%;width:${r2 - l2}%;background:repeating-linear-gradient(45deg,#9DB3A6,#9DB3A6 6px,#B9CABF 6px,#B9CABF 12px);color:#0B1A12">${sug.emoji} ${sug.nome}?</div>` : '';
    return `<div class="tl-row"><span class="b">Zona ${z.id} ${d.cd.crop.emoji}</span><div class="tl-track">${segs}${prox}<div class="tl-today" style="left:${pos(hoje())}%"></div></div></div>`;
  }).join('');
  return `<section class="card"><h2>Calendário de safra</h2><div class="timeline">${linhas}</div>
    <div class="t12 mute">Roxo = fase crítica · listrado = próxima cultura sugerida pela rotação · linha vermelha = hoje.</div></section>`;
}
function cardReles(agora) {
  const on = (k) => (k === 0 && agora) || (agora && k === S.zones.findIndex((z) => z.id === agora.zona) + 1);
  return `<section class="card only-desktop"><h2>Placa de 8 relés</h2><div class="relays">${RELES.map(([n, g, hw], k) => `<div class="relay ${on(k) ? 'on' : ''} ${hw ? '' : 'off-hw'}"><b>R${k + 1}</b><br>${n}<br><span class="mute">GPIO ${g}</span></div>`).join('')}</div></section>`;
}
function cardAuditoria() {
  const ic = { fisico: '🖐️', app: '📱', sistema: '🤖', claude: '🧠' };
  const l = S.auditoria.slice(0, 10);
  return `<section class="card"><h2>Quem fez o quê</h2>${l.length ? `<div class="list">${l.map((a) => `<div class="li t14"><span>${ic[a.origem] || '•'} ${esc(a.texto)}</span><span class="t12 mute" style="white-space:nowrap">${quando(a.ts).replace('hoje às ', '')}</span></div>`).join('')}</div>` : '<div class="mute t14">Nenhum evento ainda.</div>'}
    <div class="t12 mute" style="margin-top:6px">🖐️ botão na parede · 📱 aplicativo · 🤖 automático</div></section>`;
}
function alternarCadeado() { S.ui.locked = !S.ui.locked; salvar(); render(); toast(S.ui.locked ? '🔒 Configurações travadas' : '🔓 Configurações liberadas por 10 min'); if (!S.ui.locked) setTimeout(() => { S.ui.locked = true; salvar(); render(); }, 600000); }

/* ---------------- Inicialização ---------------- */
async function iniciar() {
  fecharDiasPendentes(); render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  if (!S.weather.fetched || Date.now() - S.weather.fetched > 3 * 3600e3) { await buscarClima(); fecharDiasPendentes(); render(); }
  await sincronizarEsp32(); render();
  setInterval(() => { fecharDiasPendentes(); render(); }, 30000);
  setInterval(sincronizarEsp32, 15000);
}
document.addEventListener('DOMContentLoaded', iniciar);
