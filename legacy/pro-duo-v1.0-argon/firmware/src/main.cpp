// ==============================================================================
// 🌱 Irriga.ai Pro-Duo — Firmware Oficial ESP32-WROOM-32D (38 Pinos V4)
// ==============================================================================
// Funcionalidades Completas de Produção:
// 1. Acionamento seguro dos 8 Relés (3 ativos no MVP: Válvula Mestre, Zona 1 e Zona 2
//    + 5 pré-contabilizados p/ expansão: Zona 3, Zona 4, Bomba 12V, Luz e Câmera).
// 2. Relógio Real NTP (America/Fortaleza UTC-3) + Agendador Automático de Turnos
//    (dispara Zona 1 e Zona 2 nos horários planejados, enfileira se houver colisão,
//    zera a cota diária à meia-noite e incrementa o DAP de cada planta automaticamente).
// 3. Guardião da Cota + Travas Hidráulicas de Emergência via Sensor Hall SF1 (GPIO 34):
//    - Corte por Cota Diária (ex: 1.000 L/dia)
//    - Detecção de Cano Seco / Válvula Presa (< 0.4 L/min após 60s de válvula aberta)
//    - Detecção de Mangueira Rompida / Fuga Livre (> 15.0 L/min por 10s seguidos)
//    - Detecção de Vazamento com Válvulas Fechadas (> 0.5 L/min por 15s em espera)
//    - Timeout máximo absoluto de 180 minutos por rega + Hardware Watchdog (10s)
//    - Diagnóstico de saúde do Filtro Único 120 Mesh (< 80% avisa limpeza)
// 4. Leitura das 4 Boias de Nível da Caixa de 5.000 L (25%, 50%, 75%, 100%).
// 5. Os 4 Botões Físicos do Painel:
//    - Botão 1 (GPIO 13): Pausar irrigações planejadas
//    - Botão 2 (GPIO 14): Continuar irrigações planejadas / Trocar página do OLED
//    - Botão 3 (GPIO 26): Liga tudo por +1 hora (incrementa +1h a cada aperto, máx 4h)
//    - Botão 4 (GPIO 27): "Era bom que chovesse" (+25% / +50% nas regas das próx. 24h)
// 6. Wi-Fi Dual (Estação + Ponto de Acesso Fallback "IrrigaAI-ProDuo") + API HTTP JSON
//    completa (/api/status, /api/plan, /api/button, /api/relay) e memória NVS.
// ==============================================================================

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <time.h>
#include <esp_task_wdt.h>
#include "pinout_pro_duo.h"

using namespace IrrigaPins;

// --- Credenciais Wi-Fi Padrão (Podem ser alteradas via NVS / HTTP) ---
String g_wifiSsid = "WIFI_SITIO_SERIDO";
String g_wifiPass = "irriga1234";
const char* AP_FALLBACK_SSID = "IrrigaAI-ProDuo";
const char* AP_FALLBACK_PASS = "sitio1234";

// --- Configurações de Display OLED 0.96" (128x64) ---
Adafruit_SSD1306 display(128, 64, &Wire, -1);
bool oledReady = false;
uint32_t oledWakeTimestampMs = 0;
uint8_t oledPageIndex = 0;
constexpr uint32_t OLED_SLEEP_TIMEOUT_MS = 60000; // Apaga após 60s p/ poupar vida útil

// --- Persistência Não-Volátil (Modo Offline Resiliente) e Servidor HTTP ---
Preferences nvs;
WebServer server(80);

// --- Contadores do Sensor de Vazão Hall SF1 (GPIO 34) ---
// Calibração padrão YF-S201 / YF-B5 (3/4"): ~330 pulsos por Litro (ajustável via JSON)
volatile uint32_t g_flowPulseCount = 0;
float g_pulsesPerLiter = 330.0f;
float g_currentFlowRateLpm = 0.0f;
float g_filterEfficiencyPct = 100.0f;
bool  g_filterDirtyWarning = false;

void IRAM_ATTR onFlowSensorPulse() {
    g_flowPulseCount++;
}

// --- Estados de Operação e Diagnóstico de Segurança Hidráulica ---
enum class SystemMode {
    AUTO_SCHEDULE,      // Operando conforme o plano padronizado (IrrigaPlan)
    PAUSED_BY_USER,     // Botão 1 pressionado: irrigações planejadas pausadas
    MANUAL_PLUS_HOURS,  // Botão 3 pressionado: irrigando por +1h (+2h, +3h...)
    EMERGENCY_STOP      // Falha hidráulica (cano seco, mangueira rompida ou caixa < 25%)
};

struct ShiftSchedule {
    uint8_t hour;
    uint8_t minute;
    float   litersBase;
    bool    executedToday;
};

