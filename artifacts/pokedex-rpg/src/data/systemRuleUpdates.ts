type RuleBlock = {
  id: string;
  type: string;
  text: string;
  properties?: Record<string, unknown>;
  richText?: [string, unknown[]?][] | null;
  children?: RuleBlock[];
};

const makeBlock = (type: string, id: string, text: string): RuleBlock => ({
  id,
  type,
  text,
  properties: { title: [[text]] },
  richText: [[text]],
});

const heading2 = (id: string, text: string) => makeBlock('heading_2', id, text);
const heading3 = (id: string, text: string) => makeBlock('heading_3', id, text);
const paragraph = (id: string, text: string) => makeBlock('paragraph', id, text);
const bullet = (id: string, text: string) => makeBlock('bulleted_list_item', id, text);
const numbered = (id: string, text: string) => makeBlock('numbered_list_item', id, text);

export const HIDDEN_SYSTEM_RULE_DOCUMENT_IDS = new Set([
  '3554bb16-8489-8042-8759-ecab1165fd70',
  '38d4bb16-8489-80ff-9479-c1357f0d02c0',
  '3f14bb16-8489-8091-9449-e9fb4ebccc68',
  '3f14bb16-8489-802d-9fb3-c211bca17042',
  '3544bb16-8489-809e-88f1-ff30ab196ffe',
  '3544bb16-8489-8057-b3b3-ef4d3f9dc31d',
]);

export const SYSTEM_DOCUMENT_METADATA_OVERRIDES: Record<string, Record<string, unknown>> = {
  '3544bb16-8489-808e-a195-c0c18d54e9c9': {
    title: 'Contest',
    navTitle: 'Contest',
    subsection: null,
  },
};

export const SYSTEM_RULE_DOCUMENTS = [
  {
    id: 'system-rule-pokemon-human',
    title: 'Pokémon x humano',
    navTitle: 'Pokémon x humano',
    section: 'Sistema',
    subsection: 'Combate',
    kind: 'rule',
    references: [],
  },
  {
    id: 'system-rule-updated-statistics',
    title: 'Estatísticas e evolução',
    navTitle: 'Estatísticas e evolução',
    section: 'Pokémon',
    subsection: 'Status',
    kind: 'rule',
    references: [],
  },
];

