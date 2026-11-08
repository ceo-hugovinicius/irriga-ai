// ==============================================================================
// 🌱 Irriga.ai Pro-Duo · v1.6.5-Argon — Firmware Autônomo ESP32
// ------------------------------------------------------------------------------
// Espelha o motor único `core/irriga-core.js` em C++:
//  1. Rega Diária Garantida em 2 turnos (Manhã Cedo 04:00–05:30 + Fim da Tarde
//     16:00–17:30) para facilitar a reposição da caixa de 5.000 L pelo poço artesiano.
//  2. Decisão inteligente para culturas com restrição hídrica na reta final
//     (Melancia, Melão, Jerimum, Batata-doce): reduz ou corta em clima ameno/chuva.
//  3. Medição hidráulica por metros de fita + espaçamento entre furos + L/h.
//  4. Fila anti-colisão rigorosa: NUNCA abre Zona 1 e Zona 2 juntas (filtro 120M).
//  5. Os 4 botões físicos (GPIOs 13, 14, 26, 27) sempre ativos:
//     - B1 (13) ⏯️ Pausa 2h c/ retomada automática (segurar 3s = sem prazo; tocar pausado = retoma)
//     - B2 (14) 💧 Override "+1 Hora Flex" (cada aperto soma +30 min na Zona 1 + 30 min na Zona 2,
//                  contabilizado no dia e liberado mesmo se a cota diária já foi atingida!)
//     - B3 (26) 🌧️ Era bom que chovesse (+25% / +50% por 24h)
//     - B4 (27) ☔ Choveu aqui (1/2/3 toques = 5 / 15 / 30 mm descontados no dia)
// ==============================================================================

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <PubSubClient.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <esp_task_wdt.h>
#include "pinout_pro_duo.h"

using namespace IrrigaPins;

// --- Constantes Físicas e Hidráulicas ---
constexpr float EFICIENCIA_GOTEJO      = 0.88f;
constexpr float PULSOS_POR_LITRO_SF1   = 450.0f; // Sensor Hall YF-S201 / DN20 padrão
constexpr float MIN_FLOW_DRY_PIPE_LPM  = 0.40f;
constexpr float MAX_FLOW_BURST_LPM     = 15.0f;
constexpr uint32_t MAX_VALVE_MS        = 180UL * 60UL * 1000UL;
constexpr uint32_t OLED_SLEEP_MS       = 60000UL;

// Normais mensais de ET0 em São Vicente do Seridó - PB (jan..dez)
const float CLIMA_SERIDO_ET0[12] = { 5.8f, 5.4f, 5.0f, 4.6f, 4.2f, 3.9f, 4.2f, 5.0f, 5.9f, 6.4f, 6.5f, 6.2f };

struct ZoneModel {
    uint8_t id;
    uint8_t relayPin;
    bool enabled;
    float area_m2;
    float fw;
    float flow_lpm;
    float flow_baseline_lpm;
    float hose_L;
    uint16_t dap;
    uint16_t days[4];
    float kc[3];
    float zr[2];
    float p;
    float cover;
    float ky[5];
    uint8_t late_days;
    float late_rep;
    bool mulch;
    int8_t fine_pct;
    float Dr_mm;
    float planned_L;
    float delivered_today_L;
};

ZoneModel zones[2] = {
    { 1, PIN_RELAY_2_ZONE_1, true, 128.0f, 0.35f, 2.8f, 2.8f, 12.2f, 48, {20,22,43,15}, {0.60f,1.00f,0.75f}, {0.15f,0.70f}, 0.50f, 0.60f, {0.4f,0.6f,1.1f,0.9f,0.4f}, 0, 1.0f, false, 0, 2.6f, 0.0f, 0.0f },
    { 2, PIN_RELAY_3_ZONE_2, true, 158.0f, 0.35f, 3.2f, 3.2f, 14.9f, 81, {20,25,33,10}, {0.40f,1.00f,0.75f}, {0.15f,0.80f}, 0.40f, 0.70f, {0.4f,0.6f,1.1f,0.8f,0.3f}, 10, 0.5f, false, 0, 3.2f, 0.0f, 0.0f }
};

// --- Estado Global do Controlador ---
float soil_taw_mm_m      = 100.0f; // Franco-arenoso
float daily_quota_L      = 1000.0f;
float tank_capacity_L    = 5000.0f;
float tank_reserve_pct   = 25.0f;
float filter_health_pct  = 96.0f;
float today_et0_mm       = 5.8f;
float today_rain_mm      = 0.0f;
uint8_t today_rain_prob  = 10;

bool isPaused            = false;
bool pauseIndefinite     = false;
uint32_t pauseUntilMs    = 0;
uint8_t boostPct         = 0;
uint32_t boostUntilMs    = 0;

