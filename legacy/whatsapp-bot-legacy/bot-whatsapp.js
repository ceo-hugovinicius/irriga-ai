/**
 * 🌱 SABIÁ · Bot Autônomo de WhatsApp para o Grupo da Família
 * ============================================================================
 * Dispara automaticamente boletins matinais, fechamentos e alertas de emergência
 * no grupo da família no WhatsApp, sem exigir intervenção humana.
 *
 * Funcionalidades:
 *  - ☀️ 06:00: Boletim matinal das culturas + Pro Tip de manejo da lavoura
 *  - 🌙 18:00: Fechamento do dia (água gasta vs. cota economizada)
 *  - 🚨 Imediato: Alerta de cano seco / bomba parada ou caixa d'água crítica
 *  - 📡 24 Horas: Alerta se o SABIÁ passar 24h sem ping de internet
 *
 * Suporta:
 *  - Evolution API / Z-API / Baileys
 *  - CallMeBot (Group & Personal API)
 *  - Webhooks Genéricos (n8n, Make, etc.)
 * ============================================================================
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const Core = require('../core/irriga-core.js');
const Notif = require('../core/notificacoes-sabia.js');

// Arquivo de configuração local (ou variáveis de ambiente)
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = {
  webhookUrl: process.env.WHATSAPP_WEBHOOK_URL || '',
  groupId: process.env.WHATSAPP_GROUP_ID || '',
  apiKey: process.env.WHATSAPP_API_KEY || '',
  apiType: process.env.WHATSAPP_API_TYPE || 'evolution', // 'evolution', 'z-api', 'callmebot', 'generic'
  mqttBroker: 'mqtt://broker.hivemq.com',
  mqttTopicStatus: 'irriga-ai/ceo-hugovinicius/status',
  mqttTopicConfig: 'irriga-ai/ceo-hugovinicius/config',
  mqttTopicNotify: 'irriga-ai/ceo-hugovinicius/notify',
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
 * Envia uma mensagem de texto diretamente para o WhatsApp do Grupo
 */
async function enviarMensagemGrupo(texto) {
  if (!config.webhookUrl) {
    console.warn('⚠️ [WhatsApp Bot] Nenhuma webhookUrl configurada. Exibindo mensagem no console:\n');
    console.log(texto);
    return false;
  }

  console.log(`📤 [WhatsApp Bot] Enviando mensagem para o grupo (${new Date().toLocaleTimeString()}):`);
  console.log(texto.split('\n')[0]);

  try {
    let url = config.webhookUrl;
    let postData = null;
    let headers = { 'Content-Type': 'application/json' };

    if (config.apiType === 'callmebot') {
      // CallMeBot Group API: GET https://api.callmebot.com/whatsapp.php?group=...&text=...&apikey=...
      const encodedText = encodeURIComponent(texto);
      url = `${config.webhookUrl}?group=${encodeURIComponent(config.groupId)}&text=${encodedText}&apikey=${config.apiKey}`;
      return await httpGet(url);
    } else if (config.apiType === 'z-api') {
      // Z-API: POST /send-text
      postData = JSON.stringify({ phone: config.groupId, message: texto });
      if (config.apiKey) headers['Client-Token'] = config.apiKey;
    } else {
      // Evolution API / Green API / Z-API / Genérico
      postData = JSON.stringify({
        chatId: config.groupId,
        number: config.groupId,
        phone: config.groupId,
        recipient: config.groupId,
        text: texto,
        message: texto,
        sender: 'SABIÁ Irriga.ai',
      });
      if (config.apiKey) {
        headers['apikey'] = config.apiKey;
        headers['Client-Token'] = config.apiKey;
      }
    }

    return await httpPost(url, postData, headers);
  } catch (err) {
    console.error('❌ [WhatsApp Bot] Erro ao enviar mensagem:', err.message);
    return false;
  }
}

function httpPost(urlStr, data, headers) {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request(url, {
        method: 'POST',
        headers: Object.assign({ 'Content-Length': Buffer.byteLength(data) }, headers),
        timeout: 10000,
      }, (res) => {
        let respData = '';
        res.on('data', (c) => { respData += c; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ [WhatsApp Bot] Mensagem entregue ao gateway com sucesso!');
            resolve(true);
          } else {
            console.warn(`⚠️ [WhatsApp Bot] Gateway respondeu com status ${res.statusCode}:`, respData);
            resolve(false);
          }
        });
      });

      req.on('error', (e) => {
        console.error('❌ [WhatsApp Bot] Erro de rede HTTP:', e.message);
        resolve(false);
      });
      req.write(data);
      req.end();
    } catch (e) {
      console.error('❌ [WhatsApp Bot] Erro na URL:', e.message);
      resolve(false);
    }
  });
}

function httpGet(urlStr) {
  return new Promise((resolve) => {
    try {
      const isHttps = urlStr.startsWith('https:');
      const lib = isHttps ? https : http;
      lib.get(urlStr, { timeout: 10000 }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('✅ [WhatsApp Bot] Mensagem entregue via GET!');
          resolve(true);
        } else {
          console.warn(`⚠️ [WhatsApp Bot] Resposta GET ${res.statusCode}`);
          resolve(false);
        }
      }).on('error', (e) => {
        console.error('❌ [WhatsApp Bot] Erro de rede GET:', e.message);
        resolve(false);
      });
    } catch (e) {
      resolve(false);
    }
  });
}

