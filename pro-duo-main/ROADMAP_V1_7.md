# 🗺️ Irriga.ai Pro-Duo — Roadmap & Especificação Técnica v1.7.0

> **Documento de Engenharia & Guia de Implementação para o Claude (v1.7.0)**  
> **Repositório:** `ceo-hugovinicius/irriga-ai`  
> **Data:** Novembro de 2026  
> **Status:** Planejado para implementação na versão 1.7.0

---

## 📌 Visão Geral da Versão 1.7.0

A versão 1.6.0 estabeleceu a base de conectividade híbrida em tempo real (Nuvem HiveMQ MQTT + GitHub Pages PWA + ESP32 Wokwi / Físico), fila de rega transparente, segurança por PIN e catálogo completo de culturas e forragens.

A versão **1.7.0** tem dois objetivos centrais de alta prioridade:
1. **Auditoria Geral de Sincronização e Tolerância a Falhas Multi-Dispositivos**: Eliminar qualquer ponto cego onde ações no app fiquem retidas apenas localmente sem propagação instantânea via nuvem para os demais dispositivos do agricultor.
2. **Prevenção de Choque de Cota Hídrica & Otimizador Avançado de Calendário de Plantio**: Alerta proativo de colisão de consumo entre zonas concomitantes e recomendação algorítmica da data ideal de plantio para evitar estouro da cota diária de água.

---

## 🛠️ TASK 1: Auditoria Geral de Sincronização de Estado Multi-Dispositivos

### 1.1 Contexto e Diagnóstico do Problema (v1.6)
Durante os testes de campo da versão 1.6, observou-se que determinadas ações pontuais ficavam restritas ao `localStorage` do navegador que as executava:
- **Alteração de Fita/Gotejador:** Ao mudar a metragem de fita ou vazão do gotejador em uma zona, o app executava `salvarLocal()`, mas a alteração só subia para a nuvem se o usuário fizesse o ciclo completo de "replantio" da cultura.
- **Botão "Regar Agora" (Override) e Mini-Botão "✕ Parar":** O disparo e o cancelamento do override manual por vezes não sincronizavam com o estado visual em outros aparelhos abertos simultaneamente (ex: celular e PC).
- **Botões "Era bom chover" (Boost) e "Choveu aqui" (Chuva Local):** Registros climáticos manuais não constavam no payload de configuração retida (`MQTT_TOPIC_CONFIG`).
- **Eco de Mensagens (Feedback Loop):** Abas abertas no mesmo tópico recebiam de volta as mensagens que elas próprias emitiram, arriscando sobrescrever dados voláteis.

### 1.2 Solução Arquitetural Implementada & Pontos a Verificar na v1.7

A infraestrutura de sincronização foi unificada em `pro-duo-main/web-app/app.js`:
```
[Ação do Usuário] 
       │
       ▼
 ┌─────────────┐
 │  salvar()   │──► localStorage.setItem() [Imediato]
 └─────────────┘
       │
       ▼ (Debounce 120ms)
 ┌──────────────────────┐      ┌────────────────────────┐
 │  salvarConfigCloud() │──►   │  MQTT Retained Config  │──► [Todos os Celulares/PCs]
 └──────────────────────┘      └────────────────────────┘
       │
       ▼
 ┌──────────────────────┐      ┌────────────────────────┐
 │ sincronizarEsp32()   │──►   │  MQTT Plan / Telemetria│──► [ESP32 Válvulas / Relés]
 └──────────────────────┘      └────────────────────────┘
```

