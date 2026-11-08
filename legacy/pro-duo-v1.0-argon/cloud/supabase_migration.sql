-- ==============================================================================
-- 🌱 Irriga.ai Pro-Duo — Script Oficial de Criação do Banco (Supabase Free Tier)
-- ==============================================================================
-- Como usar: Cole este script no "SQL Editor" do seu projeto gratuito no Supabase
-- e clique em "Run". Ele cria toda a estrutura para:
-- 1. Armazenar o arquivo padronizado `plano_irrigacao_sitio.yaml` (editável pelo Claude)
-- 2. Controlar as 2 zonas ativas + 5 slots de expansão da placa de 8 relés
-- 3. Receber o Heartbeat do ESP32 (mantendo o banco ativo sem pausar após 7 dias!)
-- ==============================================================================

-- 1. Tabela de Planos Padronizados (IrrigaPlan YAML + JSON Compilado p/ ESP32)
CREATE TABLE IF NOT EXISTS irriga_plans (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    version_tag TEXT DEFAULT '1.0',
    edited_by TEXT DEFAULT 'Usuario / Claude IA',
    raw_yaml_content TEXT NOT NULL,           -- O arquivo YAML legível com comentários
    compiled_esp32_json JSONB NOT NULL,       -- O JSON enxuto que o ESP32 baixa
    daily_quota_max_liters NUMERIC(7,1) DEFAULT 1000.0,
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. Estado dos 8 Canais da Placa de Relés (3 Ativos no MVP + 5 Slots de Expansão)
CREATE TABLE IF NOT EXISTS relay_channels (
    channel_number INT PRIMARY KEY CHECK (channel_number BETWEEN 1 AND 8),
    gpio_pin INT NOT NULL,
    channel_key TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role_type TEXT NOT NULL,                  -- 'MASTER_VALVE', 'ZONE_VALVE', 'EXPANSION_PUMP', 'EXPANSION_LIGHT', 'EXPANSION_CAMERA'
    enabled_in_hardware BOOLEAN DEFAULT FALSE,
    current_state BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO relay_channels (channel_number, gpio_pin, channel_key, display_name, role_type, enabled_in_hardware)
VALUES
    (1, 4,  'valvula_mestre',       'Válvula Mestre Geral 12V',           'MASTER_VALVE',     TRUE),
    (2, 16, 'valvula_zona_1',       'Válvula Zona 1 (Oeste • 128 m²)',    'ZONE_VALVE',       TRUE),
    (3, 17, 'valvula_zona_2',       'Válvula Zona 2 (Leste • 158 m²)',    'ZONE_VALVE',       TRUE),
    (4, 18, 'exp_valvula_zona_3',   'Reserva: Futura Válvula Zona 3',     'ZONE_VALVE',       FALSE),
    (5, 19, 'exp_valvula_zona_4',   'Reserva: Futura Válvula Zona 4',     'ZONE_VALVE',       FALSE),
    (6, 23, 'exp_bomba_auxiliar',   'Reserva: Bomba Auxiliar 12V',        'EXPANSION_PUMP',   FALSE),
    (7, 25, 'exp_iluminacao',       'Reserva: Luz / Refletor LED Sítio',  'EXPANSION_LIGHT',  FALSE),
    (8, 5,  'exp_camera_acessorio', 'Reserva: Câmera Wi-Fi / Acessório',  'EXPANSION_CAMERA', FALSE)
ON CONFLICT (channel_number) DO NOTHING;

-- 3. Telemetria em Tempo Real, Cotas e Botões Físicos (Recebe Heartbeat do ESP32)
CREATE TABLE IF NOT EXISTS pro_duo_telemetry (
    id BIGSERIAL PRIMARY KEY,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    operation_mode TEXT NOT NULL DEFAULT 'AUTO', -- 'AUTO', 'PAUSED', 'MANUAL_PLUS_1H', 'EMERGENCY'
    tank_level_pct INT NOT NULL DEFAULT 75,      -- 0, 25, 50, 75, 100
    flow_rate_lpm NUMERIC(5,2) DEFAULT 0.0,
    liters_used_today NUMERIC(7,1) DEFAULT 0.0,
    daily_quota_max_liters NUMERIC(7,1) DEFAULT 1000.0,
    filter_120mesh_efficiency_pct NUMERIC(5,1) DEFAULT 100.0,
    wish_rain_boost_pct NUMERIC(4,1) DEFAULT 0.0, -- Botão 4: "Era bom que chovesse" (+25% ou +50%)
    wish_rain_expires_at TIMESTAMPTZ,
    temp_max_today_c NUMERIC(4,1),
    hours_above_32c NUMERIC(4,1),
    wind_max_kmh NUMERIC(4,1)
);

-- Habilita Realtime via WebSockets para atualização instantânea na tela do celular
ALTER PUBLICATION supabase_realtime ADD TABLE relay_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE pro_duo_telemetry;
ALTER PUBLICATION supabase_realtime ADD TABLE irriga_plans;
