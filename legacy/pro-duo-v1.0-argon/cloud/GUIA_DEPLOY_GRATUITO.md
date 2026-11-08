# ☁️ Guia Prático de Implantação Gratuita (R$ 0,00/mês) — Irriga.ai Pro-Duo

Este guia mostra como colocar a interface online ubíqua e o banco de dados na nuvem em **menos de 10 minutos**, sem precisar cadastrar cartão de crédito.

---

## Passo 1: Publicar o Aplicativo Web Mobile/Desktop (Vercel ou Netlify — 2 min)

A pasta [`c:\irriga-ai\pro-duo\web-app\`](file:///c:/irriga-ai/pro-duo/web-app) já é um aplicativo web completo (PWA) que não exige compilação complexa:
1. Para usar **localmente agora mesmo** no computador ou celular: basta abrir o arquivo [`web-app/index.html`](file:///c:/irriga-ai/pro-duo/web-app/index.html) no navegador.
2. Para ter um **link online público (ex.: `irriga-sitio.vercel.app`)** acessível de qualquer lugar no seu celular:
   * Acesse [app.netlify.com/drop](https://app.netlify.com/drop) ou [vercel.com](https://vercel.com);
   * Arraste a pasta `c:\irriga-ai\pro-duo\web-app` para a tela;
   * Em 10 segundos você recebe o link HTTPS oficial! Abra esse link no seu celular e toque em **"Adicionar à Tela de Início"** para instalar como aplicativo nativo.

---

## Passo 2: Criar o Banco de Dados em Tempo Real no Supabase (5 min)

1. Crie uma conta gratuita em [supabase.com](https://supabase.com) e clique em **`New Project`** (ex.: `irriga-pro-duo`).
2. No menu lateral esquerdo, clique em **`SQL Editor`** $\to$ **`New Query`**.
3. Copie todo o conteúdo do arquivo [`cloud/supabase_migration.sql`](file:///c:/irriga-ai/pro-duo/cloud/supabase_migration.sql), cole no editor e clique em **`Run`**.
4. Pronto! As tabelas `irriga_plans`, `relay_channels` (com os 8 relés já cadastrados) e `pro_duo_telemetry` estarão criadas e com atualização em tempo real ativada.
5. Em **`Project Settings` $\to$ `API`**, copie a **`Project URL`** e a chave **`anon public`** e cole no botão **`⚙️ Conexão Sítio / Nuvem`** dentro do seu aplicativo web!

---

## Passo 3: Alertas Gratuitos no Celular via Telegram (Opcional — 3 min)

1. No seu Telegram, procure por **`@BotFather`** e envie o comando `/newbot`.
2. Escolha um nome (ex.: `Irriga Sítio Seridó`) e receba o seu **`TELEGRAM_BOT_TOKEN`**.
3. Envie um "Oi" para o seu novo bot e configure o token na Edge Function [`cloud/supabase_daily_cron.ts`](file:///c:/irriga-ai/pro-duo/cloud/supabase_daily_cron.ts) para receber gratuitamente todos os dias às `05:00` o boletim de calor, vento, nível da caixa de $5.000\text{ L}$ e saúde do filtro 120 Mesh!