export const SYSTEM_DOCUMENT_BLOCK_OVERRIDES: Record<string, RuleBlock[]> = {
  '3544bb16-8489-808e-a195-c0c18d54e9c9': [
    heading2('contest-overview', 'Estrutura e inscrição'),
    paragraph('contest-intro', 'O Contest é uma competição de apresentações. Cada participante inscreve um Treinador e o Pokémon que participará; é necessário apresentar um Passe de Contest ou pagar a taxa de inscrição definida pelo evento.'),
    bullet('contest-host-details', 'Antes do evento, a organização informa local e horário, tipos de Contest exigidos, tema da apresentação, limite de Pokémon, número de rodadas, jurados e condições especiais, como fantasias ou acessórios.'),
    heading3('contest-types', 'Tipos de Contest'),
    bullet('contest-type-list', 'Os cinco tipos são Beleza (:pk_beauty:), Estilo (:pk_cool:), Fofo (:pk_cute:), Inteligência (:pk_smart:) e Carisma/Fortaleza (:pk_tough:).'),
    paragraph('contest-type-rule', 'Vale o tipo de Contest da apresentação, não o tipo elemental do movimento. Ações ou movimentos que não correspondam ao tipo exigido geram metade da Atenção normal.'),
    bullet('contest-repeat-rule', 'Repetir o mesmo movimento em apresentações consecutivas reduz a Atenção obtida: a 1ª repetição reduz 1/4; a 2ª, 2/4; e da 3ª em diante, 3/4. O limite permanece em 3/4 até que outro movimento quebre a sequência. Aplique a penalidade de repetição depois do modificador por tipo.'),
    heading2('contest-presentations', 'Apresentações e testes'),
    numbered('contest-round-action', 'Em cada rodada, o participante descreve a apresentação completa. O Mestre escolhe a perícia ou teste apropriado e a DT com base na ação; também informa a Atenção máxima possível.'),
    bullet('contest-judges-bonus', 'A partir da 2ª rodada, o teste recebe um bônus igual à metade da soma das notas dos jurados na rodada anterior.'),
    bullet('contest-success', 'Em caso de sucesso, a Atenção obtida é 2d4 + (resultado do teste − DT) / 2.'),
    bullet('contest-failure', 'Em caso de falha, perca a quantidade de Atenção que teria sido obtida com o sucesso; o bônus ou a penalidade proveniente da diferença entre resultado e DT é dividido por 5, em vez de 2.'),
    bullet('contest-comeback', 'Se falhou na apresentação anterior, pode gastar PE na mesma quantidade da parcela do bônus dos jurados da rodada retrasada que deseja conservar para o teste atual. Se terminar esta apresentação em 1º lugar, torna-se o centro das atenções.'),
    heading3('contest-streak', 'Sequência e centro das atenções'),
    bullet('contest-streak-rule', 'Uma sequência é mantida quando a colocação melhora ou se mantém em relação à rodada anterior. A cada rodada consecutiva, acrescente +1 dado à rolagem de Atenção. Manter a sequência por pelo menos metade das rodadas do Contest torna o participante o centro das atenções.'),
    bullet('contest-center-rule', 'Estar no centro das atenções dobra os ganhos e as perdas de Atenção. Esse estado pode ser concedido por mais de uma regra ao mesmo tempo.'),
    heading2('contest-resource-scoring', 'Recursos e pontuação'),
    bullet('contest-pp-rule', 'No início de cada apresentação, os Pokémon participantes recuperam o PP até o máximo. Movimentos utilizados consomem PP normalmente. O PE do Treinador é acompanhado ao longo de todo o Contest e não é restaurado entre rodadas.'),
    bullet('contest-round-score', 'Ao fim de cada rodada, os três primeiros colocados recebem, na pontuação final, +1/4 da Atenção obtida naquela rodada. Para cada posição abaixo do 3º lugar, o participante recebe +1#d20 no próximo teste de apresentação (4º: +1#d20; 5º: +2#d20, e assim por diante).'),
    bullet('contest-final-score', 'A pontuação final é: (Atenção total acumulada × 2) + soma de todas as notas dos jurados.'),
  ],
  'system-rule-pokemon-human': [
    heading2('human-damage', 'Dano e nocaute'),
    bullet('human-damage-pokemon', 'Dano causado por um Pokémon a um humano é reduzido à metade. Dano causado por um humano a um Pokémon não é reduzido.'),
    bullet('human-knockout', 'Quando um Pokémon reduz um humano a 0 PV, ele fica nocauteado. Se o dano que o levou a 0 PV for igual ou superior ao dobro do PV máximo do humano, o humano morre.'),
    bullet('human-other-damage', 'Dano de terreno, clima e condições de estado não é reduzido. Movimentos que causam nocaute instantâneo também nocauteiam humanos.'),
    heading2('human-stages', 'Estágios de atributos em humanos'),
    paragraph('human-stages-intro', 'Ao aplicar um aumento ou redução de estágio de um Pokémon a um humano, converta o atributo afetado conforme esta tabela:'),
    bullet('human-stage-atk', 'ATK → FOR (Força).'),
    bullet('human-stage-spatk', 'SP.ATK → INT (Inteligência).'),
    bullet('human-stage-def', 'DEF → VIG (Vigor).'),
    bullet('human-stage-spdef', 'SP.DEF → VON (Vontade).'),
    bullet('human-stage-spe', 'SPE → AGI (Agilidade).'),
    bullet('human-stage-accuracy', 'Precisão (ACC) → testes de ataque.'),
    bullet('human-stage-evasion', 'Evasiva → testes de Esquiva.'),
    bullet('human-stage-crit', 'Crítico → taxa de crítico.'),
    paragraph('human-stage-effect', 'Cada estágio concede ou remove 1#d20 nos testes do atributo ou ação correspondente. Para crítico, cada estágio positivo aumenta a taxa de crítico em 2; cada estágio negativo a reduz em 2.'),
    heading2('human-conditions', 'Condições de estado'),
    bullet('human-poison', 'Envenenamento, envenenamento grave, queimadura e congelamento por gelo causam o mesmo dano em humanos que em Pokémon. Sono e congelamento mantêm seus efeitos normais.'),
    bullet('human-paralysis', 'Paralisia reduz à metade os testes de AGI e FOR. No início de cada turno, faça um teste de Fortitude contra DT 25 − 2 para cada rodada em que o humano esteve paralisado; em caso de sucesso, a condição termina.'),
    bullet('human-confusion', 'Confusão inverte o resultado do dado (por exemplo, 19 equivale a 2). Não role dados adicionais nem escolha o pior resultado.'),
    bullet('human-flinch', 'Atordoamento faz o humano perder a ação atual; se o efeito acontecer depois de sua ação, ele perde a próxima ação.'),
    bullet('human-rage', 'Irritado obriga o humano a atacar. No início de cada turno, faça um teste de Determinação contra DT 25 − 2 para cada rodada sob o efeito; em caso de sucesso, a condição termina.'),
    bullet('human-other-conditions', 'As demais condições mantêm seus efeitos normais em humanos. Cura Bloqueada impede cura e Rugido força a fuga.'),
  ],
  'system-rule-updated-statistics': [
    heading2('updated-ev', 'EV por nível'),
    bullet('updated-ev-gain', 'Ao subir de nível, o Pokémon recebe 3 EVs para distribuir entre suas estatísticas.'),
    bullet('updated-ev-cap', 'O limite de EVs em cada estatística é 2 × o nível atual do Pokémon.'),
    heading2('updated-iv', 'IV e dados'),
    paragraph('updated-iv-map', 'O IV define os dados-base da estatística: D (valor 1) = 0#d20; C (2–8) = 1#d20; B (9–17) = 2#d20; A (18–24) = 3#d20; S (25–30) = 4#d20; SS (31) = 5#d20. A natureza pode acrescentar ou retirar dados conforme a regra de Natureza.'),
    heading2('updated-stat-formula', 'Estatística e bônus'),
    bullet('updated-stat-total', 'Estatística final = Base + EV distribuído.'),
    bullet('updated-stat-bonus', 'Bônus da estatística = piso da estatística final ÷ 10; se o resto da divisão for maior que 5, acrescente +1.'),
    heading2('updated-stages', 'Estágios de SPE e Evasiva'),
    bullet('updated-spe-stage', 'Cada estágio positivo de SPE multiplica a Iniciativa por 1,5; cada estágio negativo divide a Iniciativa por 1,5. A aplicação é multiplicativa por estágio.'),
    bullet('updated-evasion-stage', 'Cada estágio de Evasiva altera a Esquiva em +5 ou −5.'),
    heading2('updated-critical-damage', 'Dano crítico físico'),
    paragraph('updated-critical-damage-rule', 'Quando um Pokémon acerta um crítico com um movimento físico, dobre o bônus de dano físico do Pokémon somado à rolagem. Não dobre o dano-base do movimento nem o bônus de STAB por esta regra.'),
  ],
};