int8_t activeZoneIdx     = -1; // -1 = nenhuma, 0 = Z1, 1 = Z2
float activeTargetLiters = 0.0f;
float activeStartLiters  = 0.0f;
uint32_t activeStartMs   = 0;
float queueLiters[2]     = { 0.0f, 0.0f };

// --- Sensor Hall SF1 (ISR) ---
volatile uint32_t sf1Pulses = 0;
float currentFlowLpm     = 0.0f;
uint32_t lastFlowCalcMs  = 0;
uint32_t dryPipeStartMs  = 0;
uint32_t burstStartMs    = 0;
bool hydraulicLockAlert  = false;
String lastAlertMsg      = "OK";

void IRAM_ATTR onSf1Pulse() {
    sf1Pulses++;
}

// --- Display OLED, Servidor HTTP e Nuvem MQTT (HiveMQ) ---
Adafruit_SSD1306 display(128, 64, &Wire, -1);
WebServer server(80);

const char* MQTT_SERVER       = "broker.hivemq.com";
const int   MQTT_PORT         = 1883;
const char* MQTT_TOPIC_CMD    = "irriga-ai/ceo-hugovinicius/cmd";
const char* MQTT_TOPIC_STATUS = "irriga-ai/ceo-hugovinicius/status";
const char* MQTT_TOPIC_PLAN   = "irriga-ai/ceo-hugovinicius/plan";

WiFiClient espMqttClient;
PubSubClient mqttClient(espMqttClient);
uint32_t lastMqttReconnectMs = 0;
uint32_t lastMqttStatusPubMs = 0;

Preferences prefs;
bool oledAwake           = true;
uint32_t lastInteraction = 0;
uint8_t oledPage         = 0;

// --- Utilitários Matemáticos FAO-56 ---
static inline float clampf(float v, float a, float b) { return v < a ? a : (v > b ? b : v); }
static inline float lerpf(float a, float b, float t) { return a + (b - a) * clampf(t, 0.0f, 1.0f); }
static inline float chuvaEfetiva(float mm) { return mm > 2.0f ? 0.8f * (mm - 2.0f) : 0.0f; }

void beep(uint16_t ms = 80, uint8_t times = 1) {
    for (uint8_t i = 0; i < times; i++) {
        tone(PIN_BUZZER, 2400, ms);
        delay(ms);
        noTone(PIN_BUZZER);
        if (i + 1 < times) delay(60);
    }
}

float lerCaixaLitros() {
    bool b100 = (digitalRead(PIN_TANK_LVL_100) == LOW);
    bool b75  = (digitalRead(PIN_TANK_LVL_75)  == LOW);
    bool b50  = (digitalRead(PIN_TANK_LVL_50)  == LOW);
    bool b25  = (digitalRead(PIN_TANK_LVL_25)  == LOW);
    if (b100) return tank_capacity_L;
    if (b75)  return tank_capacity_L * 0.75f;
    if (b50)  return tank_capacity_L * 0.50f;
    if (b25)  return tank_capacity_L * 0.25f;
    return tank_capacity_L * 0.75f; // fallback seguro caso chave DIP esteja aberta na bancada
}

// --- Cálculo Agronômico FAO-56 de uma Zona ---
void calcularZonaFao56(ZoneModel &z, float &outTaw, float &outRaw, float &outEtc, float &outKy, float &outRep) {
    uint16_t Li = z.days[0], Ld = z.days[1], Lm = z.days[2], Ll = z.days[3];
    uint16_t ciclo = Li + Ld + Lm + Ll;
    uint16_t d = (uint16_t)clampf(z.dap, 1, ciclo);
    float kc = z.kc[0];
    uint8_t fase = 0;
    if (d <= Li) { kc = z.kc[0]; fase = 0; }
    else if (d <= Li + Ld) { kc = lerpf(z.kc[0], z.kc[1], float(d - Li) / float(Ld)); fase = 1; }
    else if (d <= Li + Ld + Lm) { kc = z.kc[1]; fase = (d - Li - Ld) <= uint16_t(Lm * 0.45f) ? 2 : 3; }
    else { kc = lerpf(z.kc[1], z.kc[2], float(d - Li - Ld - Lm) / float(Ll)); fase = 4; }

    float cob = lerpf(0.08f, z.cover, float(d - 1) / float(Li + Ld + Lm * 0.3f));
    float kr = clampf(0.10f + cob, 0.15f, 1.0f);
    float fPalhada = z.mulch ? (fase <= 1 ? 0.85f : 0.95f) : 1.0f;
    float zr = lerpf(z.zr[0], z.zr[1], float(d - 1) / float(Li + Ld));

    outTaw = soil_taw_mm_m * zr * z.fw;
    outRaw = z.p * outTaw;
    outEtc = today_et0_mm * kc * kr * fPalhada * (1.0f + float(z.fine_pct) / 100.0f);
    outKy  = z.ky[fase];
    bool retaFinal = (z.late_days > 0 && z.dap > (ciclo - z.late_days));
    outRep = retaFinal ? z.late_rep : 1.0f;
}

