/* ============================================================================
 * Irriga.ai Pro-Duo · v1.5.2-Argon — Catálogo de Culturas & Guia de Plantio
 * ----------------------------------------------------------------------------
 * Inclui coeficientes agronômicos (Kc, raiz, Ky), regras de restrição hídrica
 * na reta final (melancia, melão, jerimum, batata-doce) e guia completo de
 * espaçamento entre ruas (fitas) e entre plantas para preparo do canteiro.
 * ========================================================================== */
(function (root) {
  const CROPS = {
    melancia: {
      nome: 'Melancia', emoji: '🍉', familia: 'Cucurbitáceas',
      dias: [20, 25, 33, 10], kc: [0.45, 1.00, 0.70], raiz_m: [0.15, 0.8], p: 0.40,
      cobertura: 0.75, ky: [0.4, 0.6, 1.1, 0.8, 0.3],
      reta_final: {
        dias: 10,
        reposicao: 0.45,              // -55% em dias secos normais
        reposicao_ameno_chuva: 0.25,  // -75% se clima ameno (<30.5°C) ou chance de chuva (>=50%)
        motivo: 'concentrar o açúcar (°Brix) e evitar que a melancia rache ou fique aguada',
      },
      espacamento_ruas_m: '1,80 m a 2,00 m entre fitas',
      espacamento_plantas_m: '0,80 m a 1,00 m entre covas',
      preparo: 'Covas com esterco bem curtido; deixe espaço livre para as ramas correrem.',
      colheita: 'Fruto pronto quando a gavinha junto ao cabinho seca e o som ao bater fica oco.',
      fases: ['Pegamento', 'Ramas correndo', 'Floração e vingamento', 'Engorda dos frutos', 'Reta final (°Brix / Restrição)'],
    },
    melao: {
      nome: 'Melão', emoji: '🍈', familia: 'Cucurbitáceas',
      dias: [18, 22, 25, 10], kc: [0.45, 1.00, 0.65], raiz_m: [0.15, 0.7], p: 0.40,
      cobertura: 0.70, ky: [0.4, 0.6, 1.1, 0.8, 0.3],
      reta_final: {
        dias: 10,
        reposicao: 0.40,              // -60% em dias secos
        reposicao_ameno_chuva: 0.20,  // -80% se clima ameno ou chance de chuva
        motivo: 'apurar a doçura (°Brix), o aroma e evitar rachaduras na casca',
      },
      espacamento_ruas_m: '1,50 m a 1,80 m entre fitas',
      espacamento_plantas_m: '0,40 m a 0,50 m entre plantas',
      preparo: 'Adora sol pleno e solo bem drenado; reduza forte a água nos 10 dias finais.',
      colheita: 'Casca muda de cor, aroma forte no pé e cabinho começa a soltar.',
      fases: ['Pegamento', 'Ramas correndo', 'Floração e pegamento', 'Crescimento dos frutos', 'Reta final (Doçura / Corte)'],
    },
    jerimum: {
      nome: 'Jerimum', emoji: '🎃', familia: 'Cucurbitáceas',
      dias: [20, 30, 30, 20], kc: [0.50, 1.00, 0.75], raiz_m: [0.15, 1.0], p: 0.35,
      cobertura: 0.80, ky: [0.4, 0.6, 1.1, 0.8, 0.3],
      reta_final: {
        dias: 15,
        reposicao: 0.50,              // -50% em dias secos
        reposicao_ameno_chuva: 0.30,  // -70% se clima ameno ou chance de chuva
        motivo: 'enxugar a polpa, firmar a casca e durar meses guardado no paiol',
      },
      espacamento_ruas_m: '2,00 m a 2,50 m entre fitas',
      espacamento_plantas_m: '1,00 m a 1,50 m entre covas',
      preparo: 'Rústico e produtivo; covas adubadas com esterco de curral e cinza.',
      colheita: 'Colha quando o cabinho secar e a casca ficar dura (resistente à unha).',
      fases: ['Pegamento', 'Ramas correndo', 'Floração e pegamento', 'Engorda dos frutos', 'Cura da casca (Restrição)'],
    },
    maxixe: {
      nome: 'Maxixe', emoji: '🥒', familia: 'Cucurbitáceas',
      dias: [20, 22, 43, 15], kc: [0.55, 1.00, 0.75], raiz_m: [0.15, 0.7], p: 0.50,
      cobertura: 0.65, ky: [0.4, 0.6, 1.1, 0.9, 0.4], colheita_continua_desde: 45,
      espacamento_ruas_m: '1,20 m a 1,50 m entre fitas',
      espacamento_plantas_m: '0,50 m a 0,60 m entre covas',
      preparo: 'Produz rápido e por muitas semanas se colhido sempre verdinho.',
      colheita: 'Colha a cada 2–3 dias com frutos ainda novos e macios (4–6 cm).',
      fases: ['Pegamento', 'Ramas correndo', 'Floração', 'Colheita contínua', 'Fim de ciclo'],
    },
    feijao_verde: {
      nome: 'Feijão verde', emoji: '🫘', familia: 'Leguminosas',
      dias: [15, 25, 25, 10], kc: [0.50, 1.05, 0.85], raiz_m: [0.15, 0.6], p: 0.45,
      cobertura: 0.80, ky: [0.2, 0.4, 1.15, 0.75, 0.2],
      espacamento_ruas_m: '0,50 m a 0,70 m entre fitas',
      espacamento_plantas_m: '0,15 m a 0,20 m (2 a 3 sementes por cova)',
      preparo: 'Excelente para plantar após melancia ou jerimum: repõe nitrogênio na terra.',
      colheita: 'Vagens cheias mas ainda verdes e macias; colha de manhã cedo.',
      fases: ['Emergência', 'Crescimento', 'Floração (crítica)', 'Enchimento das vagens', 'Ponto de colheita'],
    },
    batata_doce: {
      nome: 'Batata-doce', emoji: '🍠', familia: 'Convolvuláceas',
      dias: [15, 30, 50, 25], kc: [0.50, 1.10, 0.65], raiz_m: [0.20, 1.0], p: 0.65,
      cobertura: 0.90, ky: [0.5, 0.6, 0.9, 0.8, 0.3],
      reta_final: {
        dias: 15,
        reposicao: 0.50,
        reposicao_ameno_chuva: 0.30,
        motivo: 'secar a leira antes de arrancar, evitando rachadura e broca',
      },
      espacamento_ruas_m: '0,80 m a 1,00 m entre leiras (camalhões)',
      espacamento_plantas_m: '0,25 m a 0,30 m entre ramas',
      preparo: 'Plante as ramas em leiras altas (30 cm) de terra fofa para a batata engrossar fácil.',
      colheita: 'Arranque com a terra enxuta; folhas mais velhas amarelando indicam o ponto.',
      fases: ['Pegamento das ramas', 'Fechamento da rama', 'Formação das batatas', 'Engorda das batatas', 'Secagem pré-colheita'],
    },
    milho_verde: {
      nome: 'Milho verde', emoji: '🌽', familia: 'Poáceas',
      dias: [20, 25, 25, 10], kc: [0.40, 1.15, 1.00], raiz_m: [0.15, 0.8], p: 0.50,
      cobertura: 0.85, ky: [0.4, 0.4, 1.5, 0.5, 0.2],
      espacamento_ruas_m: '0,80 m a 0,90 m entre fitas',
      espacamento_plantas_m: '0,20 m a 0,25 m entre plantas na linha',
      preparo: 'Exige bastante água e adubo quando começa a soltar o pendão e a boneca.',
      colheita: 'Cabelo da espiga marrom-escuro e grão leitoso (ao apertar com a unha, sai leite).',
      fases: ['Emergência', 'Crescimento', 'Pendoamento e espiga (crítico)', 'Grão leitoso', 'Colheita verde'],
    },
    quiabo: {
      nome: 'Quiabo', emoji: '🌶️', familia: 'Malváceas',
      dias: [20, 30, 50, 20], kc: [0.45, 1.00, 0.80], raiz_m: [0.15, 0.8], p: 0.45,
      cobertura: 0.75, ky: [0.3, 0.5, 1.0, 0.9, 0.4], colheita_continua_desde: 55,
      espacamento_ruas_m: '0,80 m a 1,00 m entre fitas',
      espacamento_plantas_m: '0,30 m a 0,40 m entre plantas',
      preparo: 'Gosta muito do calor do Seridó; raiz funda que ajuda a descompactar a terra.',
      colheita: 'Colha com 10–12 cm (ponta quebra fácil ao dobrar), a cada 2 dias.',
      fases: ['Emergência', 'Crescimento', 'Floração', 'Colheita contínua', 'Fim de ciclo'],
    },
    coentro: {
      nome: 'Coentro', emoji: '🌿', familia: 'Apiáceas',
      dias: [10, 15, 15, 5], kc: [0.65, 1.00, 0.90], raiz_m: [0.10, 0.3], p: 0.30,
      cobertura: 0.90, ky: [0.5, 0.8, 1.0, 1.0, 0.5],
      espacamento_ruas_m: '0,20 m a 0,25 m entre fileiras no canteiro',
      espacamento_plantas_m: 'Semeio em risquinho contínuo (filete)',
      preparo: 'Canteiro bem estercado e cobertura com palhada fina até nascer.',
      colheita: 'Colha os molhos com 15–20 cm de altura, antes de espigar.',
      fases: ['Germinação', 'Primeiras folhas', 'Folhagem fechando', 'Ponto de colheita', 'Final'],
    },
    macaxeira: {
      nome: 'Macaxeira', emoji: '🥔', familia: 'Euforbiáceas',
      dias: [30, 50, 150, 60], kc: [0.35, 0.80, 0.35], raiz_m: [0.20, 0.8], p: 0.40,
      cobertura: 0.80, ky: [0.6, 0.6, 0.5, 0.4, 0.2],
      espacamento_ruas_m: '1,00 m entre linhas',
      espacamento_plantas_m: '0,60 m a 0,80 m entre manivas',
      preparo: 'Plante manivas sadias de 20 cm deitadas na cova; essencial regar bem nos primeiros 90 dias.',
      colheita: 'Arranque a partir do 8º mês conforme o consumo ou venda.',
      fases: ['Brotação das manivas', 'Formação da rama', 'Engrossamento das raízes', 'Acúmulo de amido', 'Pronta p/ arrancar'],
    },
    /* ---------- Culturas Forrageiras & Silagem (Suporte ao Gado no Seridó) ---------- */
    palma_mexicana: {
      nome: 'Palma Orelha de Elefante', emoji: '🌵', familia: 'Cactáceas',
      dias: [30, 60, 180, 90], kc: [0.20, 0.35, 0.25], raiz_m: [0.15, 0.6], p: 0.70,
      cobertura: 0.85, ky: [0.2, 0.3, 0.4, 0.3, 0.1],
      espacamento_ruas_m: '1,50 m a 2,00 m entre fileiras',
      espacamento_plantas_m: '0,40 m a 0,50 m entre raquetes (artículos)',
      preparo: 'Resistente à cochonilha-do-carmim. Plante raquetes murchas de 7 dias na vertical com a base enterrada.',
      colheita: 'Corte a cada 12–24 meses preservando os artículos basais (planta-mãe).',
      fases: ['Pegamento das raquetes', 'Brotamento inicial', 'Formação de novos artículos', 'Acúmulo de biomassa', 'Corte forrageiro'],
    },
    palma_miuda: {
      nome: 'Palma Miúda (Doce)', emoji: '🌵', familia: 'Cactáceas',
      dias: [25, 50, 160, 80], kc: [0.20, 0.35, 0.25], raiz_m: [0.15, 0.5], p: 0.70,
      cobertura: 0.80, ky: [0.2, 0.3, 0.4, 0.3, 0.1],
      espacamento_ruas_m: '1,20 m a 1,60 m entre fileiras',
      espacamento_plantas_m: '0,30 m a 0,40 m entre raquetes',
      preparo: 'Altíssima digestibilidade e teor de água para vacas leiteiras. Exige solos sem encharcamento.',
      colheita: 'Corte de desbaste ou corte total bienal mantendo a matriz basal.',
      fases: ['Enraizamento', 'Brotação intensiva', 'Ramificação', 'Maturidade forrageira', 'Ponto de corte'],
    },
    capim_capiacu: {
      nome: 'Capim BRS Capiaçu', emoji: '🌾', familia: 'Poáceas',
      dias: [20, 25, 20, 10], kc: [0.50, 1.10, 0.90], raiz_m: [0.20, 1.2], p: 0.55,
      cobertura: 0.95, ky: [0.3, 0.6, 1.1, 0.7, 0.2], colheita_continua_desde: 60,
      espacamento_ruas_m: '1,00 m a 1,20 m entre linhas de plantio',
      espacamento_plantas_m: 'Sulco contínuo com colmos sobrepostos pé-com-ponta',
      preparo: 'Capineira de alta produtividade (50 t/ha/corte de MS). Cortes sucessivos a cada 55–70 dias.',
      colheita: 'Ponto ideal de corte: altura de 3,5 a 4,2 m (cerca de 55–65 dias) para picadeira ou silagem.',
      fases: ['Rebrota / Brotamento', 'Alongamento dos colmos', 'Pleno desenvolvimento', 'Ponto de corte silagem', 'Rebrota imediata'],
    },
    capim_buffel: {
      nome: 'Capim Buffel', emoji: '🌾', familia: 'Poáceas',
      dias: [15, 20, 25, 10], kc: [0.40, 0.85, 0.60], raiz_m: [0.20, 1.0], p: 0.65,
      cobertura: 0.85, ky: [0.2, 0.4, 0.8, 0.5, 0.2], colheita_continua_desde: 45,
      espacamento_ruas_m: '0,60 m a 0,80 m entre linhas',
      espacamento_plantas_m: '0,30 m entre covas ou linha rala',
      preparo: 'O rei da resistência à seca no Seridó. Suporta pastejo direto e produz ótimo feno na seca.',
      colheita: 'Corte a 10 cm do solo no início do florescimento para feno de alto valor proteico.',
      fases: ['Perfilhamento', 'Crescimento vegetativo', 'Florescimento', 'Ponto de feno/pastejo', 'Dormência na estiagem'],
    },
    sorgo_forrageiro: {
      nome: 'Sorgo Forrageiro / Silagem', emoji: '🌾', familia: 'Poáceas',
      dias: [20, 30, 30, 15], kc: [0.40, 1.05, 0.65], raiz_m: [0.20, 1.0], p: 0.55,
      cobertura: 0.85, ky: [0.3, 0.5, 1.1, 0.7, 0.2],
      espacamento_ruas_m: '0,70 m a 0,80 m entre linhas',
      espacamento_plantas_m: '0,10 m a 0,15 m (12 a 15 plantas por metro)',
      preparo: 'Mais rústico e tolerante à estiagem que o milho. Permite 2º corte (rebrota da soca).',
      colheita: 'Colher para silagem no estádio de grão pastoso-farináceo (~85–95 dias).',
      fases: ['Emergência', 'Crescimento vegetativo', 'Emborrachamento e floração', 'Grão pastoso (ponto silagem)', 'Colheita / Rebrota'],
    },
    milho_silagem: {
      nome: 'Milho para Silagem', emoji: '🌽', familia: 'Poáceas',
      dias: [20, 25, 30, 15], kc: [0.40, 1.15, 0.85], raiz_m: [0.15, 0.9], p: 0.50,
      cobertura: 0.90, ky: [0.4, 0.4, 1.5, 0.6, 0.2],
      espacamento_ruas_m: '0,80 m entre linhas',
      espacamento_plantas_m: '0,20 m entre covas (55.000 plantas/ha)',
      preparo: 'Exige boa fertilidade e umidade contínua no florescimento. Alta concentração energética para o gado.',
      colheita: 'Ponto exato: grão na meia linha do leite (30–35% de matéria seca na planta toda).',
      fases: ['Emergência', 'Desenvolvimento vegetativo', 'Pendoamento e polinização', 'Grão farináceo (ponto silagem)', 'Colheita e picagem'],
    },
    moringa: {
      nome: 'Moringa Forrageira', emoji: '🌳', familia: 'Moringáceas',
      dias: [20, 30, 40, 20], kc: [0.40, 0.80, 0.60], raiz_m: [0.20, 1.2], p: 0.60,
      cobertura: 0.80, ky: [0.2, 0.4, 0.8, 0.6, 0.2], colheita_continua_desde: 60,
      espacamento_ruas_m: '0,80 m a 1,00 m entre fileiras',
      espacamento_plantas_m: '0,30 m a 0,50 m entre plantas',
      preparo: 'Folhas com mais de 20% de proteína bruta. Excelente banco proteico para cortar e fornecer verde ou moído.',
      colheita: 'Podas de rebaixamento a cada 45–60 dias na altura de 50 cm do solo.',
      fases: ['Brotamento', 'Ramificação rápida', 'Folhagem densa', 'Ponto de poda forrageira', 'Rebrota sucessiva'],
    },
    erva_sal: {
      nome: 'Erva-Sal (Atriplex)', emoji: '🌿', familia: 'Amarantáceas',
      dias: [30, 40, 60, 30], kc: [0.30, 0.60, 0.40], raiz_m: [0.25, 1.5], p: 0.75,
      cobertura: 0.75, ky: [0.1, 0.2, 0.4, 0.3, 0.1], colheita_continua_desde: 90,
      espacamento_ruas_m: '1,50 m a 2,00 m entre linhas',
      espacamento_plantas_m: '1,00 m entre mudas',
      preparo: 'Arbusto halófito excepcional. Tolera água salobra e solos com salinidade onde nada mais vive.',
      colheita: 'Corte dos ramos finos e folhas 2 a 3 vezes ao ano como feno ou suplemento mineral/proteico.',
      fases: ['Pegamento da muda', 'Arbustamento', 'Acúmulo de biomassa e sais', 'Poda de feno', 'Descanso e rebrota'],
    },
    guandu_forrageiro: {
      nome: 'Guandu Forrageiro', emoji: '🫘', familia: 'Leguminosas',
      dias: [20, 35, 60, 30], kc: [0.40, 0.95, 0.60], raiz_m: [0.25, 1.4], p: 0.60,
      cobertura: 0.85, ky: [0.2, 0.4, 0.9, 0.6, 0.2], colheita_continua_desde: 90,
      espacamento_ruas_m: '0,80 m a 1,00 m entre linhas',
      espacamento_plantas_m: '0,25 m a 0,30 m entre plantas',
      preparo: 'Leguminosa rústica e profunda. Fixa nitrogênio no solo e oferece forragem rica no auge da estiagem.',
      colheita: 'Corte a 40 cm de altura antes de engrossar o talho para manter alta digestibilidade.',
      fases: ['Emergência', 'Crescimento e nodulação', 'Floração e vagens', 'Poda forrageira', 'Rebrota'],
    },
  };

  /* Rotação: o que plantar depois de cada família (ordem = melhor primeiro). */
  const ROTACAO = {
    'Cucurbitáceas': ['Leguminosas', 'Poáceas', 'Convolvuláceas', 'Malváceas'],
    'Leguminosas': ['Cucurbitáceas', 'Poáceas', 'Malváceas'],
    'Convolvuláceas': ['Leguminosas', 'Cucurbitáceas', 'Poáceas'],
    'Poáceas': ['Leguminosas', 'Cucurbitáceas', 'Convolvuláceas'],
    'Malváceas': ['Leguminosas', 'Poáceas', 'Cucurbitáceas'],
    'Apiáceas': ['Leguminosas', 'Cucurbitáceas'],
    'Euforbiáceas': ['Leguminosas', 'Cucurbitáceas'],
    'Cactáceas': ['Leguminosas', 'Poáceas'],
    'Moringáceas': ['Poáceas', 'Cucurbitáceas'],
    'Amarantáceas': ['Leguminosas', 'Poáceas'],
  };
  const MOTIVO_ROTACAO = {
    'Leguminosas': 'devolve nitrogênio para a terra de graça',
    'Cucurbitáceas': 'aproveita o nitrogênio deixado na terra',
    'Poáceas': 'raiz em cabeleira solta a terra e corta pragas',
    'Convolvuláceas': 'forra o chão e busca adubo mais fundo',
    'Malváceas': 'raiz forte que abre caminho no solo',
    'Cactáceas': 'altíssima reserva de água e biomassa para a seca',
    'Moringáceas': 'banco de proteína foliar concentrada',
    'Amarantáceas': 'recupera solo com sal e fornece minerais',
  };

  const api = { CROPS, ROTACAO, MOTIVO_ROTACAO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IrrigaCrops = api;
})(typeof window !== 'undefined' ? window : globalThis);
