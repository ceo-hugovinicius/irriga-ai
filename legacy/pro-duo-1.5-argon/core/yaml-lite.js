/* ============================================================================
 * Irriga.ai Pro-Duo · v1.5-Argon — YAML Lite + Ponte Simbiótica com o Claude
 * ----------------------------------------------------------------------------
 * - Sem dependências externas (roda offline no navegador e no Node).
 * - Gera o arquivo `plano_irrigacao_sitio.yaml` compatível com v1.0-Argon e v2.0,
 *   já com diagnóstico FAO-56 em tempo real, relato de sintomas clicáveis e
 *   instruções de perito agrônomo embutidas.
 * - Lê de volta o bloco YAML devolvido pelo Claude (aceita chaves v1.0 e v1.5/v2.0)
 *   e valida guardrails físicos (GPIOs proibidos, limites de cota, culturas, rotação).
 * ========================================================================== */
(function (root) {
  const C = (typeof module !== 'undefined' && module.exports)
    ? require('./irriga-core.js') : root.IrrigaCore;

  const GPIOS_PROIBIDOS = [13, 14, 26, 27, 32, 33, 12, 15, 34];

  const SINTOMAS_RAPIDOS = [
    { id: 'folhas_amarelando', emoji: '🍂', label: 'Folhas amarelando' },
    { id: 'flores_caindo',     emoji: '🌸', label: 'Flores caindo (abortamento)' },
    { id: 'fruto_rachando',    emoji: '🍉', label: 'Fruto rachando' },
    { id: 'murcha_tarde',      emoji: '🥀', label: 'Murcha nas horas quentes' },
    { id: 'vazao_fraca_fim',   emoji: '🐌', label: 'Vazão fraca no fim da linha' },
    { id: 'solo_encharcado',   emoji: ' puddles', emoji: '💦', label: 'Solo encharcado / musgo' },
    { id: 'praga_mosca',       emoji: '🐛', label: 'Praga / mosca-branca / pulgão' },
    { id: 'muda_travada',      emoji: '🌱', label: 'Planta travada (cresce devagar)' },
  ];

  /* ---------- Geração do YAML Completo (Compatível v1.0 + v1.5/v2.0) ---------- */
  function gerarYaml(state, plano, opcoes = {}) {
    const dt = (plano && plano.date) || C.isoDate(new Date());
    const p = plano || C.planejarDia(state, [], dt);
    const sintomas = (opcoes.sintomas || []).map((id) => {
      const s = SINTOMAS_RAPIDOS.find((x) => x.id === id);
      return s ? `${s.emoji} ${s.label}` : id;
    });
    const relato = (opcoes.relato || '').trim();
    const w = p.clima || C.climatologia(dt);

    const zonasYaml = state.zones.map((z, idx) => {
      const d = p.porZona[idx] || {};
      const cd = d.cd;
      const g = C.geometria(z, state.soil);
      const vaz = C.vazaoZona(z, state.soil);
      const b = d.balde || { taw: 0, raw: 0 };
      const reservaPct = b.taw > 0 ? Math.round(100 * (1 - (z.Dr_mm || 0) / b.taw)) : 100;
      const evZ = (p.eventos || []).filter((e) => e.zona === z.id);

      return `  zona_${z.id}:
    id: ${z.id}
    nome: "${z.nome}"
    ativa: ${!!z.enabled}
    area_m2: ${z.area_m2}
    metros_fita_gotejamento: ${g.metros}
    espacamento_gotejadores_cm: ${g.espacamentoCm}
    vazao_furo_lph: ${g.vazaoFuroLph}
    total_gotejadores_zona: ${g.gotejadores}
    vazao_saida_zona_lph: ${Math.round(g.vazaoLph)}
    vazao_efetiva_calculada_lpm: ${vaz.toFixed(2)}
    volume_interno_mangueira_litros: ${g.volumeMangueiraL.toFixed(1)}
    cobertura_morta_palhada: ${!!z.mulch}
    ajuste_fino_usuario_pct: ${z.fine_pct || 0}
    modo_restricao_hidrica: "${z.restricao_modo || 'auto'}"
    cultura_atual:
      id_catalogo: "${z.crop ? z.crop.id : ''}"
      nome: "${cd ? cd.crop.nome : 'Sem cultura'}"
      familia_botanica: "${cd ? cd.crop.familia : ''}"
      espacamento_minimo_rua_m: "${cd ? (cd.crop.espacamento_ruas_m || '1,0 m') : ''}"
      espacamento_entre_plantas_m: "${cd ? (cd.crop.espacamento_plantas_m || '0,30 m') : ''}"
      data_plantio: "${z.crop ? z.crop.plantio : ''}"
      familia_anterior_rotacao: "${z.crop && z.crop.anterior ? z.crop.anterior : ''}"
      dia_atual_ciclo_dap: ${cd ? cd.dap : 0}
      ciclo_total_dias: ${cd ? cd.ciclo : 0}
      fase_atual: "${cd ? cd.nomeFase : 'Inativa'}"
      kc_efetivo_hoje: ${cd ? cd.kcEf.toFixed(2) : 0}
      sensibilidade_ky_fao33: ${cd ? cd.ky : 0}
    programacao_2_turnos_hoje:
      pedido_real_planta_litros: ${Math.round(d.pedidoRealL || d.litros || 0)}
      rega_liberada_cota_litros: ${Math.round(d.litros || 0)}
      deficit_sede_litros: ${Math.round(d.deficitSedeL || 0)}
      turno_manha_cedo_litros: ${Math.round(d.litrosManha || 0)}
      turno_fim_tarde_litros: ${Math.round(d.litrosTarde || 0)}
      pulsos_agenda_hoje: ${evZ.length ? evZ.map((e) => `"${C.minToHhmm(e.inicioMin)}-${C.minToHhmm(e.fimMin)} (${Math.round(e.litros)}L)"`).join(', ') : '"Nenhum pulso necessário"'}`;
    }).join('\n\n');

    return `# ==============================================================================
# 🌱 IRRIGA.AI PRO-DUO (v1.5-Argon · Motor FAO-56) — PLANO & DIAGNÓSTICO DO SÍTIO
# ==============================================================================
# 🧠 INSTRUÇÕES DIRETAS PARA O CLAUDE (PERITO AGRÔNOMO DO SÍTIO):
# 1. Você é o Engenheiro Agrônomo Sênior (especialista em olericultura e fruticultura
#    irrigada por gotejamento no Semiárido Paraibano — São Vicente do Seridó, PB)
#    do sistema Irriga.ai Pro-Duo.
# 2. Analise abaixo:
#    - O 'relato_do_produtor_hoje' (sintomas observados em campo e pedido do usuário)
#    - O 'diagnostico_tempo_real_hoje' e o 'balanco_hidrico_solo_fao56' de cada zona.
# 3. Se precisar ajustar qualquer parâmetro do sistema, devolva um bloco \`\`\`yaml ... \`\`\`
#    contendo as chaves que deseja alterar (ou o arquivo completo).
# 4. GUARDRAILS OBRIGATÓRIOS:
#    - Culturas válidas (id_catalogo): ${Object.keys(C.CROPS).map((k) => `"${k}"`).join(', ')}.
#    - Tipos de solo válidos (tipo_solo): "arenoso", "franco_arenoso", "franco", "argiloso".
#    - Cota diária máxima (cota_diaria_maxima_litros): entre 50 e 5000 L.
#    - NUNCA recomende repetir a mesma família botânica seguida na mesma zona.
#    - NUNCA use os GPIOs proibidos [${GPIOS_PROIBIDOS.join(', ')}] para relés.
# ==============================================================================
versao_padrao: "1.5-argon"
sistema: "Irriga.ai Pro-Duo"
data_referencia_sistema: "${dt}"

relato_do_produtor_hoje:
  sintomas_selecionados: [${sintomas.map((s) => `"${s}"`).join(', ')}]
  observacao_humana: "${relato.replace(/"/g, '\\"') || 'Revisão geral do plano e diagnóstico das zonas.'}"

localizacao_sitio:
  nome: "${state.site.nome}"
  latitude: ${state.site.lat}
  longitude: ${state.site.lon}
  fuso_horario: "${state.site.tz}"
  tipo_solo: "${state.soil}"

cotas_e_seguranca:
  capacidade_caixa_litros: ${state.tank.capacity}
  nivel_atual_caixa_litros: ${Math.round(state.tank.level_L ?? state.tank.capacity)}
  reserva_minima_obrigatoria_pct: ${state.tank.reserve_pct}
  cota_diaria_maxima_litros: ${state.quota.daily_L}
  margem_extra_era_bom_chover_pct: ${state.quota.boost_margin_pct || 15}
  eficiencia_filtro_120_mesh_pct: ${(state.filtro && state.filtro.pct) ?? 100}

janelas_e_guarda_termica:
  termino_alvorada_hhmm: "${state.windows.end_dawn}"
  inicio_mais_cedo_noite_hhmm: "${state.windows.earliest}"
  pulso_entardecer_hhmm: "${state.windows.evening}"
  duracao_max_pulso_min: ${state.windows.pulse_max_min}
  intervalo_entre_zonas_min: ${state.windows.gap_min}
  guarda_termica_inicio_hhmm: "${state.thermal.start}"
  guarda_termica_fim_hhmm: "${state.thermal.end}"
  multiplo_minimo_volume_mangueira: ${state.thermal.min_hose_multiple}

diagnostico_tempo_real_hoje:
  clima_data: "${dt}"
  et0_mm_dia: ${(w.et0 || 5.4).toFixed(2)}
  temperatura_maxima_c: ${(w.tmax || 33).toFixed(1)}
  vento_maximo_kmh: ${(w.wind || 20).toFixed(1)}
  chuva_prevista_mm: ${(w.rain || 0).toFixed(1)}
  probabilidade_chuva_pct: ${Math.round(w.rain_prob || 0)}
  volume_total_planejado_hoje_litros: ${Math.round(p.totalL || 0)}
  corte_cota_aplicado: ${!!p.cortouCota}
  era_bom_que_chovesse_boost_pct: ${(state.boost && state.boost.pct) || 0}

zonas_de_plantio:
${zonasYaml}
`;
  }

  /* ---------- Parser / Importador Tolerante (YAML & JSON) c/ Guardrails ---------- */
  function extrairBlocoYaml(texto) {
    const m = String(texto || '').match(/```(?:yaml|yml|json)?\s*([\s\S]*?)```/i);
    return (m ? m[1] : String(texto || '')).trim();
  }

  function lerEscalar(val) {
    if (val === undefined || val === null) return null;
    const s = String(val).replace(/#.*$/, '').trim();
    if (!s) return null;
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  }

  function importarYaml(textoBruto, stateAtual) {
    const limpo = extrairBlocoYaml(textoBruto);
    if (!limpo) return { ok: false, erros: ['Texto vazio. Cole a resposta do Claude ou selecione um arquivo .yaml.'] };

    const novo = JSON.parse(JSON.stringify(stateAtual));
    const mudancas = [];
    const avisos = [];
    const erros = [];

    // Caso o usuário cole um JSON direto
    if (limpo.startsWith('{')) {
      try {
        const j = JSON.parse(limpo);
        if (j.quota && j.quota.daily_L) { novo.quota.daily_L = C.clamp(Number(j.quota.daily_L), 50, 5000); mudancas.push(`Cota diária: ${novo.quota.daily_L} L`); }
        if (j.soil && C.SOLOS[j.soil]) { novo.soil = j.soil; mudancas.push(`Solo: ${C.SOLOS[j.soil].nome}`); }
        if (Array.isArray(j.zones)) {
          j.zones.forEach((jz, i) => {
            if (!novo.zones[i]) return;
            Object.assign(novo.zones[i], jz);
            mudancas.push(`Zona ${novo.zones[i].id} atualizada via JSON`);
          });
        }
        return { ok: erros.length === 0, state: novo, mudancas, avisos, erros };
      } catch (e) {
        return { ok: false, erros: ['JSON inválido: ' + e.message] };
      }
    }

    // Verifica guardrails de GPIOs proibidos se houver seção de relés
    const gpioMatches = [...limpo.matchAll(/gpio(?:_esp32)?\s*:\s*(\d+)/gi)];
    for (const gm of gpioMatches) {
      const pin = Number(gm[1]);
      if (GPIOS_PROIBIDOS.includes(pin)) {
        erros.push(`Guardrail físico: GPIO ${pin} é reservado para botões/boias/SF1 e não pode acionar relé.`);
      }
    }

    // Divide por blocos de zona (`zona_1:`, `zona_2:`) e cabeçalho global
    const linhas = limpo.split(/\r?\n/);
    let ctxZona = null;

    for (const rawLine of linhas) {
      const semComent = rawLine.replace(/#.*$/, '');
      if (!semComent.trim()) continue;

      if (/^\s*zona_1\s*:/.test(semComent)) { ctxZona = 0; continue; }
      if (/^\s*zona_2\s*:/.test(semComent)) { ctxZona = 1; continue; }
      if (/^[a-z_]+\s*:/i.test(semComent) && !/^\s*zona_/.test(semComent)) {
        const rootKey = semComent.split(':')[0].trim();
        if (rootKey !== 'zonas_de_plantio') ctxZona = null;
      }

      const kv = semComent.match(/^\s*([a-z0-9_]+)\s*:\s*(.+)$/i);
      if (!kv) continue;
      const k = kv[1].trim();
      const v = lerEscalar(kv[2]);
      if (v === null || v === '') continue;

      // Chaves globais
      if (ctxZona === null) {
        if (k === 'tipo_solo' || k === 'soil') {
          if (C.SOLOS[v]) {
            if (novo.soil !== v) { novo.soil = v; mudancas.push(`Solo alterado para ${C.SOLOS[v].nome}`); }
          } else {
            avisos.push(`Tipo de solo "${v}" desconhecido — mantido ${novo.soil}.`);
          }
        } else if (k === 'cota_diaria_maxima_litros' || k === 'daily_L') {
          const num = Number(v);
          if (num < 10 || num > 5000) erros.push(`Cota diária (${num} L) fora da faixa segura (10–5000 L).`);
          else if (novo.quota.daily_L !== num) { novo.quota.daily_L = num; mudancas.push(`Cota diária: ${num} L/dia`); }
        } else if (k === 'nivel_atual_caixa_litros' || k === 'level_L') {
          const num = C.clamp(Number(v), 0, novo.tank.capacity);
          if (Math.round(novo.tank.level_L) !== Math.round(num)) { novo.tank.level_L = num; mudancas.push(`Nível da caixa: ${Math.round(num)} L`); }
        } else if (k === 'reserva_minima_obrigatoria_pct' || k === 'reserve_pct') {
          const num = C.clamp(Number(v), 10, 60);
          if (novo.tank.reserve_pct !== num) { novo.tank.reserve_pct = num; mudancas.push(`Reserva da caixa: ${num}%`); }
        } else if (k === 'termino_alvorada_hhmm' || k === 'end_dawn') {
          if (/^\d{2}:\d{2}$/.test(String(v)) && novo.windows.end_dawn !== v) { novo.windows.end_dawn = String(v); mudancas.push(`Término na alvorada: ${v}`); }
        } else if (k === 'pulso_entardecer_hhmm' || k === 'evening') {
          if (/^\d{2}:\d{2}$/.test(String(v)) && novo.windows.evening !== v) { novo.windows.evening = String(v); mudancas.push(`Início crepúsculo: ${v}`); }
        } else if (k === 'era_bom_que_chovesse_boost_pct') {
          const num = C.clamp(Number(v), 0, 100);
          if ((novo.boost?.pct || 0) !== num) {
            novo.boost = num > 0 ? { pct: num, until: new Date(Date.now() + 24 * 3600e3).toISOString() } : { pct: 0, until: null };
            mudancas.push(`Reforço 24h ("Era bom chover"): +${num}%`);
          }
        }
      } else {
        // Chaves de zona (zona_1 ou zona_2)
        const z = novo.zones[ctxZona];
        if (!z) continue;
        if (k === 'ativa' || k === 'enabled') {
          const b = Boolean(v);
          if (z.enabled !== b) { z.enabled = b; mudancas.push(`Zona ${z.id}: ${b ? 'ativada' : 'desativada'}`); }
        } else if (k === 'id_catalogo') {
          const cid = String(v).toLowerCase().trim();
          if (!C.CROPS[cid]) {
            erros.push(`Zona ${z.id}: cultura "${cid}" não existe no catálogo.`);
          } else if (!z.crop || z.crop.id !== cid) {
            const famAnt = z.crop && C.CROPS[z.crop.id] ? C.CROPS[z.crop.id].familia : z.crop?.anterior;
            const famNova = C.CROPS[cid].familia;
            if (famAnt && famAnt === famNova) {
              avisos.push(`Atenção na Zona ${z.id}: ${C.CROPS[cid].nome} repete a família ${famNova}. Considere rotação.`);
            }
            z.crop = { id: cid, plantio: z.crop?.plantio || C.isoDate(new Date()), anterior: famAnt || 'Leguminosas' };
            z.Dr_mm = 0;
            mudancas.push(`Zona ${z.id}: cultura alterada para ${C.CROPS[cid].emoji} ${C.CROPS[cid].nome}`);
          }
        } else if (k === 'data_plantio' || k === 'plantio') {
          if (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) && z.crop && z.crop.plantio !== v) {
            z.crop.plantio = String(v);
            mudancas.push(`Zona ${z.id}: data de plantio → ${v}`);
          }
        } else if (k === 'metros_fita_gotejamento' || k === 'tape_meters') {
          const n = C.clamp(Math.round(Number(v)), 10, 2000);
          if (z.tape_meters !== n) { z.tape_meters = n; z.flow_cal_lpm = 0; mudancas.push(`Zona ${z.id}: ${n}m de fita de gotejamento`); }
        } else if (k === 'espacamento_gotejadores_cm' || k === 'emitter_spacing_cm') {
          const n = C.clamp(Math.round(Number(v)), 10, 100);
          if (z.emitter_spacing_cm !== n) { z.emitter_spacing_cm = n; z.emitter_spacing_m = n / 100; z.flow_cal_lpm = 0; mudancas.push(`Zona ${z.id}: espaçamento de gotejadores ${n} cm`); }
        } else if (k === 'vazao_furo_lph' || k === 'emitter_flow_lph') {
          const n = C.clamp(Number(v), 0.2, 10);
          if (z.emitter_flow_lph !== n) { z.emitter_flow_lph = n; z.emitter_q_lph = n; z.flow_cal_lpm = 0; mudancas.push(`Zona ${z.id}: vazão por gotejador ${n} L/h`); }
        } else if (k === 'modo_restricao_hidrica' || k === 'restricao_modo') {
          z.restricao_modo = String(v);
          mudancas.push(`Zona ${z.id}: modo de restrição hídrica → ${v}`);
        } else if (k === 'mangueiras_16mm_abertas_agora' || k === 'lines_open') {
          const n = C.clamp(Math.round(Number(v)), 1, z.lines_total || 16);
          if (z.lines_open !== n) { z.lines_open = n; mudancas.push(`Zona ${z.id}: ${n}/${z.lines_total} linhas abertas`); }
        } else if (k === 'ajuste_fino_usuario_pct' || k === 'fine_pct') {
          const n = C.clamp(Number(v), -50, 50);
          if ((z.fine_pct || 0) !== n) { z.fine_pct = n; mudancas.push(`Zona ${z.id}: ajuste fino ${n >= 0 ? '+' : ''}${n}%`); }
        } else if (k === 'cobertura_morta_palhada' || k === 'mulch') {
          const b = Boolean(v);
          if (Boolean(z.mulch) !== b) { z.mulch = b; mudancas.push(`Zona ${z.id}: palhada ${b ? 'ativada' : 'desativada'}`); }
        } else if (k === 'vazao_calibrada_sf1_lpm' || k === 'flow_cal_lpm') {
          const n = Math.max(0, Number(v));
          if ((z.flow_cal_lpm || 0) !== n) { z.flow_cal_lpm = n; mudancas.push(`Zona ${z.id}: vazão calibrada ${n} L/min`); }
        } else if (k === 'esgotamento_atual_dr_mm' || k === 'Dr_mm') {
          const n = Math.max(0, Number(v));
          if (Math.abs((z.Dr_mm || 0) - n) > 0.05) { z.Dr_mm = n; mudancas.push(`Zona ${z.id}: esgotamento do solo Dr = ${n.toFixed(1)} mm`); }
        }
      }
    }

    if (!erros.length && !mudancas.length) {
      avisos.push('Nenhuma chave diferente do estado atual foi encontrada no YAML enviado.');
    }

    return { ok: erros.length === 0, state: novo, mudancas, avisos, erros };
  }

  const api = { SINTOMAS_RAPIDOS, GPIOS_PROIBIDOS, gerarYaml, importarYaml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IrrigaYaml = api;
})(typeof window !== 'undefined' ? window : globalThis);