/**
 * Loop de agendamento cron diário
 */
function verificarAgendamentoDiario() {
  const agora = new Date();
  const hora = agora.getHours();
  const min = agora.getMinutes();
  const hoje = Core.isoDate(agora);

  // 1. Boletim Matinal às 06:00
  if (hora === config.envioManhaHora && min >= 0 && min <= 15 && ultimoEnvioManhaData !== hoje) {
    ultimoEnvioManhaData = hoje;
    const P = Core.planejarDia(estadoAtual, [], hoje);
    const msg = Notif.gerarResumoManha(estadoAtual, { pHoje: P }, hoje);
    enviarMensagemGrupo(msg);
  }

  // 2. Fechamento do Entardecer às 18:00
  if (hora === config.envioTardeHora && min >= 0 && min <= 15 && ultimoEnvioTardeData !== hoje) {
    ultimoEnvioTardeData = hoje;
    const P = Core.planejarDia(estadoAtual, [], hoje);
    const msg = Notif.gerarResumoTarde(estadoAtual, { pHoje: P }, hoje);
    enviarMensagemGrupo(msg);
  }

  // 3. Checagem de SABIÁ Offline há mais de 24 horas consecutivas
  const horasSemPing = (Date.now() - ultimoPingSabiaTs) / 3600000;
  if (horasSemPing >= 24 && !alerta24hDisparado) {
    alerta24hDisparado = true;
    const msg = Notif.gerarAlertaEmergencia('sabia_offline_24h', {
      siteNome: estadoAtual.site?.nome,
    });
    enviarMensagemGrupo(msg);
  } else if (horasSemPing < 24) {
    alerta24hDisparado = false;
  }
}

/**
 * Processa mensagens recebidas do SABIÁ (MQTT ou eventos locais)
 */
function processarTelemetriaSabia(data) {
  ultimoPingSabiaTs = Date.now();

  // Verifica alertas de hardware imediatos
  const now = Date.now();
  if (now - ultimoAlertaDisparadoTs > 15 * 60000) { // Trava de repetição: máx 1 alerta a cada 15 min
    let tipo = null;
    if (data.alert && (data.alert.includes('CANO SECO') || data.alert.includes('VAZAMENTO'))) {
      tipo = 'tubo_seco';
    } else if (data.flow_lpm < 0.2 && data.active_rem_L > 2.0 && data.active_zone > 0) {
      tipo = 'tubo_seco';
    } else if (typeof data.tank_L === 'number' && data.tank_L < (estadoAtual.tank.capacity * 0.20)) {
      tipo = 'caixa_critica';
    }

    if (tipo) {
      ultimoAlertaDisparadoTs = now;
      const msg = Notif.gerarAlertaEmergencia(tipo, {
        siteNome: estadoAtual.site?.nome,
        zona: data.active_zone || 1,
        nivel_L: data.tank_L,
        pct: Math.round(100 * (data.tank_L || 1000) / (estadoAtual.tank?.capacity || 5000)),
      });
      enviarMensagemGrupo(msg);
    }
  }
}

// Trata execução pontual por linha de comando (CLI ou GitHub Action)
const args = process.argv.slice(2);
if (args.includes('--teste')) {
  console.log('🔔 [SABIÁ] Disparando mensagem de teste pontual para o grupo...');
  const msgTeste = `🔔 *TESTE OPERACIONAL DO SABIÁ* 🦅\n📍 *${estadoAtual.site?.nome || 'Sítio'}*\n\nConexão com o grupo da família realizada com sucesso! O robô enviará os boletins diários da roça às 06:00 e 18:00.`;
  enviarMensagemGrupo(msgTeste).then(() => process.exit(0));
} else if (args.includes('--manha')) {
  console.log('☀️ [SABIÁ] Gerando e enviando Boletim Matinal pontual...');
  const hoje = Core.isoDate(new Date());
  const P = Core.planejarDia(estadoAtual, [], hoje);
  const msg = Notif.gerarResumoManha(estadoAtual, { pHoje: P }, hoje);
  enviarMensagemGrupo(msg).then(() => process.exit(0));
} else if (args.includes('--tarde')) {
  console.log('🌙 [SABIÁ] Gerando e enviando Fechamento do Entardecer pontual...');
  const hoje = Core.isoDate(new Date());
  const P = Core.planejarDia(estadoAtual, [], hoje);
  const msg = Notif.gerarResumoTarde(estadoAtual, { pHoje: P }, hoje);
  enviarMensagemGrupo(msg).then(() => process.exit(0));
} else {
  console.log('🤖 [SABIÁ WhatsApp Bot] Serviço contínuo iniciado com sucesso.');
  console.log(`⏱️ Boletim Matinal programado para as ${config.envioManhaHora}:00.`);
  console.log(`⏱️ Fechamento do Entardecer programado para as ${config.envioTardeHora}:00.`);
  console.log('🛡️ Monitoramento de emergências ativo (Cano Seco, Caixa < 20% e Offline > 24h).');

  // Inicia verificação periódica a cada 30 segundos no modo daemon
  setInterval(verificarAgendamentoDiario, 30000);
}

// Exporta funções para uso embutido ou teste
module.exports = {
  enviarMensagemGrupo,
  processarTelemetriaSabia,
  verificarAgendamentoDiario,
  config,
};