export const SYSTEM_BLOCK_TEXT_OVERRIDES: Record<string, string> = {
  '3554bb16-8489-8064-aeae-de7d7cbdb569': 'Ao subir de nível, o Pokémon recebe +3 EVs para distribuir. O limite de EVs em cada estatística é 2 × o nível atual do Pokémon.',
  '3554bb16-8489-8096-a296-d1e600ca664f': 'Cada estágio positivo multiplica a Iniciativa por 1,5; cada estágio negativo divide a Iniciativa por 1,5. A aplicação é multiplicativa por estágio.',
  '3554bb16-8489-80b2-a3de-e47795a5d028': '+5/−5 de Esquiva por estágio de Evasiva.',
  '35c4bb16-8489-80e0-b97d-c583baad77bc': 'Para descobrir o valor final da estatística (F.stats), some a Base da estatística (BE) e os EVs distribuídos.',
  '35c4bb16-8489-8065-b648-f156f29f9482': 'F.stats = BE + EV',
  '35c4bb16-8489-80e3-9427-c9bbcb65c159': 'BF = piso(F.stats / 10) + 1 se o resto da divisão por 10 for maior que 5.',
  '35c4bb16-8489-80a7-8dce-fe99ea6d3700': 'PV = piso(F.stats / 2) + (10 × número de dados da estatística).',
  '3554bb16-8489-8040-94f7-f00669cea21e': 'Apresenta sua arte gastando 5 PE e uma ação completa; aliados em cena recebem +2 nos próximos testes. Em um Contest, recebe +3 dados de Atenção.',
  '3554bb16-8489-8054-9b0d-c138b1eea710': 'Escolha um dos estilos, Artista ou Vândalo, e use uma ação completa para realizar a ação correspondente.',
  '3554bb16-8489-80cc-a1be-f46399a98740': 'Artista: gaste 5 PE para recuperar 1d8+2 PE de cada aliado em campo. Em um Contest, recupere também 1 PE para cada nota de jurado acima de 6.',
  '3554bb16-8489-808e-a23b-dec7046bba3a': 'Vândalo: aliados em campo perdem 2 PE e você recupera 5 PE. Uma vez durante o Contest, gaste 10 PE para converter sua Atenção negativa em positiva.',
  '3554bb16-8489-80dc-beb7-cfb567a8eb8d': 'Para a habilidade funcionar, faça um teste de Artes ou Crime (DT 18), conforme o estilo escolhido.',
  '3554bb16-8489-8080-bb7d-ef59c64355b0': 'Uma vez por cena durante um Contest, gaste 5 PE e faça um teste de Artes (DT 20). Se passar, o público não se cansa quando você repete o mesmo movimento em apresentações consecutivas, até no máximo 2 repetições.',
  '3554bb16-8489-8016-8633-f25e29a1ec6c': 'Movimentos físicos usados em um Contest fornecem +1 dado de Atenção.',
  '3554bb16-8489-8067-a5e4-fa8900f53258': 'Você pode iniciar uma batalha durante um Contest; você e o adversário tornam-se o centro das atenções. O vencedor recebe +3 dados de Atenção.',
  '3554bb16-8489-80ea-a09d-ed1cd1fdb434': 'Após sua apresentação em um Contest, gaste 5 PE e faça uma pose para receber Atenção igual à metade do seu CAR.',
  '3554bb16-8489-8027-bc6c-df868400abc8': 'Durante um teste de perícia em um Contest, faça também um teste de AGI (DT 10). Se passar, o próximo teste de Contest usa a mesma perícia do último, exceto quando ela for muito diferente da situação.',
  '3554bb16-8489-80ee-aafc-e6935c1763ea': 'Escolha um tipo de Contest. Durante seu turno, gaste 5 PE e execute uma dança baseada nesse tipo para receber +2 de Atenção.',
  '3554bb16-8489-80f7-a699-d9a61db18508': 'Antes do Contest, escolha um tipo e vista-se com seu Pokémon de acordo. Durante o evento, movimentos e ações desse tipo recebem +2 nos testes feitos para obter Atenção.',
  '3554bb16-8489-802a-aa5c-d15eca67f84c': 'Uma vez por cena, use uma ação de movimento e gaste 25 PE para desfilar na passarela e se tornar o centro das atenções.',
  '3554bb16-8489-8068-ad10-f1e2b005faab': 'Escolha um item especial. Na primeira vez que usá-lo em um Contest durante a cena, receba +5 de Atenção.',
  '3554bb16-8489-807a-8116-c1d2e13da1c3': 'Recebe +1 CAR e passa a ser conhecido nas ruas e entre as pessoas.',
  '3554bb16-8489-804f-ba57-cf02186d50a7': 'Uma vez por cena em um Contest, você pode usar Acrobacia no lugar de qualquer teste feito para obter Atenção.',
  '3554bb16-8489-80bb-bd24-d04422899eab': 'Quando um dos seus Pokémon dos tipos Lutador, Metálico, Terrestre, Normal, Dragão, Pedra ou Sombrio sofrer um ataque físico, você pode gastar 12 PE e sofrer esse ataque; em seguida, realiza outro ataque como ação livre.',
  '3554bb16-8489-8074-ad85-fc79fb96efa1': 'Durante uma cena, gaste 5 PE para aumentar o dano dos movimentos de um dos seus Pokémon ativos em um bônus igual a +2 × VON. Sustente a habilidade pagando 1 PE no início de cada rodada; enquanto estiver ativa, os movimentos utilizados custam +1 PP. Se desativá-la, o Pokémon ativo afetado fica nocauteado.',
  '3554bb16-8489-803f-b33e-d7c033a794e3': 'Recebe +2 em testes para perceber coisas, independente da perícia utilizada. Caso perceba algo, escolha: gastar 5 PE e realizar uma ação padrão logo após isso, ou receber +1d4+2 PE adicionais, disponíveis até o final da cena.',
  '3554bb16-8489-8077-95b4-df6d8ed406e0': 'Aumenta o bônus concedido por preparar uma ação em +1#d20.',
};

