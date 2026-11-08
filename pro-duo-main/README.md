# 🌱 Irriga.ai Pro-Duo · `v1.6.7.a (SABIÁ)`

> **SABIÁ:** Sistema Autônomo de Balanço hídrico e Irrigação Assistida  
> **Hardware de Campo:** Microcontrolador autônomo (ESP32-WROOM-32D / Bancada Wokwi)  
> **Localização:** Sítio em São Vicente do Seridó – PB  

O ecossistema **Irriga.ai Pro-Duo (v1.6.7.a)** é a solução definitiva de automação agronômica para o Semiárido. Toda a inteligência agronômica de balanço hídrico FAO-56 opera unificada em 2 turnos diários no motor autônomo **SABIÁ**, com sincronização em tempo real multi-telas via nuvem MQTT (HiveMQ) e WebApp PWA Offline-First.

---

## 🦅 Identidade SABIÁ

O microcontrolador de campo deixa de ser tratado como mero componente de bancada e passa a ser reconhecido na interface e em campo como **SABIÁ** (*Sistema Autônomo de Balanço hídrico e Irrigação Assistida*):

- **Pílula Interativa no Cabeçalho:** `SABIÁ Online` (verde) ou `SABIÁ Offline` (âmbar). Ao clicar, abre o modal educativo que detalha o que é o servidor autônomo SABIÁ, o que ele faz pelo agricultor e o diagnóstico com telemetria em tempo real.
- **Display OLED 128x64:** Exibe `IRRIGA.AI v1.6.7.a` e logs seriais identificados como `[SABIÁ]`.
- **Telemetria e LWT:** Avisos no broker HiveMQ identificando `SABIÁ OFFLINE` e `v: "1.6.7.a"`.
- **Fila e Overrides Inteligentes:** Mensagens claras na interface informando quando a fila está aguardando o SABIÁ conectar para liberar a água.

---

## ✨ Principais Funcionalidades da v1.6.7.a

1. **🔄 Sincronização em Tempo Real Multi-Dispositivos:**
   - Celular, computador e tablet refletem alterações de configuração (reforço climático, palhada, cota, solo, overrides) instantaneamente via MQTT sem necessidade de recarregar a página.

2. **🔒 Segurança & Blindagem de PIN Anti-Griefing:**
   - Proteção estrita do modal de Ajustes quando o painel estiver bloqueado.
   - Máscara visual de senha com alternância de visibilidade (`👁️`).
   - Proteção contra ataques de força bruta: bloqueio temporal de 1 minuto após 3 erros consecutivos e 5 minutos após 5 erros, persistido em `localStorage`.
   - Higienização de dados: o PIN nunca trafega no broker MQTT público.

3. **🌾 Alerta de Choque de Cota no Plantio:**
   - Detecta no ato da troca de cultura se a demanda da nova planta somada às outras zonas ativas ultrapassará a cota diária do sítio.
   - Botão direto `[📅 Usar Data Recomendada]` para agendar a semeadura/transplante em data segura com 1 clique.

4. **⏱️ Telemetria Hardware-First:**
   - A contagem regressiva e os volumes restantes exibidos na interface derivam diretamente do fluxo medido pelo sensor do SABIÁ (`active_rem_L`).
   - Alerta em tempo real de `⚠️ Fluxo Interrompido / Tubulação Seca` se a válvula estiver aberta sem fluxo detectado.

5. **🌅🌇 2 Turnos Diários (04h e 16h):**
   - Rega focada nos horários mais frescos do dia para maximizar o aproveitamento hídrico e facilitar a reposição da caixa d'água de 5.000 L pelo poço artesiano.

6. **💧 Override Manual +1h Flex:**
   - Botão físico B2 ou comando pelo app permite acionar 1 hora de rega flexível (30 min Z1 + 30 min Z2) com conversão direta `Horas ⇄ Litros`.

---

## 🚀 Como Executar

- **Web-App PWA:** Abra [`web-app/index.html`](./web-app/index.html) no navegador ou acesse o site público.
- **Bancada de Engenharia (Dev-GUI):** Abra [`web-app/dev-gui.html`](./web-app/dev-gui.html).
- **Simulador de Safra de 260 Dias:** `node sim/simular_safra.js`.
- **Firmware do SABIÁ:** [`firmware/src/main.cpp`](./firmware/src/main.cpp).