struct ZoneRuntime {
    uint8_t id;
    uint8_t relayPin;
    String  name;
    String  cropName;
    uint16_t dap;
    float   targetLitersCurrentRun;
    float   deliveredLitersCurrentRun;
    float   nominalFlowLpm;
    bool    isIrrigating;
    uint32_t activeRunSeconds;
    bool    pendingQueue;
    float   pendingQueueLiters;
    ShiftSchedule shifts[2];
};

SystemMode g_mode = SystemMode::AUTO_SCHEDULE;
String g_lastHydraulicFault = "NENHUMA";
float g_dailyQuotaMaxLiters = 1000.0f;
float g_litersUsedToday = 0.0f;
uint8_t g_tankLevelPct = 75;

// --- Contadores das Travas Hidráulicas (Watchdog de Vazão SF1) ---
uint16_t g_dryPipeSeconds = 0;          // Segundos seguidos com válvula aberta e vazão < 0.4 L/min
uint16_t g_burstPipeSeconds = 0;        // Segundos seguidos com vazão > 15.0 L/min (fuga livre)
uint16_t g_uncommandedFlowSeconds = 0;  // Segundos seguidos com vazão > 0.5 L/min e válvulas fechadas
constexpr uint32_t MAX_VALVE_OPEN_SECONDS = 180 * 60; // Trava absoluta: 180 minutos (10.800s)

// --- Relógio e Controle de Virada de Dia (Meia-Noite) ---
int g_currentHour = 6;
int g_currentMinute = 0;
int g_lastResetDayOfYear = -1;
bool g_ntpSynced = false;

// --- Estado do Botão 3 ("Liga tudo +1h") ---
uint32_t g_manualRemainingSeconds = 0;
uint32_t g_manualElapsedSeconds = 0;

// --- Estado do Botão 4 Lúdico ("Era bom que chovesse") ---
uint8_t  g_wishRainClicks = 0;          // 0 = Normal, 1 = +25%, 2 = +50%
float    g_wishRainBoostPct = 0.0f;     // Multiplicador ativo nas regas das próximas 24h
uint32_t g_wishRainExpiresAtSec = 0;    // Expira após 24 horas (86.400 s)

// --- Estado dos 5 Slots de Expansão (Relés 4 a 8) ---
bool g_expZone3Enabled  = false;        // Relé 4: Futura Zona 3
bool g_expZone4Enabled  = false;        // Relé 5: Futura Zona 4
bool g_expPumpEnabled   = false;        // Relé 6: Bomba Auxiliar 12V
bool g_expLightState    = false;        // Relé 7: Luz / Refletor
bool g_expCameraState   = false;        // Relé 8: Câmera / Acessório

ZoneRuntime g_zones[2] = {
    {
        1, PIN_RELAY_2_ZONE_1, "Zona 1 (Oeste)", "Jerimum", 102,
        0.0f, 0.0f, 6.5f, false, 0, false, 0.0f,
        { {5, 30, 92.8f, false}, {16, 30, 61.9f, false} }
    },
    {
        2, PIN_RELAY_3_ZONE_2, "Zona 2 (Leste)", "Jerimum", 52,
        0.0f, 0.0f, 7.2f, false, 0, false, 0.0f,
        { {6, 10, 327.3f, false}, {17, 0, 218.2f, false} }
    }
};

// ==============================================================================
// 1. FUNÇÕES SONORAS DO BUZZER (Feedback Humano Claro)
// ==============================================================================
void beepShort(uint8_t count = 1, uint16_t durationMs = 70) {
    for (uint8_t i = 0; i < count; i++) {
        digitalWrite(PIN_BUZZER, HIGH);
        delay(durationMs);
        digitalWrite(PIN_BUZZER, LOW);
        if (i + 1 < count) delay(70);
    }
}

void beepWishRainMelody() {
    const uint16_t pulses[] = {50, 50, 90, 140};
    for (uint16_t d : pulses) {
        digitalWrite(PIN_BUZZER, HIGH);
        delay(d);
        digitalWrite(PIN_BUZZER, LOW);
        delay(55);
    }
}

void beepAlarmFault() {
    for (uint8_t i = 0; i < 3; i++) {
        digitalWrite(PIN_BUZZER, HIGH);
        delay(180);
        digitalWrite(PIN_BUZZER, LOW);
        delay(100);
    }
}

// ==============================================================================
// 2. LEITURA DAS 4 BOIAS DE NÍVEL DA CAIXA DE 5.000 L (Sem Eletrólise)
// ==============================================================================
uint8_t readTankLevelPercent() {
    if (digitalRead(PIN_TANK_LVL_100) == LOW) return 100;
    if (digitalRead(PIN_TANK_LVL_75)  == LOW) return 75;
    if (digitalRead(PIN_TANK_LVL_50)  == LOW) return 50;
    if (digitalRead(PIN_TANK_LVL_25)  == LOW) return 25;
    return 0; // Abaixo de 25% -> Reserva crítica!
}

