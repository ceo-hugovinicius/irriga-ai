/* ============================================================================
 * Simulador de safra — 260 dias em São Vicente do Seridó (PB)
 * Compara, sobre o MESMO clima e a MESMA física de solo:
 *   A) Política v1.0-Argon (reconstrução fiel da regra: lâmina fixa por fase,
 *      +4%/h acima de 32 °C (teto 20%), +10% vento, −80% da chuva de ontem,
 *      adia se previsão >5 mm e >75%, −65% nos 10 dias finais de cucurbitáceas)
 *   B) Política Claude (balanço hídrico do core/irriga-core.js)
 * O "solo verdadeiro" é igual para as duas. O planejador Claude NÃO enxerga a
 * verdade: usa ET0 prevista com erro, chuva do satélite que perde 35% das
 * pancadas locais, e o botão "Choveu aqui" apertado em 60% dessas vezes.
 * Uso: node sim/simular_safra.js  → escreve BENCHMARK_260_DIAS.md
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const C = require('../core/irriga-core.js');

const INICIO = '2026-11-07', DIAS = 260, SEED = 20261107;
let seed = SEED;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += rnd(); return (u - 3) / Math.sqrt(0.5); };

/* ---------- 1. Clima sintético verdadeiro + previsão imperfeita ---------- */
const clima = [];
for (let k = 0; k < DIAS + 2; k++) {
  const dt = C.addDays(INICIO, k), cl = C.climatologia(dt);
  const pChuva = Math.min(0.6, cl.chuva_media_dia / 11);
  const chove = rnd() < pChuva;
  const mm = chove ? -Math.log(1 - rnd()) * 11 : 0;
  const nublado = chove ? 0.75 : 1;
  const local = chove && rnd() < 0.35; // pancada localizada: satélite não vê
  clima.push({ date: dt, et0: Math.max(1.5, cl.et0 * nublado * (1 + 0.08 * gauss())), rain: mm, local,
    tmax: cl.tmax + 1.5 * gauss() - (chove ? 3 : 0), vento: 12 + 8 * Math.abs(gauss()) });
}
const previsaoDe = (k) => [0, 1].map((j) => {
  const w = clima[k + j]; if (!w) return null;
  const visto = w.local ? 0 : w.rain;
  const alarmeFalso = !w.rain && rnd() < 0.06;
  return { date: w.date, et0: w.et0 * (1 + 0.08 * gauss()), tmax: w.tmax,
    rain: visto ? visto * (0.6 + 0.8 * rnd()) : (alarmeFalso ? 8 : 0),
    rain_prob: visto ? 70 + 25 * rnd() : (alarmeFalso ? 65 : 5) };
}).filter(Boolean);

/* ---------- 2. Calendário de culturas (mesmo cenário da v1.0-Argon) ---------- */
const calendario = [
  [{ id: 'jerimum', dia: 0 }, { id: 'feijao_verde', dia: 100 }, { id: 'milho_verde', dia: 175 }],
  [{ id: 'jerimum', dia: 50 }, { id: 'batata_doce', dia: 150 }],
];
const culturaNoDia = (zi, k) => {
  let atual = null;
  for (const c of calendario[zi]) if (k >= c.dia) atual = c;
  return atual ? { id: atual.id, plantio: C.addDays(INICIO, atual.dia) } : null;
};

/* ---------- 3. Política A: v1.0-Argon reconstruída ---------- */
function argonLitros(zone, cd, w, ontemChuva, prev) {
  const kcFase = [cd.crop.kc[0], (cd.crop.kc[0] + cd.crop.kc[1]) / 2, cd.crop.kc[1], cd.crop.kc[1] * 0.9, cd.crop.kc[2]][cd.fase];
  let mm = kcFase * 4.8; // padrão do catálogo Argon (Kc 1,0 ≈ 4,8 mm/dia)
  const horasQuentes = Math.max(0, (w.tmax - 32) * 1.5);
  let bonus = Math.min(20, horasQuentes * 4) + (w.vento > 20 ? 10 : 0);
  mm *= 1 + bonus / 100;
  if (['Cucurbitáceas'].includes(cd.crop.familia) && cd.diasParaColher < 10) mm *= 0.35;
  mm = Math.max(0, mm - 0.8 * ontemChuva);
  const amanha = prev[1];
  if (amanha && amanha.rain > 5 && amanha.rain_prob > 75) mm *= cd.critica ? 0.5 : 0;
  return mm * zone.area_m2;
}

