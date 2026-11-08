# ✈️ SABIÁ · Robô Oficial do Telegram (Grupo da Família)

Este módulo envia automaticamente resumos agronômicos e alertas em tempo real diretamente para o **grupo da família no Telegram**, com foco exclusivo em informações da lida, colheita e emergências reais do sítio.

---

## 🛡️ Por que Telegram?
- **100% Gratuito & Oficial:** Utiliza a API oficial do Telegram Bot via HTTPS direto.
- **Privacidade Total:** Zero acesso às suas conversas, fotos ou mensagens privadas. O bot tem identidade própria (ex: `@SabiaDoSitioBot`).
- **Autônomo & Leve:** Pode ser disparado diretamente pelo **ESP32** com poucas linhas de C++, pelo **GitHub Actions** (na nuvem) ou pelo **WebApp**.
- **Sem Servidor Obrigatório:** Não exige Raspberry Pi nem computador ligado 24h na tomada.

---

## ☀️ Boletins & Alertas
1. **06:00 (Manhã):** Status das culturas, Dias Após o Plantio (DAP), previsão do tempo, nível da caixa d'água e Pro Tip agronômica.
2. **18:00 (Entardecer):** Total irrigado no dia, cota economizada e confirmação de repouso noturno até as 04:00.
3. **🚨 Emergências Reais:** Cano seco (válvula aberta com 0 L/min — bomba parada ou registro fechado) e caixa d'água crítica (< 20%).
4. **📡 Conexão:** Alerta de desconexão disparado **estritamente após 24 horas consecutivas sem ping**.

---

## 🚀 Como Obter o Token do Bot (Em 1 Minuto)
1. No Telegram, procure pelo usuário oficial **`@BotFather`** e mande a mensagem:  
   `/newbot`
2. Escolha um nome (ex: `SABIÁ - Sítio Seridó`) e um usuário (ex: `SabiaSitioBot`).
3. O `@BotFather` responderá na hora com o seu **Token de Acesso** (ex: `7123456789:AAHkQZp_X9...`).
4. Crie um grupo no Telegram, adicione os familiares e adicione o seu bot lá dentro.
5. No WebApp do SABIÁ, clique em **✈️ Telegram**, cole o Token e clique em **🔍 Detectar Automaticamente** para achar o ID do Grupo!