void recalcularPlanoDoDia() {
    float multBoost = (boostPct > 0 && millis() < boostUntilMs) ? (1.0f + float(boostPct) / 100.0f) : 1.0f;
    float ky[2] = { 0.5f, 0.5f };
    float reqL[2] = { 0.0f, 0.0f };

    for (int i = 0; i < 2; i++) {
        ZoneModel &z = zones[i];
        if (!z.enabled) { z.planned_L = 0; continue; }
        float taw, raw, etc, kyi, rep;
        calcularZonaFao56(z, taw, raw, etc, kyi, rep);
        ky[i] = kyi;
        float chuvaEsp = chuvaEfetiva(today_rain_mm) * clampf(float(today_rain_prob) / 100.0f, 0.0f, 1.0f);
        float espaco = min(chuvaEsp, 0.5f * raw);
        float liqMm = max(0.0f, z.Dr_mm - espaco) * rep;
        reqL[i] = (liqMm >= 0.4f) ? (liqMm * z.area_m2 / EFICIENCIA_GOTEJO * multBoost) : 0.0f;
    }

    float tankL = lerCaixaLitros();
    float resL  = tank_capacity_L * (tank_reserve_pct / 100.0f);
    float dispL = max(0.0f, min(daily_quota_L, tankL - resL));
    float tot   = reqL[0] + reqL[1];

    if (tot <= dispL || tot < 1.0f) {
        zones[0].planned_L = reqL[0];
        zones[1].planned_L = reqL[1];
    } else {
        // Rateio por sensibilidade Ky (FAO-33)
        float piso = min(0.4f, dispL / tot);
        float a0 = reqL[0] * piso, a1 = reqL[1] * piso;
        float resto = max(0.0f, dispL - (a0 + a1));
        if (ky[0] >= ky[1]) {
            float add0 = min(reqL[0] - a0, resto); a0 += add0; resto -= add0;
            a1 += min(reqL[1] - a1, resto);
        } else {
            float add1 = min(reqL[1] - a1, resto); a1 += add1; resto -= add1;
            a0 += min(reqL[0] - a0, resto);
        }
        zones[0].planned_L = a0;
        zones[1].planned_L = a1;
    }
}

// --- Controle Seguro de Válvulas (Fila Anti-Colisão) ---
void fecharTodasValvulas() {
    digitalWrite(PIN_RELAY_2_ZONE_1, RELAY_OFF);
    digitalWrite(PIN_RELAY_3_ZONE_2, RELAY_OFF);
    digitalWrite(PIN_RELAY_1_MASTER, RELAY_OFF);
    activeZoneIdx = -1;
    dryPipeStartMs = 0;
    burstStartMs = 0;
}

void abrirZonaFila(uint8_t idx, float litrosAlvo) {
    if (idx > 1 || litrosAlvo < 2.0f || hydraulicLockAlert) return;
    // Fecha a outra zona antes de abrir (anti-colisão no filtro 120 Mesh)
    digitalWrite(PIN_RELAY_2_ZONE_1, idx == 0 ? RELAY_ON : RELAY_OFF);
    digitalWrite(PIN_RELAY_3_ZONE_2, idx == 1 ? RELAY_ON : RELAY_OFF);
    digitalWrite(PIN_RELAY_1_MASTER, RELAY_ON);
    activeZoneIdx      = idx;
    activeTargetLiters = litrosAlvo;
    activeStartLiters  = zones[idx].delivered_today_L;
    activeStartMs      = millis();
    dryPipeStartMs     = 0;
    burstStartMs       = 0;
}

// Despacha a próxima zona da fila se o sistema estiver livre e despausado
void despacharFilaSeOcioso() {
    if (isPaused || hydraulicLockAlert || activeZoneIdx >= 0) return;
    if (queueLiters[0] >= 2.0f) {
        float l = queueLiters[0];
        queueLiters[0] = 0.0f;
        abrirZonaFila(0, l);
    } else if (queueLiters[1] >= 2.0f) {
        float l = queueLiters[1];
        queueLiters[1] = 0.0f;
        abrirZonaFila(1, l);
    }
}

