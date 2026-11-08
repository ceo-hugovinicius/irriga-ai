# OPUS_CHECKPOINT_LOG — Irriga.ai Pro-Duo · `v1.5-Argon` (edição Claude concluída por Argon)

> **Status Geral:** ✅ **100% CONCLUÍDO (`CP0` a `CP8` + Painel de Luzes de Espia Automotivas `v1.5-Argon`)**

## Decisões de arquitetura (fixas + evolução v1.5-Argon)

1. **Um só cérebro (`core/irriga-core.js`)**: o mesmo arquivo JS roda no app (navegador) e no simulador (Node). O firmware espelha o core em C++ seguindo `docs/ESPEC_MOTOR.md`.
2. **Balanço hídrico do solo FAO-56 (modelo de "balde")** no lugar de "lâmina fixa por fase + bônus". Rega só quando o solo realmente precisa e devolve só o que falta → chuva fica guardada no solo, não há percolação.
3. **Curva Kc contínua (FAO-56, 4 estágios)** + raiz que cresce + `p` (esgotamento permitido) por cultura + **Ky (FAO-33)** para dividir água escassa entre as zonas.
4. **Hidráulica medida, não suposta**: `q = k·H^0,5` por gotejador; autocalibração pelo SF1 → pressão efetiva no gotejador, vazão real, duração exata.
5. **Guarda térmica**: entre 09:30–16:30, nenhuma rega menor que 5× o volume da mangueira (a água escaldante vira < 20% da dose); se não couber, vai para 17:15.
6. **Firmware autônomo**: sem internet usa ET0 climatológica mensal do Seridó; com internet usa a previsão enviada pelo app.
7. **Botões físicos novos** (mesmos GPIOs):
   - B1 `GPIO13` ⏯️ **Pausa/Retoma** (toque = pausa 2 h com retomada automática; segurar 3 s = pausa sem prazo; tocar pausado = retoma).
   - B2 `GPIO14` 💧 **Regar agora** (devolve ao solo exatamente o que falta, zona por zona em fila; toques extras +2 mm).
   - B3 `GPIO26` 🌧️ **Era bom que chovesse** (+25%/+50% por 24 h, e *aprende*: se apertado em 3 dias de 7, sugere ajuste fino permanente).
   - B4 `GPIO27` ☔ **Choveu aqui** (1/2/3 toques = ~5/15/30 mm; credita no solo e cancela regas).
   - Qualquer botão segurado 1 s com tela apagada = só acorda o OLED.
8. **App sem dependências externas** (CSS próprio, sem Tailwind CDN) → abre 100% offline na roça.
9. **🚨 NOVO (`v1.5-Argon`) — Painel de Luzes de Espia Clicáveis abaixo da Temperatura:**
   - Substitui os blocos de texto grandes por botões/luzes de espia compactos estilo painel de carro (`☀️ Calor forte +20%`, `💨 Vento seco +10%`, `🚨 Limite de cota atingido!!`, `🌅 Janela elástica ativada`, etc.) mantendo o bloco de Cota & Caixa 5.000 L compacto e alinhado.
   - Clicáveis mesmo com o cadeado `🔒` trancado para exibir um modal rico com todos os detalhes técnicos e atalhos de ação.

## Fila de checkpoints

| # | Entrega | Arquivos | Status |
|---|---|---|---|
| CP0 | Log + decisões | `OPUS_CHECKPOINT_LOG.md` | ✅ |
| CP1 | Motor agronômico compartilhado | `core/irriga-core.js`, `core/crops.js` | ✅ |
| CP2 | Simulador 260 dias (Argon vs 1.5) + relatório | `sim/simular_safra.js`, `BENCHMARK_260_DIAS.md` | ✅ |
| CP3 | App: shell, estilo, luzes de espia, estado, home | `web-app/index.html`, `web-app/app.js` | ✅ |
| CP4 | App: sheets (detalhe luzes de espia, botões, plantio, calibração, ajustes) | `web-app/sheets.js` | ✅ |
| CP5 | YAML v1.5 (compatível com v1.0) + Claude | `core/yaml-lite.js`, `planos/plano_irrigacao_sitio.yaml`, `planos/PROMPT_PARA_O_CLAUDE.md` | ✅ |
| CP6 | PWA + bancada dev | `web-app/sw.js`, `web-app/manifest.json`, `web-app/icon.svg`, `web-app/dev-gui.html` | ✅ |
| CP7 | Firmware ESP32 | `firmware/src/main.cpp`, `firmware/include/pinout_pro_duo.h`, `firmware/platformio.ini` | ✅ |
| CP8 | README final + espec do motor | `README.md`, `docs/ESPEC_MOTOR.md` | ✅ |
