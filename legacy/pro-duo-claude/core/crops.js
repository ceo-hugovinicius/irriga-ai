/* ============================================================================
 * Irriga.ai Pro-Duo · edição Claude — Catálogo de culturas
 * ----------------------------------------------------------------------------
 * Fonte dos coeficientes: FAO-56 (Tabelas 11, 12 e 22) e FAO-33 (Ky), ajustados
 * para ciclo curto no Semiárido (BSh). Cada cultura tem 4 estágios FAO
 * (inicial, desenvolvimento, intermediário, final). O estágio intermediário é
 * dividido em dois para o usuário: floração/pegamento (crítico) e enchimento.
 *
 *   kc:      [Kc_ini, Kc_mid, Kc_end]   (curva contínua, interpolada)
 *   dias:    [ini, dev, mid, late]       (soma = ciclo)
 *   raiz_m:  [Zr_min, Zr_max]            (raiz cresce até o fim do 'dev')
 *   p:       fração da água disponível que a planta pode usar sem estresse
 *   cobertura: cobertura máxima do solo pela copa (corrige Kc no gotejo)
 *   ky:      [ini, dev, floração, enchimento, final] (sensibilidade à falta d'água)
 *   reta_final: déficit controlado nos últimos dias (doçura / cura / pele)
 * ========================================================================== */
