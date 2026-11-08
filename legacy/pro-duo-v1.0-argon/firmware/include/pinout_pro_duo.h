#pragma once
#include <Arduino.h>

// ==============================================================================
// 🌱 Irriga.ai Pro-Duo — Mapeamento Oficial e Blindado de Pinos (ESP32 38p V4)
// ==============================================================================
// REGRA DE SEGURANÇA CRÍTICA:
// Os pinos de botões (13, 14, 26, 27) e boias da caixa (32, 33, 12, 15) fecham
// contato direto com o GND. JAMAIS configure-os como OUTPUT HIGH!
// ==============================================================================

namespace IrrigaPins {

    // --- 1. COMUNICAÇÃO I2C (Display OLED 0.96" SSD1306) ---
    constexpr uint8_t PIN_OLED_SDA         = 21;
    constexpr uint8_t PIN_OLED_SCL         = 22;
    constexpr uint8_t OLED_I2C_ADDR        = 0x3C;

    // --- 2. OS 4 BOTÕES FÍSICOS DE INTERAÇÃO HUMANA (INPUT_PULLUP -> GND) ---
    constexpr uint8_t PIN_BTN_PAUSE        = 13; // Botão 1: Pausar irrigações planejadas
    constexpr uint8_t PIN_BTN_RESUME       = 14; // Botão 2: Continuar irrigações planejadas / Acordar tela
    constexpr uint8_t PIN_BTN_PLUS_1H      = 26; // Botão 3: Liga tudo por +1 hora (incrementável)
    constexpr uint8_t PIN_BTN_WISH_RAIN    = 27; // Botão 4: "Era bom que chovesse" (+25% / +50% nas próx. 24h)

    // --- 3. AS 4 BOIAS DE NÍVEL DA CAIXA DE 5.000 L (INPUT_PULLUP -> GND) ---
    constexpr uint8_t PIN_TANK_LVL_25      = 32; // Nível 1: 25% (1.250 L - Reserva mínima obrigatória)
    constexpr uint8_t PIN_TANK_LVL_50      = 33; // Nível 2: 50% (2.500 L)
    constexpr uint8_t PIN_TANK_LVL_75      = 12; // Nível 3: 75% (3.750 L)
    constexpr uint8_t PIN_TANK_LVL_100     = 15; // Nível 4: 100% (5.000 L)

    // --- 4. SENSOR DE VAZÃO HALL SF1 E ENTRADAS DE EXPANSÃO (INPUT ONLY) ---
    constexpr uint8_t PIN_FLOW_SENSOR_SF1  = 34; // Guardião da Cota e diagnóstico do filtro 120 Mesh
    constexpr uint8_t PIN_EXP_SENSOR_1     = 35; // Contabilizado p/ expansão (ex: Sensor Temperatura/Solo)
    constexpr uint8_t PIN_EXP_SENSOR_2     = 36; // Contabilizado p/ expansão (ex: Sensor Umidade Solo VP)
    constexpr uint8_t PIN_EXP_SENSOR_3     = 39; // Contabilizado p/ expansão (ex: Tensão Bateria Solar VN)

    // --- 5. PLACA DE 8 RELÉS 12V (Isolamento Óptico JD-VCC — Active LOW) ---
    // 3 Usados já no MVP + 5 Contabilizados na arquitetura para expansão imediata:
    constexpr uint8_t PIN_RELAY_1_MASTER   = 4;  // [ATIVO MVP] Válvula Mestre Geral 12V
    constexpr uint8_t PIN_RELAY_2_ZONE_1   = 16; // [ATIVO MVP] Válvula Zona 1 (Oeste 128 m²)
    constexpr uint8_t PIN_RELAY_3_ZONE_2   = 17; // [ATIVO MVP] Válvula Zona 2 (Leste 158 m²)
    constexpr uint8_t PIN_RELAY_4_EXP_Z3   = 18; // [EXPANSÃO]  Futura Válvula Zona 3
    constexpr uint8_t PIN_RELAY_5_EXP_Z4   = 19; // [EXPANSÃO]  Futura Válvula Zona 4
    constexpr uint8_t PIN_RELAY_6_EXP_PUMP = 23; // [EXPANSÃO]  Futura Bomba Auxiliar 12V
    constexpr uint8_t PIN_RELAY_7_EXP_LIGHT= 25; // [EXPANSÃO]  Futura Luz / Refletor LED
    constexpr uint8_t PIN_RELAY_8_EXP_CAM  = 5;  // [EXPANSÃO]  Futura Câmera / Sirene / Acessório

    // --- 6. ALERTA SONORO ---
    constexpr uint8_t PIN_BUZZER           = 2;  // Buzzer Ativo 3.3V/5V (Active HIGH)

    // Níveis lógicos para Módulo Relé Optoacoplado (Active LOW)
    constexpr uint8_t RELAY_ON             = LOW;
    constexpr uint8_t RELAY_OFF            = HIGH;

    // Lista indexada dos 8 canais para iteração segura
    constexpr uint8_t ALL_RELAY_PINS[8] = {
        PIN_RELAY_1_MASTER,
        PIN_RELAY_2_ZONE_1,
        PIN_RELAY_3_ZONE_2,
        PIN_RELAY_4_EXP_Z3,
        PIN_RELAY_5_EXP_Z4,
        PIN_RELAY_6_EXP_PUMP,
        PIN_RELAY_7_EXP_LIGHT,
        PIN_RELAY_8_EXP_CAM
    };
}