// ==============================================================================
// 3. ACIONAMENTO COORDENADO E SEGURO DAS VÁLVULAS (V_MASTER + ZONA 1 / ZONA 2)
// ==============================================================================
void stopAllIrrigationSafely() {
    if (g_expPumpEnabled) {
        digitalWrite(PIN_RELAY_6_EXP_PUMP, RELAY_OFF);
        delay(350);
    }
    digitalWrite(PIN_RELAY_1_MASTER, RELAY_OFF);
    delay(200);
    digitalWrite(PIN_RELAY_2_ZONE_1, RELAY_OFF);
    digitalWrite(PIN_RELAY_3_ZONE_2, RELAY_OFF);
    digitalWrite(PIN_RELAY_4_EXP_Z3, RELAY_OFF);
    digitalWrite(PIN_RELAY_5_EXP_Z4, RELAY_OFF);

    g_zones[0].isIrrigating = false;
    g_zones[0].activeRunSeconds = 0;
    g_zones[1].isIrrigating = false;
    g_zones[1].activeRunSeconds = 0;
    g_dryPipeSeconds = 0;
    g_burstPipeSeconds = 0;
}

void activateSingleZoneSafely(uint8_t zoneIndex, float targetLiters) {
    if (g_tankLevelPct < 25) {
        stopAllIrrigationSafely();
        g_mode = SystemMode::EMERGENCY_STOP;
        g_lastHydraulicFault = "CAIXA_ABAIXO_DE_25_PCT";
        return;
    }

    uint8_t otherIndex = (zoneIndex == 0) ? 1 : 0;
    digitalWrite(g_zones[otherIndex].relayPin, RELAY_OFF);
    g_zones[otherIndex].isIrrigating = false;
    g_zones[otherIndex].activeRunSeconds = 0;

    // 1º Abre a Válvula da Zona desejada
    digitalWrite(g_zones[zoneIndex].relayPin, RELAY_ON);
    delay(200);
    // 2º Abre a Válvula Mestre (Relé 1)
    digitalWrite(PIN_RELAY_1_MASTER, RELAY_ON);

    // 3º Se houver Bomba Auxiliar 12V configurada no Relé 6, liga após abrir a válvula
    if (g_expPumpEnabled) {
        delay(350);
        digitalWrite(PIN_RELAY_6_EXP_PUMP, RELAY_ON);
    }

    if (!g_zones[zoneIndex].isIrrigating) {
        g_zones[zoneIndex].targetLitersCurrentRun = targetLiters;
        g_zones[zoneIndex].deliveredLitersCurrentRun = 0.0f;
        g_zones[zoneIndex].activeRunSeconds = 0;
        g_zones[zoneIndex].isIrrigating = true;
        g_dryPipeSeconds = 0;
    }
}

// ==============================================================================
// 4. RELÓGIO NTP (AMERICA/FORTALEZA) E DISPARADOR AUTOMÁTICO DE TURNOS
// ==============================================================================
void updateClockAndDailyReset() {
    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 10)) {
        g_ntpSynced = true;
        g_currentHour = timeinfo.tm_hour;
        g_currentMinute = timeinfo.tm_min;

        // Virada de meia-noite: zera cota diária, libera turnos do novo dia e incrementa DAP!
        if (g_lastResetDayOfYear != -1 && timeinfo.tm_yday != g_lastResetDayOfYear) {
            g_litersUsedToday = 0.0f;
            for (int z = 0; z < 2; z++) {
                g_zones[z].dap++;
                g_zones[z].shifts[0].executedToday = false;
                g_zones[z].shifts[1].executedToday = false;
            }
            nvs.putUShort("z1_dap", g_zones[0].dap);
            nvs.putUShort("z2_dap", g_zones[1].dap);
        }
        g_lastResetDayOfYear = timeinfo.tm_yday;
    } else {
        // Fallback offline se o sítio estiver sem internet: avança relógio interno por millis()
        uint32_t totalMinutes = (millis() / 60000UL) + (6 * 60); // Começa 06:00 no boot offline
        g_currentHour = (totalMinutes / 60) % 24;
        g_currentMinute = totalMinutes % 60;
        int virtualDay = totalMinutes / (24 * 60);
        if (g_lastResetDayOfYear != -1 && virtualDay != g_lastResetDayOfYear) {
            g_litersUsedToday = 0.0f;
            for (int z = 0; z < 2; z++) {
                g_zones[z].dap++;
                g_zones[z].shifts[0].executedToday = false;
                g_zones[z].shifts[1].executedToday = false;
            }
        }
        g_lastResetDayOfYear = virtualDay;
    }
}

