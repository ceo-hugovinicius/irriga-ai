# 📚 Catálogo de Versões Anteriores (`legacy/`) — Irriga.ai

Este diretório preserva e cataloga o histórico evolutivo do **Irriga.ai Pro-Duo** até chegarmos à versão principal em produção ([`../pro-duo-main`](../pro-duo-main/)).

---

## 🗂️ Índice das Pastas Arquivadas

| Pasta | Versão / Autor | Resumo Técnico & Histórico | Por que foi substituída |
|---|---|---|---|
| [`ContextIngested/`](./ContextIngested/) | **v0 — Base Inicial & Contexto do Sítio** | Primeiros levantamentos de contexto do sítio em São Vicente do Seridó (PB), especificações preliminares de hardware ESP32 e ideias iniciais de automação. | Evoluiu para a arquitetura estruturada do `Pro-Duo` (2 zonas) e `Pro-Max`. |
| [`pro-duo-v1.0-argon/`](./pro-duo-v1.0-argon/) | **v1.0-Argon (Primeira Versão Completa)** | Primeira implementação completa com ESP32 de 38 pinos, 8 relés Active-LOW, Sensor Hall `SF1`, 4 boias na caixa de `5.000 L`, 4 botões físicos (`Pausa`, `Regar Agora`, `Era Bom Chover`, `Choveu Aqui`), ponte `.yaml` com o Claude e Web-App PWA. | Usava lâminas fixas por fase e fatores climáticos aditivos (`+20%` calor / `+10%` vento) sobrepostos, além de um card de clima muito extenso na tela principal. |
| [`pro-duo-claude/`](./pro-duo-claude/) | **v2.0-Claude / Opus (Proposta Incompleta do Claude Code)** | Análise crítica feita pelo Claude Opus sobre a `v1.0-Argon`. Deixou prontos o motor agronômico unificado (`core/irriga-core.js`, `core/crops.js`), o simulador de 260 dias (`sim/simular_safra.js`) e a especificação (`docs/ESPEC_MOTOR.md`), mas interrompeu antes de concluir o Web-App completo e o firmware. *(Inclui nota de contexto do Argon no `OPUS_CHECKPOINT_LOG.md`).* | Serviu de fundação matemática para a linha `1.5`, mas precisava de interface completa, ajustes de UX humana e correções de operação real sem sensor de solo. |
| [`pro-duo-1.5-argon/`](./pro-duo-1.5-argon/) | **v1.5-Argon (Híbrido Inicial Claude + Argon)** | Uniu o motor do Claude com o Web-App e firmware completos do Argon. Na primeira iteração da `1.5`, tentou expor o "balde FAO-56" e `% de umidade do solo` na tela, o que gerou excesso de informação técnica ("painel de bomba atômica") e o problema do "chutômetro" sem sensor físico. | Refinada na **`v1.5.2-Argon`**, que foi promovida para [`../pro-duo-main`](../pro-duo-main/). |

---

## 🏆 Versão Escolhida e Ativa no Repositório Principal

- **[`../pro-duo-main/`](../pro-duo-main/) (`v1.5.2-Argon`):**
  - **Luzes de Espia Enxutas** (estilo painel de carro, máx. 4 avisos ativos, clicáveis mesmo com cadeado `🔒` trancado).
  - **Fim do "Chutômetro" de Umidade:** Rega Diária Garantida + **Mecanismo de Tomada de Decisão na Reta Final** para culturas com restrição hídrica (`Melancia`, `Melão`, `Jerimum`, `Batata-doce`).
  - **2 Turnos Diários (`🌅 Manhã Cedo 04:00–05:30` + `🌇 Fim da Tarde 16:00–17:30`):** Facilita a reposição da caixa de `5.000 L` pelo **poço artesiano**.
  - **Contador "Pedido Real das Plantas vs. Gasto na Cota":** Indicador direto para saber se as plantas estão passando sede.
  - **Medição por Metros de Fita de Gotejamento:** Calcula a saída da zona a partir da metragem da fita (`m`), espaçamento entre furos (`cm`) e vazão por gotejador (`L/h`).
  - **Override Manual ("Little Treat / Flex"):** Botão físico `B2` adiciona `+1 hora` (`30 min Zona 1 + 30 min Zona 2`) mesmo acima da cota, e o modal do app converte **`Horas ⇄ Litros`** em tempo real.
  - **Guia de Culturas & Espaçamentos separado da Troca de Cultura com Dupla Confirmação.**
