/* ============================================================================
 * 🌱 SABIÁ · Notificações, Resumos Diários & Pro Tips Agronômicos
 * ============================================================================
 * Gera boletins acolhedores e alertas em tempo real formatados especialmente
 * para WhatsApp (grupos da família e do sítio), Webhooks e SMS.
 *
 * Tipos de Mensagens:
 *  1. ☀️ Resumo da Manhã (06:00): Regas do 1º turno, fases das culturas, cota e Pro Tip
 *  2. 🌙 Resumo do Entardecer (18:00): Total do dia, cota economizada e status da caixa
 *  3. 🚨 Alertas de Emergência: Tubulação seca, caixa crítica e filtro 120 Mesh
 * ========================================================================== */

(function (root) {
  const Core = (typeof module !== 'undefined' && module.exports)
    ? require('./irriga-core.js') : (root.IrrigaCore || {});
  const Crops = (typeof module !== 'undefined' && module.exports)
    ? require('./crops.js') : (root.IrrigaCrops || {});

  const fmtL = (l) => `${Math.round(l).toLocaleString('pt-BR')} L`;
  const fmtPct = (p) => `${Math.round(p)}%`;

  /**
   * Gera uma Pro Tip agronômica inteligente com base nas culturas ativas e clima.
   */
  function gerarProTip(S, P, climaHoje) {
    const tmax = climaHoje?.tmax ?? 33;
    const wind = climaHoje?.wind ?? 20;
    const rainProb = climaHoje?.rain_prob ?? 0;
    const rainMm = climaHoje?.rain ?? 0;

    const dicas = [];

    // 1. Dica de Reta Final e Restrição Hídrica (°Brix e Cura)
    (S.zones || []).forEach((z) => {
      if (!z.enabled || !z.crop) return;
      const cd = Core.cropDay(z.crop.id, Core.daysBetween(z.crop.plantio, Core.isoDate(new Date())));
      if (cd && cd.retaFinal && cd.crop.reta_final) {
        dicas.push(`🍯 *Reta final do ${cd.crop.nome} (${z.nome.split('—')[0].trim()}):* Faltam apenas ${cd.diasParaColher} dias para a colheita! O SABIÁ reduziu a água para ${cd.crop.reta_final.motivo}. A terra mais seca nessa fase é essencial para a qualidade do fruto.`);
      }
    });

    // 2. Dica de Floração / Fase Crítica (Sensibilidade máxima à falta d'água)
    (S.zones || []).forEach((z) => {
      if (!z.enabled || !z.crop) return;
      const cd = Core.cropDay(z.crop.id, Core.daysBetween(z.crop.plantio, Core.isoDate(new Date())));
      if (cd && cd.critica && !cd.retaFinal) {
        dicas.push(`🌸 *Fase nobre do ${cd.crop.nome} (${z.nome.split('—')[0].trim()}):* A cultura está em *${cd.nomeFase}*! O SABIÁ está priorizando cada gota para garantir o vingamento dos frutos e evitar aborto de flores.`);
      }
    });

    // 3. Dica de Calor Extremo e Palhada
    if (tmax >= 32) {
      const tmaxArr = Math.round(tmax);
      const zonasSemPalhada = (S.zones || []).filter((z) => z.enabled && z.crop && !z.mulch);
      if (zonasSemPalhada.length > 0) {
        const nomesZ = zonasSemPalhada.map((z) => z.nome.split('—')[0].trim()).join(' e ');
        dicas.push(`☀️ *Calor forte hoje (${tmaxArr}°C):* ${nomesZ} ainda está com a terra descoberta. Cobrir com palhada seca (bagaço ou capim seco) corta a perda d'água do solo em 15% e protege a raiz do sol quente!`);
      } else {
        dicas.push(`☀️ *Calor de ${tmaxArr}°C esperado:* Graças à palhada nos canteiros, as raízes estão blindadas contra o sol das 12h às 15h até o turno da tarde (16h).`);
      }
    }

    // 4. Dica de Vento Seco do Seridó
    if (wind >= 22) {
      dicas.push(`💨 *Vento seco do Seridó (${Math.round(wind)} km/h):* O vento acelera o ressecamento das folhas. O gotejo no pé evita deriva e perda por evaporação em comparação com aspersores.`);
    }

    // 5. Dica de Chuva Prevista
    if (rainProb >= 40) {
      dicas.push(`🌧️ *Chance de chuva hoje (${rainProb}%):* Se cair chuva no sítio, lembre de tocar em *"☔ Choveu Aqui"* no app para descontar do balde e economizar a caixa d'água!`);
    }

    // 6. Dica de Ponto de Colheita
    (S.zones || []).forEach((z) => {
      if (!z.enabled || !z.crop) return;
      const cd = Core.cropDay(z.crop.id, Core.daysBetween(z.crop.plantio, Core.isoDate(new Date())));
      if (cd && cd.diasParaColher <= 3 && cd.crop.colheita) {
        dicas.push(`✂️ *Ponto de colheita do ${cd.crop.nome}:* ${cd.crop.colheita}`);
      }
    });

    // Fallback: Dica Geral de Economia
    if (!dicas.length) {
      dicas.push(`🌱 *Manejo Autônomo:* As regas divididas em 2 turnos (04h e 16h) garantem que as plantas se hidratem nas horas mais frescas e dão tempo para o poço artesiano recompor a caixa.`);
    }

    return dicas[0];
  }

  /**
   * 🌅 BOLETIM MATINAL (Para envio às 06:00, pós 1º turno)
   */
  function gerarResumoManha(S, P, dataStr) {
    const hoje = dataStr || Core.isoDate(new Date());
    const plano = P?.pHoje || Core.planejarDia(S, [], hoje);
    const clima = plano.clima || Core.climatologia(hoje);
    const nivelCaixa = S.tank?.level_L ?? 3750;
    const capCaixa = S.tank?.capacity || 5000;
    const pctCaixa = Math.round((100 * nivelCaixa) / capCaixa);
    const cotaDiaria = S.quota?.daily_L || 1000;

    let totalManha = 0;
    const linhasZonas = [];

    (S.zones || []).forEach((z, idx) => {
      if (!z.enabled || !z.crop) {
        linhasZonas.push(`• *Zona ${z.id}:* 🟫 Canteiro livre (0 L)`);
        return;
      }
      const cd = Core.cropDay(z.crop.id, Core.daysBetween(z.crop.plantio, hoje));
      const dadosZona = plano.porZona ? plano.porZona[idx] : null;
      const volTurnoManha = dadosZona ? Math.round(dadosZona.litros * 0.60) : 0;
      totalManha += volTurnoManha;

      const emoji = cd?.crop?.emoji || '🌱';
      const nomeCultura = cd?.crop?.nome || z.crop.id;
      const faseStr = cd ? `DAP ${cd.dap} · ${cd.nomeFase}` : 'Em cultivo';

      linhasZonas.push(`• *${z.nome.split('—')[0].trim()}:* ${emoji} *${nomeCultura}* (${faseStr})\n  💧 ~${fmtL(volTurnoManha)} entregues no turno das 04:00`);
    });

    const proTip = gerarProTip(S, P, clima);

    return `☀️ *BOM DIA, FAMÍLIA! BOLETIM DO SABIÁ* 🦅
📍 *${S.site?.nome || 'Sítio — Seridó (PB)'}* · ${hoje.split('-').reverse().join('/')}

🌱 *1º Turno da Manhã Concluído:*
${linhasZonas.join('\n')}

📊 *Situação Hídrica:*
• 💧 *Volume matinal:* ~${fmtL(totalManha)} aplicados
• 🚰 *Cota diária:* ${fmtL(cotaDiaria)} reservada para hoje
• 🪣 *Caixa 5.000 L:* ${fmtL(nivelCaixa)} (${pctCaixa}%)

🌤️ *Previsão do Tempo:*
• 🌡️ Máxima: *${Math.round(clima.tmax ?? 33)}°C* | Mínima: *${Math.round(clima.tmin ?? 22)}°C*
• 💨 Vento: *${Math.round(clima.wind ?? 18)} km/h* ${clima.rain_prob >= 30 ? `| 🌧️ *${clima.rain_prob}% de chuva*` : ''}

💡 *Pro Tip Agronômica:*
${proTip}

👉 *Próximo turno:* 🌇 Hoje às 16:00 (Turno da Tarde)`;
  }

  /**
   * 🌙 BOLETIM DO ENTARDECER (Para envio às 18:00, pós 2º turno)
   */
  function gerarResumoTarde(S, P, dataStr, totalEntregueDiaL) {
    const hoje = dataStr || Core.isoDate(new Date());
    const plano = P?.pHoje || Core.planejarDia(S, [], hoje);
    const nivelCaixa = S.tank?.level_L ?? 3750;
    const capCaixa = S.tank?.capacity || 5000;
    const pctCaixa = Math.round((100 * nivelCaixa) / capCaixa);
    const cotaDiaria = S.quota?.daily_L || 1000;

    const gastoReal = typeof totalEntregueDiaL === 'number' && totalEntregueDiaL > 0
      ? Math.round(totalEntregueDiaL)
      : Math.round(plano.totalL);

    const saldoCota = Math.max(0, cotaDiaria - gastoReal);

    const linhasZonas = [];
    (S.zones || []).forEach((z, idx) => {
      if (!z.enabled || !z.crop) {
        linhasZonas.push(`• *Zona ${z.id}:* 🟫 Canteiro livre (0 L)`);
        return;
      }
      const cd = Core.cropDay(z.crop.id, Core.daysBetween(z.crop.plantio, hoje));
      const dadosZona = plano.porZona ? plano.porZona[idx] : null;
      const volTotalZona = dadosZona ? Math.round(dadosZona.litros) : 0;
      const emoji = cd?.crop?.emoji || '🌱';
      const nomeCultura = cd?.crop?.nome || z.crop.id;
      linhasZonas.push(`• *${z.nome.split('—')[0].trim()}:* ${emoji} *${nomeCultura}* — ${fmtL(volTotalZona)} total no dia`);
    });

    return `🌙 *BOA NOITE, FAMÍLIA! FECHAMENTO DO SABIÁ* 🦅
📍 *${S.site?.nome || 'Sítio — Seridó (PB)'}* · ${hoje.split('-').reverse().join('/')}

✅ *Regas do Dia Finalizadas com Sucesso:*
${linhasZonas.join('\n')}

📈 *Balanço da Água:*
• 💧 *Total aplicado:* *${fmtL(gastoReal)}* (nos 2 turnos 04h/16h)
• 🎯 *Cota autorizada:* *${fmtL(cotaDiaria)}*
• 💚 *Economia de cota guardada:* *${fmtL(saldoCota)}*
• 🪣 *Nível atual da Caixa:* *${fmtL(nivelCaixa)}* (${pctCaixa}%)

🌅 O SABIÁ entrará em repouso noturno e iniciará o próximo ciclo amanhã pontualmente às *04:00* no fresco da madrugada!`;
  }

  /**
   * 🚨 ALERTAS DE EMERGÊNCIA
   */
  function gerarAlertaEmergencia(tipo, dados = {}) {
    const nomeSitio = dados.siteNome || 'Sítio — Seridó (PB)';
    const dataHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    switch (tipo) {
      case 'tubo_seco':
      case 'bomba_parada':
        return `🚨 *ALERTA URGENTE DO SABIÁ: CANO SECO / BOMBA PARADA* 🚨
📍 *${nomeSitio}* · ${dataHora}

⚠️ *Problema Detectado:*
A válvula da *Zona ${dados.zona || 1}* abriu para regar, mas o Sensor de Vazão registrou *0 L/min* (sem água passando na tubulação).

🛠️ *O que fazer:*
1. Verifique se a bomba d'água auxiliar está ligada.
2. Confira se o registro geral da saída da caixa de 5.000 L está aberto.
3. Cheque se há ar ou entupimento na sucção.

🛡️ *O SABIÁ desligou o sistema preventivamente para não queimar a bomba a seco.*`;

      case 'caixa_critica':
        return `🪣 *ALERTA: NÍVEL DA CAIXA D'ÁGUA CRÍTICO* 🪣
📍 *${nomeSitio}* · ${dataHora}

⚠️ O volume da caixa de 5.000 L caiu para *${fmtL(dados.nivel_L || 1200)}* (*${dados.pct || 24}%*), atingindo a reserva mínima de segurança.

🛑 *Medida Automática:*
O SABIÁ pausou as regas automáticas para proteger as torneiras e encanamentos.
👉 Acione a bomba do poço artesiano para restabelecer o nível.`;

      case 'filtro_sujo':
        return `🧹 *AVISO DE MANUTENÇÃO: FILTRO 120 MESH* 🧹
📍 *${nomeSitio}* · ${dataHora}

A saúde do filtro de discos caiu para *${dados.pct || 65}%* (perda de pressão detectada pelo sensor de vazão).
👉 Recomendada a lavagem dos anéis do filtro para garantir a uniformidade dos gotejadores.`;

      case 'sabia_offline':
        return `📡 *AVISO: SABIÁ SEM SINAL* 📡
📍 *${nomeSitio}* · ${dataHora}

O servidor autônomo SABIÁ está sem comunicação com a internet há mais de 3 minutos (queda de Wi-Fi ou falta de energia na tomada da bancada).
👉 O SABIÁ continua regando normalmente pelo relógio interno, mas o app online só atualizará após a rede voltar.`;

      default:
        return `ℹ️ *AVISO DO SISTEMA SABIÁ:* ${dados.msg || 'Aviso operacional registrado.'}`;
    }
  }

  /**
   * Gera o link direto para disparar no WhatsApp (Web ou App móvel).
   */
  function gerarLinkWhatsApp(texto, numeroOpcional = '') {
    const textoCodificado = encodeURIComponent(texto);
    if (numeroOpcional) {
      const numLimpo = String(numeroOpcional).replace(/\D/g, '');
      return `https://wa.me/${numLimpo}?text=${textoCodificado}`;
    }
    return `https://api.whatsapp.com/send?text=${textoCodificado}`;
  }

  const api = {
    gerarProTip,
    gerarResumoManha,
    gerarResumoTarde,
    gerarAlertaEmergencia,
    gerarLinkWhatsApp,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SabiaNotificacoes = api;
})(typeof window !== 'undefined' ? window : globalThis);