void checkAndTriggerScheduledShifts() {
    if (g_mode != SystemMode::AUTO_SCHEDULE) return;
    if (g_tankLevelPct < 25) return;

    bool anyZoneIrrigatingNow = (g_zones[0].isIrrigating || g_zones[1].isIrrigating);

    // 1. Se nenhuma zona está irrigando agora, verifica se há alguma zona na fila de espera
    if (!anyZoneIrrigatingNow) {
        for (int z = 0; z < 2; z++) {
            if (g_zones[z].pendingQueue && g_zones[z].pendingQueueLiters > 0.5f) {
                float targetL = g_zones[z].pendingQueueLiters;
                g_zones[z].pendingQueue = false;
                g_zones[z].pendingQueueLiters = 0.0f;
                activateSingleZoneSafely(z, targetL);
                return;
            }
        }
    }

    // 2. Verifica se algum turno bateu o horário exato (HH:MM)
    float boostMultiplier = 1.0f + (g_wishRainBoostPct / 100.0f);
    for (int z = 0; z < 2; z++) {
        for (int s = 0; s < 2; s++) {
            ShiftSchedule& sh = g_zones[z].shifts[s];
            if (!sh.executedToday && sh.litersBase > 0.5f &&
                g_currentHour == sh.hour && g_currentMinute == sh.minute) {

                sh.executedToday = true;
                float targetLiters = sh.litersBase * boostMultiplier;

                if (!g_zones[0].isIrrigating && !g_zones[1].isIrrigating) {
                    activateSingleZoneSafely(z, targetLiters);
                } else {
                    // Outra zona já está aberta: coloca na fila para abrir assim que a atual terminar!
                    g_zones[z].pendingQueue = true;
                    g_zones[z].pendingQueueLiters = targetLiters;
                }
            }
        }
    }
}

// ==============================================================================
// 5. LEITURA DOS 4 BOTÕES FÍSICOS DO PAINEL (Com Debounce)
// ==============================================================================
struct ButtonTracker {
    uint8_t pin;
    bool lastState;
    uint32_t lastChangeMs;
};

ButtonTracker g_buttons[4] = {
    {PIN_BTN_PAUSE,     HIGH, 0},
    {PIN_BTN_RESUME,    HIGH, 0},
    {PIN_BTN_PLUS_1H,   HIGH, 0},
    {PIN_BTN_WISH_RAIN, HIGH, 0}
};

void executeButtonAction(uint8_t buttonIndex) {
    uint32_t nowMs = millis();
    oledWakeTimestampMs = nowMs;

    switch (buttonIndex) {
        case 0: // ⏸️ BOTÃO 1: PAUSAR IRRIGAÇÕES PLANEJADAS
            stopAllIrrigationSafely();
            g_manualRemainingSeconds = 0;
            g_mode = SystemMode::PAUSED_BY_USER;
            nvs.putBool("paused", true);
            beepShort(2, 120);
            break;

        case 1: // ▶️ BOTÃO 2: CONTINUAR IRRIGAÇÕES PLANEJADAS / TROCAR PÁGINA OLED
            if (g_mode != SystemMode::AUTO_SCHEDULE) {
                stopAllIrrigationSafely();
                g_manualRemainingSeconds = 0;
                g_lastHydraulicFault = "NENHUMA";
                g_mode = SystemMode::AUTO_SCHEDULE;
                nvs.putBool("paused", false);
                beepShort(2, 60);
            } else {
                oledPageIndex = (oledPageIndex + 1) % 3;
                beepShort(1, 40);
            }
            break;

        case 2: // 💦 BOTÃO 3: LIGA TUDO POR 1 HORA (+1h a cada clique, máx 4h)
            if (g_manualRemainingSeconds < 4 * 3600) {
                g_manualRemainingSeconds += 3600;
            }
            g_lastHydraulicFault = "NENHUMA";
            g_mode = SystemMode::MANUAL_PLUS_HOURS;
            beepShort(1, 100);
            break;

        case 3: // 🌧️ BOTÃO 4: "ERA BOM QUE CHOVESSE" (+25% / +50% nas próx. 24h)
            g_wishRainClicks = (g_wishRainClicks + 1) % 3;
            if (g_wishRainClicks == 1) {
                g_wishRainBoostPct = 25.0f;
                g_wishRainExpiresAtSec = (nowMs / 1000) + 86400;
                beepWishRainMelody();
            } else if (g_wishRainClicks == 2) {
                g_wishRainBoostPct = 50.0f;
                g_wishRainExpiresAtSec = (nowMs / 1000) + 86400;
                beepWishRainMelody();
            } else {
                g_wishRainBoostPct = 0.0f;
                g_wishRainExpiresAtSec = 0;
                beepShort(1, 150);
            }
            nvs.putFloat("boost_24h", g_wishRainBoostPct);
            break;
    }
}