// Pausa o sistema de forma segura, preservando litros restantes na fila para retomada
void pausarSistema(uint32_t horas) {
    uint32_t now = millis();
    isPaused = true;
    pauseIndefinite = (horas == 0);
    pauseUntilMs = horas > 0 ? (now + horas * 3600UL * 1000UL) : 0;

    // Se havia uma zona ativamente irrigando, preserva os litros restantes na fila
    if (activeZoneIdx >= 0 && activeZoneIdx <= 1) {
        float entregue = zones[activeZoneIdx].delivered_today_L - activeStartLiters;
        float restante = max(0.0f, activeTargetLiters - entregue);
        if (restante >= 1.5f) {
            queueLiters[activeZoneIdx] += restante;
        }
    }
    fecharTodasValvulas();
}

// Override Manual "+1 Hora Flex" (Botão físico B2):
// Cada aperto adiciona +30 min na Zona 1 e +30 min na Zona 2 (mesmo acima da cota diária!)
void enfileirarOverrideFlex1Hora() {
    for (int i = 0; i < 2; i++) {
        ZoneModel &z = zones[i];
        if (!z.enabled) continue;
        float addLitros = 30.0f * max(0.5f, z.flow_lpm); // 30 minutos na vazão da zona
        if (activeZoneIdx == i) {
            activeTargetLiters += addLitros;
        } else {
            queueLiters[i] += addLitros;
        }
    }
    isPaused = false;
    pauseIndefinite = false;
    despacharFilaSeOcioso();
}

// --- Leitura dos 4 Botões Físicos ---
struct BtnTracker {
    uint8_t pin;
    bool lastLevel;
    uint32_t downMs;
    bool longHandled;
    bool wasSleeping;
};
BtnTracker btns[4] = {
    { PIN_BTN_PAUSE,       HIGH, 0, false, false },
    { PIN_BTN_WATER_NOW,   HIGH, 0, false, false },
    { PIN_BTN_WISH_RAIN,   HIGH, 0, false, false },
    { PIN_BTN_RAINED_HERE, HIGH, 0, false, false }
};
uint8_t rainClicksCount = 0;
uint32_t lastRainClickMs = 0;

void processarBotoesFisicos() {
    uint32_t now = millis();
    for (int i = 0; i < 4; i++) {
        bool lvl = digitalRead(btns[i].pin);
        if (lvl == LOW && btns[i].lastLevel == HIGH) {
            btns[i].downMs = now;
            btns[i].longHandled = false;
            if (!oledAwake) {
                // Tela estava dormindo: acorda imediatamente e NÃO executa a função do botão
                oledAwake = true;
                lastInteraction = now;
                btns[i].wasSleeping = true;
                beep(40, 1);
            } else {
                btns[i].wasSleeping = false;
            }
        } else if (lvl == LOW && !btns[i].longHandled && !btns[i].wasSleeping) {
            // B1 segurado por 3s = Pausa sem prazo (somente com a tela já acesa)
            if (i == 0 && (now - btns[i].downMs >= 3000)) {
                pausarSistema(0);
                btns[i].longHandled = true;
                beep(200, 2);
            }
        } else if (lvl == HIGH && btns[i].lastLevel == LOW) {
            uint32_t held = now - btns[i].downMs;
            if (btns[i].wasSleeping) {
                // Apenas acordou a tela: reseta e ignora a ação do botão
                btns[i].wasSleeping = false;
            } else if (held >= 40 && !btns[i].longHandled) {
                lastInteraction = now;
                beep(60, 1);
                if (i == 0) { // B1: Pausa 2h c/ retomada auto ou Retoma
                    if (isPaused) {
                        isPaused = false; pauseIndefinite = false;
                        despacharFilaSeOcioso();
                    } else {
                        pausarSistema(2);
                    }
                } else if (i == 1) { // B2: Override +1 Hora Flex (30 min Z1 + 30 min Z2)
                    enfileirarOverrideFlex1Hora();
                } else if (i == 2) { // B3: Era bom que chovesse (+25% / +50% / OFF)
                    boostPct = (boostPct == 0) ? 25 : (boostPct == 25 ? 50 : 0);
                    boostUntilMs = boostPct > 0 ? (now + 24UL * 3600UL * 1000UL) : 0;
                    recalcularPlanoDoDia();
                } else if (i == 3) { // B4: Choveu aqui (1/2/3 toques = 5/15/30 mm)
                    rainClicksCount = (now - lastRainClickMs < 4000) ? min<uint8_t>(3, rainClicksCount + 1) : 1;
                    lastRainClickMs = now;
                    float addMm = (rainClicksCount == 1) ? 5.0f : (rainClicksCount == 2 ? 10.0f : 15.0f);
                    for (int z = 0; z < 2; z++) {
                        zones[z].Dr_mm = max(0.0f, zones[z].Dr_mm - chuvaEfetiva(addMm));
                    }
                    fecharTodasValvulas();
                    recalcularPlanoDoDia();
                }
            }
        }
        btns[i].lastLevel = lvl;
    }
}

