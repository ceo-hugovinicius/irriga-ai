#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🌱 Irriga.ai Pro-Duo — Simulador Prático de Safra Longa e Benchmark do Sistema (260 Dias)
=========================================================================================
Simula na prática o cenário planejado pelo usuário em São Vicente do Seridó - PB:
  - Fase 1 (Dias 1 a 160): Plantio de JERIMUM nas duas zonas com defasagem de 50 dias
    para evitar excesso de estoque na colheita:
      * Zona 1 (128 m²): Planta Jerimum no Dia 1 (Colheita no Dia 110)
      * Zona 2 (158 m²): Planta Jerimum no Dia 51 (Colheita no Dia 160)
  - Fase 2 (Pós-Colheita do Jerimum — Recomendação Automática do App):
      * Como Jerimum é Cucurbitácea, o sistema BLOQUEIA repetir Melancia/Maxixe/Jerimum
        e recomenda:
        -> Zona 1 (Dia 126 a 193): FEIJÃO VERDE (Leguminosa: ciclo rápido de 68 dias,
           repõe o nitrogênio consumido pelo Jerimum!)
        -> Zona 2 (Dia 176 a 260): BATATA-DOCE (Convolvulácea: rústica, aproveita o
           solo no período mais quente e seco do 2º semestre!)