void handlePhysicalButtons() {
    uint32_t nowMs = millis();
    for (int i = 0; i < 4; i++) {
        bool reading = digitalRead(g_buttons[i].pin);
        if (reading != g_buttons[i].lastState && (nowMs - g_buttons[i].lastChangeMs) > 60) {
            g_buttons[i].lastChangeMs = nowMs;
            g_buttons[i].lastState = reading;
            if (reading == LOW) {
                executeButtonAction(i);
            }
        }
    }
}

// ==============================================================================
// 6. SENSOR DE VAZÃO SF1, GUARDIÃO DA COTA E TRAVAS HIDRÁULICAS (1 Hz)
// ==============================================================================
void updateFlowAndSafetyWatchdogs1Hz() {
    noInterrupts();
    uint32_t pulses = g_flowPulseCount;
    g_flowPulseCount = 0;
    interrupts();

    float litersLastSecond = (float)pulses / g_pulsesPerLiter;
    g_currentFlowRateLpm = litersLastSecond * 60.0f;
    g_litersUsedToday += litersLastSecond;
    g_tankLevelPct = readTankLevelPercent();

    // Verifica validade de 24h do botão "Era bom que chovesse"
    uint32_t nowSec = millis() / 1000;
    if (g_wishRainBoostPct > 0.0f && nowSec > g_wishRainExpiresAtSec) {
        g_wishRainBoostPct = 0.0f;
        g_wishRainClicks = 0;
        nvs.putFloat("boost_24h", 0.0f);
    }

    // 1. GUARDIÃO DA COTA DIÁRIA
    float effectiveQuota = g_dailyQuotaMaxLiters;
    if (g_wishRainBoostPct > 0.0f && g_tankLevelPct >= 50) {
        effectiveQuota *= 1.15f;
    }
    if (g_litersUsedToday >= effectiveQuota && (g_zones[0].isIrrigating || g_zones[1].isIrrigating)) {
        stopAllIrrigationSafely();
        g_manualRemainingSeconds = 0;
        g_lastHydraulicFault = "COTA_DIARIA_ATINGIDA_COM_SUCESSO";
        return;
    }

    bool anyValveCommandedOpen = (g_zones[0].isIrrigating || g_zones[1].isIrrigating);

    // 2. TRAVA CONTRA VAZAMENTO COM VÁLVULAS FECHADAS
    if (!anyValveCommandedOpen) {
        if (g_currentFlowRateLpm > 0.5f) {
            g_uncommandedFlowSeconds++;
            if (g_uncommandedFlowSeconds >= 15) {
                digitalWrite(PIN_RELAY_1_MASTER, RELAY_OFF);
                g_lastHydraulicFault = "ALERTA_FLUXO_COM_VALVULA_FECHADA";
                beepAlarmFault();
            }
        } else {
            g_uncommandedFlowSeconds = 0;
        }
    }

    // 3. MONITORAMENTO DE ZONA ATIVA (CANO SECO, MANGUEIRA ROMPIDA, FILTRO 120M E TIMEOUT 180M)
    for (int i = 0; i < 2; i++) {
        if (g_zones[i].isIrrigating) {
            g_zones[i].deliveredLitersCurrentRun += litersLastSecond;
            g_zones[i].activeRunSeconds++;

            // 3a. Timeout Absoluto de 180 Minutos (10.800s)
            if (g_zones[i].activeRunSeconds >= MAX_VALVE_OPEN_SECONDS) {
                stopAllIrrigationSafely();
                g_mode = SystemMode::EMERGENCY_STOP;
                g_lastHydraulicFault = "TIMEOUT_MAXIMO_180_MINUTOS";
                beepAlarmFault();
                return;
            }

            // 3b. Trava de Cano Seco / Válvula Presa (< 0.4 L/min por 60s seguidos)
            if (g_currentFlowRateLpm < 0.4f) {
                g_dryPipeSeconds++;
                if (g_dryPipeSeconds >= 60) {
                    stopAllIrrigationSafely();
                    g_mode = SystemMode::EMERGENCY_STOP;
                    g_lastHydraulicFault = "CANO_SECO_OU_SOLENOIDE_PRESA";
                    beepAlarmFault();
                    return;
                }
            } else {
                g_dryPipeSeconds = 0;
            }

            // 3c. Trava de Mangueira Estourada / Fuga Livre (> 15.0 L/min por 10s seguidos)
            if (g_currentFlowRateLpm > 15.0f) {
                g_burstPipeSeconds++;
                if (g_burstPipeSeconds >= 10) {
                    stopAllIrrigationSafely();
                    g_mode = SystemMode::EMERGENCY_STOP;
                    g_lastHydraulicFault = "MANGUEIRA_ROMPIDA_SOBREVAZAO";
                    beepAlarmFault();
                    return;
                }
            } else {
                g_burstPipeSeconds = 0;
            }

            // 3d. Saúde do Filtro Único 120 Mesh
            if (g_currentFlowRateLpm >= 0.5f && g_currentFlowRateLpm <= 14.0f) {
                g_filterEfficiencyPct = (g_currentFlowRateLpm / g_zones[i].nominalFlowLpm) * 100.0f;
                if (g_filterEfficiencyPct > 100.0f) g_filterEfficiencyPct = 100.0f;
                g_filterDirtyWarning = (g_filterEfficiencyPct < 80.0f);
            }

            // 3e. Conclusão normal por volume entregue (Litros)
            if (g_zones[i].targetLitersCurrentRun > 0.0f &&
                g_zones[i].deliveredLitersCurrentRun >= g_zones[i].targetLitersCurrentRun) {
                stopAllIrrigationSafely();
            }
        }
    }

    // 4. Execução do Botão 3 ("Liga tudo +1h" alternando 30 min por zona)
    if (g_mode == SystemMode::MANUAL_PLUS_HOURS) {
        if (g_manualRemainingSeconds > 0) {
            g_manualRemainingSeconds--;
            g_manualElapsedSeconds++;
            uint8_t activeZoneIdx = ((g_manualElapsedSeconds / 1800) % 2 == 0) ? 0 : 1;
            activateSingleZoneSafely(activeZoneIdx, 9999.0f);
        } else {
            stopAllIrrigationSafely();
            g_mode = SystemMode::AUTO_SCHEDULE;
        }
    }
}