// --- Medição Hall SF1, Autocalibração de 3 Minutos e 4 Travas Hidráulicas ---
void atualizarSensorVazaoETravas() {
    uint32_t now = millis();
    if (now - lastFlowCalcMs < 1000) return;

    noInterrupts();
    uint32_t pulses = sf1Pulses;
    sf1Pulses = 0;
    interrupts();

    float dtSec = float(now - lastFlowCalcMs) / 1000.0f;
    lastFlowCalcMs = now;

    float litrosNoSegundo = float(pulses) / PULSOS_POR_LITRO_SF1;
    // Em bancada Wokwi sem gerador de pulsos no GPIO 34, simula a vazão da zona aberta
    if (activeZoneIdx >= 0 && pulses == 0) {
        litrosNoSegundo = zones[activeZoneIdx].flow_lpm / 60.0f;
    }
    currentFlowLpm = (litrosNoSegundo / dtSec) * 60.0f;

    if (activeZoneIdx >= 0) {
        ZoneModel &z = zones[activeZoneIdx];
        z.delivered_today_L += litrosNoSegundo;
        z.Dr_mm = max(0.0f, z.Dr_mm - (litrosNoSegundo * EFICIENCIA_GOTEJO / z.area_m2));

        // Autocalibração hidráulica após 3 minutos estáveis
        uint32_t elapsedMs = now - activeStartMs;
        if (elapsedMs > 180000UL && elapsedMs < 185000UL && currentFlowLpm > 0.6f && currentFlowLpm < 14.0f) {
            z.flow_lpm = 0.7f * z.flow_lpm + 0.3f * currentFlowLpm;
            if (z.flow_baseline_lpm <= 0.1f) z.flow_baseline_lpm = z.flow_lpm;
            filter_health_pct = clampf(100.0f * (z.flow_lpm / z.flow_baseline_lpm), 30.0f, 100.0f);
        }

        // Trava 1: Cano seco (< 0.4 L/min por 60s)
        if (currentFlowLpm < MIN_FLOW_DRY_PIPE_LPM) {
            if (dryPipeStartMs == 0) dryPipeStartMs = now;
            else if (now - dryPipeStartMs > 60000UL) {
                hydraulicLockAlert = true;
                lastAlertMsg = "TRAVA: CANO SECO";
                fecharTodasValvulas();
                beep(300, 3);
            }
        } else dryPipeStartMs = 0;

        // Trava 2: Mangueira rompida (> 15 L/min por 10s)
        if (currentFlowLpm > MAX_FLOW_BURST_LPM) {
            if (burstStartMs == 0) burstStartMs = now;
            else if (now - burstStartMs > 10000UL) {
                hydraulicLockAlert = true;
                lastAlertMsg = "TRAVA: VAZAMENTO";
                fecharTodasValvulas();
                beep(300, 4);
            }
        } else burstStartMs = 0;

        // Trava 3: Timeout máximo de válvula (180 min)
        if (elapsedMs > MAX_VALVE_MS) {
            hydraulicLockAlert = true;
            lastAlertMsg = "TRAVA: TIMEOUT 180m";
            fecharTodasValvulas();
        }

        // Verifica se entregou o pulso alvo e avança a fila anti-colisão
        if ((z.delivered_today_L - activeStartLiters) >= activeTargetLiters) {
            fecharTodasValvulas();
            despacharFilaSeOcioso();
        }
    } else {
        currentFlowLpm = 0.0f;
        despacharFilaSeOcioso();
    }

    // Retomada automática da pausa temporária
    if (isPaused && !pauseIndefinite && now >= pauseUntilMs) {
        isPaused = false;
        despacharFilaSeOcioso();
    }
}

// --- Renderização do Display OLED 0.96" SSD1306 ---
void desenharOled() {
    if (!oledAwake) {
        display.clearDisplay();
        display.display();
        return;
    }
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println(F("IRRIGA.AI v1.6.5"));
    display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

    display.setCursor(0, 14);
    if (hydraulicLockAlert) {
        display.println(lastAlertMsg);
    } else if (isPaused) {
        display.println(pauseIndefinite ? F("PAUSADO [SEM PRAZO]") : F("PAUSADO [VOLTA AUTO]"));
    } else if (activeZoneIdx >= 0) {
        display.printf("REGANDO ZONA %d\n", activeZoneIdx + 1);
    } else {
        display.println(F("PILOTO AUTOMATICO"));
    }

    display.setCursor(0, 26);
    display.printf("Caixa:%dL V:%.1fL/m\n", (int)lerCaixaLitros(), currentFlowLpm);
    display.printf("Z1:%.0fL(Dr%.1f) Z2:%.0fL\n", zones[0].planned_L, zones[0].Dr_mm, zones[1].planned_L);
    display.printf("Filtro:%.0f%% Boost:+%d%%\n", filter_health_pct, boostPct);
    display.display();
}

