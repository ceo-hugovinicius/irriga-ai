/* ============================================================================
 * 🌱 SABIÁ · Notificações & Boletins Agronômicos Autônomos (Telegram do Grupo)
 * ============================================================================
 * Gera exclusivamente mensagens operacionais agronômicas para o grupo da família:
 *  1. ☀️ Boletim da Manhã (06:00): Status do cultivo, previsão, fases e Pro Tips de manejo.
 *  2. 🌙 Fechamento do Entardecer (18:00): Água gasta, cota guardada e saúde da lavoura.
 *  3. 🧺 Alertas de Colheita & Comercialização: Avisos com dias de antecedência para organizar caixas e venda.
 *  4. ⚠️ Alerta de Choque de Cota / Plantas com Sede: Detecta déficit hídrico consecutivo e sugere ajuste.
 *  5. 🚨 Emergências Reais: Cano seco (bomba parada/registro fechado) e caixa d'água na reserva.
 *  6. 📡 Queda Crítica de Conexão: Notifica APENAS se o SABIÁ ficar mais de 24 horas sem ping.
 * ========================================================================== */

(function (root) {
  const Core = (typeof module !== 'undefined' && module.exports)
    ? require('./irriga-core.js') : (root.IrrigaCore || {});
  const Crops = (typeof module !== 'undefined' && module.exports)
    ? require('./crops.js') : (root.IrrigaCrops || {});

  const fmtL = (l) => `${Math.round(l).toLocaleString('pt-BR')} L`;

  /**
   * Gera Pro Tips puramente agrícolas, operacionais e de manejo de safra.
   */
  function gerarProTipOperacional(S, P, climaHoje) {
    const tmax = climaHoje?.tmax ?? 33;
    const tmaxArr = Math.round(tmax);
    const rainProb = climaHoje?.rain_prob ?? 0;
    const hojeStr = Core.isoDate(new Date());

    const dicas = [];

    // 1. Alerta de Colheita Próxima (Organização da Família, Caixaria e Compradores)
    (S.zones || []).forEach((z) => {
      if (!z.enabled || !z.crop) return;
      const cd = Core.cropDay(z.crop.id, Core.daysBetween(z.crop.plantio, hojeStr));
      if (cd && cd.diasParaColher <= 7) {
        if (cd.diasParaColher <= 2) {
          dicas.push(`🧺 *MUTIRÃO DE COLHEITA (${cd.crop.nome.toUpperCase()}):* Faltam apenas *${cd.diasParaColher} dias* para colher na ${z.nome.split('—')[0].trim()}! Hora de reunir o pessoal, providenciar caixaria e fechar os compradores da feira/Ceasa.`);
        } else {
          dicas.push(`🧺 *Colheita se aproximando (${cd.crop.nome}):* Faltam *${cd.diasParaColher} dias* para o ponto de corte na ${z.nome.split('—')[0].trim()}. Dica de colheita: ${cd.crop.colheita}`);
        }
      }
    });

    // 2. Alerta de Reta Final e Restrição Hídrica (Açúcar °Brix / Casca Firme)
    (S.zones || []).forEach((z) => {
      if (!z.enabled || !z.crop) return;
      const cd = Core.cropDay(z.crop.id, Core.daysBetween(z.crop.plantio, hojeStr));
      if (cd && cd.retaFinal && cd.crop.reta_final) {
        dicas.push(`🍯 *Manejo de Reta Final (${cd.crop.nome}):* A ${z.nome.split('—')[0].trim()} está na fase final de maturação. O sistema reduziu a rega para ${cd.crop.reta_final.motivo}. Se a terra parecer mais seca nos próximos dias, isso é correto e intencional!`);
      }
    });

    // 3. Alerta de Plantas Passando Sede (Déficit Hídrico Consecutivo)
    const pedidoReal = P?.pHoje?.pedidoRealL || 0;
    const cotaDiaria = S.quota?.daily_L || 1000;
    if (pedidoReal > cotaDiaria * 1.15) {
      const defPct = Math.round((100 * (pedidoReal - cotaDiaria)) / pedidoReal);
      dicas.push(`⚠️ *Aviso de Cota Apertada:* As plantas estão pedindo ${fmtL(pedidoReal)}, mas a cota diária está travada em ${fmtL(cotaDiaria)} (−${defPct}% de água). Se o tempo continuar quente, considere aumentar a cota temporariamente para ${fmtL(Math.round(pedidoReal))} ou dar +1h Flex para não perder rendimento.`);
    }

    // 4. Floração e Pegamento de Frutos (Fase Nobre que não pode faltar água)
    (S.zones || []).forEach((z) => {
      if (!z.enabled || !z.crop) return;
      const cd = Core.cropDay(z.crop.id, Core.daysBetween(z.crop.plantio, hojeStr));
      if (cd && cd.critica && !cd.retaFinal) {
        dicas.push(`🌸 *Fase de Floração/Frutificação (${cd.crop.nome}):* A cultura está no ponto que mais exige água no ciclo todo. A irrigação foi reforçada para segurar a florada e garantir que os frutos vinguem sem abortar.`);
      }
    });

    // 5. Manejo Prático de Terra com Palhada vs. Sol Forte
    if (tmax >= 32) {
      const zonasSemPalhada = (S.zones || []).filter((z) => z.enabled && z.crop && !z.mulch);
      if (zonasSemPalhada.length > 0) {
        const nomesZ = zonasSemPalhada.map((z) => z.nome.split('—')[0].trim()).join(' e ');
        dicas.push(`☀️ *Sol quente previsto (${tmaxArr}°C):* ${nomesZ} está com solo descoberto. Cobrir com palhada seca (capim seco ou restolho) segura a umidade das 04h até o turno das 16h e reduz em 15% o gasto de água.`);
      }
    }

    // 6. Chuva na Roça
    if (rainProb >= 40) {
      dicas.push(`🌧️ *Previsão de chuva hoje (${rainProb}% de chance):* Se chover na roça, anote no app pelo botão *"☔ Choveu Aqui"* para o sistema guardar a água da caixa de 5.000 L para os dias secos.`);
    }

    return dicas.length > 0
      ? dicas[0]
      : `🌱 *Lavoura em pleno desenvolvimento:* Todos os canteiros receberam a lâmina calculada para hoje dentro da cota programada.`;
  }

  /**
   * ☀️ BOLETIM OPERACIONAL DA MANHÃ (Envio automático às 06:00 para o grupo)
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
        linhasZonas.push(`• *${z.nome.split('—')[0].trim()}:* 🟫 Canteiro livre (em descanso / preparo)`);
        return;
      }
      const cd = Core.cropDay(z.crop.id, Core.daysBetween(z.crop.plantio, hoje));
      const dadosZona = plano.porZona ? plano.porZona[idx] : null;
      const volTurnoManha = dadosZona ? Math.round(dadosZona.litros * 0.60) : 0;
      totalManha += volTurnoManha;

      const emoji = cd?.crop?.emoji || '🌱';
      const nomeCultura = cd?.crop?.nome || z.crop.id;
      const faseStr = cd ? `DAP ${cd.dap} (${cd.nomeFase})` : 'Em cultivo';
      const colheitaAviso = cd && cd.diasParaColher <= 10 ? ` ➔ *Colheita em ${cd.diasParaColher}d!*` : '';

      linhasZonas.push(`• *${z.nome.split('—')[0].trim()}:* ${emoji} *${nomeCultura}* — ${faseStr}${colheitaAviso}\n  💧 Rega matinal: *${fmtL(volTurnoManha)}*`);
    });

    const proTip = gerarProTipOperacional(S, P, clima);

    return `☀️ *BOLETIM DO SÍTIO · 1º TURNO CONCLUÍDO* 🦅
📍 *${S.site?.nome || 'Sítio — Seridó (PB)'}* · ${hoje.split('-').reverse().join('/')}

🌱 *Status das Culturas na Roça:*
${linhasZonas.join('\n')}

📊 *Água & Reservatório:*
• 💧 Regado na fresca das 04h: *${fmtL(totalManha)}*
• 🚰 Cota reservada p/ o dia: *${fmtL(cotaDiaria)}*
• 🪣 Nível da Caixa de 5.000 L: *${fmtL(nivelCaixa)}* (${pctCaixa}%)

🌤️ *Tempo Hoje:* Máx: *${Math.round(clima.tmax ?? 33)}°C* | Vento: *${Math.round(clima.wind ?? 18)} km/h* ${clima.rain_prob >= 30 ? `| 🌧️ *${clima.rain_prob}% de chuva*` : ''}

💡 *Recomendação Operacional da Lavoura:*
${proTip}

👉 *2º Turno de rega agendado para o entardecer às 16:00.*`;
  }

  /**
   * 🌙 FECHAMENTO OPERACIONAL DO ENTARDECER (Envio automático às 18:00 para o grupo)
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
        linhasZonas.push(`• *${z.nome.split('—')[0].trim()}:* 🟫 Canteiro livre`);
        return;
      }
      const cd = Core.cropDay(z.crop.id, Core.daysBetween(z.crop.plantio, hoje));
      const dadosZona = plano.porZona ? plano.porZona[idx] : null;
      const volTotalZona = dadosZona ? Math.round(dadosZona.litros) : 0;
      const emoji = cd?.crop?.emoji || '🌱';
      const nomeCultura = cd?.crop?.nome || z.crop.id;
      linhasZonas.push(`• *${z.nome.split('—')[0].trim()}:* ${emoji} *${nomeCultura}* ➔ Total recebido hoje: *${fmtL(volTotalZona)}*`);
    });

    return `🌙 *FECHAMENTO DO DIA NO SÍTIO* 🦅
📍 *${S.site?.nome || 'Sítio — Seridó (PB)'}* · ${hoje.split('-').reverse().join('/')}

✅ *Irrigações do dia concluídas com sucesso:*
${linhasZonas.join('\n')}

📈 *Balanço Hídrico:*
• 💧 Água total aplicada hoje: *${fmtL(gastoReal)}* (Turno 04h + Turno 16h)
• 🎯 Cota autorizada: *${fmtL(cotaDiaria)}*
• 💚 Economia guardada na caixa: *${fmtL(saldoCota)}*
• 🪣 Caixa de 5.000 L: *${fmtL(nivelCaixa)}* (${pctCaixa}%)

🌅 Todas as válvulas estão fechadas. Próxima rega automática programada para amanhã às *04:00*.`;
  }

  /**
   * 🚨 ALERTAS DE EMERGÊNCIA REAIS
   */
  function gerarAlertaEmergencia(tipo, dados = {}) {
    const nomeSitio = dados.siteNome || 'Sítio — Seridó (PB)';
    const dataHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    switch (tipo) {
      case 'tubo_seco':
      case 'bomba_parada':
        return `🚨 *ALERTA URGENTE NO SÍTIO: CANO SECO OU BOMBA PARADA* 🚨
📍 *${nomeSitio}* · ${dataHora}

⚠️ *O que aconteceu:*
A válvula da *Zona ${dados.zona || 1}* abriu para irrigar, mas o sensor registrou *0 L/min* (nenhuma água passando pela tubulação).

🛠️ *Ações necessárias no sítio:*
1. Verificar se a bomba auxiliar do poço/caixa está ligada.
2. Conferir se o registro geral da saída da caixa de 5.000 L está aberto.
3. Checar se houve entupimento grosso ou entrada de ar na sucção.

🛡️ *O SABIÁ desligou o sistema imediatamente para proteger a bomba contra queima a seco.*`;

      case 'caixa_critica':
        return `🪣 *ALERTA URGENTE: NÍVEL DA CAIXA CRÍTICO* 🪣
📍 *${nomeSitio}* · ${dataHora}

⚠️ O volume da caixa d'água caiu para *${fmtL(dados.nivel_L || 1000)}* (*${dados.pct || 20}%*), atingindo o limite de segurança da propriedade.

🛑 *Medida adotada:*
O SABIÁ suspendeu as irrigações automáticas para não esgotar as torneiras da casa.
👉 Ligar a bomba do poço artesiano para reabastecer a caixa.`;

      case 'filtro_sujo':
        return `🧹 *AVISO DE MANUTENÇÃO: LAVAR FILTRO 120 MESH* 🧹
📍 *${nomeSitio}* · ${dataHora}

A saúde do filtro de discos caiu para *${dados.pct || 65}%* (perda de vazão detectada no gotejamento).
👉 Na próxima visita ao sítio, favor desrosquear o filtro e lavar os anéis para manter a pressão dos gotejadores.`;

      case 'sabia_offline_24h':
        return `📡 *ALERTA OPERACIONAL: SABIÁ SEM SINAL HÁ MAIS DE 24 HORAS* 📡
📍 *${nomeSitio}* · ${dataHora}

⚠️ O dispositivo de campo completou *mais de 24 horas consecutivas sem conectar à internet*.
💡 *Fique tranquilo:* O SABIÁ continua executando as regas pelo relógio interno, mas não está recebendo novas previsões climáticas nem transmitindo o gasto do dia.
👉 Quando alguém for ao sítio, favor checar se o roteador Wi-Fi caiu ou se o disjuntor da bancada desarmou.`;

      default:
        return `ℹ️ *Aviso do Sítio:* ${dados.msg || 'Registro operacional.'}`;
    }
  }

  const api = {
    gerarProTipOperacional,
    gerarResumoManha,
    gerarResumoTarde,
    gerarAlertaEmergencia,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SabiaNotificacoes = api;
})(typeof window !== 'undefined' ? window : globalThis);
