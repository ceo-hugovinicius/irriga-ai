#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🌱 Irriga.ai Pro-Duo — Motor Cognitivo, Validador de Plano (IrrigaPlan) e Compilador ESP32
==========================================================================================
Este script lê o arquivo padronizado `plano_irrigacao_sitio.yaml` (editável manualmente ou
pelo Claude), valida todas as travas de segurança de hardware/cota, calcula a irrigação
ideal das 2 zonas considerando:
  - Planta e Estágio de Crescimento (DAP = Dias Após o Plantio e Fator Kc)
  - Exposição ao Calor Diurno (horas > 32°C), Vento Seco (> 20 km/h), ET0 e Chuva
  - Botão lúdico "Era bom que chovesse" (+25% ou +50% nas próximas 24h)
  - Rateio inteligente da Cota Diária da Caixa (5.000 L) medido pelo Sensor de Vazão SF1
E exporta o pacote JSON enxuto (`esp32_compiled_payload.json`) pronto para o ESP32.
"""

import json
import os
import re
import sys
from datetime import date, datetime


# ==============================================================================
# 1. PARSER YAML NATIVO (Zero dependências externas — funciona em qualquer PC)
# ==============================================================================
def _parse_scalar(val_str: str):
    val_str = val_str.strip()
    if not val_str:
        return ""
    # Remove comentários inline respeitando strings entre aspas
    in_quote = None
    clean_chars = []
    for ch in val_str:
        if ch in ('"', "'"):
            if in_quote == ch:
                in_quote = None
            elif in_quote is None:
                in_quote = ch
        elif ch == "#" and in_quote is None:
            break
        clean_chars.append(ch)
    s = "".join(clean_chars).strip()
    if not s:
        return ""
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        return s[1:-1]
    if s.lower() == "true":
        return True
    if s.lower() == "false":
        return False
    if s.lower() in ("null", "none", "~"):
        return None
    if s == "[]":
        return []
    if s.startswith("{") and s.endswith("}"):
        inner = s[1:-1].strip()
        obj = {}
        if inner:
            for part in inner.split(","):
                if ":" in part:
                    k, v = part.split(":", 1)
                    obj[k.strip().strip("\"'")] = _parse_scalar(v)
        return obj
    try:
        if "." in s:
            return float(s)
        return int(s)
    except ValueError:
        return s


def load_yaml_file(filepath: str) -> dict:
    """Lê arquivos YAML estruturados do padrão IrrigaPlan sem exigir pip install pyyaml."""
    try:
        import yaml  # Se PyYAML estiver instalado, usa diretamente
        with open(filepath, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except ImportError:
        pass

    with open(filepath, "r", encoding="utf-8") as f:
        raw_lines = f.readlines()

    # Pré-processa linhas válidas (indent, texto)
    lines = []
    for raw in raw_lines:
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        lines.append((indent, stripped))

    def parse_block(idx: int, base_indent: int):
        if idx >= len(lines):
            return {}, idx
        # Verifica se o bloco é uma lista
        if lines[idx][0] >= base_indent and lines[idx][1].startswith("- "):
            arr = []
            while idx < len(lines) and lines[idx][0] == base_indent and lines[idx][1].startswith("- "):
                item_str = lines[idx][1][2:].strip()
                item_indent = base_indent + 2
                idx += 1
                if ":" in item_str:
                    k, v = item_str.split(":", 1)
                    item_dict = {k.strip(): _parse_scalar(v)}
                    while idx < len(lines) and lines[idx][0] >= item_indent and not lines[idx][1].startswith("- "):
                        sub_k, sub_v = lines[idx][1].split(":", 1)
                        sub_k = sub_k.strip()
                        sub_v_clean = _parse_scalar(sub_v)
                        idx += 1
                        if sub_v_clean == "" and idx < len(lines) and lines[idx][0] > item_indent:
                            nested, idx = parse_block(idx, lines[idx][0])
                            item_dict[sub_k] = nested
                        else:
                            item_dict[sub_k] = sub_v_clean
                    arr.append(item_dict)
                else:
                    arr.append(_parse_scalar(item_str))
            return arr, idx

        obj = {}
        while idx < len(lines) and lines[idx][0] == base_indent:
            line_str = lines[idx][1]
            if line_str.startswith("- "):
                break
            if ":" in line_str:
                k, v = line_str.split(":", 1)
                k = k.strip()
                v_clean = _parse_scalar(v)
                idx += 1
                if v_clean == "" and idx < len(lines) and lines[idx][0] > base_indent:
                    nested, idx = parse_block(idx, lines[idx][0])
                    obj[k] = nested
                else:
                    obj[k] = v_clean
            else:
                idx += 1
        return obj, idx

    result, _ = parse_block(0, 0)
    return result


# ==============================================================================
# 2. VALIDADOR DE SEGURANÇA (GUARDRAILS CONTRA ERROS MANUAIS OU DE IA)
# ==============================================================================
FORBIDDEN_OUTPUT_GPIOS = {13, 14, 26, 27, 32, 33, 12, 15, 34, 35, 36, 39}
OFFICIAL_RELAY_GPIOS = {
    "rele_1": 4,   # Válvula Mestre
    "rele_2": 16,  # Válvula Zona 1
    "rele_3": 17,  # Válvula Zona 2
    "rele_4": 18,  # Expansão Zona 3
    "rele_5": 19,  # Expansão Zona 4
    "rele_6": 23,  # Expansão Bomba 12V
    "rele_7": 25,  # Expansão Iluminação
    "rele_8": 5,   # Expansão Câmera/Acessório
}


def validate_irriga_plan(plan: dict) -> tuple[bool, list[str], list[str]]:
    """
    Retorna (aprovado: bool, erros_criticos: list, avisos_agronomicos: list)
    """
    errors = []
    warnings = []

    # 1. Verifica seções obrigatórias
    required_sections = [
        "cotas_e_seguranca",
        "inteligencia_climatica",
        "botoes_fisicos_painel",
        "zonas_de_plantio",
        "arquitetura_8_reles_e_expansao",
    ]
    for sec in required_sections:
        if sec not in plan:
            errors.append(f"Seção obrigatória ausente no arquivo: '{sec}'.")
    if errors:
        return False, errors, warnings

    # 2. Trava de segurança de Cota e Tempo Máximo
    cotas = plan["cotas_e_seguranca"]
    cota_diaria = cotas.get("cota_diaria_maxima_litros", 0)
    cap_caixa = cotas.get("capacidade_caixa_litros", 5000)
    if cota_diaria <= 0 or cota_diaria > cap_caixa:
        errors.append(
            f"Cota diária inválida ({cota_diaria} L). Deve ser entre 10 L e a capacidade da caixa ({cap_caixa} L)."
        )
    max_min = cotas.get("tempo_maximo_valvula_aberta_min", 180)
    if max_min > 240:
        errors.append(f"Tempo máximo de válvula aberta ({max_min} min) excede a trava de segurança de 240 min.")

    # 3. Trava de proteção elétrica de GPIOs (Proíbe usar pinos de botão/boia como saída)
    reles = plan["arquitetura_8_reles_e_expansao"]
    for r_key, expected_gpio in OFFICIAL_RELAY_GPIOS.items():
        if r_key not in reles:
            errors.append(f"Canal '{r_key}' ausente em 'arquitetura_8_reles_e_expansao'.")
            continue
        gpio = reles[r_key].get("gpio")
        if gpio in FORBIDDEN_OUTPUT_GPIOS:
            errors.append(
                f"PERIGO ELÉTRICO: O canal '{r_key}' tentou usar o GPIO {gpio}, que é um pino de entrada "
                f"(botão/boia ligado ao GND). Isso causaria curto-circuito!"
            )
        elif gpio != expected_gpio:
            warnings.append(
                f"Aviso: '{r_key}' está com GPIO {gpio} (o padrão do Pro-Duo é GPIO {expected_gpio})."
            )

    # 4. Validação das Duas Zonas de Plantio e Rotação Botânica
    zonas = plan["zonas_de_plantio"]
    for z_key in ("zona_1", "zona_2"):
        if z_key not in zonas:
            errors.append(f"Zona obrigatória '{z_key}' não encontrada em 'zonas_de_plantio'.")
            continue
        z = zonas[z_key]
        cultura = z.get("cultura_atual", {})
        familia_atual = str(cultura.get("familia_botanica", "")).lower()
        anterior = str(cultura.get("cultura_anterior_na_zona", "")).lower()
        if familia_atual and familia_atual in anterior:
            warnings.append(
                f"⚠️ Alerta Agronômico ({z.get('nome')}): A cultura atual ({cultura.get('nome_exibicao')} - "
                f"{cultura.get('familia_botanica')}) pertence à mesma família da cultura anterior "
                f"('{cultura.get('cultura_anterior_na_zona')}'). Risco aumentado de pragas de solo/oídio."
            )

    return len(errors) == 0, errors, warnings


# ==============================================================================
# 3. MOTOR COGNITIVO DE CÁLCULO DIÁRIO (ESTÁGIO DA PLANTA + CLIMA + BOTÕES)
# ==============================================================================
PRIORITY_WEIGHTS = {
    "MAXIMA_CRITICA": 1.5,
    "ALTA": 1.15,
    "MEDIA": 0.9,
    "BAIXA": 0.6,
}


def find_current_stage(fases: list, dap: int) -> dict:
    """Localiza em qual fase fenológica a planta está hoje com base nos Dias Após o Plantio (DAP)."""
    if dap < 1:
        return fases[0]
    for f in fases:
        if f["dia_inicio"] <= dap <= f["dia_fim"]:
            return f
    # Se já passou do último dia previsto, retorna a última fase (final de ciclo/colheita)
    return fases[-1]


def calculate_daily_irrigation(
    plan: dict,
    ref_date: date,
    weather: dict,
    button_state: dict = None,
) -> dict:
    """
    Calcula o plano diário detalhado para a Zona 1 e Zona 2.
    Parâmetros em `weather`:
      - et0_mm: float (Evapotranspiração FAO-56 do dia em São Vicente do Seridó)
      - temp_max_c: float (Temperatura máxima do dia)
      - hours_above_32c: float (Horas em que a planta ficou exposta a > 32°C hoje)
      - wind_max_kmh: float (Velocidade do vento diurno em km/h)
      - rain_yesterday_mm: float (Chuva acumulada nas últimas 24h)
      - rain_forecast_prob_pct: float (Probabilidade de chuva hoje %)
      - rain_forecast_mm: float (Chuva prevista para hoje mm)
    Parâmetros em `button_state`:
      - paused: bool (Botão 1 — Pausar irrigações planejadas)
      - manual_plus_hours: int (Botão 3 — Liga tudo +1h)
      - era_bom_que_chovesse_clicks: int (0, 1 ou 2 cliques no Botão 4)
      - tank_level_pct: int (25, 50, 75 ou 100%)
    """
    if button_state is None:
        button_state = {
            "paused": False,
            "manual_plus_hours": 0,
            "era_bom_que_chovesse_clicks": 0,
            "tank_level_pct": 75,
        }

    cotas = plan["cotas_e_seguranca"]
    clima_cfg = plan["inteligencia_climatica"]
    btn_cfg = plan["botoes_fisicos_painel"]

    # 1. Calcula multiplicadores climáticos (Calor Diurno, Vento Seco e Chuva)
    calor_cfg = clima_cfg["exposicao_ao_calor_diurno"]
    bonus_calor_pct = 0.0
    if calor_cfg.get("ativo", True) and weather.get("hours_above_32c", 0) > 0:
        bonus_calor_pct = min(
            calor_cfg.get("teto_maximo_bonus_calor_pct", 20.0),
            weather["hours_above_32c"] * calor_cfg.get("bonus_rega_tarde_por_hora_quente_pct", 4.0),
        )

    vento_cfg = clima_cfg["exposicao_ao_vento"]
    bonus_vento_pct = 0.0
    if vento_cfg.get("ativo", True) and weather.get("wind_max_kmh", 0) >= vento_cfg.get("vento_forte_acima_kmh", 20.0):
        bonus_vento_pct = vento_cfg.get("bonus_protecao_vento_pct", 10.0)

    # 2. Botão Lúdico "Era bom que chovesse" (Botão 4)
    btn4_cfg = btn_cfg["botao_4_era_bom_que_chovesse"]
    clicks_chuva = button_state.get("era_bom_que_chovesse_clicks", 0)
    if clicks_chuva == 1:
        bonus_botao_chuva_pct = btn4_cfg.get("aumento_1_clique_pct", 25.0)
    elif clicks_chuva >= 2:
        bonus_botao_chuva_pct = btn4_cfg.get("aumento_2_cliques_pct", 50.0)
    else:
        bonus_botao_chuva_pct = 0.0

    # 3. Chuva efetiva de ontem
    chuva_cfg = clima_cfg["chuva"]
    chuva_efetiva_mm = weather.get("rain_yesterday_mm", 0.0) * (
        chuva_cfg.get("descontar_chuva_ultimas_24h_pct", 80.0) / 100.0
    )

    previsao_chuva_forte = (
        weather.get("rain_forecast_prob_pct", 0) >= chuva_cfg.get("adiar_rega_se_chance_chuva_maior_pct", 75)
        and weather.get("rain_forecast_mm", 0.0) >= chuva_cfg.get("adiar_rega_se_chuva_prevista_maior_mm", 5.0)
    )

    # 4. Calcula demanda bruta de cada Zona (Zona 1 e Zona 2)
    zones_calc = {}
    for z_key in ("zona_1", "zona_2"):
        z = plan["zonas_de_plantio"][z_key]
        cult = z["cultura_atual"]
        planted_date = datetime.strptime(cult["data_plantio"], "%Y-%m-%d").date()
        dap = (ref_date - planted_date).days + 1
        stage = find_current_stage(z["fases_fenologicas"], dap)

        # Lâmina base: usa ET0 * Kc se ativo, ou a lâmina base da fase
        if clima_cfg.get("usar_evapotranspiracao_et0_real", True) and weather.get("et0_mm"):
            lamina_mm = weather["et0_mm"] * stage["fator_kc"]
        else:
            lamina_mm = stage["lamina_base_mm_dia"]

        # Desconta chuva efetiva das últimas 24h
        lamina_apos_chuva_mm = max(0.0, lamina_mm - chuva_efetiva_mm)

        # Aplica previsão de chuva iminente
        is_critical = stage["prioridade_cota"] == "MAXIMA_CRITICA"
        status_clima_zona = "NORMAL"
        if previsao_chuva_forte:
            if is_critical and chuva_cfg.get("proteger_fase_critica_mesmo_com_previsao", True):
                lamina_apos_chuva_mm *= 0.50
                status_clima_zona = "REDUZIDA_50%_PREVISAO_CHUVA_FASE_CRITICA"
            else:
                lamina_apos_chuva_mm = 0.0
                status_clima_zona = "ADIADA_AGUARDANDO_CHUVA_PREVISTA"

        # Aplica exposição ao calor diurno + vento + ajuste do usuário + botão "Era bom que chovesse"
        fator_ambiental = 1.0 + ((bonus_calor_pct + bonus_vento_pct + z.get("ajuste_fino_usuario_pct", 0.0)) / 100.0)
        fator_botao_ludico = 1.0 + (bonus_botao_chuva_pct / 100.0)
        lamina_final_mm = lamina_apos_chuva_mm * fator_ambiental * fator_botao_ludico

        # Área efetiva molhada (considera proporção de mangueiras abertas, mínimo 50% de cobertura radicular)
        prop_mangueiras = z.get("mangueiras_16mm_abertas_agora", 16) / max(1, z.get("mangueiras_16mm_totais", 16))
        fator_area = max(0.65, prop_mangueiras) if prop_mangueiras < 1.0 else 1.0
        litros_pedidos = (lamina_final_mm * z["area_total_m2"] * fator_area) / 0.90  # 90% eficiência gotejo

        zones_calc[z_key] = {
            "id": z["id"],
            "nome": z["nome"],
            "cultura": cult["nome_exibicao"],
            "familia": cult["familia_botanica"],
            "data_plantio": cult["data_plantio"],
            "dap_atual": dap,
            "ciclo_total_dias": cult["ciclo_previsto_dias"],
            "progresso_ciclo_pct": round(min(100.0, (dap / cult["ciclo_previsto_dias"]) * 100.0), 1),
            "fase_atual": stage,
            "lamina_base_mm": round(lamina_mm, 2),
            "lamina_final_mm": round(lamina_final_mm, 2),
            "litros_pedidos_sem_corte": round(litros_pedidos, 1),
            "litros_aprovados_cota": round(litros_pedidos, 1),
            "status_clima_zona": status_clima_zona,
            "vazao_referencia_lpm": z["vazao_nominal_referencia_lpm"],
            "turnos_config": z["turnos_diarios"],
        }

    # 5. Guardião da Cota Diária (Rateio inteligente entre Zona 1 e Zona 2)
    cota_base = float(cotas["cota_diaria_maxima_litros"])
    if clicks_chuva > 0 and button_state.get("tank_level_pct", 75) >= 50:
        cota_efetiva = cota_base * (1.0 + btn4_cfg.get("permitir_margem_extra_na_cota_pct", 15.0) / 100.0)
    else:
        cota_efetiva = cota_base

    soma_pedida = sum(zc["litros_pedidos_sem_corte"] for zc in zones_calc.values())
    corte_cota_aplicado = False

    if soma_pedida > cota_efetiva and soma_pedida > 0:
        corte_cota_aplicado = True
        excesso = soma_pedida - cota_efetiva
        # Quem tem MENOR prioridade absorve mais o corte para proteger a zona em fase crítica!
        inv_w1 = 1.0 / PRIORITY_WEIGHTS.get(zones_calc["zona_1"]["fase_atual"]["prioridade_cota"], 1.0)
        inv_w2 = 1.0 / PRIORITY_WEIGHTS.get(zones_calc["zona_2"]["fase_atual"]["prioridade_cota"], 1.0)
        soma_inv = inv_w1 + inv_w2
        corte_z1 = min(zones_calc["zona_1"]["litros_pedidos_sem_corte"] * 0.5, excesso * (inv_w1 / soma_inv))
        corte_z2 = excesso - corte_z1
        zones_calc["zona_1"]["litros_aprovados_cota"] = round(
            max(0.0, zones_calc["zona_1"]["litros_pedidos_sem_corte"] - corte_z1), 1
        )
        zones_calc["zona_2"]["litros_aprovados_cota"] = round(
            max(0.0, zones_calc["zona_2"]["litros_pedidos_sem_corte"] - corte_z2), 1
        )

    # 6. Gera os turnos cronometrados c/ JANELA ELÁSTICA INTELIGENTE (Alvorada + Crepúsculo)
    #    - Turno 1 (Alvorada): Ancora o término da Zona 1 às 05:45 (nascer do sol / abertura dos estômatos),
    #      e inicia a Zona 2 exatamente 5 min após o término da Zona 1 (anti-colisão no filtro 120 Mesh).
    #    - Turno 2 (Fim da Tarde / Crepúsculo):
    #      * Sol extremo (>= 34°C ou >= 3h > 32°C): desloca p/ Crepúsculo (17:05) -> esfria mangueira PEBD (-12°C)
    #      * Calor/vento moderado (>= 32°C ou vento >= 20 km/h): desloca p/ 16:35
    #      * Dia ameno (< 32°C): antecipa p/ 16:00 -> folha e colo secam antes da noite (anti-fungo)
    def _mins_to_hhmm(total_mins: float) -> str:
        m = int(round(total_mins)) % 1440
        return f"{m // 60:02d}:{m % 60:02d}"

    max_v_min = cotas["tempo_maximo_valvula_aberta_min"]
    raw_shifts = {}
    for z_key, zc in zones_calc.items():
        raw_shifts[z_key] = []
        for idx_t, t in enumerate(zc["turnos_config"], 1):
            prop = t["proporcao_do_dia_pct"] / 100.0
            litros_t = round(zc["litros_aprovados_cota"] * prop, 1)
            dur_min = min(max_v_min, round(litros_t / max(0.5, zc["vazao_referencia_lpm"]), 1))
            raw_shifts[z_key].append({"pct": t["proporcao_do_dia_pct"], "litros": litros_t, "min": dur_min})

    # Cálculo Janela Elástica Turno 1 (Alvorada — Término Z1 ancorado às 05:45 + Recuo p/ Baixa Vazão até 02:30)
    z1_m_min = raw_shifts["zona_1"][0]["min"]
    z2_m_min = raw_shifts["zona_2"][0]["min"]
    combined_m_min = z1_m_min + 5 + z2_m_min
    z1_ideal_start = (5 * 60 + 45) - z1_m_min
    if z1_ideal_start + combined_m_min > (6 * 60 + 40):
        # Se a vazão por gravidade for baixa e a duração for longa, recua na madrugada p/ terminar antes das 06:40
        z1_ideal_start = (6 * 60 + 40) - combined_m_min
    z1_m_start = max(2 * 60 + 30, min(5 * 60 + 30, z1_ideal_start))
    z1_m_end = z1_m_start + z1_m_min
    z2_m_start = z1_m_end + 5  # +5 min após Zona 1 fechar (100% pressão no filtro 120 Mesh)
    z2_m_end = z2_m_start + z2_m_min

    # Cálculo Janela Elástica Turno 2 (Tarde / Crepúsculo)
    temp_max = weather.get("temp_max_c", 32.0)
    hours_32 = weather.get("hours_above_32c", 0.0)
    wind_max = weather.get("wind_max_kmh", 15.0)
    z1_a_min = raw_shifts["zona_1"][1]["min"]
    z2_a_min = raw_shifts["zona_2"][1]["min"]
    combined_a_min = z1_a_min + 5 + z2_a_min

    if temp_max >= 34.0 or hours_32 >= 3.0:
        z1_a_start = (16 * 60 + 40) if combined_a_min > 100 else (17 * 60 + 5)
        janela_tarde_nome = "Crepúsculo (Tubo Frio -12°C)"
        motivo_tarde = "Deslocado p/ Crepúsculo (esfria mangueira PEBD e reduz ~7% evaporação)"
    elif temp_max >= 32.0 or wind_max >= 20.0:
        z1_a_start = 16 * 60 + 35  # 16:35
        janela_tarde_nome = "Fim da Tarde (Brisa)"
        motivo_tarde = "Ajustado p/ queda do sol e vento"
    else:
        z1_a_start = 16 * 60 + 0  # 16:00
        janela_tarde_nome = "Tarde (Anti-Fungo)"
        motivo_tarde = "Antecipado p/ 16:00 (folha seca antes da noite)"

    z1_a_end = z1_a_start + z1_a_min
    z2_a_start = z1_a_end + 5
    z2_a_end = z2_a_start + z2_a_min

    zones_calc["zona_1"]["turnos_calculados"] = [
        {
            "turno": 1,
            "janela_elastica": "Alvorada Ótima",
            "horario_inicio": _mins_to_hhmm(z1_m_start),
            "horario_termino": _mins_to_hhmm(z1_m_end),
            "motivo_janela": "Termina exatamente ao nascer do sol (05:45)",
            "meta_litros_sensor_sf1": raw_shifts["zona_1"][0]["litros"],
            "duracao_estimada_min": z1_m_min,
        },
        {
            "turno": 2,
            "janela_elastica": janela_tarde_nome,
            "horario_inicio": _mins_to_hhmm(z1_a_start),
            "horario_termino": _mins_to_hhmm(z1_a_end),
            "motivo_janela": motivo_tarde,
            "meta_litros_sensor_sf1": raw_shifts["zona_1"][1]["litros"],
            "duracao_estimada_min": z1_a_min,
        },
    ]
    del zones_calc["zona_1"]["turnos_config"]

    zones_calc["zona_2"]["turnos_calculados"] = [
        {
            "turno": 1,
            "janela_elastica": "Alvorada (Seq. Z1)",
            "horario_inicio": _mins_to_hhmm(z2_m_start),
            "horario_termino": _mins_to_hhmm(z2_m_end),
            "motivo_janela": "Entra 5 min após Zona 1 (100% pressão no filtro 120M)",
            "meta_litros_sensor_sf1": raw_shifts["zona_2"][0]["litros"],
            "duracao_estimada_min": z2_m_min,
        },
        {
            "turno": 2,
            "janela_elastica": janela_tarde_nome,
            "horario_inicio": _mins_to_hhmm(z2_a_start),
            "horario_termino": _mins_to_hhmm(z2_a_end),
            "motivo_janela": "Entra 5 min após Zona 1 (100% pressão no filtro 120M)",
            "meta_litros_sensor_sf1": raw_shifts["zona_2"][1]["litros"],
            "duracao_estimada_min": z2_a_min,
        },
    ]
    del zones_calc["zona_2"]["turnos_config"]

    # 7. Monta resumo humano empático para a interface mobile
    frases_dia = []
    if weather.get("hours_above_32c", 0) > 0:
        frases_dia.append(
            f"☀️ Calor forte hoje ({weather['temp_max_c']}°C com {weather['hours_above_32c']}h acima de 32°C): "
            f"adicionamos +{bonus_calor_pct:.0f}% de água fresca para recuperar as plantas."
        )
    if bonus_vento_pct > 0:
        frases_dia.append(
            f"💨 Vento seco de {weather['wind_max_kmh']} km/h detectado: proteção eólica de +{bonus_vento_pct:.0f}% ativada."
        )
    if clicks_chuva > 0:
        frases_dia.append(
            f"🌧️ Botão 'Era bom que chovesse' ativo ({clicks_chuva}x): bônus de +{bonus_botao_chuva_pct:.0f}% em todas as regas das próximas 24h!"
        )
    if corte_cota_aplicado:
        frases_dia.append(
            f"🪣 Guardião da Cota: O pedido total ({soma_pedida:.0f} L) foi ajustado para caber no teto de "
            f"{cota_efetiva:.0f} L/dia, protegendo prioritariamente a zona em fase mais sensível."
        )
    if not frases_dia:
        frases_dia.append("✅ Clima ameno e dentro do esperado em São Vicente do Seridó. Irrigação padrão ativa.")

    total_aprovado = round(
        zones_calc["zona_1"]["litros_aprovados_cota"] + zones_calc["zona_2"]["litros_aprovados_cota"], 1
    )

    return {
        "data_calculo": ref_date.isoformat(),
        "resumo_humano_do_dia": frases_dia,
        "clima_processado": {
            "et0_mm": weather.get("et0_mm"),
            "temp_max_c": weather.get("temp_max_c"),
            "hours_above_32c": weather.get("hours_above_32c"),
            "wind_max_kmh": weather.get("wind_max_kmh"),
            "bonus_calor_aplicado_pct": bonus_calor_pct,
            "bonus_vento_aplicado_pct": bonus_vento_pct,
            "bonus_era_bom_que_chovesse_pct": bonus_botao_chuva_pct,
        },
        "cota_diaria": {
            "cota_configurada_litros": cota_base,
            "cota_efetiva_hoje_litros": round(cota_efetiva, 1),
            "litros_totais_planejados_hoje": total_aprovado,
            "rateio_de_protecao_acionado": corte_cota_aplicado,
        },
        "zonas": zones_calc,
        "payload_esp32_compacto": {
            "v": "1.0-pro-duo",
            "date": ref_date.isoformat(),
            "paused": button_state.get("paused", False),
            "boost_24h_pct": bonus_botao_chuva_pct,
            "quota_max_l": round(cota_efetiva, 1),
            "max_valve_min": cotas["tempo_maximo_valvula_aberta_min"],
            "filter_warn_pct": cotas["filtro_unico_120_mesh"]["alerta_limpeza_abaixo_de_pct"],
            "relays_map": {
                "r1_master": 4,
                "r2_z1": 16,
                "r3_z2": 17,
                "r4_exp_z3": 18,
                "r5_exp_z4": 19,
                "r6_exp_pump": 23,
                "r7_exp_light": 25,
                "r8_exp_cam": 5,
            },
            "schedule": [
                {
                    "zone": 1,
                    "relay": 2,
                    "time": t["horario_inicio"],
                    "liters": t["meta_litros_sensor_sf1"],
                    "max_min": t["duracao_estimada_min"],
                }
                for t in zones_calc["zona_1"]["turnos_calculados"]
            ]
            + [
                {
                    "zone": 2,
                    "relay": 3,
                    "time": t["horario_inicio"],
                    "liters": t["meta_litros_sensor_sf1"],
                    "max_min": t["duracao_estimada_min"],
                }
                for t in zones_calc["zona_2"]["turnos_calculados"]
            ],
        },
    }


# ==============================================================================
# 4. EXECUÇÃO VIA LINHA DE COMANDO (CLI) E TESTE DE CENÁRIOS
# ==============================================================================
def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    yaml_path = os.path.join(base_dir, "planos", "plano_irrigacao_sitio.yaml")
    out_json_path = os.path.join(base_dir, "planos", "esp32_compiled_payload.json")

    print("=" * 78)
    print("🌱 IRRIGA.AI PRO-DUO — MOTOR COGNITIVO E VALIDADOR DE PLANO (IrrigaPlan v1.0)")
    print("=" * 78)
    print(f"Lendo arquivo de plano: {yaml_path}")

    plan = load_yaml_file(yaml_path)
    ok, errors, warnings = validate_irriga_plan(plan)

    if not ok:
        print("\n❌ ERROS CRÍTICOS DE SEGURANÇA ENCONTRADOS:")
        for e in errors:
            print(f"   - {e}")
        sys.exit(1)

    print("✅ Validação de Segurança (Guardrails de Pinout, Cota e Válvula Mestre): APROVADA!")
    for w in warnings:
        print(f"   {w}")

    # Simula um dia típico quente e ventoso em São Vicente do Seridó - PB (06/11/2026)
    weather_today = {
        "et0_mm": 5.4,
        "temp_max_c": 34.8,
        "hours_above_32c": 3.5,
        "wind_max_kmh": 24.0,
        "rain_yesterday_mm": 0.0,
        "rain_forecast_prob_pct": 10.0,
        "rain_forecast_mm": 0.0,
    }

    result = calculate_daily_irrigation(
        plan=plan,
        ref_date=date(2026, 11, 6),
        weather=weather_today,
        button_state={"paused": False, "manual_plus_hours": 0, "era_bom_que_chovesse_clicks": 0, "tank_level_pct": 75},
    )

    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print("\n📊 RESUMO COGNITIVO GERADO PARA HOJE (06/11/2026 — São Vicente do Seridó/PB):")
    for msg in result["resumo_humano_do_dia"]:
        print(f"  {msg}")

    for z_key in ("zona_1", "zona_2"):
        z = result["zonas"][z_key]
        f_atual = z["fase_atual"]
        print(f"\n  🔹 {z['nome']} ({z['cultura']} • Dia {z['dap_atual']}/{z['ciclo_total_dias']} - {z['progresso_ciclo_pct']}%)")
        print(f"     Estágio: Fase {f_atual['fase']} — {f_atual['nome']} (Kc={f_atual['fator_kc']} | Prioridade={f_atual['prioridade_cota']})")
        print(f"     Mensagem Humana: \"{f_atual['mensagem_humana']}\"")
        print(f"     Lâmina Hoje: {z['lamina_final_mm']} mm -> Volume Aprovado: {z['litros_aprovados_cota']} Litros")
        for t in z["turnos_calculados"]:
            print(f"       ⏰ Turno {t['turno']} às {t['horario_inicio']}: {t['meta_litros_sensor_sf1']} L (~{t['duracao_estimada_min']} min)")

    print(f"\n💾 Pacote compilado para o ESP32 salvo com sucesso em:\n   {out_json_path}")
    print("=" * 78)


if __name__ == "__main__":
    main()
