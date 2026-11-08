# 🗺️ ROADMAP & TASKS — Irriga.ai Pro-Duo · `v1.6` (Próxima Sessão)

> Arquivo de planejamento registrado ao finalizar a `v1.5.2-Argon` (`pro-duo-main`) para guiar a implementação da **`v1.6`** na próxima sessão.

---

## 🎯 Task 1: Expansão do Catálogo de Culturas — Silagens, Forragens e Apoio ao Gado no Inverno / Seca (`core/crops.js`)

Adicionar um novo grupo de culturas forrageiras e de suporte alimentar para o rebanho no Semiárido (Seridó Paraibano), com curvas `Kc`, duração de fases/cortes, espaçamento mínimo entre ruas (`espacamento_ruas_m`), espaçamento entre plantas (`espacamento_plantas_m`), manejo de corte/pastejo e recomendações de consórcio/rotação:

1. **🌵 Tipos de Palma Forrageira (Cactáceas — CAM de altíssima eficiência hídrica):**
   - **Palma Orelha de Elefante Mexicana (*Opuntia stricta*):** Rústica, resistente à cochonilha-do-carmim, exige pouquíssima água (pulsos quinzenais/semanais leves de estabelecimento e manutenção).
   - **Palma Miúda / Doce (*Nopalea cochenillifera*):** Altíssima palatabilidade e digestibilidade para o gado leiteiro/corte.
   - **Palma Gigante (*Opuntia ficus-indica*):** Clássica do Nordeste, foco em biomassa.
2. **🌾 Capins & Gramíneas Forrageiras (Corte, Pastejo e Capineira Irrigada):**
   - **BRS Capiaçu (*Pennisetum purpureum*):** Altíssima produção de massa para picadeira e silagem (cortes a cada 50–70 dias).
   - **Capim Buffel (*Cenchrus ciliaris*):** Extremamente resistente à seca, ótimo para feno/reserva.
   - **Capim Corrente (*Urochloa mosambicensis*):** Excelente cobertura e resistência no Seridó.
   - **Capim Mombaça / Tanzânia / Massai (*Megathyrsus maximus*):** Alto teor proteico sob irrigação.
3. **🌽 Culturas para Silagem (Grão Leitoso / Planta Inteira):**
   - **Sorgo Forrageiro / Silagem (*Sorghum bicolor*):** Mais tolerante ao déficit hídrico que o milho, com capacidade de rebrota (2º corte).
   - **Milho para Silagem:** Ciclo ajustado para colheita no ponto de grão farináceo/meia linha do leite (~85–95 dias).
   - **Milheto (*Pennisetum glaucum*):** Ciclo curtíssimo e baixa exigência hídrica.
4. **🌿 Forrageiras Proteicas, Halófitas e Oleaginosas de Apoio:**
   - **Moringa (*Moringa oleifera*):** "Árvore milagrosa" — folhas ricas em proteína e vitaminas para suplementação animal na seca.
   - **Erva-Sal (*Atriplex nummularia*):** Planta halófita perfeita para solos/águas salobras do Nordeste, fonte estratégica de proteína e sais minerais para caprinos, ovinos e bovinos.
   - **Linhaça (*Linum usitatissimum*):** Semente energética/funcional de apoio na ração.
   - **Gliricídia (*Gliricidia sepium*) / Cunhã (*Clitoria ternatea*) / Guandu Forrageiro:** Leguminosas ricas em proteína para banco de proteína e feno.

---

## 🎯 Task 2: Estado Inicial "Virgem" (`Canteiro Livre`) + Opção `"Nenhuma"` em Trocar Cultura (`core/irriga-core.js`, `web-app/app.js`, `web-app/sheets.js`)

1. **Sistema Virgem (Primeiro Uso sem Planta Cadastrada):**
   - Quando o sistema abrir pela primeira vez (ou ao clicar em *"Restaurar padrão de fábrica"*), **ambas as zonas (`Zona 1` e `Zona 2`) devem vir no estado `🟫 Canteiro livre` (`crop: null` / sem planta)**.
   - Assim o agricultor cadastra do zero apenas o que realmente estiver plantado em cada zona, sem precisar apagar culturas fictícias.

2. **Opção `"🟫 Nenhuma (Deixar Canteiro Livre)"` dentro de `Trocar Cultura`:**
   - No modal de **Trocar Cultura** (`abrirPlantio`), incluir uma opção clara **`🟫 Nenhuma (Canteiro Livre / Sem Plantio)`**.
   - Quando selecionada e confirmada:
     - Encerra a cultura atual da zona e deixa a zona em modo **`Canteiro livre`**.
     - **Irrigação Automática = `0 L/dia`** naquela zona (o piloto automático não gasta água dos turnos das 04:00 e 16:00 numa zona sem planta).
     - **Override Manual ("💧 Regar Agora") CONTINUA LIBERADO na zona livre!**
       - **Por quê?** Quando o agricultor vai preparar a terra ou acabou de semear o primeiro dia de uma nova safra, é muito útil poder acionar o **Override Manual** (por Horas ou por Litros, ou pelo botão físico `+1h Flex`) para molhar o canteiro antes ou logo no início do plantio, mesmo com a zona marcada como "Canteiro livre".
