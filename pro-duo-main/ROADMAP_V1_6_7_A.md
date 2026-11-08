# 🗺️ Irriga.ai Pro-Duo — Roadmap Técnico v1.6.7.a (SABIÁ)

> **Versão:** 1.6.7.a  
> **Nome do Dispositivo:** SABIÁ (Sistema Autônomo de Balanço hídrico e Irrigação Assistida)  
> **Objetivo:** Incorporação e antecipação das tarefas técnicas da v1.7.0 diretamente na versão 1.6.7.a, rebranding estético coerente do hardware (ESP32 ➔ SABIÁ) e solução definitiva para o flapping e sincronização bidirecional entre simulador/placa e WebApp.

---

## 🦅 Identidade e Ajuste Estético: O SABIÁ

- **Definição:** O microcontrolador de campo (ESP32) passa a ser identificado perante o usuário final como **SABIÁ** (*Sistema Autônomo de Balanço hídrico e Irrigação Assistida*).
- **Interface Web & PWA:**
  - Pílula de status interativa: `SABIÁ Online` / `SABIÁ Offline` clicável, abrindo modal educativo que explica o que é o servidor autônomo SABIÁ, o que ele faz pelo agricultor e exibe o diagnóstico e a telemetria em tempo real.
  - Alerta de fila aguardando conexão: `📡 Fila aguardando conexão do SABIÁ`.
  - Notificações de override: `O SABIÁ está offline e iniciará a rega ao conectar`.
  - Ajustes do Sítio: Seção dedicada com status e sincronização direta com o SABIÁ.
- **Display OLED & Firmware:**
  - Cabeçalho do visor SSD1306: `IRRIGA.AI v1.6.7.a`.
  - Telemetria JSON e avisos no broker MQTT: `"alert": "SABIÁ OFFLINE"` no LWT e `"v": "1.6.7.a"`.
  - Logs seriais: `[SABIÁ]` no lugar de `[ESP32]`.

---

## 📌 Task 1: Sincronização em Tempo Real Multi-Dispositivos (Celular / PC / PWA)

- [x] **Sincronia Total de Estado via Nuvem (MQTT):**
  - Toda alteração nas zonas, cota, solo, caixa, override, pausa, reforço climático e auditoria transmitida para `irriga-ai/ceo-hugovinicius/config` (`retained: true`).
  - O DOM atualiza instantaneamente (`render()`) ao receber telemetria ou configuração compartilhada sem necessidade de reload.
- [x] **Prevenção de Ressurreição de Dados Apagados:**
  - Substituição limpa de estados (`chuvaLocal`, `manual`) sem mesclagem aditiva incorreta.
- [x] **Comportamento PWA no iOS & Reconexão:**
  - Eventos de lifecycle (`visibilitychange`, `pageshow`, `focus`) religam o WebSocket MQTT e sincronizam o SABIÁ.
  - Botão de atualização manual (`🔄`) ativo no cabeçalho.

---

## 🌾 Task 2: Alerta de Choque de Cota Hídrica no Plantio

- [x] **Detecção no Modal de Troca/Cadastro de Cultura:**
  - Execução de `C.sugerirDataPlantio(S, zoneIdx, cropId, dataPlantio)`.
  - Alerta visual no modal caso a soma dos consumos com as outras zonas ativas ultrapasse a cota diária (`quota.daily_L`).
- [x] **Recomendação de Data Segura:**
  - Exibição da data recomendada para zerar ou mitigar o choque hídrico.
  - Botão de ação direta `[📅 Usar Data Recomendada]` para preencher a data sugerida com 1 clique.

---

## 🔒 Task 3: Segurança e Blindagem do PIN Anti-Griefing

- [x] **Bloqueio Estrito do Modal de Ajustes:**
  - Se o painel estiver travado (`S.ui.locked === true`), o botão ⚙️ de Ajustes invoca `solicitarDestravamentoComPin(abrirAjustes)` e **nunca abre** sem validação prévia.
- [x] **Ocultação e Mascaramento Visual do PIN:**
  - Na tela de Ajustes, o PIN é exibido como `••••` com botão de alternância `👁️` para visualização.
  - Campo de novo PIN protegido com `type="password"` e alternância de visibilidade.
- [x] **Proteção Anti-Brute-Force (Rate Limiting & Lockout):**
  - 3 erros consecutivos: bloqueio de 1 minuto com contagem regressiva em tela.
  - 5 erros consecutivos: bloqueio de 5 minutos com registro em auditoria (`audit()`).
  - Lockout salvo e recuperado via `localStorage` para impedir burlar recarregando a página.