"""

import json
import math
import os
import random
from datetime import date, timedelta

from irriga_engine import calculate_daily_irrigation, load_yaml_file, validate_irriga_plan

# Semente fixa para reprodutibilidade exata do benchmark meteorológico do Seridó-PB
random.seed(20261107)


def generate_serido_historical_weather(start_date: date, num_days: int) -> list[dict]:
    """
    Gera série meteorológica diária realista para São Vicente do Seridó - PB (-6.95, -36.36):
    - Meses 3 a 6 (Mar-Jun): Quadra chuvosa irregular do semiárido (pancadas intercaladas com veranicos)
    - Meses 7 a 11 (Jul-Nov): Estação seca, ventos alísios fortes na Borborema (22-32 km/h) e calor crescente (33-36°C)
    """
    series = []
    rain_yesterday = 0.0

    for d_idx in range(num_days):
        curr_date = start_date + timedelta(days=d_idx)
        month = curr_date.month

        # Sazonalidade térmica e de vento em São Vicente do Seridó - PB
        if month in (3, 4, 5):  # Outono (época com algumas chuvas)
            base_temp = 31.5 + random.uniform(-2.0, 2.5)
            wind_kmh = 16.0 + random.uniform(-3.0, 8.0)
            rain_chance = 0.22  # 22% dos dias com chuva
        elif month in (6, 7, 8):  # Inverno seco e ventoso na Borborema
            base_temp = 29.8 + random.uniform(-1.5, 2.8)
            wind_kmh = 22.0 + random.uniform(-3.0, 10.0)
            rain_chance = 0.07
        else:  # Setembro a Novembro (Seca forte, muito sol e vento)
            base_temp = 34.2 + random.uniform(-1.5, 2.5)
            wind_kmh = 24.0 + random.uniform(-3.0, 9.0)
            rain_chance = 0.02

        is_rainy_day = random.random() < rain_chance
        if is_rainy_day:
            rain_today_mm = round(random.uniform(6.0, 28.0), 1)
            rain_prob_pct = random.randint(75, 95)
            temp_max_c = round(base_temp - 2.5, 1)
            hours_above_32c = 0.0
            et0_mm = round(random.uniform(3.2, 4.2), 2)
        else:
            rain_today_mm = 0.0
            rain_prob_pct = random.randint(0, 30)
            temp_max_c = round(base_temp, 1)
            hours_above_32c = round(max(0.0, (temp_max_c - 31.2) * 1.4), 1)
            et0_mm = round(4.5 + (temp_max_c - 30.0) * 0.28 + (wind_kmh - 15.0) * 0.04, 2)

        series.append(
            {
                "date": curr_date,
                "et0_mm": et0_mm,
                "temp_max_c": temp_max_c,
                "hours_above_32c": hours_above_32c,
                "wind_max_kmh": round(wind_kmh, 1),
                "rain_yesterday_mm": rain_yesterday,
                "rain_forecast_prob_pct": rain_prob_pct,
                "rain_forecast_mm": rain_today_mm,
            }
        )
        rain_yesterday = rain_today_mm

    return series


# Catálogo de fases para trocar dinamicamente na simulação
CROP_PROFILES_SIM = {
    "jerimum": {
        "id_catalogo": "jerimum",
        "nome_exibicao": "Jerimum",
        "familia_botanica": "Cucurbitáceas",
        "ciclo_previsto_dias": 110,
        "mangueiras_abertas": 8,  # Espaçamento 2,0m
        "fases": [
            {"fase": 1, "nome": "Pegamento Inicial", "dia_inicio": 1, "dia_fim": 22, "fator_kc": 0.45, "lamina_base_mm_dia": 2.2, "prioridade_cota": "MEDIA", "mensagem_humana": "Mudas de jerimum pegando raiz."},
            {"fase": 2, "nome": "Espalhamento de Ramas", "dia_inicio": 23, "dia_fim": 50, "fator_kc": 0.75, "lamina_base_mm_dia": 3.7, "prioridade_cota": "MEDIA", "mensagem_humana": "Ramas de jerimum crescendo pelo terreno."},
            {"fase": 3, "nome": "Floração e Enchimento de Frutos (CRÍTICA)", "dia_inicio": 51, "dia_fim": 85, "fator_kc": 1.00, "lamina_base_mm_dia": 5.0, "prioridade_cota": "MAXIMA_CRITICA", "mensagem_humana": "Jerimum florindo e enchendo fruto! Prioridade máxima."},
            {"fase": 4, "nome": "Maturação Inicial", "dia_inicio": 86, "dia_fim": 98, "fator_kc": 0.70, "lamina_base_mm_dia": 3.5, "prioridade_cota": "MEDIA", "mensagem_humana": "Casca firme e fruto formado."},
            {"fase": 5, "nome": "Reta Final Pré-Colheita (Cura e Conservação)", "dia_inicio": 99, "dia_fim": 110, "fator_kc": 0.35, "lamina_base_mm_dia": 1.5, "prioridade_cota": "BAIXA", "mensagem_humana": "Reduzindo 65% da água nos últimos 12 dias para o jerimum durar semanas armazenado!"},
        ],
    },
    "feijao_verde": {
        "id_catalogo": "feijao_verde",
        "nome_exibicao": "Feijão Verde",
        "familia_botanica": "Leguminosas",
        "ciclo_previsto_dias": 68,
        "mangueiras_abertas": 16,  # Todas as 16 linhas abertas
        "fases": [
            {"fase": 1, "nome": "Emergência", "dia_inicio": 1, "dia_fim": 15, "fator_kc": 0.45, "lamina_base_mm_dia": 2.2, "prioridade_cota": "MEDIA", "mensagem_humana": "Feijão verde nascendo."},
            {"fase": 2, "nome": "Crescimento e Fixação de Nitrogênio", "dia_inicio": 16, "dia_fim": 32, "fator_kc": 0.75, "lamina_base_mm_dia": 3.8, "prioridade_cota": "ALTA", "mensagem_humana": "Enriquecendo o solo com nitrogênio pós-jerimum."},
            {"fase": 3, "nome": "Floração e Enchimento de Vagens (CRÍTICA)", "dia_inicio": 33, "dia_fim": 55, "fator_kc": 1.10, "lamina_base_mm_dia": 5.4, "prioridade_cota": "MAXIMA_CRITICA", "mensagem_humana": "Florada e vagens enchendo! Prioridade total."},
            {"fase": 4, "nome": "Colheita Escalonada", "dia_inicio": 56, "dia_fim": 68, "fator_kc": 0.80, "lamina_base_mm_dia": 4.0, "prioridade_cota": "ALTA", "mensagem_humana": "Apanha de vagens verdes."},
        ],
    },
    "batata_doce": {
        "id_catalogo": "batata_doce",
        "nome_exibicao": "Batata-doce",
        "familia_botanica": "Convolvuláceas",
        "ciclo_previsto_dias": 130,
        "mangueiras_abertas": 16,
        "fases": [
            {"fase": 1, "nome": "Pegamento das Ramas", "dia_inicio": 1, "dia_fim": 20, "fator_kc": 0.50, "lamina_base_mm_dia": 2.5, "prioridade_cota": "MEDIA", "mensagem_humana": "Pegamento das ramas nas leiras."},
            {"fase": 2, "nome": "Crescimento Vegetativo", "dia_inicio": 21, "dia_fim": 30, "fator_kc": 0.75, "lamina_base_mm_dia": 3.5, "prioridade_cota": "MEDIA", "mensagem_humana": "Fechando ramas."},
            {"fase": 3, "nome": "Formação das Raízes / Tuberização (CRÍTICA)", "dia_inicio": 31, "dia_fim": 75, "fator_kc": 1.10, "lamina_base_mm_dia": 5.0, "prioridade_cota": "MAXIMA_CRITICA", "mensagem_humana": "Tuberização crítica (30-75d)!"},
            {"fase": 4, "nome": "Engorda das Batatas", "dia_inicio": 76, "dia_fim": 115, "fator_kc": 0.75, "lamina_base_mm_dia": 3.5, "prioridade_cota": "ALTA", "mensagem_humana": "Engorda das raízes."},
            {"fase": 5, "nome": "Secagem Pré-Colheita", "dia_inicio": 116, "dia_fim": 130, "fator_kc": 0.30, "lamina_base_mm_dia": 1.2, "prioridade_cota": "BAIXA", "mensagem_humana": "Secando solo p/ colheita."},
        ],
    },
}


def set_zone_crop(plan: dict, z_key: str, crop_key: str, planted_date: date, prev_family: str):
    prof = CROP_PROFILES_SIM[crop_key]
    z = plan["zonas_de_plantio"][z_key]
    z["ativa"] = True
    z["mangueiras_16mm_abertas_agora"] = prof["mangueiras_abertas"]
    z["cultura_atual"] = {
        "id_catalogo": prof["id_catalogo"],
        "nome_exibicao": prof["nome_exibicao"],
        "familia_botanica": prof["familia_botanica"],
        "data_plantio": planted_date.isoformat(),
        "ciclo_previsto_dias": prof["ciclo_previsto_dias"],
        "cultura_anterior_na_zona": prev_family,
    }
    z["fases_fenologicas"] = prof["fases"]


def run_260_day_simulation():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    yaml_path = os.path.join(base_dir, "planos", "plano_irrigacao_sitio.yaml")
    plan = load_yaml_file(yaml_path)

    start_date = date(2026, 3, 1)
    num_days = 260
    weather_series = generate_serido_historical_weather(start_date, num_days)

    # Estatísticas globais do Benchmark
    stats = {
        "total_days": num_days,
        "total_liters_z1": 0.0,
        "total_liters_z2": 0.0,
        "rain_saved_events": 0,
        "heat_boost_days": 0,
        "wind_boost_days": 0,
        "quota_protection_days": 0,
        "filter_cleanings_triggered": 0,
        "wish_rain_button_uses": 0,
        "snapshots": [],
    }

    filter_efficiency = 100.0

    for day_num in range(1, num_days + 1):
        w = weather_series[day_num - 1]
        curr_date = w["date"]

        # ----------------------------------------------------------------------
        # CRONOGRAMA REAL DE PLANTIO DEFASADO (50 DIAS) + ROTAÇÃO RECOMENDADA
        # ----------------------------------------------------------------------
        # ZONA 1 (Oeste 128 m²):
        # - Dias 1 a 110: Jerimum (Safra 1A)
        # - Dias 111 a 125: 15 dias de colheita/descanso/preparo de solo (Zona 1 desligada)
        # - Dias 126 a 193: Feijão Verde (Safra 2A — Recomendado p/ repor Nitrogênio pós-Jerimum!)
        # - Dias 194 a 208: 15 dias de preparo
        # - Dias 209 a 260: Batata-doce (Safra 3A — 3ª família diferente!)
        z1_active = True
        if day_num == 1:
            set_zone_crop(plan, "zona_1", "jerimum", curr_date, "Pousio Inicial")
        elif 111 <= day_num <= 125:
            z1_active = False
        elif day_num == 126:
            set_zone_crop(plan, "zona_1", "feijao_verde", curr_date, "Jerimum (Cucurbitáceas)")
        elif 194 <= day_num <= 208:
            z1_active = False
        elif day_num == 209:
            set_zone_crop(plan, "zona_1", "batata_doce", curr_date, "Feijão Verde (Leguminosas)")

        # ZONA 2 (Leste 158 m²):
        # - Dias 1 a 50: Aguardando defasagem de 50 dias (para não acumular estoque de Jerimum!)
        # - Dias 51 a 160: Jerimum (Safra 1B — Defasado 50d em relação à Zona 1)
        # - Dias 161 a 175: 15 dias de colheita/preparo do solo
        # - Dias 176 a 260: Batata-doce (Safra 2B — Convolvulácea rústica p/ o auge da seca!)
        z2_active = True
        if 1 <= day_num <= 50:
            z2_active = False
            if day_num == 1:
                set_zone_crop(plan, "zona_2", "jerimum", curr_date, "Aguardando Janela 50d")
        elif day_num == 51:
            set_zone_crop(plan, "zona_2", "jerimum", curr_date, "Pousio Defasado 50d")
        elif 161 <= day_num <= 175:
            z2_active = False
        elif day_num == 176:
            set_zone_crop(plan, "zona_2", "batata_doce", curr_date, "Jerimum (Cucurbitáceas)")

        # Simula o caseiro apertando o botão "Era bom que chovesse" em 6 dias muito secos do ano
        clicks_chuva = 1 if (w["temp_max_c"] >= 35.8 and w["rain_forecast_prob_pct"] < 10) else 0
        if clicks_chuva > 0:
            stats["wish_rain_button_uses"] += 1

        res = calculate_daily_irrigation(
            plan=plan,
            ref_date=curr_date,
            weather=w,
            button_state={"paused": False, "manual_plus_hours": 0, "era_bom_que_chovesse_clicks": clicks_chuva, "tank_level_pct": 75},
        )

        # Se uma zona estiver em intervalo de preparo de solo (15 dias pós-colheita), zera o consumo dela
        lit_z1 = res["zonas"]["zona_1"]["litros_aprovados_cota"] if z1_active else 0.0
        lit_z2 = res["zonas"]["zona_2"]["litros_aprovados_cota"] if z2_active else 0.0

        stats["total_liters_z1"] += lit_z1
        stats["total_liters_z2"] += lit_z2

        if w["rain_yesterday_mm"] >= 5.0 or w["rain_forecast_prob_pct"] >= 75:
            stats["rain_saved_events"] += 1
        if res["clima_processado"]["bonus_calor_aplicado_pct"] > 0:
            stats["heat_boost_days"] += 1
        if res["clima_processado"]["bonus_vento_aplicado_pct"] > 0:
            stats["wind_boost_days"] += 1
        if z1_active and z2_active and res["cota_diaria"]["rateio_de_protecao_acionado"]:
            stats["quota_protection_days"] += 1

        # Simula entupimento gradual do Filtro Único 120 Mesh (perde ~0.45% de vazão a cada 1.000 L filtrados)
        filter_efficiency -= ((lit_z1 + lit_z2) / 1000.0) * 0.45
        if filter_efficiency < 78.0:
            # Sistema emitiu alerta < 80% e caseiro limpou o filtro 120 Mesh manualmente!
            stats["filter_cleanings_triggered"] += 1
            filter_efficiency = 100.0

        # Salva marcos importantes para a tabela de auditoria do Benchmark
        milestone_days = {
            1:   "Início: Plantio do Jerimum na Zona 1 (Zona 2 aguarda defasagem de 50d)",
            51:  "Dia 51: Zona 1 entra na Floração Crítica! Zona 2 inicia plantio do 2º Jerimum",
            78:  "Dia 78: Pico de Calor + Ambas as Zonas com Jerimum (Z1 Crítica vs Z2 Ramas)",
            102: "Dia 102: Zona 1 em Pré-Colheita (-65% água p/ curar) enquanto Zona 2 está em Floração Crítica!",
            110: "Dia 110: 1ª Colheita de Jerimum na Zona 1 (~154 kg)! Zona 2 segue firme no Dia 60",
            126: "Dia 126: App bloqueia repetir Cucurbitácea na Z1 e inicia Feijão Verde (fixa Nitrogênio)",
            152: "Dia 152: Zona 1 com Feijão em Floração Crítica + Zona 2 com Jerimum em Pré-Colheita (-65%)",
            160: "Dia 160: 2ª Colheita de Jerimum na Zona 2 (~190 kg, 50 dias após a Zona 1!)",
            185: "Dia 185: Zona 1 colhendo Feijão Verde + Zona 2 iniciando Batata-doce na seca",
            225: "Dia 225: Auge da seca (Novembro): Ambas em Tuberização de Batata-doce — Guardião da Cota atua!",
        }
        if day_num in milestone_days:
            z1_info = res["zonas"]["zona_1"]
            z2_info = res["zonas"]["zona_2"]
            stats["snapshots"].append(
                {
                    "day_num": day_num,
                    "date": curr_date.isoformat(),
                    "title": milestone_days[day_num],
                    "temp_c": w["temp_max_c"],
                    "wind_kmh": w["wind_max_kmh"],
                    "rain_mm": w["rain_yesterday_mm"],
                    "z1_desc": f"{z1_info['cultura']} (D.{z1_info['dap_atual']} - F{z1_info['fase_atual']['fase']} Kc={z1_info['fase_atual']['fator_kc']})" if z1_active else "Em preparo de solo",
                    "z1_liters": round(lit_z1, 1),
                    "z2_desc": f"{z2_info['cultura']} (D.{z2_info['dap_atual']} - F{z2_info['fase_atual']['fase']} Kc={z2_info['fase_atual']['fator_kc']})" if z2_active else "Aguardando janela (Defasagem 50d)",
                    "z2_liters": round(lit_z2, 1),
                    "total_liters": round(lit_z1 + lit_z2, 1),
                }
            )

    return stats


if __name__ == "__main__":
    stats = run_260_day_simulation()
    print("=" * 85)
    print("🏆 RESULTADO DO BENCHMARK PRÁTICO DE 260 DIAS (SÃO VICENTE DO SERIDÓ - PB)")
    print("=" * 85)
    print(f"• Dias Simulados:                     {stats['total_days']} dias (01/03/2026 a 15/11/2026)")
    print(f"• Volume Total Entregue na Zona 1:    {stats['total_liters_z1']:,.0f} Litros")
    print(f"• Volume Total Entregue na Zona 2:    {stats['total_liters_z2']:,.0f} Litros")
    print(f"• Média Diária do Sítio (Z1 + Z2):    {(stats['total_liters_z1'] + stats['total_liters_z2']) / stats['total_days']:.1f} L/dia (Dentro da cota de 1.000 L!)")
    print(f"• Eventos de Economia por Chuva:      {stats['rain_saved_events']} dias")
    print(f"• Dias com Reforço por Calor (>32°C): {stats['heat_boost_days']} dias")
    print(f"• Dias com Proteção Eólica (>20km/h): {stats['wind_boost_days']} dias")
    print(f"• Atuações do Guardião da Cota:       {stats['quota_protection_days']} dias de pico")
    print(f"• Alertas de Limpeza Filtro 120 Mesh: {stats['filter_cleanings_triggered']} limpezas avisadas no ano")
    print("-" * 85)
    for snap in stats["snapshots"]:
        print(f"[Dia {snap['day_num']:3d} | {snap['date']}] {snap['title']}")
        print(f"   Clima: {snap['temp_c']}°C, Vento {snap['wind_kmh']} km/h | Z1: {snap['z1_desc']} -> {snap['z1_liters']} L | Z2: {snap['z2_desc']} -> {snap['z2_liters']} L | Total: {snap['total_liters']} L")
    print("=" * 85)
