# OPUS_CHECKPOINT_LOG — Irriga.ai Pro-Duo · edição Claude

> **Para qualquer IA que retomar este trabalho ("Continue"):** leia este arquivo primeiro.
> Siga a fila abaixo, faça **um checkpoint por vez** e marque ✅ logo ao terminar.

## Decisões de arquitetura (fixas)

1. **Um só cérebro (`core/irriga-core.js`)**: o mesmo arquivo JS roda no app (navegador) e no simulador (Node). Na v1.0-Argon a lógica estava triplicada (app.js, Python, C++). O firmware espelha o core em C++ seguindo `docs/ESPEC_MOTOR.md`.
2. **Balanço hídrico do solo FAO-56 (modelo de "balde")** no lugar de "lâmina fixa por fase + bônus". Rega só quando o solo realmente precisa e devolve só o que falta → chuva fica guardada no solo, não há percolação.
3. **Curva Kc contínua (FAO-56, 4 estágios)** + raiz que cresce + `p` (esgotamento permitido) por cultura + **Ky (FAO-33)** para dividir água escassa entre as zonas.
4. **Hidráulica medida, não suposta**: `q = k·H^0,5` por gotejador; autocalibração pelo SF1 → pressão efetiva no gotejador, vazão real, duração exata.
5. **Guarda térmica**: entre 09:30–16:30, nenhuma rega menor que 5× o volume da mangueira (a água escaldante vira < 20% da dose); se não couber, vai para 17:00.
6. **Firmware autônomo**: sem internet usa ET0 climatológica mensal do Seridó; com internet usa a previsão enviada pelo app.
7. **Botões físicos novos** (mesmos GPIOs):
   - B1 `GPIO13` ⏯️ **Pausa/Retoma** (toque = pausa 2 h com retomada automática, +2 h por toque; segurar 3 s = pausa sem prazo; tocar pausado = retoma) → acaba com "esqueceram pausado".
   - B2 `GPIO14` 💧 **Regar agora** (devolve ao solo exatamente o que falta, zona por zona em fila; toques extras +2 mm).
   - B3 `GPIO26` 🌧️ **Era bom que chovesse** (mantido: +25%/+50% por 24 h, e agora *aprende*: se apertado em 3 dias de 7, sugere ajuste fino permanente).
   - B4 `GPIO27` ☔ **Choveu aqui** (1/2/3 toques = ~5/15/30 mm; credita no solo e cancela regas). Resolve a chuva localizada que o satélite não vê.
   - Qualquer botão segurado 1 s com tela apagada = só acorda o OLED.
8. **App sem dependências externas** (CSS próprio, sem Tailwind CDN) → abre 100% offline na roça.

## Fila de checkpoints

| # | Entrega | Arquivos | Status |
|---|---|---|---|
| CP0 | Log + decisões | `OPUS_CHECKPOINT_LOG.md` | ✅ |
| CP1 | Motor agronômico compartilhado | `core/irriga-core.js`, `core/crops.js` | ✅ |
| CP2 | Simulador 260 dias (Argon vs Claude) + relatório | `sim/simular_safra.js`, `BENCHMARK_260_DIAS.md` | ✅ |
| CP3 | App: shell, estilo, estado, home | `web-app/index.html`, `web-app/app.js` | ⏳ |
| CP4 | App: sheets (botões, plantio, calibração, ajustes) | `web-app/sheets.js` | ⏳ |
| CP5 | YAML v2 (compatível com v1.0) + Claude | `core/yaml-lite.js`, `planos/plano_irrigacao_sitio.yaml`, `planos/PROMPT_PARA_O_CLAUDE.md` | ⏳ |
| CP6 | PWA + bancada dev | `web-app/sw.js`, `manifest.json`, `icon.svg`, `dev-gui.html` | ⏳ |
| CP7 | Firmware ESP32 | `firmware/src/main.cpp`, `firmware/include/*`, `platformio.ini` | ⏳ |
| CP8 | README final + espec do motor | `README.md`, `docs/ESPEC_MOTOR.md` | ⏳ |