// ==============================================================================
// 7. DISPLAY OLED 0.96" HUMANO E FÁCIL DE LER
// ==============================================================================
void renderOledScreen() {
    if (!oledReady) return;

    if (millis() - oledWakeTimestampMs > OLED_SLEEP_TIMEOUT_MS) {
        display.clearDisplay();
        display.display();
        return;
    }

    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);

    if (oledPageIndex == 0) {
        display.printf("IRRIGA.AI  %02d:%02d %s\n", g_currentHour, g_currentMinute, g_ntpSynced ? "NTP" : "LOC");
        display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
        display.setCursor(0, 14);

        if (g_mode == SystemMode::EMERGENCY_STOP) {
            display.println(F("ALERTA HIDRAULICO!"));
            display.println(g_lastHydraulicFault.substring(0, 20));
        } else if (g_mode == SystemMode::PAUSED_BY_USER) {
            display.println(F("Status: PAUSADO [||]"));
        } else if (g_mode == SystemMode::MANUAL_PLUS_HOURS) {
            display.printf("LIGA TUDO: %lum rest.\n", g_manualRemainingSeconds / 60);
        } else if (g_zones[0].isIrrigating) {
            display.printf("Z1 Regando: %.0f/%.0fL\n", g_zones[0].deliveredLitersCurrentRun, g_zones[0].targetLitersCurrentRun);
        } else if (g_zones[1].isIrrigating) {
            display.printf("Z2 Regando: %.0f/%.0fL\n", g_zones[1].deliveredLitersCurrentRun, g_zones[1].targetLitersCurrentRun);
        } else {
            display.println(F("Status: AUTOMATICO"));
        }

        display.printf("Caixa: %u%% | %.1fL/m\n", g_tankLevelPct, g_currentFlowRateLpm);
        display.printf("Cota: %.0f/%.0f L\n", g_litersUsedToday, g_dailyQuotaMaxLiters);

        if (g_wishRainBoostPct > 0.0f) {
            display.printf("Chuva Extra: +%.0f%% 24h\n", g_wishRainBoostPct);
        } else if (g_filterDirtyWarning) {
            display.println(F("AVISO: Limpar Filtro!"));
        } else {
            display.println(F("Filtro 120M: OK"));
        }
    } else if (oledPageIndex == 1) {
        display.println(F("ZONAS DE PLANTIO"));
        display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
        display.setCursor(0, 15);
        display.printf("Z1: %s (D.%u)\n", g_zones[0].cropName.c_str(), g_zones[0].dap);
        display.printf("Z2: %s (D.%u)\n", g_zones[1].cropName.c_str(), g_zones[1].dap);
        display.printf("V.Mestre: %s\n", digitalRead(PIN_RELAY_1_MASTER) == RELAY_ON ? "ABERTA" : "FECHADA");
        display.printf("IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        display.println(F("SLOTS EXPANSAO (R4-8)"));
        display.drawLine(0, 10, 128, 10, SSD1306_WHITE);
        display.setCursor(0, 15);
        display.printf("R6 Bomba: %s\n", g_expPumpEnabled ? "ATIVA" : "Reserva");
        display.printf("R7 Luz:   %s\n", g_expLightState ? "LIGADA" : "OFF");
        display.printf("R8 Cam:   %s\n", g_expCameraState ? "LIGADA" : "OFF");
    }

    display.display();
}