- [x] **Higienização de Payloads MQTT:**
  - O valor de `security.pin` foi removido do envio público para HiveMQ (transmite apenas `{ enabled: true/false }`).
  - O PIN permanece estritamente no armazenamento local do dispositivo.

---

## ⏱️ Task 4: Alinhamento de Fila de Override, Telemetria & Conectividade do Simulador

- [x] **Contagem de Tempo Baseada em Telemetria (Hardware-First):**
  - Quando o SABIÁ está online, o tempo restante no banner ativo e na fila é derivado dinamicamente de `telemetry.active_rem_L / vazaoZona`.
  - Alerta imediato `"⚠️ Fluxo Interrompido / Tubulação Seca (0 L/min)"` caso a válvula esteja aberta sem vazão.
- [x] **Entropia Única no Client ID MQTT:**
  - O firmware gera identificador único com sufixo aleatório por boot:  
    `clientId = "SABIA-" + String((uint32_t)ESP.getEfuseMac(), HEX) + "-" + String(random(1000, 9999), HEX);`
  - Elimina colisões e quedas de conexão ("session takeover") no simulador Wokwi e no broker HiveMQ.
- [x] **Solução de Conexão no Simulador Wokwi & Respostas Imediatas:**
  - Inicialização em `WiFi.mode(WIFI_STA)` garantindo canal compatível com `Wokwi-GUEST`.
  - Loop de recuperação contínua de WiFi em background se a rede cair.
  - O firmware publica telemetria em tempo real no `status` com `retained: false` (evita que navegadores mostrem status "online" fictício baseado em mensagens antigas retidas no broker).
  - Todos os 4 botões físicos (B1, B2, B3, B4) disparam `publicarStatusMqtt()` imediatamente ao serem tocados.
  - Simulador de vazão nominal no modo bancada/Wokwi atualizado para incrementar `delivered_today_L` proporcional ao tempo real decorrido (`dtSec`).

---

## 📲 Task 5: Robô Autônomo de Mensagens para Grupo da Família no WhatsApp (`core/notificacoes-sabia.js` & `bot/`)

- [x] **Motor de Mensagens Agronômicas Autônomo:**
  - `gerarResumoManha`: Boletim matinal das 06:00 com litros previstos, DAP (*Dias Após o Plantio*), fase atual da cultura, nível da caixa d'água, clima e Pro Tips de manejo.
  - `gerarResumoTarde`: Fechamento do dia às 18:00 com total irrigado, cota economizada e confirmação de repouso noturno até as 04:00.
  - `gerarAlertaEmergencia`: Mensagens formatadas exclusivamente para eventos críticos (cano seco/bomba parada, caixa crítica < 20%, filtro 120 Mesh).
  - **Alerta de Conexão Estrito:** O alerta de falta de sinal é disparado **apenas se o SABIÁ passar mais de 24 horas consecutivas sem ping**, evitando spam por oscilações transitórias de Wi-Fi.
  - **Pro Tips Agronômicas & Comerciais:**
    - Aviso de proximidade da colheita (ex: "Faltam 2 dias para colher o Coentro! Hora de providenciar caixaria e fechar compradores").
    - Explicações claras de manejo na reta final (ex: corte de água para concentração de açúcar °Brix no melão ou cura da casca da cebola).
    - Sugestão de revisão de cota caso o balanço registre déficit hídrico consecutivo.
- [x] **Automação 100% Silenciosa e Sem Cringe:**
  - Eliminação de qualquer botão de "copiar texto" manual ou links `wa.me` para compartilhamento individual.
  - Robô opera de forma estritamente unidirecional no grupo da família do WhatsApp: apenas entrega os boletins e alertas operacionais.
  - Permite que a família utilize o grupo livremente para conversar sobre o sítio, organizar colheitas, vendas e visitas sem interferência de bots conversacionais.
- [x] **Integração Dupla (PWA WebApp + Daemon Node.js):**
  - **No WebApp (`app.js` e `sheets.js`):** Modal de configuração com status do robô, URL de webhook (Evolution API, Z-API, Baileys, CallMeBot), token de autenticação, caixas de ativação (06h, 18h, emergências), prévia do texto e botão de disparo imediato de teste no grupo. Verificação periódica automática a cada 30 segundos.
  - **No Servidor / Daemon Standalone (`pro-duo-main/bot/`):** Script `bot-whatsapp.js` pronto para rodar como serviço contínuo (PM2, Docker ou systemd), monitorando tópicos MQTT e cron local para despacho autônomo mesmo com todas as abas do navegador fechadas.