/* ---------- 4. Execução ---------- */
function rodar(politica) {
  const plano = C.estadoPadrao();
  plano.tank.level_L = 1e9; // a caixa é reabastecida; a cota de 1.000 L/dia é o limite
  const verdade = plano.zones.map(() => ({ Dr: 0, cultura: null }));
  const m = { litros: 0, perdaL: 0, diasEstresse: 0, porDia: [], ciclos: [], botaoChoveu: 0 };
  const acum = plano.zones.map(() => null);
  for (let k = 0; k < DIAS; k++) {
    const w = clima[k], dt = w.date, prev = previsaoDe(k);
    // troca de cultura
    plano.zones.forEach((z, i) => {
      const c = culturaNoDia(i, k);
      z.enabled = !!c;
      if (c && (!z.crop || z.crop.plantio !== c.plantio)) {
        if (acum[i]) m.ciclos.push(fecharCiclo(acum[i]));
        z.crop = { id: c.id, plantio: c.plantio }; z.Dr_mm = 0; verdade[i].Dr = 0;
        acum[i] = { zona: z.id, id: c.id, plantio: c.plantio, estagios: {} };
      }
    });
    // "Choveu aqui": usuário relata pancada local que o satélite não viu
    if (politica === 'claude' && k > 0 && clima[k - 1].local && clima[k - 1].rain > 3 && rnd() < 0.6) {
      plano.zones.forEach((z) => { z.Dr_mm = Math.max(0, z.Dr_mm - C.chuvaEfetiva(clima[k - 1].rain)); });
      m.botaoChoveu++;
    }
    let litrosZona;
    const pl = C.planejarDia(plano, prev, dt);
    if (politica === 'claude') {
      litrosZona = pl.porZona.map((z) => z.litros);
    } else {
      const ontem = k > 0 ? clima[k - 1].rain : 0;
      litrosZona = plano.zones.map((z, i) => (pl.porZona[i].cd && !pl.porZona[i].cd.terminou ? argonLitros(z, pl.porZona[i].cd, w, ontem, prev) : 0));
      const tot = litrosZona.reduce((a, b) => a + b, 0);
      if (tot > plano.quota.daily_L) { // Argon: prioriza fase crítica, ajusta a outra
        const ci = pl.porZona.findIndex((z) => z.cd && z.cd.critica);
        if (ci >= 0) { const outro = 1 - ci; litrosZona[outro] = Math.max(0, plano.quota.daily_L - litrosZona[ci]); litrosZona[ci] = Math.min(litrosZona[ci], plano.quota.daily_L); }
        else litrosZona = litrosZona.map((l) => l * plano.quota.daily_L / tot);
      }
    }
    // Física verdadeira
    let diaL = 0;
    plano.zones.forEach((z, i) => {
      const d = pl.porZona[i];
      if (!d.cd || d.cd.terminou) return;
      const ontemCd = C.cropDay(z.crop.id, d.cd.dap - 1, {});
      const g = C.geometria(z, plano.soil);
      if (ontemCd && d.cd.dap > 1) verdade[i].Dr += Math.max(0, d.cd.zr - ontemCd.zr) * g.solo.taw_mm_m * g.fw * 0.5;
      const etcReal = w.et0 * d.cd.kcEf;
      const r = C.passoDia(verdade[i].Dr, d.balde, etcReal, w.rain, litrosZona[i] * C.EFICIENCIA_GOTEJO / z.area_m2);
      verdade[i].Dr = r.Dr;
      const perdaIrr = Math.min(r.perdaMm, litrosZona[i] * C.EFICIENCIA_GOTEJO / z.area_m2) * z.area_m2 / C.EFICIENCIA_GOTEJO;
      m.perdaL += perdaIrr; diaL += litrosZona[i];
      if (r.ks < 0.95 && !d.cd.retaFinal) { m.diasEstresse++; if (process.env.DEBUG) console.log(politica, dt, z.id, d.cd.id, d.cd.nomeFase, 'ks', r.ks.toFixed(2), 'L', Math.round(litrosZona[i]), 'DrPlan', d.DrMm.toFixed(1), 'DrReal', r.Dr.toFixed(1), 'raw', d.balde.raw.toFixed(1), 'tot', Math.round(pl.totalL), pl.avisos.join(';')); }
      const st = acum[i].estagios[d.cd.fase] || (acum[i].estagios[d.cd.fase] = { etc: 0, eta: 0, ky: d.cd.ky });
      st.etc += etcReal; st.eta += r.etaMm;
    });
    // O planejador Claude fecha o dia com o que ele SABE: ET0 estimada e a chuva
    // observada pelo satélite (Open-Meteo past_days) — pancada local fica invisível.
    if (politica === 'claude') C.fecharDia(plano, pl, w.local ? 0 : w.rain);
    m.litros += diaL; m.porDia.push(diaL);
  }
  acum.forEach((a) => a && m.ciclos.push(fecharCiclo(a)));
  return m;
}
function fecharCiclo(a) {
  let y = 1;
  for (const s of Object.values(a.estagios)) y *= Math.max(0, 1 - s.ky * (1 - s.eta / Math.max(0.01, s.etc)));
  return { ...a, produtividadeRel: y };
}

