# 📋 CHECKPOINT LOG — Irriga.ai Pro-Duo · `v1.5.2-Argon`

> Seguindo o sistema de checkpoints para implementar todas as melhorias pedidas pelo usuário com precisão e sem perda de contexto.

| # | Checkpoint | Arquivos | Status |
|---|---|---|---|
| **CP1** | Nota de contexto do Argon no `pro-duo-claude/OPUS_CHECKPOINT_LOG.md` + criação deste log | `pro-duo-claude/OPUS_CHECKPOINT_LOG.md`, `CHECKPOINT_1_5_2.md` | ✅ |
| **CP2** | Motor `crops.js` & `irriga-core.js`: Fim do chutômetro (rega diária garantida), mecanismo inteligente para restrição hídrica (Melancia, Melão, Jerimum, Batata-doce), 2 turnos (Manhã 04:00–05:30 + Tarde 16:00–17:30 p/ poço artesiano), medição por **metros de fita + espaçamento entre furos + L/h por gotejador**, contador **Pedido Real vs. Cota** e espaçamentos de plantio | `core/crops.js`, `core/irriga-core.js` | ✅ |
| **CP3** | Tela Principal (`index.html` & `app.js`): Contador de Pedido Real vs. Gasto (indicador de sede), cartões de zona com 2 turnos claros + metragem de fita, botão separado de **Guia de Culturas & Espaçamentos** vs. **Trocar Cultura** | `web-app/index.html`, `web-app/app.js` | ✅ |
| **CP4** | Modais (`sheets.js`): Novo **💧 Regar Agora (Override / Flex)** com conversor bidirecional **Horas ⇄ Litros** + **+1h (30m cada zona)**; modal **📖 Guia de Culturas & Espaçamentos** (consulta segura); modal **🔄 Trocar Cultura com Dupla Confirmação**; modal **⚙️ Detalhes da Zona** por metros de fita, espaçamento de gotejador e L/h | `web-app/sheets.js` | ✅ |
| **CP5** | Firmware ESP32 (`main.cpp` com B2 = +1h Flex 30m+30m override de cota), `dev-gui.html`, `README.md` e sincronia com `pro-duo-1.5-argon` | `firmware/src/main.cpp`, `web-app/dev-gui.html`, `README.md` | ✅ |
