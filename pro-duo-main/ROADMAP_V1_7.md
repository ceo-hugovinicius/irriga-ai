# 🗺️ Irriga.ai Pro-Duo — Roadmap Técnico v1.7.0

> [!NOTE]
> **Antecipação de Versão:** Conforme deliberação técnica, todas as tarefas deste roadmap foram antecipadas e consolidadas diretamente na **versão 1.6.7.a (SABIÁ)**. Consulte o arquivo [ROADMAP_V1_6_7_A.md](file:///c:/irriga-ai/pro-duo-main/ROADMAP_V1_6_7_A.md) para o estado executivo atualizado.

> **Objetivo:** Guia focado para desenvolvimento com Claude na versão 1.7.0.  
> **Pilares:** Sincronização em tempo real multi-telas, blindagem agronômica de cota, segurança de acesso (PIN) e fidelidade de telemetria/hardware.

---

## 📌 Task 1: Sincronização em Tempo Real Multi-Dispositivos (Celular / PC / PWA)

### O Problema:
Em versões anteriores, alterações realizadas em um dispositivo (ex: metragem de mangueira, vazão, botões de override, boost, chuva local ou lista de eventos) ficavam gravadas apenas no `localStorage` local ou eram mescladas de forma incompleta, exigindo que o agricultor desse "refresh" na página. No iOS (onde o app instalado como PWA não possui botão de recarregar nem gesto de puxar para atualizar), a tela ficava dessincronizada.

### Requisitos Obrigatórios:
1. **Sincronia Total de Estado via Nuvem (MQTT):**
   - Toda alteração em qualquer tela (hidráulica da zona, cota, solo, nível da caixa, override, pausa, reforço climático, chuva local e lista de eventos) deve ser transmitida para o tópico `irriga-ai/ceo-hugovinicius/config` de forma retida (`retained: true`).
   - Dispositivos conectados devem atualizar o DOM instantaneamente (`render()`) ao receber a mensagem, sem recarregar a página.
2. **Prevenção de Ressurreição de Dados Apagados:**
   - Valores apagados (ex: chuva local de hoje desfeita, rega manual cancelada, histórico limpo) devem substituir o estado no receptor (`S.chuvaLocal = data.chuvaLocal || {}`), e não usar mesclagem aditiva (`{ ...S.chuvaLocal, ...data.chuvaLocal }`).
3. **Comportamento PWA no iOS (Wake-up e Reconexão):**
   - Ao desbloquear o iPhone ou retornar ao app, os eventos `visibilitychange`, `pageshow` e `focus` devem reestabelecer o WebSocket MQTT e re-renderizar a tela automaticamente.
   - Disponibilizar botão de atualização manual (`🔄`) no cabeçalho para casos de oscilação de sinal no campo.

---

## 🌾 Task 2: Alerta de Choque de Cota Hídrica no Plantio

### O Problema:
Se o agricultor plantar a Zona 2 em uma data cujo pico de consumo coincida com o pico da Zona 1, a soma diária ultrapassará a cota de água da propriedade, forçando o corte de irrigação e prejudicando a colheita.

### Requisitos Obrigatórios:
1. **Detecção no Modal de Plantio:**
   - Usar a função nativa `C.sugerirDataPlantio(S, zoneIdx, cropId, dataPlantio)` de `irriga-core.js`.
   - Se o pico combinado ultrapassar a cota diária (`quota.daily_L`), alertar o agricultor informando o volume previsto.
2. **Recomendação de Data Segura:**
   - Sugerir a melhor data de plantio identificada pelo algoritmo para mitigar ou zerar o choque de cota.
   - Permitir aplicar a data recomendada com 1 toque no botão `[📅 Usar Data Recomendada]`.

---

## 🔒 Task 3: Segurança e Blindagem do PIN Anti-Griefing (Proteção contra Invasão e Brute-Force)

### O Problema:
Na arquitetura atual (v1.6.x), o PIN de 4 dígitos foi criado como barreira anti-toques acidentais no campo ("anti-griefing"), mas apresenta vulnerabilidades críticas de segurança caso alguém mal-intencionado acerte ou inspecione o sistema:
1. **Exibição do PIN com Painel Travado:** Mesmo quando o painel está no estado travado (`S.ui.locked === true`), o botão de configurações no cabeçalho ⚙️ (`abrirAjustes()`) permanece clicável. Ao abrir o modal, a linha do PIN exibe explicitamente `PIN Atual: <b>${S.security?.pin || '1234'}</b>` em texto puro, permitindo que qualquer pessoa veja a senha imediatamente.
2. **Vazamento no Tópico MQTT Público:** O objeto `S.security` contendo o PIN em texto plano (`{ pin: '1234', enabled: true }`) é transmitido via MQTT para o broker público HiveMQ no tópico `irriga-ai/ceo-hugovinicius/config`. Qualquer pessoa inscrita no tópico aberto pode ler o PIN do agricultor.
3. **Armazenamento em Texto Puro no Navegador:** O PIN fica salvo em `localStorage` sem nenhum algoritmo de hashing ou criptografia.
4. **Vulnerabilidade a Ataques de Força Bruta (Brute-Force):** Como o PIN possui apenas 4 dígitos (0000 a 9999), a ausência de limite de tentativas erradas permite que um invasor teste combinações até acertar em poucos minutos.

### Requisitos Obrigatórios:
1. **Bloqueio Estrito do Modal de Ajustes:**
   - Se o painel estiver travado (`S.ui.locked === true`), o botão ⚙️ de Ajustes deve invocar imediatamente `solicitarDestravamentoComPin()`.
   - O modal de configurações (`abrirAjustes()`) **nunca deve abrir** sem a autenticação prévia bem-sucedida.
2. **Ocultação e Mascaramento Visual do PIN:**
   - Substituir qualquer exibição de PIN em texto aberto por máscara de proteção (`••••`).
   - Campos de alteração de PIN devem utilizar `type="password"` com opção toggle "mostrar/ocultar".
3. **Proteção Anti-Brute-Force (Rate Limiting & Lockout):**
   - Implementar contador de tentativas consecutivas com bloqueio progressivo:
     - 3 erros consecutivos: bloqueio de 1 minuto com aviso visual em tela.
     - 5 erros consecutivos: bloqueio de 5 minutos e emissão de alerta sonoro/registro em auditoria.
   - O tempo de bloqueio (lockout) deve persistir mesmo se o agricultor recarregar a página (timestamp salvo em cache).
4. **Higienização de Payloads MQTT e Armazenamento Protegido:**
   - Remover a propriedade `security.pin` do payload transmitido via MQTT público. O PIN deve permanecer estritamente local no dispositivo ou ser transmitido exclusivamente com Hash SHA-256 com Salt criptográfico (`SHA-256(PIN + Salt)`).
   - O estado compartilhado via MQTT sincronizará apenas se o PIN está habilitado (`enabled: true/false`), mantendo a senha sigilosa.

---

## ⏱️ Task 4: Alinhamento de Fila de Override e Telemetria (Tempo Relógio vs. Volume Real e Identificação MQTT)

### O Problema:
Durante testes com o simulador Wokwi ESP32 e overrides longos (ex: 3 horas na Zona 2):
1. **Decaimento Fictício do Tempo por Relógio de Parede:**
   - No ESP32, o controle de corte de rega é **estritamente volumétrico** (litros calculados pelo sensor Hall SF1). No Wokwi (onde não há vazão física simulada por pulsos), `delivered_today_L` permanece em zero.
   - Na interface web, o evento de override cria um intervalo de horário fixo (`ts` até `te`), e o banner calcula `(agora.te - Date.now())`. O tempo na tela baixa (de 3h para 2h50m) mesmo sem nenhuma gota d'água ter sido entregue de fato.
   - No campo real, se a pressão da bomba cair ou o filtro sujar, a vazão diminuirá, fazendo com que o tempo de parede se esgote antes que a cota em litros seja realmente entregue ao plantio.
2. **Flapping e Alerta Falso "ESP32 Offline" no Wokwi:**
   - O identificador de cliente MQTT no firmware é gerado via `ESP.getEfuseMac()`. No Wokwi, o endereço MAC emulado é idêntico em todas as sessões. No broker HiveMQ compartilhado, novas conexões com o mesmo ID derrubam a conexão anterior ("session takeover").
   - Quando o intervalo entre pacotes excede o limite de 35s do app, a interface exibe intermitentemente "ESP32 Offline", causando confusão para o agricultor.

### Requisitos Obrigatórios:
1. **Contagem de Tempo Baseada em Telemetria (Hardware-First):**
   - Quando o ESP32 estiver conectado (`espOnline === true`), o tempo restante exibido no card ativo e na fila deve ser calculado dinamicamente com base nos **litros restantes reais informados pela telemetria do ESP32**:  
     `minutosRestantes = Math.round(telemetry.active_rem_L / vazaoZonaLpm)`.
   - Se o hardware reportar vazão nula (`flow_lpm === 0`) com válvula aberta por mais de 60 segundos, a contagem de tempo deve estagnar e alertar "⚠️ Fluxo Interrompido / Tubulação Seca".
2. **Entropia Única no Client ID MQTT:**
   - Atualizar a conexão MQTT do firmware para incluir sufixo aleatório por boot:  
     `clientId = "ESP32-Irriga-" + String((uint32_t)ESP.getEfuseMac(), HEX) + "-" + String(random(1000, 9999), HEX);`  
     Isso elimina colisões e quedas de sessão no Wokwi e no broker HiveMQ.
3. **Simulador de Vazão Virtual no Firmware (Modo Bancada/Wokwi):**
   - Disponibilizar chave de compilação ou comando para simulação de pulsos no Wokwi quando as válvulas estiverem abertas, permitindo validar o fluxo volumétrico completo sem necessidade de hardware físico conectado.
4. **Padronização das Filas de Override (Físico vs. Digital):**
   - Confirmar formalmente que tanto o botão físico B2 (+1h Flex = 30 min Z1 + 30 min Z2) quanto o botão digital no app utilizam a mesma regra de empilhamento aditivo (`queueLiters += litros`) e respeito anti-colisão no filtro 120 Mesh.
