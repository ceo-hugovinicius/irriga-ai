# 🤖 Bot de WhatsApp do SABIÁ — Grupo da Família

Este serviço automatizado conecta o motor do **SABIÁ** diretamente ao grupo da família no WhatsApp.

---

## 🎯 O Que o Bot Envia Sozinho no Grupo

1. **☀️ 06:00 — Boletim Matinal da Lavoura:**
   - Volume de água entregue no 1º turno das 04h por zona;
   - Idade das plantas (DAP), fase de desenvolvimento (floração, ramas correndo, maturação);
   - Alerta antecipado de colheita (ex: *"Colheita do Jerimum em 5 dias — hora de organizar caixas e venda"*);
   - Explicações de manejo agronômico (ex: *"Rega reduzida no melão para apurar o açúcar (°Brix)"*);
   - Alerta se a cota diária estiver deixando as plantas com sede há dias seguidos;
   - Nível da caixa d'água de 5.000 L e previsão do tempo (calor/vento/chuva).

2. **🌙 18:00 — Fechamento do Entardecer:**
   - Total de litros aplicados no dia (Turno 1 + Turno 2);
   - Saldo de cota economizada guardada na caixa;
   - Aviso de repouso noturno até as 04:00.

3. **🚨 Imediato — Alertas de Emergência do Campo:**
   - **Cano Seco / Bomba Parada:** Alerta urgente se a válvula abrir e o sensor marcar 0 L/min.
   - **Caixa Crítica:** Alerta se o nível cair para menos de 20% (< 1.000 L).

4. **📡 Redundância 24 Horas:**
   - **Não envia avisos por pequenas oscilações de Wi-Fi.**
   - Envia alerta **apenas se o SABIÁ passar mais de 24 horas consecutivas sem conectar à internet.**

---

## 🚀 Como Conectar com o Grupo do WhatsApp

O bot suporta qualquer gateway ou webhook de WhatsApp:

### Opção 1: CallMeBot (Gratuito e sem servidor intermediário)
- Adicione o bot do CallMeBot ao grupo do WhatsApp conforme instruções do serviço;
- Copie a URL gerada e preencha em `config.json` ou na interface web em **Ajustes ➔ Robô do WhatsApp**.

### Opção 2: Evolution API / Z-API (Gateway Próprio)
- Crie uma instância no seu servidor ou serviço na nuvem;
- Aponte a URL do webhook (ex: `https://sua-api.com/message/sendText/instancia`) e o ID do grupo (`1203630XXXX@g.us`).

---

## 💻 Executando o Bot

```bash
# Executar diretamente com Node.js
node pro-duo-main/bot/bot-whatsapp.js
```
*(Também pode ser executado em segundo plano via PM2, Docker, n8n ou cron job na nuvem).*