// ==============================================================================
// 8. API HTTP / JSON COMPLETA PARA O APLICATIVO MOBILE E DEV-GUI
// ==============================================================================
void setupHttpRoutes() {
    // 1. GET /api/status — Telemetria completa em tempo real
    server.on("/api/status", HTTP_GET, []() {
        JsonDocument doc;
        doc["system"] = "Irriga.ai Pro-Duo";
        doc["clock"] = String(g_currentHour) + ":" + (g_currentMinute < 10 ? "0" : "") + String(g_currentMinute);
        doc["ntp_synced"] = g_ntpSynced;
        doc["mode"] = (g_mode == SystemMode::EMERGENCY_STOP) ? "EMERGENCY_STOP" :
                      (g_mode == SystemMode::PAUSED_BY_USER) ? "PAUSED" :
                      (g_mode == SystemMode::MANUAL_PLUS_HOURS) ? "MANUAL_PLUS_1H" : "AUTO";
        doc["last_hydraulic_fault"] = g_lastHydraulicFault;
        doc["tank_level_pct"] = g_tankLevelPct;
        doc["flow_rate_lpm"] = g_currentFlowRateLpm;
        doc["liters_used_today"] = g_litersUsedToday;
        doc["daily_quota_max_liters"] = g_dailyQuotaMaxLiters;
        doc["filter_efficiency_pct"] = g_filterEfficiencyPct;
        doc["filter_dirty_warning"] = g_filterDirtyWarning;
        doc["wish_rain_boost_pct"] = g_wishRainBoostPct;
        doc["master_valve_open"] = (digitalRead(PIN_RELAY_1_MASTER) == RELAY_ON);
        doc["zone_1_open"] = g_zones[0].isIrrigating;
        doc["zone_1_dap"] = g_zones[0].dap;
        doc["zone_2_open"] = g_zones[1].isIrrigating;
        doc["zone_2_dap"] = g_zones[1].dap;

        String out;
        serializeJson(doc, out);
        server.sendHeader("Access-Control-Allow-Origin", "*");
        server.send(200, "application/json", out);
    });

    // 2. POST /api/plan — Recebe o Plano Compilado (gerado pelo App ou Claude)
    server.on("/api/plan", HTTP_POST, []() {
        if (!server.hasArg("plain")) {
            server.send(400, "application/json", "{\"error\":\"Missing JSON body\"}");
            return;
        }
        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, server.arg("plain"));
        if (err) {
            server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
            return;
        }
        if (doc["quota_max_l"].is<float>()) {
            g_dailyQuotaMaxLiters = doc["quota_max_l"].as<float>();
            nvs.putFloat("quota_max", g_dailyQuotaMaxLiters);
        }
        if (doc["z1_liters"].is<float>()) {
            float z1Total = doc["z1_liters"].as<float>();
            g_zones[0].shifts[0].litersBase = z1Total * 0.60f;
            g_zones[0].shifts[1].litersBase = z1Total * 0.40f;
        }
        if (doc["z2_liters"].is<float>()) {
            float z2Total = doc["z2_liters"].as<float>();
            g_zones[1].shifts[0].litersBase = z2Total * 0.60f;
            g_zones[1].shifts[1].litersBase = z2Total * 0.40f;
        }
        if (doc["z1_dap"].is<uint16_t>()) {
            g_zones[0].dap = doc["z1_dap"].as<uint16_t>();
            nvs.putUShort("z1_dap", g_zones[0].dap);
        }
        if (doc["z2_dap"].is<uint16_t>()) {
            g_zones[1].dap = doc["z2_dap"].as<uint16_t>();
            nvs.putUShort("z2_dap", g_zones[1].dap);
        }
        nvs.putString("active_plan", server.arg("plain"));
        beepShort(2, 60);
        server.sendHeader("Access-Control-Allow-Origin", "*");
        server.send(200, "application/json", "{\"status\":\"saved_to_nvs\"}");
    });

    // 3. POST /api/button — Aciona remotamente um dos 4 botões pelo celular
    server.on("/api/button", HTTP_POST, []() {
        int btnId = server.arg("id").toInt(); // 1..4
        if (btnId >= 1 && btnId <= 4) {
            executeButtonAction(btnId - 1);
            server.sendHeader("Access-Control-Allow-Origin", "*");
            server.send(200, "application/json", "{\"status\":\"button_triggered\"}");
        } else {
            server.send(400, "application/json", "{\"error\":\"Invalid button id (1..4)\"}");
        }
    });

    // 4. POST /api/relay — Aciona slots de expansão (Relés 4 a 8)
    server.on("/api/relay", HTTP_POST, []() {
        int ch = server.arg("ch").toInt();
        bool turnOn = (server.arg("on") == "1" || server.arg("on") == "true");
        if (ch == 6) {
            g_expPumpEnabled = turnOn;
        } else if (ch == 7) {
            g_expLightState = turnOn;
            digitalWrite(PIN_RELAY_7_EXP_LIGHT, turnOn ? RELAY_ON : RELAY_OFF);
        } else if (ch == 8) {
            g_expCameraState = turnOn;
            digitalWrite(PIN_RELAY_8_EXP_CAM, turnOn ? RELAY_ON : RELAY_OFF);
        }
        beepShort(1, 50);
        server.sendHeader("Access-Control-Allow-Origin", "*");
        server.send(200, "application/json", "{\"status\":\"relay_updated\"}");
    });

    server.begin();
}