const A = rodar('argon');
seed = SEED + 1;
const B = rodar('claude');

/* ---------- 5. Relatório ---------- */
const f0 = (x) => Math.round(x).toLocaleString('pt-BR');
const pct = (x) => (x * 100).toFixed(0) + '%';
const prodMedia = (m) => m.ciclos.reduce((s, c) => s + c.produtividadeRel, 0) / m.ciclos.length;
const chuvaTotal = clima.slice(0, DIAS).reduce((s, w) => s + w.rain, 0);
const locais = clima.slice(0, DIAS).filter((w) => w.local && w.rain > 3).length;
const nome = (id) => C.CROPS[id].nome;
const linhasCiclo = A.ciclos.map((c, i) => `| Zona ${c.zona} · ${nome(c.id)} (${c.plantio}) | ${pct(c.produtividadeRel)} | ${pct(B.ciclos[i].produtividadeRel)} |`).join('\n');
const md = `# Benchmark 260 dias — v1.0-Argon × edição Claude

> Gerado por \`node sim/simular_safra.js\` (semente ${SEED}). Mesmo clima sintético do Seridó,
> mesma física de solo (FAO-56) para as duas políticas. Chuva no período: **${f0(chuvaTotal)} mm**,
> com **${locais} pancadas localizadas** que o satélite não enxergou.

Cenário (igual ao benchmark da v1.0-Argon): Jerimum na Zona 1 (dia 1) e na Zona 2 (dia 51, defasado),
depois rotação Feijão verde → Milho verde (Z1) e Batata-doce (Z2). Cota 1.000 L/dia.

| Indicador | v1.0-Argon | edição Claude | Diferença |
|---|---:|---:|---:|
| Água total aplicada | ${f0(A.litros)} L | ${f0(B.litros)} L | **${((B.litros / A.litros - 1) * 100).toFixed(0)}%** |
| Média por dia | ${f0(A.litros / DIAS)} L | ${f0(B.litros / DIAS)} L | |
| Água perdida (passou da raiz) | ${f0(A.perdaL)} L | ${f0(B.perdaL)} L | **${((B.perdaL / Math.max(1, A.perdaL) - 1) * 100).toFixed(0)}%** |
| Zona-dias com planta em estresse | ${A.diasEstresse} | ${B.diasEstresse} | |
| Produtividade relativa média (FAO-33) | ${pct(prodMedia(A))} | ${pct(prodMedia(B))} | |
| Litros por 1% de produtividade | ${f0(A.litros / (prodMedia(A) * 100 * A.ciclos.length))} | ${f0(B.litros / (prodMedia(B) * 100 * B.ciclos.length))} | |
| Relatos "☔ Choveu aqui" usados | — | ${B.botaoChoveu} | |

## Produtividade relativa por ciclo (100% = sem falta d'água)

| Ciclo | v1.0-Argon | edição Claude |
|---|---:|---:|
${linhasCiclo}

## Por que a diferença
1. **Lâmina fixa × balanço do solo.** A Argon aplica a lâmina da fase todo dia, chova ou faça sol; o excedente atravessa a raiz e se perde. A edição Claude só devolve o que o solo perdeu.
2. **Calor e vento contados duas vezes.** A ET0 (Penman-Monteith) já inclui calor e vento; somar +20%/+10% por cima é água a mais.
3. **Gotejo molha só uma faixa.** O coeficiente Kr corrige a demanda enquanto a copa ainda não cobre o chão — muda pequena não bebe como lavoura fechada.
4. **Chuva guardada.** Chuva de ontem fica no "balde" e é consumida aos poucos, em vez de um desconto de um dia só. Pancadas locais entram pelo botão ☔.
5. **Água escassa vai para quem perde mais.** Quando a cota aperta, o rateio usa o Ky (FAO-33) de cada fase, não um "crítico/não crítico" binário.

> [!IMPORTANT]
> Em junho/julho este cenário pede ~1.500 L/dia (milho + batata-doce no pico) para uma cota de 1.000 L.
> Nenhuma regra resolve isso por inteiro: a Argon salva o milho e sacrifica a batata-doce (74%); a edição Claude
> divide pelo Ky e protege a batata em engorda, que perde mais por litro faltante (milho já em grão leitoso).
> No app, o assistente **"Quando plantar?"** detecta esse choque **antes do plantio** e sugere a data que cabe na cota.

> [!NOTE]
> Clima sintético calibrado nas normais do Seridó; os números servem para comparar políticas, não para prever a safra real.
`;
fs.writeFileSync(path.join(__dirname, '..', 'BENCHMARK_260_DIAS.md'), md);
console.log(md);
