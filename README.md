# 🌱 Irriga.ai — Automação Agronômica Inteligente para o Semiárido

Repositório oficial (privado) do ecossistema **Irriga.ai** — desenvolvido para operação real no Semiárido Paraibano (**São Vicente do Seridó – PB**).

---

## 📂 Estrutura do Repositório

| Diretório | Status | Descrição |
|---|---|---|
| **[`pro-duo-main/`](./pro-duo-main/)** | 🟢 **Produção Atual (`v1.6.7.a — SABIÁ`)** | Sistema completo para **2 Zonas de Irrigação** por gravidade (`Caixa 5.000 L` + `Poço Artesiano`), motor autônomo SABIÁ em 2 turnos (`04:00` e `16:00`), medição por metros de fita de gotejamento, decisão inteligente de restrição hídrica na reta final, override manual (`Horas ⇄ Litros` e botão físico `+1h Flex`), firmware de campo do SABIÁ, simulador Wokwi e telemetria em tempo real via nuvem MQTT (HiveMQ). |
| **[`pro-duo-main/ROADMAP_V1_6.md`](./pro-duo-main/ROADMAP_V1_6.md)** | 📋 **Backlog `v1.6`** | Especificação das próximas features: catálogo de forragens/silagens/palma/capins/moringa/erva-sal para apoio ao gado + estado inicial virgem (`Canteiro livre`) e opção `"Nenhuma"` mantendo override manual ativo. |
| **[`pro-max/`](./pro-max/)** | 🔬 **Em Desenvolvimento Futuro** | Arquitetura avançada (`Pro-Max`) reservada para evolução futura de hardware, sensores de solo e expansão multi-zona. |
| **[`legacy/`](./legacy/)** | 🏛️ **Arquivo Histórico Catalogado** | Contém as versões anteriores (`v1.0-Argon`, `pro-duo-claude`, `v1.5-Argon` e `ContextIngested`). Veja o índice detalhado em **[`legacy/CATALOGO_VERSOES.md`](./legacy/CATALOGO_VERSOES.md)**. |

---

## 🚀 Como Abrir o App Principal (`pro-duo-main`)

- **App do Agricultor (PWA Offline-First):** [`pro-duo-main/web-app/index.html`](./pro-duo-main/web-app/index.html)
- **Bancada de Engenharia e Testes (Dev-GUI):** [`pro-duo-main/web-app/dev-gui.html`](./pro-duo-main/web-app/dev-gui.html)
- **Simulador de Safra de 260 Dias (Node.js):** `node pro-duo-main/sim/simular_safra.js`
- **Firmware do SABIÁ (ESP32 / PlatformIO / Wokwi):** [`pro-duo-main/firmware/src/main.cpp`](./pro-duo-main/firmware/src/main.cpp)