(function (root) {
  const CROPS = {
    melancia: {
      nome: 'Melancia', emoji: '🍉', familia: 'Cucurbitáceas',
      dias: [20, 25, 33, 10], kc: [0.40, 1.00, 0.75], raiz_m: [0.15, 0.8], p: 0.40,
      cobertura: 0.70, ky: [0.4, 0.6, 1.1, 0.8, 0.3],
      reta_final: { dias: 10, reposicao: 0.5, motivo: 'concentrar açúcar (°Brix) e evitar rachar' },
      colheita: 'Fruto pronto quando a gavinha junto ao pedúnculo seca e o som fica oco.',
      fases: ['Pegamento', 'Ramas correndo', 'Floração e pegamento dos frutos', 'Engorda dos frutos', 'Maturação (°Brix)'],
    },
    jerimum: {
      nome: 'Jerimum', emoji: '🎃', familia: 'Cucurbitáceas',
      dias: [20, 30, 30, 20], kc: [0.50, 1.00, 0.80], raiz_m: [0.15, 1.0], p: 0.35,
      cobertura: 0.75, ky: [0.4, 0.6, 1.1, 0.8, 0.3],
      reta_final: { dias: 15, reposicao: 0.6, motivo: 'firmar a casca e melhorar a conservação' },
      colheita: 'Colha com o pedúnculo seco e a casca resistente à unha.',
      fases: ['Pegamento', 'Ramas correndo', 'Floração e pegamento', 'Engorda dos frutos', 'Cura da casca'],
    },
    maxixe: {
      nome: 'Maxixe', emoji: '🥒', familia: 'Cucurbitáceas',
      dias: [20, 22, 43, 15], kc: [0.60, 1.00, 0.75], raiz_m: [0.15, 0.7], p: 0.50,
      cobertura: 0.60, ky: [0.4, 0.6, 1.1, 0.9, 0.4], colheita_continua_desde: 45,
      colheita: 'Colheita a cada 2–3 dias com frutos tenros (4–6 cm).',
      fases: ['Pegamento', 'Ramas correndo', 'Floração', 'Colheita contínua', 'Fim de ciclo'],
    },
    feijao_verde: {
      nome: 'Feijão verde', emoji: '🫘', familia: 'Leguminosas',
      dias: [15, 25, 25, 10], kc: [0.50, 1.05, 0.90], raiz_m: [0.15, 0.6], p: 0.45,
      cobertura: 0.80, ky: [0.2, 0.4, 1.15, 0.75, 0.2],
      colheita: 'Vagens cheias e ainda verdes; colha de manhã cedo.',
      fases: ['Emergência', 'Crescimento', 'Floração (crítica)', 'Enchimento das vagens', 'Colheita'],
    },
    batata_doce: {
      nome: 'Batata-doce', emoji: '🍠', familia: 'Convolvuláceas',
      dias: [15, 30, 50, 25], kc: [0.50, 1.15, 0.65], raiz_m: [0.20, 1.0], p: 0.65,
      cobertura: 0.90, ky: [0.5, 0.6, 0.9, 0.8, 0.3],
      reta_final: { dias: 20, reposicao: 0.6, motivo: 'evitar rachadura e melhorar a conservação' },
      colheita: 'Arranque com solo seco; ramas amarelando indicam ponto.',
      fases: ['Pegamento das ramas', 'Crescimento da rama', 'Início da tuberização (crítica)', 'Engorda das batatas', 'Maturação'],
    },
    milho_verde: {
      nome: 'Milho verde', emoji: '🌽', familia: 'Poáceas',
      dias: [20, 25, 25, 10], kc: [0.30, 1.15, 1.05], raiz_m: [0.15, 0.8], p: 0.50,
      cobertura: 0.85, ky: [0.4, 0.4, 1.5, 0.5, 0.2],
      colheita: 'Cabelo escuro e grão leitoso (unha solta leite).',
      fases: ['Emergência', 'Crescimento', 'Pendoamento e espigamento (crítico)', 'Grão leitoso', 'Colheita'],
    },
    quiabo: {
      nome: 'Quiabo', emoji: '🌶️', familia: 'Malváceas',
      dias: [20, 30, 50, 20], kc: [0.40, 1.00, 0.80], raiz_m: [0.15, 0.8], p: 0.45,
      cobertura: 0.70, ky: [0.3, 0.5, 1.0, 0.9, 0.4], colheita_continua_desde: 55,
      colheita: 'Colha frutos com 10–12 cm, a cada 2 dias.',
      fases: ['Emergência', 'Crescimento', 'Floração', 'Colheita contínua', 'Fim de ciclo'],
    },
    coentro: {
      nome: 'Coentro', emoji: '🌿', familia: 'Apiáceas',
      dias: [10, 15, 15, 5], kc: [0.70, 1.00, 0.95], raiz_m: [0.10, 0.3], p: 0.30,
      cobertura: 0.90, ky: [0.5, 0.8, 1.0, 1.0, 0.5],
      colheita: 'Corte com 15–20 cm, antes de pendoar.',
      fases: ['Germinação', 'Folhas', 'Folhagem plena', 'Ponto de corte', 'Pendoamento'],
    },
    macaxeira: {
      nome: 'Macaxeira', emoji: '🥔', familia: 'Euforbiáceas',
      dias: [30, 50, 150, 60], kc: [0.30, 0.80, 0.30], raiz_m: [0.20, 0.8], p: 0.40,
      cobertura: 0.80, ky: [0.6, 0.6, 0.5, 0.4, 0.2],
      colheita: 'Colha entre 8 e 12 meses; prove o cozimento de uma planta.',
      fases: ['Brotação', 'Formação da copa', 'Engrossamento das raízes', 'Acúmulo de amido', 'Repouso'],
    },
  };

  /* Rotação: o que plantar depois de cada família (ordem = melhor primeiro). */
  const ROTACAO = {
    'Cucurbitáceas': ['Leguminosas', 'Poáceas', 'Convolvuláceas'],
    'Leguminosas': ['Cucurbitáceas', 'Poáceas', 'Malváceas'],
    'Convolvuláceas': ['Leguminosas', 'Cucurbitáceas'],
    'Poáceas': ['Leguminosas', 'Cucurbitáceas'],
    'Malváceas': ['Leguminosas', 'Poáceas'],
    'Apiáceas': ['Leguminosas', 'Cucurbitáceas'],
    'Euforbiáceas': ['Leguminosas'],
  };
  const MOTIVO_ROTACAO = {
    'Leguminosas': 'devolve nitrogênio ao solo de graça',
    'Cucurbitáceas': 'aproveita o nitrogênio deixado pela leguminosa',
    'Poáceas': 'raiz em cabeleira estrutura o solo e quebra ciclo de pragas',
    'Convolvuláceas': 'cobre o solo e explora camada mais funda',
    'Malváceas': 'raiz pivotante descompacta',
  };

  const api = { CROPS, ROTACAO, MOTIVO_ROTACAO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IrrigaCrops = api;
})(typeof window !== 'undefined' ? window : globalThis);