// ==============================================================================
// 9. SETUP E LOOP PRINCIPAL (COM HARDWARE WATCHDOG DE 10s)
// ==============================================================================
void setup() {
    Serial.begin(115200);

    // 1. Inicializa TODOS os 8 Relés DESLIGADOS (HIGH) ANTES de configurar OUTPUT
    for (uint8_t pin : ALL_RELAY_PINS) {
        digitalWrite(pin, RELAY_OFF);
        pinMode(pin, OUTPUT);
    }

    // 2. Buzzer Ativo
    digitalWrite(PIN_BUZZER, LOW);
    pinMode(PIN_BUZZER, OUTPUT);

    // 3. Os 4 Botões Físicos e 4 Boias da Caixa — EXCLUSIVAMENTE INPUT_PULLUP!
    pinMode(PIN_BTN_PAUSE,     INPUT_PULLUP);
    pinMode(PIN_BTN_RESUME,    INPUT_PULLUP);
    pinMode(PIN_BTN_PLUS_1H,   INPUT_PULLUP);
    pinMode(PIN_BTN_WISH_RAIN, INPUT_PULLUP);

    pinMode(PIN_TANK_LVL_25,   INPUT_PULLUP);
    pinMode(PIN_TANK_LVL_50,   INPUT_PULLUP);
    pinMode(PIN_TANK_LVL_75,   INPUT_PULLUP);
    pinMode(PIN_TANK_LVL_100,  INPUT_PULLUP);

    // 4. Sensor de Vazão Hall SF1 (GPIO 34) + Pinos de Expansão de Sensores
    pinMode(PIN_FLOW_SENSOR_SF1, INPUT);
    attachInterrupt(digitalPinToInterrupt(PIN_FLOW_SENSOR_SF1), onFlowSensorPulse, FALLING);
    pinMode(PIN_EXP_SENSOR_1, INPUT);
    pinMode(PIN_EXP_SENSOR_2, INPUT);
    pinMode(PIN_EXP_SENSOR_3, INPUT);

    // 5. Recupera configurações salvas na Memória Flash NVS (Modo Offline)
    nvs.begin("irriga_duo", false);
    g_dailyQuotaMaxLiters = nvs.getFloat("quota_max", 1000.0f);
    g_wishRainBoostPct    = nvs.getFloat("boost_24h", 0.0f);
    g_zones[0].dap        = nvs.getUShort("z1_dap", 102);
    g_zones[1].dap        = nvs.getUShort("z2_dap", 52);
    if (nvs.getBool("paused", false)) {
        g_mode = SystemMode::PAUSED_BY_USER;
    }

    // 6. Conecta ao Wi-Fi do Sítio + Cria Ponto de Acesso Local Fallback + Configura NTP
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP(AP_FALLBACK_SSID, AP_FALLBACK_PASS);
    WiFi.begin(g_wifiSsid.c_str(), g_wifiPass.c_str());
    configTime(-3 * 3600, 0, "pool.ntp.org", "a.st1.ntp.br"); // America/Fortaleza (UTC-3)

    // 7. Inicializa Display OLED 0.96" I2C (SDA=21, SCL=22)
    Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
    if (display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
        oledReady = true;
        oledWakeTimestampMs = millis();
        renderOledScreen();
    }

    // 8. Ativa o Hardware Watchdog Timer (10 segundos)
    esp_task_wdt_init(10, true);
    esp_task_wdt_add(NULL);

    setupHttpRoutes();
    beepShort(2, 80);
    Serial.println(F("🌱 Irriga.ai Pro-Duo iniciado com Relógio NTP e Travas Hidráulicas!"));
}

uint32_t g_lastSecondTickMs = 0;

void loop() {
    esp_task_wdt_reset(); // Alimenta o Watchdog de Hardware

    handlePhysicalButtons();
    server.handleClient();

    uint32_t nowMs = millis();
    if (nowMs - g_lastSecondTickMs >= 1000) {
        g_lastSecondTickMs = nowMs;
        updateClockAndDailyReset();
        checkAndTriggerScheduledShifts();
        updateFlowAndSafetyWatchdogs1Hz();
        renderOledScreen();
    }
}