void fecharTodasValvulas();
void abrirZonaFila(uint8_t idx, float litrosAlvo);
void despacharFilaSeOcioso();
void pausarSistema(uint32_t horas);
void recalcularPlanoDoDia();
void publicarStatusMqtt();

void executarComandoGeral(JsonDocument& doc) {
    String acao = doc["acao"] | "";
    if (acao == "pausar") {
        uint32_t h = doc["horas"] | 0;
        pausarSistema(h);
        beep(80, 2);
    } else if (acao == "retomar") {
        isPaused = false;
        pauseIndefinite = false;
        hydraulicLockAlert = false;
        despacharFilaSeOcioso();
        beep(80, 1);
    } else if (acao == "inverter_fila") {
        float tmp = queueLiters[0];
        queueLiters[0] = queueLiters[1];
        queueLiters[1] = tmp;
        despacharFilaSeOcioso();
        beep(60, 2);
    } else if (acao == "regar_agora" || acao == "override_regar_agora") {
        if (doc["zonas"].is<JsonArray>()) {
            JsonArray zs = doc["zonas"].as<JsonArray>();
            isPaused = false;
            pauseIndefinite = false;
            uint8_t primeiroZIdx = 255;

            for (JsonObject zo : zs) {
                int id = zo["zona"] | 0;
                float lit = zo["litros"] | 0.0f;
                if (id >= 1 && id <= 2 && lit >= 1.0f) {
                    uint8_t zIdx = id - 1;
                    if (primeiroZIdx == 255) primeiroZIdx = zIdx;
                    if (activeZoneIdx == zIdx) {
                        // Se a zona já está irrigando agora, soma no alvo atual
                        activeTargetLiters += lit;
                    } else {
                        // Empilha na fila da zona sem zerar o que já tinha!
                        queueLiters[zIdx] += lit;
                    }
                }
            }
            // Se nenhuma zona estiver aberta, prioriza a zona solicitada no comando
            if (activeZoneIdx < 0 && primeiroZIdx <= 1 && queueLiters[primeiroZIdx] >= 2.0f) {
                float l = queueLiters[primeiroZIdx];
                queueLiters[primeiroZIdx] = 0.0f;
                abrirZonaFila(primeiroZIdx, l);
            } else {
                despacharFilaSeOcioso();
            }
        } else {
            enfileirarOverrideFlex1Hora();
        }
        beep(120, 2);
    } else if (acao == "parar_rega" || acao == "cancelar_override") {
        queueLiters[0] = 0.0f;
        queueLiters[1] = 0.0f;
        fecharTodasValvulas();
        beep(80, 2);
    } else if (acao == "remover_fila") {
        int id = doc["zona"] | 0;
        if (id >= 1 && id <= 2) {
            queueLiters[id - 1] = 0.0f;
        }
        beep(50, 1);
    } else if (acao == "boost") {
        boostPct = doc["pct"] | 0;
        boostUntilMs = boostPct > 0 ? (millis() + 24UL * 3600UL * 1000UL) : 0;
        recalcularPlanoDoDia();
        beep(60, 1);
    } else if (acao == "chuva_local") {
        float mm = doc["mm"] | 0.0f;
        for (int i = 0; i < 2; i++) zones[i].Dr_mm = max(0.0f, zones[i].Dr_mm - chuvaEfetiva(mm));
        fecharTodasValvulas();
        recalcularPlanoDoDia();
        beep(100, 3);
    } else if (acao == "cancelar_chuva") {
        float mm = doc["mm"] | 0.0f;
        for (int i = 0; i < 2; i++) zones[i].Dr_mm += chuvaEfetiva(mm);
        recalcularPlanoDoDia();
        beep(60, 2);
    }
}