export const SYSTEM_EXTRA_BLOCKS_BY_DOCUMENT: Record<string, RuleBlock[]> = {
  '3554bb16-8489-8042-b7fb-dcaa47eb0bfb': [
    heading3('priority-repeat-cost', 'Repetição de movimentos de prioridade'),
    paragraph('priority-repeat-cost-rule', 'Se o mesmo Pokémon repetir um movimento de prioridade positiva após o turno do oponente, pague PP extra igual ao valor positivo da prioridade, além do custo normal. A regra de custo dobrado por usar prioridade como reação continua valendo; some os custos quando os dois casos se aplicarem.'),
    heading3('terastal-stab', 'STAB de Pokémon Terastalizado'),
    paragraph('terastal-stab-rule', 'Quando o movimento corresponder ao tipo Tera do Pokémon, além do STAB normal, acrescente um bônus adicional de STAB igual a 1,50× o bônus de dano do movimento.'),
  ],
};

export function applySystemBlockTextOverrides(blocks: RuleBlock[]): RuleBlock[] {
  return blocks.map(block => {
    const replacement = SYSTEM_BLOCK_TEXT_OVERRIDES[block.id];
    return {
      ...block,
      ...(replacement === undefined ? {} : {
        text: replacement,
        properties: { ...block.properties, title: [[replacement]] },
        richText: [[replacement]],
      }),
      ...(block.children ? { children: applySystemBlockTextOverrides(block.children) } : {}),
    };
  });
}
