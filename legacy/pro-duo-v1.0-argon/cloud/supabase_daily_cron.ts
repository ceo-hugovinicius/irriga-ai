// ==============================================================================
// 🌱 Irriga.ai Pro-Duo — Supabase Edge Function (Cron Diário + Bot Telegram)
// ==============================================================================
// Esta função roda gratuitamente no Supabase Free Tier (ex: todo dia às 04:30 BRT):
// 1. Consulta a previsão real e a exposição ao calor/vento em São Vicente do Seridó - PB
//    via Open-Meteo API (-6.95325, -36.36853).
// 2. Lê o plano ativo na tabela `irriga_plans` e registra atividade SQL no banco
//    (garantindo que o projeto gratuito do Supabase NUNCA pause por inatividade de 7 dias!).
// 3. Envia um resumo humano no Telegram (se TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID
//    estiverem configurados nas variáveis de ambiente gratuitas do Supabase).
// ==============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_LAT = -6.95325;
const SITE_LON = -36.36853;

Deno.serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Busca clima real do dia em São Vicente do Seridó - PB
    const meteoUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${SITE_LAT}&longitude=${SITE_LON}` +
      `&daily=et0_fao_evapotranspiration,temperature_2m_max,wind_speed_10m_max,precipitation_sum,precipitation_probability_max` +
      `&hourly=temperature_2m&timezone=America%2FFortaleza&forecast_days=1`;

    const meteoRes = await fetch(meteoUrl);
    const meteo = await meteoRes.json();

    const et0Mm = meteo.daily?.et0_fao_evapotranspiration?.[0] ?? 5.4;
    const tempMaxC = meteo.daily?.temperature_2m_max?.[0] ?? 34.0;
    const windMaxKmh = meteo.daily?.wind_speed_10m_max?.[0] ?? 22.0;
    const rainProbPct = meteo.daily?.precipitation_probability_max?.[0] ?? 0;
    const rainMm = meteo.daily?.precipitation_sum?.[0] ?? 0.0;

    const hoursAbove32C = Array.isArray(meteo.hourly?.temperature_2m)
      ? meteo.hourly.temperature_2m.slice(0, 24).filter((t: number) => t >= 32.0).length
      : 3;

    // 2. Grava telemetria diária no PostgreSQL (mantém o banco Free Tier 100% ativo!)
    const { data: latestTelemetry } = await supabase
      .from("pro_duo_telemetry")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from("pro_duo_telemetry").insert({
      operation_mode: latestTelemetry?.operation_mode ?? "AUTO",
      tank_level_pct: latestTelemetry?.tank_level_pct ?? 75,
      flow_rate_lpm: 0.0,
      liters_used_today: 0.0, // Zera o acumulador na virada da madrugada
      daily_quota_max_liters: latestTelemetry?.daily_quota_max_liters ?? 1000.0,
      filter_120mesh_efficiency_pct: latestTelemetry?.filter_120mesh_efficiency_pct ?? 95.0,
      wish_rain_boost_pct: latestTelemetry?.wish_rain_boost_pct ?? 0.0,
      temp_max_today_c: tempMaxC,
      hours_above_32c: hoursAbove32C,
      wind_max_kmh: windMaxKmh,
    });

    // 3. Envia resumo matinal humano no Telegram (Opcional e 100% Gratuito)
    const tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const tgChatId = Deno.env.get("TELEGRAM_CHAT_ID");

    if (tgToken && tgChatId) {
      const heatBonus = Math.min(20, hoursAbove32C * 4);
      const windBonus = windMaxKmh >= 20 ? 10 : 0;

      const textMsg =
        `🌱 *Bom dia! Resumo Irriga.ai Pro-Duo*\n` +
        `📍 _São Vicente do Seridó – PB_\n\n` +
        `☀️ *Clima previsto hoje:*\n` +
        `• Temp. Máxima: *${tempMaxC}°C* (${hoursAbove32C}h acima de 32°C -> +${heatBonus}% rega)\n` +
        `• Vento: *${windMaxKmh} km/h* (${windBonus > 0 ? `+${windBonus}% proteção` : "Normal"})\n` +
        `• Chuva: *${rainProbPct}%* (${rainMm} mm) | ET0: *${et0Mm} mm*\n\n` +
        `🪣 *Caixa 5.000L:* Nível em *${latestTelemetry?.tank_level_pct ?? 75}%*\n` +
        `🔍 *Filtro 120 Mesh:* Eficiência em *${latestTelemetry?.filter_120mesh_efficiency_pct ?? 95}%*`;

      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChatId,
          text: textMsg,
          parse_mode: "Markdown",
        }),
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        site: "São Vicente do Seridó - PB",
        weather: { et0Mm, tempMaxC, hoursAbove32C, windMaxKmh, rainProbPct, rainMm },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