## Diário
- CP0 ✅ — leitura de `CLAUDE.md`, `pro-duo/*`, decisões acima.
- CP1 ✅ — core com balanço FAO-56, Kc contínuo + Kr (gotejo), raiz crescente, reta final, rateio por Ky (com teto anti-espiral), agenda em pulsos intercalados terminando 05:30, guarda térmica, prévia de safra, "Quando plantar?", rotação, `estadoPadrao()`.
- CP2 ✅ — benchmark: −8% água, −66% água perdida, produtividade 91%→94% (`BENCHMARK_260_DIAS.md`). Rodar: `node sim/simular_safra.js` (DEBUG=1 mostra dias de estresse).

---

## 📝 Nota de Contexto do Argon para o Claude Opus (Relato de Erros de UX na Tentativa `1.5`)

> **Olá, Opus! Aqui é o Argon.**
> Enquanto você estava sem cota, o usuário me pediu para testar a implementação desta arquitetura numa pasta separada (`pro-duo-1.5-argon` / `pro-duo-1.5.2-argon`). Deixo este relato **apenas como contexto dos erros que EU (Argon) cometi na minha execução**, para que você não passe pelos mesmos tropeços quando retomar o seu trabalho aqui em `pro-duo-claude`.
> **Importante:** Este comentário **não tem o objetivo de limitar ou impedir você de tentar a sua própria solução** — pelo contrário, acredito que você possa pensar numa abordagem diferente e ainda mais elegante!

### O que deu errado na minha tentativa (`1.5-Argon`) e o feedback real do usuário:
1. **O "Balde FAO-56" e a barra de "% de Água no Solo" pareceram um "chutômetro" confuso para o usuário leigo:**
   - Como o hardware atual ainda não tem sensor físico de umidade espetado na terra, exibir na tela que o solo estava com *"82% de umidade"* (ou pular dias inteiros de rega dizendo *"Solo com água disponível — não precisa regar hoje"*) gerou desconfiança imediata e justa no usuário: se ainda não houve rega ou se o satélite acusou chuva que não caiu no canteiro, o sistema acha que a terra está molhada enquanto a planta pode estar passando sede no sol.
   - Além disso, expor termos como `balde FAO-56`, `conforto acima de X%`, `ET0`, `Kc`, `Ky` e excesso de avisos deixou a interface parecendo *"desarmar uma bomba atômica"*.
2. **Horários só na madrugada vs. 2 Turnos (Manhã Cedo + Fim da Tarde):**
   - Concentrar toda a rega num bloco único de madrugada dificulta a operação com a caixa d'água abastecida por poço artesiano. O usuário preferiu dividir a rega diária em **dois turnos claros**: uma parte de manhã cedo (~`04:00–05:30`) para aguentar o sol do dia e outra no fim da tarde (~`16:00–17:30`), facilitando a reposição gradual da caixa.
3. **O papel real do botão "💧 Regar agora" (`B2`):**
   - Na tentativa de fazer o `Regar agora` apenas *"devolver ao solo o que falta no balde"*, quando o balde virtual dizia estar cheio o botão se recusava a regar. Para o usuário, o botão físico `B2` deve ser um **override ("little treat / flex")**: poder ligar a água a qualquer momento (+1h de água = 30 min em cada zona por clique, mesmo acima da cota) para mostrar o sistema funcionando aos amigos, e no app poder escolher simplesmente regar por **X horas/minutos** ou **Y litros** (com conversão automática entre horas e litros).
4. **O que o usuário elogiou muito (vale manter!):**
   - O fluxo de **Detalhes e Ajustes da Zona** (ajuste fino permanente `-20%..+20%`, cobertura com palhada `-15%`) e o assistente de **Troca de Cultura com Rotação** (desde que haja um botão separado só para *consultar culturas e espaçamentos* e uma confirmação explícita ao trocar de cultura para ninguém apagar a safra atual por curiosidade).
