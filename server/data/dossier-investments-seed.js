/**
 * Dossiê oficial — 14 municípios (fonte: relatório HTML de referência).
 * Formato: { nome, grupos:[{ tag, label, itens:[{ d, v }] }], nota? }
 */
module.exports = [
  {
    nome: 'Alto Araguaia',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Doação, articulação e aquisição de maquinários', v: 1030556.0 },
          { d: 'Construção de nova unidade escolar — EE Arlinda Pessoa Morbeck', v: 6274827.53 },
          { d: 'Micro revestimento em vias públicas (180.247,29 m²)', v: 4000000.0 },
          { d: 'Ponte de concreto sobre o Ribeirão Gato Preto, MT-481 (60 m)', v: 9163754.43 },
        ],
      },
      {
        tag: 'saude',
        label: 'Saúde',
        itens: [
          { d: 'Investimento para a saúde', v: 100000.0 },
          { d: 'Custeio da saúde', v: 100000.0 },
          { d: 'Custeio da saúde', v: 500000.0 },
          { d: 'Custeio da saúde', v: 1000000.0 },
        ],
      },
    ],
  },
  {
    nome: 'Alto Garças',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Quadra poliesportiva com vestiário e ampliação de banheiros — EM Carlos de Almeida Couto', v: 2281996.31 },
          { d: 'Reforma da EE Dr. Ytrio Corrêa', v: 2950462.62 },
          { d: 'Ponte de concreto sobre o Ribeirão Café, MT-107 (60,55 m)', v: 4311641.47 },
          { d: 'Microrevestimento em vias urbanas (41.213,40 m²)', v: 3735432.35 },
          { d: 'Construção de praça', v: 1500000.0 },
        ],
      },
      {
        tag: 'saude',
        label: 'Saúde',
        itens: [{ d: 'Custeio da saúde', v: 700000.0 }],
      },
    ],
  },
  {
    nome: 'Alto Taquari',
    nota: 'Quatro itens de infraestrutura (pontes, quadra, reforma e microrrevestimento) aparecem no documento original tanto em Alto Taquari quanto em Alto Garças — possível duplicidade na fonte, mantida conforme o texto original.',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Articulação de maquinário (caminhão-pipa)', v: 571800.0 },
          { d: 'Praça no bairro Morada da Praia + Casa Lar para crianças e adolescentes', v: 1500000.0 },
          { d: 'Reforma da EM José Inácio Simão', v: 818904.29 },
          { d: 'Ponte de concreto sobre o Ribeirão Café, MT-107 (60,55 m)', v: 4311641.47 },
          { d: 'Pavimentação asfáltica — Estradas Netinho, Gueroba e Pirituba (14,64 km)', v: 4380212.52 },
          { d: 'Quadra poliesportiva com vestiário e ampliação de banheiros — EM Carlos de Almeida Couto', v: 2281996.31 },
          { d: 'Pavimentação e drenagem — loteamento São José (19.501,86 m)', v: 4000000.0 },
          { d: 'Reforma da EE Dr. Ytrio Corrêa', v: 2950462.62 },
          { d: 'Microrevestimento em vias urbanas (41.213,40 m²)', v: 3735432.35 },
          { d: 'Conservação e restauração de pavimento — diversas ruas/avenidas (52.430,43 m)', v: 4546932.79 },
        ],
      },
      {
        tag: 'saude',
        label: 'Saúde',
        itens: [
          { d: 'Investimento para a saúde', v: 150000.0 },
          { d: 'Investimento para a saúde', v: 200000.0 },
          { d: 'Investimento para a saúde', v: 150000.0 },
          { d: 'Investimento para a saúde', v: 300000.0 },
        ],
      },
    ],
  },
  {
    nome: 'Araguaiana',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Viabilizou — Caminhão-pipa 15.000L, 280cv', v: 571800.0 },
          { d: 'Viabilizou — Retroescavadeira 92 HP', v: 303500.0 },
          { d: 'Pavimentação asfáltica, drenagem e sinalização viária (50.211,60 m²)', v: 3098238.57 },
          { d: 'Material de construção para 50 casas — famílias em vulnerabilidade social', v: 4947576.76 },
        ],
      },
      {
        tag: 'saude',
        label: 'Saúde',
        itens: [{ d: 'Custeio da saúde', v: 300000.0 }],
      },
    ],
  },
  {
    nome: 'Araguainha',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Doação — Caminhão-pipa 15.000L, 280cv', v: 571800.0 },
          { d: 'Doação — Caminhão basculante 12 m³', v: 638000.0 },
          { d: 'Ponte de concreto sobre o Córrego Bisca, MT-340 (30,50 m)', v: 2839999.59 },
          { d: 'Pavimentação em concreto — continuação da Av. Fernando Correia da Costa (10.600 m²)', v: 1926032.81 },
          { d: 'Viabilizou — Pick-up Hilux 2 portas, 204cv', v: 230000.0 },
          { d: 'Material para pavimentação em concreto simples (20.448,72 m²)', v: 1700269.05 },
          { d: 'Reforma da EM Paulo Lopes Teixeira', v: 2095747.43 },
          { d: 'Material de construção para 50 casas — famílias em vulnerabilidade social', v: 4920749.82 },
        ],
      },
      {
        tag: 'saude',
        label: 'Saúde',
        itens: [{ d: 'Aquisição de motos para agentes de saúde', v: 200000.0 }],
      },
    ],
  },
  {
    nome: 'Campinápolis',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Pavimentação asfáltica, drenagem e sinalização viária (17.895,90 m²)', v: 4029000.0 },
          { d: 'Material de construção para 50 casas — famílias em vulnerabilidade social', v: 7199582.19 },
        ],
      },
      {
        tag: 'saude',
        label: 'Saúde',
        itens: [
          { d: 'Investimento para a saúde', v: 350000.0 },
          { d: 'Investimento para a saúde', v: 400000.0 },
          { d: 'Investimento para a saúde', v: 500000.0 },
          { d: 'Investimento para a saúde', v: 1000000.0 },
        ],
      },
      {
        tag: 'agro',
        label: 'Agricultura',
        itens: [
          { d: 'Investimento para a agricultura', v: 250000.0 },
          { d: 'Investimento para a agricultura', v: 150000.0 },
        ],
      },
    ],
  },
  {
    nome: 'General Carneiro',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Doação — Pick-up Montana, 141cv', v: 130852.0 },
          { d: 'Quadra poliesportiva — EE Dr. João Ponce de Arruda', v: 1427760.11 },
          { d: 'Ponte de concreto sobre o Córrego do Macaco (155 m)', v: 1800000.0 },
          { d: 'Material de construção para 44 casas — famílias em vulnerabilidade social', v: 4157716.3 },
          { d: 'Passeio público em diversas ruas', v: 1939544.91 },
        ],
      },
      {
        tag: 'saude',
        label: 'Saúde',
        itens: [{ d: 'Custeio da saúde', v: 1000000.0 }],
      },
    ],
  },
  {
    nome: 'Nova Xavantina',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Doação — Pá carregadeira, 125hp', v: 333330.0 },
          { d: 'Doação — Caminhão basculante 12 m³', v: 638000.0 },
          { d: 'Doação — Caminhão cavalo mecânico 525cv c/ semirreboque basculante 20 m³', v: 993000.0 },
          { d: 'Viabilizou — Retroescavadeira', v: 303500.0 },
          { d: 'Pavimentação asfáltica e sinalização — Estrada NX-100 (13,877 km)', v: 6238316.13 },
          { d: 'Construção de 50 casas — famílias em vulnerabilidade social', v: 4820148.78 },
        ],
      },
      {
        tag: 'saude',
        label: 'Saúde',
        itens: [
          { d: 'Investimento para a saúde', v: 300000.0 },
          { d: 'Implantação de sala sensorial', v: 170000.0 },
        ],
      },
    ],
  },
  {
    nome: 'Novo São Joaquim',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Doação — Pá carregadeira, 125hp', v: 333330.0 },
          { d: 'Doação — Caminhão basculante 12 m³', v: 638000.0 },
          { d: 'Viabilizou — Pá carregadeira', v: 333330.0 },
          { d: 'Restauração de pavimento em vias urbanas (122.253,38 m²)', v: null },
          { d: 'Restauração de pavimento — tapa-buraco e microrrevestimento (109.159,46 m²)', v: 2329058.3 },
          { d: 'Ponte de concreto sobre o Rio das Mortes, MT-474 (153,20 m)', v: 11186505.0 },
        ],
      },
      {
        tag: 'agro',
        label: 'Agricultura',
        itens: [
          { d: 'Aquisição de trator', v: 105000.0 },
          { d: 'Aquisição de trator, plantadeira e adubadeira de 4 linhas', v: 153000.0 },
        ],
      },
    ],
  },
  {
    nome: 'Pontal do Araguaia',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Material de construção para 50 casas — famílias em vulnerabilidade social', v: 4630383.43 },
          { d: 'Construção de complexo esportivo público', v: 1500000.0 },
          { d: 'Revitalização da Avenida Universitária (30.223,14 m²)', v: 2900000.0 },
        ],
      },
      {
        tag: 'saude',
        label: 'Saúde',
        itens: [{ d: 'Custeio da saúde', v: 300000.0 }],
      },
      {
        tag: 'fundiaria',
        label: 'Regularização Fundiária',
        itens: [{ d: 'Investimento em regularização fundiária', v: 250000.0 }],
      },
    ],
  },
  {
    nome: 'Ponte Branca',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Doação — Caminhão basculante 12 m³', v: 638000.0 },
          { d: 'Doação — Pick-up Montana, 141cv', v: 130852.0 },
          { d: 'Construção de Escola Nova', v: 7232802.62 },
          { d: 'Iluminação pública — Av. João Nogueira', v: 388477.19 },
          { d: 'Material de construção para 50 casas — famílias em vulnerabilidade social', v: 4822297.02 },
        ],
      },
      {
        tag: 'saude',
        label: 'Saúde',
        itens: [{ d: 'Custeio da saúde', v: 250000.0 }],
      },
    ],
  },
  {
    nome: 'Ribeirão Cascalheira',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Viabilizou — Pá carregadeira', v: 333330.0 },
          { d: 'Manutenção e conservação de rodovias estaduais não pavimentadas (72,37 km)', v: 2369029.47 },
        ],
      },
      {
        tag: 'saude',
        label: 'Saúde',
        itens: [
          { d: 'Custeio da saúde', v: 500000.0 },
          { d: 'Aquisição de equipamento de Raio-X', v: 200000.0 },
          { d: 'Custeio da saúde', v: 150000.0 },
        ],
      },
    ],
  },
  {
    nome: 'Ribeirãozinho',
    nota: 'Nenhum investimento em saúde consta para este município na fonte original.',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Doação — Pá carregadeira, 125hp', v: 333330.0 },
          { d: 'Doação — Caminhão basculante 12 m³', v: 638000.0 },
          { d: 'Doação — Caminhão cavalo mecânico 525cv c/ semirreboque basculante 20 m³', v: 993000.0 },
          { d: 'Viabilizou — Rolo compactador 114 HP', v: 417500.0 },
          { d: 'Pavimentação urbana, drenagem e sinalização (23.201,40 m²)', v: 3286858.46 },
          { d: 'Material de construção para 50 casas — famílias em vulnerabilidade social', v: 4822297.02 },
        ],
      },
    ],
  },
  {
    nome: 'Torixoréu',
    nota: 'Nenhum investimento em saúde consta para este município na fonte original.',
    grupos: [
      {
        tag: 'infra',
        label: 'Infraestrutura',
        itens: [
          { d: 'Doação — Caminhão basculante 12 m³', v: 638000.0 },
          { d: 'Doação — Retroescavadeira 92 HP', v: 303500.0 },
          { d: 'Viabilizou — Escavadeira hidráulica 175 HP', v: 620000.0 },
          { d: 'Material de construção para 50 casas — famílias em vulnerabilidade social', v: 5329071.11 },
          { d: 'Pavimentação asfáltica em diversas vias (32.145,57 m²)', v: 5000000.0 },
        ],
      },
      {
        tag: 'agro',
        label: 'Agricultura',
        itens: [
          { d: 'Aquisição de trator, plantadeira e adubadeira de 4 linhas', v: 153000.0 },
        ],
      },
    ],
  },
];
