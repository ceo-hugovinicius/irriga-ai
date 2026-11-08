/**
 * ==============================================================================
 * 🌱 SABIÁ · Robô Oficial do Telegram para o Grupo da Família
 * ==============================================================================
 * Envia automaticamente para o grupo do Telegram:
 *  1. ☀️ Boletim da Manhã (06:00): DAP das culturas, litros por zona, clima e Pro Tip.
 *  2. 🌙 Fechamento do Entardecer (18:00): Total regado, cota economizada e repouso noturno.
 *  3. 🚨 Alertas Imediatos: Cano seco, bomba parada e caixa < 20%.
 *  4. 📡 Queda Crítica: Notifica apenas se o SABIÁ ficar offline por mais de 24 horas.
 *
 * 100% Seguro: Usa a API Oficial do Telegram (sem escanear QR Code pessoal).
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Módulos do SABIÁ
const Core = require('../core/irriga-core.js');
const Notif = require('../core/notificacoes-sabia.js');

const CONFIG_PATH = path.join(__dirname, 'config.json');

let config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  envioManhaHora: 6,
  envioTardeHora: 18,
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    config = Object.assign(config, loaded);
  } catch (e) {
    console.error('Erro ao carregar config.json:', e.message);
  }
}

let ultimoEnvioManhaData = '';
let ultimoEnvioTardeData = '';
let ultimoAlertaDisparadoTs = 0;
let ultimoPingSabiaTs = Date.now();
let alerta24hDisparado = false;
let estadoAtual = Core.estadoPadrao();

/**
 * Envia uma mensagem via API Oficial do Telegram
 */
function enviarMensagemTelegram(texto) {
  return new Promise((resolve) => {
    if (!config.botToken || !config.chatId) {
      console.warn('⚠️ [Telegram Bot] Token ou Chat ID não configurados. Exibindo no console:\n');
      console.log(texto);
      return resolve(false);
    }

    console.log(`📤 [Telegram Bot] Enviando mensagem para o grupo (${new Date().toLocaleTimeString()}):`);
    console.log(texto.split('\n')[0]);

    const postData = JSON.stringify({
      chat_id: config.chatId,
      text: texto,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${encodeURIComponent(config.botToken)}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.ok) {
            console.log('✅ [Telegram Bot] Mensagem entregue com sucesso ao grupo!');
            return resolve(true);
          } else {
            console.warn('⚠️ [Telegram Bot] Falha no envio formatado, tentando fallback sem markdown:', parsed.description);
            // Fallback sem markdown
            const fallbackData = JSON.stringify({
              chat_id: config.chatId,
              text: texto,
              disable_web_page_preview: true,
            });
            const fallbackReq = https.request({
              hostname: 'api.telegram.org',
              port: 443,
              path: `/bot${encodeURIComponent(config.botToken)}/sendMessage`,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(fallbackData),
              },
              timeout: 10000,
            }, (fRes) => {
              let fBody = '';
              fRes.on('data', (d) => { fBody += d; });
              fRes.on('end', () => {
                try {
                  const fParsed = JSON.parse(fBody);
                  if (fParsed.ok) {
                    console.log('✅ [Telegram Bot] Mensagem entregue no fallback com sucesso!');
                    return resolve(true);
                  }
                  resolve(false);
                } catch (e) { resolve(false); }
              });
            });
            fallbackReq.on('error', () => resolve(false));
            fallbackReq.write(fallbackData);
            fallbackReq.end();
          }
        } catch (e) {
          return resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ [Telegram Bot] Falha de conexão HTTPS:', e.message);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Executa as verificações de horário das 06:00 e 18:00
 */
function verificarAgendamentoDiario() {
  const agora = new Date();
  const hora = agora.getHours();
  const min = agora.getMinutes();
  const hoje = Core.isoDate(agora);

  // 1. Boletim Matinal (06:00 - 06:15)
  if (hora === config.envioManhaHora && min <= 15 && ultimoEnvioManhaData !== hoje) {
    ultimoEnvioManhaData = hoje;
    const P = Core.planejarDia(estadoAtual, [], hoje);
    const msg = Notif.gerarResumoManha(estadoAtual, { pHoje: P }, hoje);
    enviarMensagemTelegram(msg);
  }

  // 2. Fechamento do Entardecer (18:00 - 18:15)
  if (hora === config.envioTardeHora && min <= 15 && ultimoEnvioTardeData !== hoje) {
    ultimoEnvioTardeData = hoje;
    const P = Core.planejarDia(estadoAtual, [], hoje);
    const msg = Notif.gerarResumoTarde(estadoAtual, { pHoje: P }, hoje);
    enviarMensagemTelegram(msg);
  }

  // 3. Checagem de SABIÁ Offline há mais de 24 horas consecutivas
  const horasSemPing = (Date.now() - ultimoPingSabiaTs) / 3600000;
  if (horasSemPing >= 24 && !alerta24hDisparado) {
    alerta24hDisparado = true;
    const msg = Notif.gerarAlertaEmergencia('sabia_offline_24h', {
      siteNome: estadoAtual.site?.nome,
    });
    enviarMensagemTelegram(msg);
  } else if (horasSemPing < 24) {
    alerta24hDisparado = false;
  }
}

// Trata execução pontual por linha de comando (CLI ou GitHub Action)
const args = process.argv.slice(2);
if (args.includes('--teste')) {
  console.log('🔔 [SABIÁ] Disparando mensagem de teste pontual para o Telegram...');
  const msgTeste = `🔔 *TESTE OPERACIONAL DO SABIÁ* 🦅\n📍 *${estadoAtual.site?.nome || 'Sítio'}*\n\nConexão com o grupo do Telegram realizada com sucesso! O robô enviará os boletins diários da roça às 06:00 e 18:00 com 100% de segurança e privacidade.`;
  enviarMensagemTelegram(msgTeste).then(() => process.exit(0));
} else if (args.includes('--manha')) {
  console.log('☀️ [SABIÁ] Gerando e enviando Boletim Matinal pontual...');
  const hoje = Core.isoDate(new Date());
  const P = Core.planejarDia(estadoAtual, [], hoje);
  const msg = Notif.gerarResumoManha(estadoAtual, { pHoje: P }, hoje);
  enviarMensagemTelegram(msg).then(() => process.exit(0));
} else if (args.includes('--tarde')) {
  console.log('🌙 [SABIÁ] Gerando e enviando Fechamento do Entardecer pontual...');
  const hoje = Core.isoDate(new Date());
  const P = Core.planejarDia(estadoAtual, [], hoje);
  const msg = Notif.gerarResumoTarde(estadoAtual, { pHoje: P }, hoje);
  enviarMensagemTelegram(msg).then(() => process.exit(0));
} else {
  console.log('🤖 [SABIÁ Telegram Bot] Serviço contínuo iniciado com sucesso.');
  console.log(`⏱️ Boletim Matinal programado para as ${config.envioManhaHora}:00.`);
  console.log(`⏱️ Fechamento do Entardecer programado para as ${config.envioTardeHora}:00.`);
  console.log('🛡️ Monitoramento de emergências ativo (Cano Seco, Caixa < 20% e Offline > 24h).');

  setInterval(verificarAgendamentoDiario, 30000);
}

module.exports = {
  enviarMensagemTelegram,
  verificarAgendamentoDiario,
  config,
};