#### Checklist de Auditoria para o Claude na v1.7:
| Componente / Ação | Função JS | Tópico MQTT | Payload Esperado | Verificado? |
| :--- | :--- | :--- | :--- | :---: |
| **Metros de Fita / Espaçamento / Vazão** | `salvarHidraulicaFita()` | `.../config` & `.../plan` | `tape_meters`, `emitter_spacing_cm`, `flow_lpm` | [x] |
| **Palhada no Solo (Mulch)** | Toggle Palhada | `.../config` & `.../plan` | `mulch: true/false` | [x] |
| **Ajuste Fino de Vazão (-20% a +20%)** | Botões de ajuste fino | `.../config` & `.../plan` | `fine_pct: -20..20` | [x] |
| **Modo de Restrição Reta Final** | `mudarModoRestricao()` | `.../config` & `.../plan` | `restricao_modo: 'auto'/'corte_forte'/...` | [x] |
| **Ligar Override Manual ("Regar Agora")**| `acionarOverrideRega()` | `.../cmd` & `.../config` | `manual: { dia, eventos, litrosTotal, fim }` | [x] |
| **Cancelar Override ("✕ Parar")** | `cancelarRegaManual()` | `.../cmd` & `.../config` | `acao: 'parar_rega'`, `manual: null` | [x] |
| **Remover Zona da Fila** | `removerDaFila()` | `.../cmd` & `.../config` | `acao: 'remover_fila'`, zona atualizada | [x] |
| **Ativar Reforço ("Era bom chover")** | `abrirBoost()` | `.../cmd` & `.../config` | `boost: { pct, until }` | [x] |
| **Cancelar Reforço ("✕ Desligar")** | `cancelarBoost()` | `.../cmd` & `.../config` | `boost: { pct: 0, until: null }` | [x] |
| **Registrar Chuva Local ("Choveu aqui")**| `choveuAqui()` | `.../cmd` & `.../config` | `chuvaLocal: { [data]: mm }` | [x] |
| **Desfazer Chuva Local ("✕ Desfazer")** | `cancelarChuvaHoje()` | `.../cmd` & `.../config` | `chuvaLocal: { ... }` sem a data | [x] |
| **Pausar / Retomar Piloto Automático** | `pausar()` / `retomar()` | `.../cmd` & `.../config` | `pause: { until, indefinite, origem }` | [x] |
| **Alterar Cota Diária de Água** | Modal de Cota | `.../config` & `.../plan` | `quota: { daily_L }` | [x] |
| **Alterar Senha PIN** | Modal de Segurança | `.../config` | `security: { pin, enabled }` | [x] |

---

## 🌾 TASK 2: Prevenção de Choque de Cota Hídrica & Otimizador Avançado de Calendário de Plantio