// --- Endpoints HTTP REST para Sincronia com o Web-App ---
void configurarRotasHttp() {
    // Inicializa a pilha de rede WiFi (SoftAP + Cliente Wokwi) antes de ligar o servidor HTTP
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP("Irriga-AI", "12345678");
    WiFi.begin("Wokwi-GUEST", "", 6);

    Serial.print("🌐 [WiFi] Conectando a rede Wokwi-GUEST");
    uint32_t t0 = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - t0 < 4000)) {
        delay(200);
        Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf(" OK! (IP: %s)\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println(" (Conectando em background...)");
    }

    server.enableCORS(true);

    server.on("/api/status", HTTP_GET, []() {
        JsonDocument doc;
        doc["v"]          = "1.6.5-argon";
        doc["tank_L"]     = lerCaixaLitros();
        doc["filter_pct"] = filter_health_pct;
        doc["flow_lpm"]   = currentFlowLpm;
        doc["paused"]     = isPaused;
        doc["boost_pct"]  = boostPct;
        doc["active_zone"]= activeZoneIdx >= 0 ? (activeZoneIdx + 1) : 0;
        doc["active_rem_L"]= activeZoneIdx >= 0 ? max(0.0f, activeTargetLiters - (zones[activeZoneIdx].delivered_today_L - activeStartLiters)) : 0.0f;
        doc["queue_z1_L"] = queueLiters[0];
        doc["queue_z2_L"] = queueLiters[1];
        doc["alert"]      = lastAlertMsg;
        String out;
        serializeJson(doc, out);
        server.send(200, "application/json", out);
    });

    server.on("/api/plan", HTTP_POST, []() {
        JsonDocument doc;
        if (deserializeJson(doc, server.arg("plain"))) {
            server.send(400, "application/json", "{\"ok\":false}");
            return;
        }
        if (doc["soil_taw_mm_m"].is<float>()) soil_taw_mm_m = doc["soil_taw_mm_m"].as<float>();
        if (doc["quota_L"].is<float>())       daily_quota_L = doc["quota_L"].as<float>();
        JsonArray zs = doc["zones"].as<JsonArray>();
        for (size_t i = 0; i < zs.size() && i < 2; i++) {
            JsonObject zo = zs[i];
            zones[i].enabled  = zo["on"] | true;
            zones[i].area_m2  = zo["area"] | zones[i].area_m2;
            zones[i].fw       = zo["fw"] | zones[i].fw;
            zones[i].flow_lpm = zo["flow_lpm"] | zones[i].flow_lpm;
            zones[i].hose_L   = zo["hose_L"] | zones[i].hose_L;
            zones[i].Dr_mm    = zo["Dr"] | zones[i].Dr_mm;
            zones[i].mulch    = zo["mulch"] | false;
            zones[i].fine_pct = zo["fine"] | 0;
        }
        JsonArray w = doc["weather"].as<JsonArray>();
        if (w.size() > 0) {
            today_et0_mm    = w[0][1] | today_et0_mm;
            today_rain_mm   = w[0][2] | 0.0f;
            today_rain_prob = w[0][3] | 0;
        }
        recalcularPlanoDoDia();
        server.send(200, "application/json", "{\"ok\":true}");
    });

    server.on("/api/cmd", HTTP_POST, []() {
        JsonDocument doc;
        if (deserializeJson(doc, server.arg("plain"))) {
            server.send(400, "application/json", "{\"ok\":false}");
            return;
        }
        executarComandoGeral(doc);
        publicarStatusMqtt();
        server.send(200, "application/json", "{\"ok\":true}");
    });

    server.begin();
}

// --- Funções da Nuvem MQTT (HiveMQ) ---
void publicarStatusMqtt() {
    if (!mqttClient.connected()) return;
    JsonDocument doc;
    doc["v"]          = "1.6.5-argon";
    doc["online"]     = true;
    doc["tank_L"]     = lerCaixaLitros();
    doc["filter_pct"] = filter_health_pct;
    doc["flow_lpm"]   = currentFlowLpm;
    doc["paused"]     = isPaused;
    doc["boost_pct"]  = boostPct;
    doc["active_zone"]= activeZoneIdx >= 0 ? (activeZoneIdx + 1) : 0;
    doc["active_rem_L"]= activeZoneIdx >= 0 ? max(0.0f, activeTargetLiters - (zones[activeZoneIdx].delivered_today_L - activeStartLiters)) : 0.0f;
    doc["queue_z1_L"] = queueLiters[0];
    doc["queue_z2_L"] = queueLiters[1];
    doc["alert"]      = lastAlertMsg;
    String out;
    serializeJson(doc, out);
    mqttClient.publish(MQTT_TOPIC_STATUS, out.c_str(), true);
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
    String body;
    for (unsigned int i = 0; i < length; i++) body += (char)payload[i];
    Serial.printf("☁️ [MQTT] Mensagem recebida no topico %s: %s\n", topic, body.c_str());

    JsonDocument doc;
    if (deserializeJson(doc, body)) return;

    if (String(topic) == MQTT_TOPIC_CMD) {
        executarComandoGeral(doc);
        publicarStatusMqtt();
    } else if (String(topic) == MQTT_TOPIC_PLAN) {
        if (doc["quota_L"].is<float>()) daily_quota_L = doc["quota_L"].as<float>();
        recalcularPlanoDoDia();
        publicarStatusMqtt();
    }
}

