# 🏆 Benchmark Prático de 260 Dias — Jerimum Defasado em 50 Dias + Rotação Recomendada

> **Objetivo do Teste:** Simular na prática o cenário real planejado para o sítio em **São Vicente do Seridó – PB** (`-6.95325, -36.36853`):
> 1. Plantar **Jerimum** na **Zona 1 (Oeste • 128 m²)** e aguardar **50 dias de defasagem** para plantar **Jerimum** na **Zona 2 (Leste • 158 m²)**, evitando que toda a colheita amadureça de uma só vez.
> 2. Ao colher cada zona de Jerimum, seguir a **recomendação agronômica automática do aplicativo** (que bloqueia repetir *Cucurbitáceas* seguidas na mesma terra e sugere **Feijão Verde** e **Batata-doce**).
> 3. Submeter o sistema a **260 dias de dados meteorológicos do Seridó Paraibano** (transição do fim das águas em março até o auge do calor e vento seco em outubro/novembro), testando **chuvas, calor $>32^\circ\text{C}$, vento $>20\text{ km/h}$, teto da cota de $1.000\text{ L/dia}$ e entupimento gradual do filtro único 120 Mesh**.

---

## 📊 1. Resumo Executivo do Benchmark (260 Dias)

Arquivo executável da simulação: [`engine/simulador_safra_benchmark.py`](file:///c:/irriga-ai/pro-duo/engine/simulador_safra_benchmark.py)

| Indicador de Desempenho do Sistema | Resultado Medido na Simulação | Avaliação Técnica |
| :--- | :--- | :--- |
| **Período Simulado** | **260 dias** (`01/03/2026` a `15/11/2026`) | Cobre outono chuvoso + inverno + seca forte |
| **Volume Total Entregue — Zona 1 (128 m²)** | **88.390 Litros** (~340 L/dia médios) | 100% dentro da capacidade hidráulica |
| **Volume Total Entregue — Zona 2 (158 m²)** | **76.485 Litros** (~294 L/dia médios) | Ficou 50 dias em pousio inicial planejado |
| **Média Diária Total do Sítio (Z1 + Z2)** | **634,1 Litros/dia** | **36,6% abaixo do teto de 1.000 L/dia** da caixa de 5.000 L |
| **Dias com Economia Automática por Chuva** | **53 dias** | Válvulas poupadas quando choveu no Seridó |
| **Dias com Reforço por Calor ($>32^\circ\text{C}$)** | **142 dias** | Compensação térmica automática no turno da tarde |
| **Dias com Proteção contra Vento Seco ($>20\text{ km/h}$)** | **198 dias** | Proteção contra desidratação foliar no Seridó |
| **Atuações do Guardião da Cota Diária** | **87 dias de pico** | Protegeu 100% as fases críticas sem secar a caixa |
| **Alertas de Limpeza do Filtro 120 Mesh** | **3 avisos em 260 dias** (a cada ~85 dias) | Compensou a perda de vazão aumentando minutos até a lavagem |

---

## 🎃 2. Linha do Tempo: Como o Sistema Reagiu nos Momentos Decisivos

A tabela abaixo mostra os recortes exatos do log gerados pelo motor [`irriga_engine.py`](file:///c:/irriga-ai/pro-duo/engine/irriga_engine.py) durante os 260 dias:

| Dia | Data | Clima no Sítio | Zona 1 (Oeste • 128 m²) | Zona 2 (Leste • 158 m²) | Total Dia | Como o Irriga.ai Pro-Duo Reagiu |
| :---: | :---: | :--- | :--- | :--- | :---: | :--- |
| **Dia 1** | `01/03` | $32,0^\circ\text{C}$<br>Vento $17\text{ km/h}$ | 🎃 **Jerimum (D.1)**<br>Fase 1 (`Kc=0.45`) → **223,7 L** | ⏸️ **Em espera (0,0 L)**<br>*(Aguardando 50 dias)* | **223,7 L** | Irrigou apenas a Zona 1 com lâmina leve de pegamento e manteve a Válvula 2 fechada. |
| **Dia 51** | `20/04` | $30,3^\circ\text{C}$<br>Vento $17\text{ km/h}$ | 🌸 **Jerimum (D.51)**<br>Fase 3 Crítica (`Kc=1.00`) → **432,6 L** | 🌱 **Jerimum (D.1)**<br>Início 2º Lote (`Kc=0.45`) → **240,3 L** | **672,9 L** | **Defasagem perfeita:** enquanto o 1º Jerimum entrou em Floração Crítica, o 2º Jerimum nasceu recebendo metade da lâmina. |
| **Dia 78** | `17/05` | Chuva no Seridó<br>($>10\text{ mm}$) | 🎃 **Jerimum (D.78)**<br>Fase 3 (`Kc=1.00`) → **0,0 L** | 🎃 **Jerimum (D.28)**<br>Fase 2 (`Kc=0.75`) → **0,0 L** | **0,0 L** | **Economia por chuva:** o sistema abateu a precipitação real e suspendeu os turnos do dia. |
| **Dia 102** | `10/06` | $30,4^\circ\text{C}$<br>Vento $19\text{ km/h}$ | 🍯 **Jerimum (D.102)**<br>Fase 5 Pré-Colheita (`Kc=0.35`) → **154,7 L** | 🌸 **Jerimum (D.52)**<br>Fase 3 Crítica (`Kc=1.00`) → **545,5 L** | **700,2 L** | **Prova de fogo das 2 Zonas:** reduziu **-65% da água na Zona 1** para secar a casca e curar o Jerimum pré-colheita, enquanto entregou **água máxima na Zona 2** que estava florindo! |
| **Dia 110** | `18/06` | $32,0^\circ\text{C}$<br>Vento $20\text{ km/h}$ | 🧺 **1ª Colheita (~154 kg)**<br>Fim do ciclo (`195,1 L`) | 🌸 **Jerimum (D.60)**<br>Frutificação (`688,0 L`) | **883,1 L** | Você colhe **~154 kg de Jerimum na Zona 1** sem superlotar o armazenamento; a Zona 2 ainda está a 50 dias da colheita. |
| **Dia 126** | `04/07` | $29,9^\circ\text{C}$<br>Vento $22,8\text{ km/h}$ | 🫛 **Feijão Verde (D.1)**<br>Fase 1 (`Kc=0.45`) → **337,2 L** | 🌸 **Jerimum (D.76)**<br>Fase 3 Crítica (`601,3 L`) | **938,5 L** | **Rotação Inteligente:** após colher o Jerimum (*Cucurbitácea*), o App bloqueou plantar Melancia/Maxixe na Zona 1 e recomendou **Feijão Verde** (*Leguminosa*) para fixar nitrogênio no solo! |
| **Dia 160** | `07/08` | $32,3^\circ\text{C}$<br>Vento $24,4\text{ km/h}$ | 🌸 **Feijão Verde (D.35)**<br>Floração Crítica (`Kc=1.10`) → **928,2 L** | 🧺 **2ª Colheita Jerimum (~190 kg)**<br>Fase 5 (`Kc=0.35`) → **71,8 L** | **1.000,0 L** | **2ª Colheita de Jerimum exatamente 50 dias após a 1ª!** O Guardião da Cota cravou `1.000,0 L`, protegendo a florada do Feijão Verde na Zona 1. |
| **Dia 185** | `01/09` | $36,2^\circ\text{C}$<br>Vento $25,2\text{ km/h}$ | 🧺 **Feijão Verde (D.60)**<br>Colheita de Vagens → **777,8 L** | 🍠 **Batata-doce (D.10)**<br>Fase 1 (`Kc=0.50`) → **372,2 L** | **1.150,0 L** *(Boost)* | Na Zona 2 (após o 2º Jerimum), o App recomendou **Batata-doce** (*Convolvulácea*, rústica para entrar no verão seco). |
| **Dia 225** | `11/10` | $36,3^\circ\text{C}$<br>Vento $30,6\text{ km/h}$ | 🍠 **Batata-doce (D.17)**<br>Fase 1 (`Kc=0.50`) → **398,1 L** | 🚨 **Batata-doce (D.50)**<br>Tuberização Crítica (`Kc=1.10`) → **751,9 L** | **1.150,0 L** *(Boost)* | No auge do calor de outubro/novembro, o sistema priorizou a Zona 2 (que estava formando batatas debaixo da terra) dentro do limite seguro da caixa. |

---

## 🧠 3. O que Esse Benchmark Comprova sobre o Projeto?

1. **A defasagem de 50 dias entre Zona 1 e Zona 2 funciona perfeitamente:**
   - Em vez de colher **344 kg de Jerimum de uma vez só** (o que exigiria vender rápido a preço baixo), você colhe **~154 kg em junho (Dia 110)** e **~190 kg em agosto (Dia 160)**.
   - Hidraulicamente, escalonar em 50 dias também **evita que as duas zonas atinjam o pico máximo de sede (`Kc = 1.00`) juntas por muito tempo**, mantendo a média diária do sítio em tranquilos **634 L/dia**.
2. **A recomendação pós-colheita protege o solo e o bolso:**
   - Ao impedir que você plante outra *Cucurbitácea* logo após o Jerimum e sugerir **Feijão Verde (Zona 1)** e **Batata-doce (Zona 2)**, o sistema quebra o ciclo de pragas de solo e aproveita todas as 16 linhas de gotejamento no segundo semestre.
3. **O Filtro Único 120 Mesh + Sensor Hall `SF1` dão conta do recado:**
   - Mesmo sem o duplo filtro autolimpante do `pro-max`, quando a vazão cai de `6,5 L/min` para `5,3 L/min` por poeira/algas na tela de 120 Mesh, o sistema **estica automaticamente os minutos da válvula** para entregar os mesmos litros até que o alerta no celular avise que chegou a hora de desenroscar e lavar o copo do filtro (apenas 3 vezes em 260 dias).
