# 🌱 Irriga.ai Pro-Duo · `v1.5.2-Argon` (Simplicidade de Uso sem Perda de Funcionalidade)

Esta evolução **`v1.5.2-Argon`** mantém toda a inteligência agronômica e hidráulica nos bastidores (`core/irriga-core.js`), eliminando chutômetros e jargões técnicos para entregar controle real, simples e humano no dia a dia do sítio.

---

## ✨ O Que Mudou na `v1.5.2-Argon`

1. **🚫 Fim do "Chutômetro" de Umidade + Rega Diária Garantida + Decisão Inteligente para Frutos com Restrição Hídrica:**
   - Removemos a barra de `% de umidade do solo` estimada sem sensor físico (que podia deixar a planta com sede achando que a terra estava molhada).
   - Agora o sistema trabalha com **Rega Diária Garantida** dentro da cota diária.
   - **Mecanismo de Tomada de Decisão na Reta Final (`🍯 Melancia, Melão, Jerimum e Batata-doce`):**
     - Nos dias finais de maturação/cura, o sistema aplica redução controlada (`-50%` a `-65%`) para concentrar o açúcar (**°Brix**) e evitar rachaduras.
     - Se detectar **clima ameno (`< 30,5 °C`), chance de chuva (`>= 50%`) ou chuva anotada**, entra automaticamente em **Corte Forte (`-70%` a `-80%`, mantendo apenas um pulso leve de manhã e cortando o turno da tarde)**. O agricultor também pode alternar com 1 toque no cartão da zona entre `🤖 Auto`, `🍯 Reduzir`, `☀️ Corte Forte` ou `🛑 Secar Hoje (0 L)`.

2. **🌅🌇 Divisão da Rega em 2 Turnos Diários (Manhã Cedo + Fim da Tarde):**
   - Em vez de concentrar regas à meia-noite, o uso diário de água é dividido em **2 turnos**:
     - **🌅 Manhã Cedo (`04:00–05:30`):** ~60% da água do dia para a planta atravessar o sol quente hidratada.
     - **🌇 Fim da Tarde (`16:00–17:30`):** ~40% da água no entardecer, facilitando para o **poço artesiano repor a água da caixa de 5.000 L** ao longo do dia.

3. **🚰 Contador "Pedido Real das Plantas vs. Gasto na Cota" (Indicador de Sede):**
   - No painel **Água do Dia**, além da cota e do nível da caixa de 5.000 L, há o contador **`🌱 Pedido real hoje`** comparado com **`🚰 Gasto / Cota`**.
   - Se a cota diária estiver travando o que as plantas realmente pedem, o painel alerta na hora: **`⚠️ Passando sede: faltam X L (−Y%)`**.

4. **📏 Hidráulica Medida por Metros de Fita de Gotejamento (Sem Contar "Fileiras"):**
   - Em **⚙️ Fita e Ajustes** de cada zona, você informa:
     - **Metragem total da fita de gotejamento (`metros`)**
     - **Espaçamento entre gotejadores (`20 cm`, `30 cm`, `40 cm`, `50 cm`)**
     - **Vazão por hora de cada gotejador (`L/h por furo`)**
   - O sistema calcula automaticamente o total de furos e o **volume exato de saída da zona (`L/hora` e `L/min`)**.

5. **💧 Novo "Regar Agora" como Override ("Little Treat / Flex") + Conversor Bidirecional `Horas ⇄ Litros`:**
   - **No Botão Físico B2 (`GPIO 14`) ou atalho `+1h Flex`:** cada aperto adiciona **+1 hora de água (30 min na Zona 1 + 30 min na Zona 2)**. Ele é contabilizado no dia, mas **consegue derramar água mesmo quando a cota diária já foi atingida**.
   - **No Painel Web/PC:** permite escolher **As 2 zonas**, **Só Zona 1** ou **Só Zona 2**, e digitar/selecionar por **Tempo (Horas)** ou por **Volume (Litros)** com conversão instantânea:
     - Colocou **2 horas** → mostra na hora: **`Vai gastar XYZ Litros`**.
     - Colocou **1.500 Litros** → mostra na hora: **`Vai durar Z horas e W min`**.

6. **📖 Guia de Culturas & Espaçamentos Separado de 🔄 Confirmar Troca de Cultura:**
   - **`📖 Ver culturas e espaçamentos`:** modo de consulta 100% seguro (não apaga a safra atual!) mostrando **espaçamento mínimo da rua (entre fitas)**, **espaçamento entre plantas**, ciclo e preparo de todas as 10 culturas.
   - **`🔄 Trocar cultura`:** exige destravar o cadeado e clicar no passo explícito **`✅ Sim, Confirmar Troca de Cultura`**, protegendo a safra em andamento contra cliques acidentais.