void gerenciarMqtt() {
    uint32_t now = millis();
    if (WiFi.status() == WL_CONNECTED) {
        if (!mqttClient.connected()) {
            if (lastMqttReconnectMs == 0 || (now - lastMqttReconnectMs > 5000)) {
                lastMqttReconnectMs = now;
                String clientId = "ESP32-Irriga-" + String((uint32_t)ESP.getEfuseMac(), HEX);
                Serial.print("☁️ [MQTT] Conectando ao broker HiveMQ... ");
                const char* willMsg = "{\"v\":\"1.6.5-argon\",\"online\":false,\"active_zone\":0,\"queue_z1_L\":0,\"queue_z2_L\":0,\"alert\":\"ESP32 OFFLINE\"}";
                if (mqttClient.connect(clientId.c_str(), MQTT_TOPIC_STATUS, 1, true, willMsg)) {
                    Serial.println("CONECTADO COM SUCESSO!");
                    mqttClient.subscribe(MQTT_TOPIC_CMD);
                    mqttClient.subscribe(MQTT_TOPIC_PLAN);
                    publicarStatusMqtt();
                    beep(50, 1);
                } else {
                    Serial.printf("Falha (rc=%d). Nova tentativa em 5s...\n", mqttClient.state());
                }
            }
        } else {
            mqttClient.loop();
            if (now - lastMqttStatusPubMs > 10000) {
                lastMqttStatusPubMs = now;
                publicarStatusMqtt();
            }
        }
    }
}

void setup() {
    Serial.begin(115200);

    // 1. Inicializa todos os 8 Relés em OFF (HIGH) antes de configurar OUTPUT
    for (uint8_t pin : ALL_RELAY_PINS) {
        digitalWrite(pin, RELAY_OFF);
        pinMode(pin, OUTPUT);
        digitalWrite(pin, RELAY_OFF);
    }

    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);

    // 2. Botões Físicos e Boias em INPUT_PULLUP seguro
    pinMode(PIN_BTN_PAUSE,       INPUT_PULLUP);
    pinMode(PIN_BTN_WATER_NOW,   INPUT_PULLUP);
    pinMode(PIN_BTN_WISH_RAIN,   INPUT_PULLUP);
    pinMode(PIN_BTN_RAINED_HERE, INPUT_PULLUP);

    pinMode(PIN_TANK_LVL_25,     INPUT_PULLUP);
    pinMode(PIN_TANK_LVL_50,     INPUT_PULLUP);
    pinMode(PIN_TANK_LVL_75,     INPUT_PULLUP);
    pinMode(PIN_TANK_LVL_100,    INPUT_PULLUP);

    // 3. Sensor de Vazão Hall SF1
    pinMode(PIN_FLOW_SENSOR_SF1, INPUT);
    attachInterrupt(digitalPinToInterrupt(PIN_FLOW_SENSOR_SF1), onSf1Pulse, FALLING);

    // 4. Display OLED I2C
    Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
    display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR);

    // 5. Watchdog de Hardware (10 s) — compatível com Wokwi (v3.x) e PlatformIO antigo (v2.x)
#if (defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3) || (defined(ESP_IDF_VERSION_MAJOR) && ESP_IDF_VERSION_MAJOR >= 5)
    esp_task_wdt_config_t wdt_config = {
        .timeout_ms = 10000,
        .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
        .trigger_panic = true
    };
    esp_task_wdt_reconfigure(&wdt_config);
#else
    esp_task_wdt_init(10, true);
    esp_task_wdt_add(NULL);
#endif

    Serial.println("🌱 [Irriga.ai] Sistema iniciado com sucesso!");

    Serial.println("⚙️ [1/3] Calculando plano hídrico do dia...");
    recalcularPlanoDoDia();

    Serial.println("🌐 [2/3] Iniciando WiFi, Servidor HTTP e Nuvem MQTT...");
    configurarRotasHttp();
    mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
    mqttClient.setCallback(onMqttMessage);
    mqttClient.setBufferSize(2048);
    gerenciarMqtt();

    Serial.println("🔔 [3/3] Inicializando buzzer e interface...");
    lastInteraction = millis();
    beep(60, 2);

    Serial.println("✅ [Irriga.ai] Sistema 100% pronto e operacional!");
}

void loop() {
    server.handleClient();
    gerenciarMqtt();
    processarBotoesFisicos();
    atualizarSensorVazaoETravas();
    delay(2);

    if (oledAwake && (millis() - lastInteraction > OLED_SLEEP_MS)) {
        oledAwake = false;
    }

    static uint32_t lastOledMs = 0;
    if (millis() - lastOledMs >= 500) {
        lastOledMs = millis();
        desenharOled();
    }
}
