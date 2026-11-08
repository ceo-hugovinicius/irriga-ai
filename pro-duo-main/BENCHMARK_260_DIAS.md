# Benchmark 260 dias — v1.0-Argon × v1.5-Argon (motor FAO-56 Claude)

> Gerado por `node sim/simular_safra.js` (semente 20261107). Mesmo clima sintético do Seridó,
> mesma física de solo (FAO-56) para as duas políticas. Chuva no período: **510 mm**,
> com **7 pancadas localizadas** que o satélite não enxergou.

Cenário (igual ao benchmark da v1.0-Argon): Jerimum na Zona 1 (dia 1) e na Zona 2 (dia 51, defasado),
depois rotação Feijão verde → Milho verde (Z1) e Batata-doce (Z2). Cota 1.000 L/dia.

| Indicador | v1.0-Argon | v1.5-Argon | Diferença |
|---|---:|---:|---:|
| Água total aplicada | 183.373 L | 194.252 L | **6%** |
| Média por dia | 705 L | 747 L | |
| Água perdida (passou da raiz) | 23.762 L | 18.712 L | **-21%** |
| Zona-dias com planta em estresse | 37 | 31 | |
| Produtividade relativa média (FAO-33) | 92% | 97% | |
| Litros por 1% de produtividade | 398 | 402 | |
| Relatos "☔ Choveu aqui" usados | — | 1 | |

## Produtividade relativa por ciclo (100% = sem falta d'água)

| Ciclo | v1.0-Argon | v1.5-Argon |
|---|---:|---:|
| Zona 1 · Jerimum (2026-11-07) | 77% | 97% |
| Zona 2 · Jerimum (2026-12-27) | 100% | 95% |
| Zona 1 · Feijão verde (2027-02-15) | 100% | 100% |
| Zona 1 · Milho verde (2027-05-01) | 100% | 91% |
| Zona 2 · Batata-doce (2027-04-06) | 85% | 100% |

## Por que a diferença
1. **Lâmina fixa × balanço do solo.** A v1.0 aplicava a lâmina da fase todo dia, chova ou faça sol; o excedente atravessava a raiz e se perdia. A v1.5-Argon só devolve o que o solo perdeu.
2. **Calor e vento na medida certa.** A ET0 (Penman-Monteith) já inclui calor e vento; somar +20%/+10% fixos por cima gerava água excedente. Na v1.5-Argon, os indicadores de calor e vento aparecem como luzes-espia clicáveis no painel enquanto o balde FAO-56 calcula a reposição exata.
3. **Gotejo molha só uma faixa.** O coeficiente Kr corrige a demanda enquanto a copa ainda não cobre o chão — muda pequena não bebe como lavoura fechada.
4. **Chuva guardada.** Chuva de ontem fica no "balde" e é consumida aos poucos, em vez de um desconto de um dia só. Pancadas locais entram pelo botão ☔.
5. **Água escassa vai para quem perde mais.** Quando a cota aperta, o rateio usa o Ky (FAO-33) de cada fase, não um "crítico/não crítico" binário.

> [!IMPORTANT]
> Em junho/julho este cenário pede ~1.500 L/dia (milho + batata-doce no pico) para uma cota de 1.000 L.
> Nenhuma regra resolve isso por inteiro: a v1.0 salva o milho e sacrifica a batata-doce (74%); a v1.5-Argon
> divide pelo Ky e protege a batata em engorda, que perde mais por litro faltante (milho já em grão leitoso).
> No app, o assistente **"Quando plantar?"** detecta esse choque **antes do plantio** e sugere a data que cabe na cota.

> [!NOTE]
> Clima sintético calibrado nas normais do Seridó; os números servem para comparar políticas, não para prever a safra real.
