# 🌱 CLAUDE.md — Manifesto de Arquitetura e Guia para o Claude Opus (`Irriga.ai Pro-Duo v1.0-Argon`)

> **Espelho Sincronizado:** Este arquivo espelha o documento mestre [`../CLAUDE.md`](file:///c:/irriga-ai/CLAUDE.md) na raiz do projeto. Leia [`../CLAUDE.md`](file:///c:/irriga-ai/CLAUDE.md) para o guia completo.

---

## 🎯 Resumo Rápido para o Claude Opus

1. **Propósito da Sua Versão:**
   - A versão atual **`Irriga.ai Pro-Duo v1.0-Argon`** já está finalizada e funcional.
   - Sua missão é criar uma nova versão trazendo **novas ideias, diferentes execuções e soluções para problemas observados na `v1.0-Argon`** (como calibração real da vazão por gravidade nas fitas de $30\text{ cm}$ / $1,6\text{ L/h por furo}$, manejo térmico da água parada na mangueira preta de PEBD, janelas de longa duração e melhorias de UX/decisão agronômica).
2. **Economia de Processamento e Tokens:**
   - **Onde não houver solução claramente melhor, copie diretamente a implementação da `v1.0-Argon`!** Não gaste processamento recriando do zero o que já funciona perfeitamente.
3. **Fila de Tarefas e Checkpoints Anti-Limite de Uso (`OPUS_CHECKPOINT_LOG.md`):**
   - Crie uma fila de tarefas dividida em pequenos checkpoints e atualize-a a cada passo concluído (igual ao [`DEV_LOG_CHECKPOINT.md`](file:///c:/irriga-ai/pro-duo/DEV_LOG_CHECKPOINT.md)), garantindo retomada imediata ao receber o comando `"Continue"`.
4. **Regras Imutáveis:**
   - Manter o pinout seguro do ESP32 38 pinos ([`firmware/include/pinout_pro_duo.h`](file:///c:/irriga-ai/pro-duo/firmware/include/pinout_pro_duo.h)) e a matriz de 8 relés (3 ativos + 5 expansão).
   - Nunca abrir Zona 1 e Zona 2 juntas (filtro único 120 Mesh por gravidade).
   - Tema Claro (*Apple Daylight*) por padrão, cadeado digital no cabeçalho (`🔒`) separado dos 4 botões físicos livres, PWA instalável em Android e iOS, e compartilhamento nativo do arquivo `.yaml` com campo de colagem vazio + upload `.yaml` puro.