### 2.1 O Problema Agronômico: O "Choque de Cota"
Em propriedades do semiárido com abastecimento limitado (ex: poço artesiano com vazão restrita ou caixa d'água de 5.000 L abastecida por cota de 1.000 a 2.000 L/dia):
- Cada cultura possui uma curva de coeficiente de cultivo ($K_c$) e evapotranspiração da cultura ($\text{ET}_c = \text{ET}_0 \times K_c \times K_s$).
- No início do ciclo (fase vegetativa inicial), a planta consome pouca água (ex: 200 L/dia na zona).
- Na fase de pico (floração e enchimento de frutos / grãos), o consumo atinge o ponto máximo (ex: 1.200 L/dia na zona).
- **O Risco Crítico:** Se o agricultor plantar a Zona 2 no mesmo dia ou com defasagem desfavorável em relação à Zona 1, **ambas as zonas atingirão o pico simultaneamente**, somando 2.400 L/dia. Como a cota diária é de 1.500 L/dia, o sistema será forçado a cortar água das plantas, causando abortamento floral e perda drástica de produtividade.

```
Consumo (L/dia)
▲
│          🔴 PICO COMBINADO: 2.400 L/dia (ESTOURO DE COTA!)
│                ▲
│              ╱   ╲
2000├─────────╱─────╲─────────────
│            ╱  ▲▲   ╲
1500├── ── ── ── ── ── ── ── ── ──  [Cota Diária Máxima: 1.500 L]
│          ╱  ╱    ╲   ╲
1000├───  ╱  ╱ Zona 2╲   ╲
│        ╱  ╱         ╲   ╲
 500├───╱  ╱           ╲   ╲
│      ╱  ╱             ╲   ╲
 0└────┴──┴──────────────┴───┴────► Dias do Ano
```

### 2.2 O Algoritmo Existente no Núcleo (`irriga-core.js`)
O algoritmo matemático central já se encontra implementado no motor de cálculo agronômico em `pro-duo-main/core/irriga-core.js`, linhas 611-634:
```javascript
function sugerirDataPlantio(state, zoneIdx, cropId, hojeStr, janelaDias = 60)
```
- **Entradas:**
  - `state`: Estado completo do sistema (zonas ativas, solos, cota diária `state.quota.daily_L`).
  - `zoneIdx`: Índice da zona que receberá a nova cultura.
  - `cropId`: Identificador da cultura que se deseja plantar (ex: `'melancia'`, `'milho_verde'`).
  - `hojeStr`: Data de referência (hoje em formato ISO `YYYY-MM-DD`).
  - `janelaDias`: Janela de busca para frente (padrão: 60 dias).
- **Processamento:**
  1. Varre uma grade de datas com passos de 5 dias (`offset: 0, 5, 10, ... 60`).
  2. Para cada data hipotética de plantio, calcula a série temporal completa de evapotranspiração da nova cultura usando `previaSafra()`.
  3. Combina a curva projetada com as curvas de consumo das demais zonas já plantadas.
  4. Calcula a média móvel de 7 dias do consumo combinado total ($\text{L/dia}$).
  5. Identifica o pico mais alto (`picoCombinadoL`).
  6. Classifica a viabilidade: `cabeNaCota = picoCombinadoL <= state.quota.daily_L`.
- **Saídas:**
  - `opcoes`: Vetor com todas as datas simuladas, picos e colheitas estimadas.
  - `melhor`: O objeto com a data ótima que respeita 100% a cota (ou, se inevitável, a data com o menor pico possível).

### 2.3 Especificação de Implementação de UI/UX para o Claude (v1.7)

Na versão 1.7, o Claude deverá expandir a interface do usuário para oferecer uma experiência visual intuitiva e educativa ao agricultor:

#### A. Alerta no Modal de Plantio (`abrirPlantio` em `sheets.js`):
1. **Detecção Automática:** Ao selecionar cultura e data, invocar instantaneamente `C.sugerirDataPlantio(S, i, cid, dt)`.
2. **Badge de Diagnóstico:**
   - 🟢 **Verde (Plantio Seguro):** "Consumo combinado seguro (Pico máx: 840 L/dia · cabe folgado na cota de 1.500 L)".
   - 🟡 **Amarelo (Atenção):** "Consumo próximo do limite (Pico máx: 1.420 L/dia · margem de 80 L)".
   - 🔴 **Vermelho (Choque de Cota):** "Choque hídrico detectado! No pico, as duas zonas pedirão 2.100 L/dia, estourando a cota de 1.500 L/dia".
3. **Card de Recomendação Inteligente:**
   - Explicação amigável em português claro: *"💡 Se você esperar 15 dias e plantar em 23/nov, a Zona 1 já terá passado da fase de enchimento, e o pico combinado cairá para 1.250 L/dia, sem cortar água de nenhuma cultura!"*
   - Botão de Ação: `[📅 Mudar data de plantio para 23/nov]` (aplica a data sugerida com 1 toque).

#### B. Mini-Gráfico de Linha do Tempo (Timeline / SVG Interativo):
- No modal de plantio ou na aba do consultor, desenhar um gráfico SVG leve e responsivo mostrando:
  - Curva azul tracejada: Demanda da Zona 1.
  - Curva verde tracejada: Demanda da Zona 2 na data escolhida.
  - Curva preta/laranja contínua: Consumo total somado.
  - Linha vermelha horizontal: Cota diária limite ($Q_{\text{dia}}$).
  - Quando a curva contínua ultrapassa a linha vermelha, preencher a área em vermelho sombreado com aviso sonoro/visual.

#### C. Suporte a Forrageiras e Culturas de Ciclo Contínuo:
- Para forragens perenes (BRS Capiaçu, Palma Forrageira) que possuem ciclos de corte repetitivos (ex: Capiaçu a cada 70 dias, Palma a cada 1 ou 2 anos):
  - Modelar o pico repetitivo pós-corte no cálculo do `previaSafra()`.

---

## 🧪 Roteiro de Verificação e Comandos para o Claude

Ao desenvolver a versão 1.7, execute a seguinte sequência de validação:

```bash
# 1. Checagem de integridade sintática dos arquivos JavaScript
node --check pro-duo-main/core/irriga-core.js
node --check pro-duo-main/core/crops.js
node --check pro-duo-main/web-app/app.js
node --check pro-duo-main/web-app/sheets.js

# 2. Teste automatizado do motor de sugestão de plantio em Node.js
node -e "const C = require('./pro-duo-main/core/irriga-core.js'); const st = { quota: { daily_L: 1200 }, soil: 'franco_argiloso', zones: [{ id: 1, enabled: true, area_m2: 128, crop: { id: 'melancia', plantio: '2026-11-01' } }, { id: 2, enabled: true, area_m2: 158, crop: null }] }; const res = C.sugerirDataPlantio(st, 1, 'milho_verde', '2026-11-08'); console.log('Melhor data:', res.melhor.plantio, 'Pico:', Math.round(res.melhor.picoCombinadoL), 'Cabe na cota:', res.melhor.cabeNaCota);"
```

---

## 📅 Histórico de Versões e Metas

| Versão | Codinome | Foco Principal | Status |
| :--- | :--- | :--- | :--- |
| **v1.5.2** | Argon Classic | Lógica agronômica FAO-56 pura e simulação local | Concluído |
| **v1.6.0** | Argon Cloud | HiveMQ MQTT Bridge, PWA, PIN security, Fila de Rega, Forragens, Sincronização em tempo real | Concluído e em Produção |
| **v1.7.0** | Argon Optimizer | Gráfico interativo de choque de cota, Otimizador de plantio multi-zona, Auditoria formal de sincronização | **Planejado (Este Roadmap)** |

---
*Documento mantido como especificação viva no repositório `ceo-hugovinicius/irriga-ai`.*
