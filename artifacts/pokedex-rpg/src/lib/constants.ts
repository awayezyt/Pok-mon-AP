import { defaultStages } from './types';
import type { Attack, Pokemon, PokemonGrowthRate } from './types';
import { computeDerivedStats } from './calculations';

export const defaultPokemonTypes: string[] = [
  "Normal", "Fogo", "Água", "Planta", "Elétrico", "Gelo",
  "Lutador", "Veneno", "Terra", "Voador", "Psíquico",
  "Inseto", "Pedra", "Fantasma", "Dragão", "Sombrio",
  "Metálico", "Fada"
];

export const emptyPokemonStats = {
  hp:    { base: 0, levelPoints: 0, ev: 0, iv: "C" as const },
  atk:   { base: 0, levelPoints: 0, ev: 0, iv: "C" as const },
  def:   { base: 0, levelPoints: 0, ev: 0, iv: "C" as const },
  spAtk: { base: 0, levelPoints: 0, ev: 0, iv: "C" as const },
  spDef: { base: 0, levelPoints: 0, ev: 0, iv: "C" as const },
  spe:   { base: 0, levelPoints: 0, ev: 0, iv: "C" as const },
};

export const defaultPokemonTemplate = {
  name: "Novo Pokémon",
  species: "",
  image: null,
  trainerName: "",
  history: "",
  pokedexDescription: "",
  types: ["Normal" as const],
  gender: "Indefinido" as const,
  catchRate: 45,
  level: 1,
  hp: 10,
  hpMax: 10,
  evGained: "",
  xp: 0,
  growthRate: "Meio rápido" as PokemonGrowthRate,
  affection: 0,
  item: "",
  itemDescription: "",
  ability: "",
  abilityDescription: "",
  natureNumber: 21,
  stages: { ...defaultStages },
  stats: { ...emptyPokemonStats },
  attacks: []
  ,
  inDex: false
};

const commonAttack = (
  id: string,
  name: string,
  data: Omit<Attack, 'id' | 'name'>,
): Attack => ({ id, name, ...data });

const curatedAttack = (
  id: string,
  name: string,
  data: Pick<Attack, 'type' | 'category' | 'pp' | 'power' | 'accuracy' | 'effectSummary' | 'effectFull'>
    & Partial<Pick<Attack, 'target' | 'priority' | 'makesContact' | 'statusChances' | 'critRange'>>,
): Attack => commonAttack(id, name, {
  critRange: 20,
  target: 'Alvo único',
  priority: 0,
  makesContact: false,
  statusChances: [],
  stab: true,
  ...data,
});

const additionalAttacks: Attack[] = [
  curatedAttack('attack-thunder', 'Thunder', { type: 'Elétrico', category: 'Especial', pp: 10, power: 110, accuracy: 70, effectSummary: '30% de chance de causar Paralisia.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo fica Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 30 }] }),
  curatedAttack('attack-spark', 'Spark', { type: 'Elétrico', category: 'Físico', pp: 20, power: 65, accuracy: 100, makesContact: true, effectSummary: '30% de chance de causar Paralisia.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo fica Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 30 }] }),
  curatedAttack('attack-wild-charge', 'Wild Charge', { type: 'Elétrico', category: 'Físico', pp: 15, power: 90, accuracy: 100, makesContact: true, effectSummary: 'O usuário também sofre parte do dano.', effectFull: 'Depois de causar dano, o usuário perde PV igual a um quarto do dano causado, arredondado para baixo.' }),

  curatedAttack('attack-bug-buzz', 'Bug Buzz', { type: 'Inseto', category: 'Especial', pp: 10, power: 90, accuracy: 100, effectSummary: '10% de chance de reduzir SP.DEF.', effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo recebe -1 estágio de SP.DEF.', statusChances: [{ effect: 'SP.DEF -1', chance: 10 }] }),
  curatedAttack('attack-x-scissor', 'X-Scissor', { type: 'Inseto', category: 'Físico', pp: 15, power: 80, accuracy: 100, makesContact: true, effectSummary: 'Corte físico confiável de inseto.', effectFull: 'O usuário corta o alvo com as duas garras.' }),
  curatedAttack('attack-leech-life', 'Leech Life', { type: 'Inseto', category: 'Físico', pp: 10, power: 80, accuracy: 100, makesContact: true, effectSummary: 'Recupera metade do dano causado.', effectFull: 'Depois do dano, o usuário recupera PV igual à metade do dano causado, arredondado para baixo.' }),
  curatedAttack('attack-pollen-puff', 'Pollen Puff', { type: 'Inseto', category: 'Especial', pp: 15, power: 90, accuracy: 100, effectSummary: 'Pode curar um aliado em vez de feri-lo.', effectFull: 'Contra um oponente, causa dano. Se usado em um aliado, recupera 1d10 PV.' }),
  curatedAttack('attack-first-impression', 'First Impression', { type: 'Inseto', category: 'Físico', pp: 10, power: 90, accuracy: 100, priority: 2, makesContact: true, effectSummary: 'Prioridade alta no primeiro turno em campo.', effectFull: 'Só pode ser usado no primeiro turno em que o usuário entra em cena e age antes de movimentos sem prioridade.' }),

  curatedAttack('attack-moonblast', 'Moonblast', { type: 'Fada', category: 'Especial', pp: 15, power: 95, accuracy: 100, effectSummary: '30% de chance de reduzir SP.ATK.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo recebe -1 estágio de SP.ATK.', statusChances: [{ effect: 'SP.ATK -1', chance: 30 }] }),
  curatedAttack('attack-dazzling-gleam', 'Dazzling Gleam', { type: 'Fada', category: 'Especial', pp: 10, power: 80, accuracy: 100, target: 'Todos os oponentes próximos', effectSummary: 'Atinge todos os oponentes próximos.', effectFull: 'Uma explosão de luz feérica atinge todos os oponentes próximos.' }),
  curatedAttack('attack-misty-terrain', 'Misty Terrain', { type: 'Fada', category: 'Status', pp: 10, power: null, accuracy: 100, target: 'Campo', effectSummary: 'Protege aliados de condições negativas.', effectFull: 'Por 5 turnos, aliados no campo têm vantagem para evitar condições negativas.' }),
  curatedAttack('attack-play-nice', 'Play Nice', { type: 'Fada', category: 'Status', pp: 20, power: null, accuracy: 100, effectSummary: 'Reduz ATK do alvo em 1 estágio.', effectFull: 'O alvo recebe -1 estágio de ATK.' }),
  curatedAttack('attack-spirit-break', 'Spirit Break', { type: 'Fada', category: 'Físico', pp: 15, power: 75, accuracy: 100, makesContact: true, effectSummary: 'Reduz SP.ATK do alvo em 1 estágio.', effectFull: 'Após acertar, o alvo recebe -1 estágio de SP.ATK.' }),

  curatedAttack('attack-fire-blast', 'Fire Blast', { type: 'Fogo', category: 'Especial', pp: 5, power: 110, accuracy: 85, effectSummary: '10% de chance de causar Queimadura.', effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Queimado.', statusChances: [{ effect: 'Queimadura', chance: 10 }] }),
  curatedAttack('attack-heat-wave', 'Heat Wave', { type: 'Fogo', category: 'Especial', pp: 10, power: 95, accuracy: 90, target: 'Todos os oponentes próximos', effectSummary: '10% de chance de causar Queimadura.', effectFull: 'Uma onda de calor atinge todos os oponentes próximos. Cada alvo tem 10% de chance de Queimadura.', statusChances: [{ effect: 'Queimadura', chance: 10 }] }),
  curatedAttack('attack-flame-charge', 'Flame Charge', { type: 'Fogo', category: 'Físico', pp: 20, power: 50, accuracy: 100, makesContact: true, effectSummary: 'Aumenta a velocidade do usuário.', effectFull: 'Depois de causar dano, o usuário recebe +1 estágio de SPEED.' }),
  curatedAttack('attack-fire-fang', 'Fire Fang', { type: 'Fogo', category: 'Físico', pp: 15, power: 65, accuracy: 95, makesContact: true, effectSummary: 'Pode causar Queimadura ou Flinch.', effectFull: 'Após acertar, role 1d10: 1 causa Queimadura; 2 causa Flinch.', statusChances: [{ effect: 'Queimadura', chance: 10 }, { effect: 'Flinch', chance: 10 }] }),
  curatedAttack('attack-overheat', 'Overheat', { type: 'Fogo', category: 'Especial', pp: 5, power: 130, accuracy: 90, effectSummary: 'Grande dano, mas reduz SP.ATK do usuário.', effectFull: 'Depois de causar dano, o usuário recebe -2 estágios de SP.ATK.' }),

  curatedAttack('attack-focus-blast', 'Focus Blast', { type: 'Lutador', category: 'Especial', pp: 5, power: 120, accuracy: 70, effectSummary: '10% de chance de reduzir SP.DEF.', effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo recebe -1 estágio de SP.DEF.', statusChances: [{ effect: 'SP.DEF -1', chance: 10 }] }),
  curatedAttack('attack-drain-punch', 'Drain Punch', { type: 'Lutador', category: 'Físico', pp: 10, power: 75, accuracy: 100, makesContact: true, effectSummary: 'Recupera metade do dano causado.', effectFull: 'Depois do dano, o usuário recupera PV igual à metade do dano causado, arredondado para baixo.' }),
  curatedAttack('attack-bulk-up', 'Bulk Up', { type: 'Lutador', category: 'Status', pp: 20, power: null, accuracy: 100, target: 'Usuário', effectSummary: 'Aumenta ATK e DEF em 1 estágio.', effectFull: 'O usuário recebe +1 estágio de ATK e +1 estágio de DEF.' }),
  curatedAttack('attack-low-sweep', 'Low Sweep', { type: 'Lutador', category: 'Físico', pp: 20, power: 65, accuracy: 100, makesContact: true, effectSummary: 'Reduz SPEED do alvo em 1 estágio.', effectFull: 'Depois de causar dano, o alvo recebe -1 estágio de SPEED.' }),
  curatedAttack('attack-aura-sphere', 'Aura Sphere', { type: 'Lutador', category: 'Especial', pp: 20, power: 80, accuracy: 100, effectSummary: 'Não falha por evasão.', effectFull: 'O teste de ataque não sofre penalidade por estágios de Evasão do alvo.' }),

  curatedAttack('attack-hydro-pump', 'Hydro Pump', { type: 'Água', category: 'Especial', pp: 5, power: 110, accuracy: 80, effectSummary: 'Jato de água de grande potência.', effectFull: 'O usuário dispara um jato concentrado de água contra o alvo.' }),
  curatedAttack('attack-aqua-jet', 'Aqua Jet', { type: 'Água', category: 'Físico', pp: 20, power: 40, accuracy: 100, priority: 1, makesContact: true, effectSummary: 'Ataque físico com prioridade.', effectFull: 'O usuário envolve-se em água e age antes de ataques sem prioridade.' }),
  curatedAttack('attack-waterfall', 'Waterfall', { type: 'Água', category: 'Físico', pp: 15, power: 80, accuracy: 100, makesContact: true, effectSummary: '20% de chance de causar Flinch.', effectFull: 'Após acertar, role 1d10. Resultado 9 ou 10: o alvo perde a ação.', statusChances: [{ effect: 'Flinch', chance: 20 }] }),
  curatedAttack('attack-scald', 'Scald', { type: 'Água', category: 'Especial', pp: 15, power: 80, accuracy: 100, effectSummary: '30% de chance de causar Queimadura.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo fica Queimado.', statusChances: [{ effect: 'Queimadura', chance: 30 }] }),
  curatedAttack('attack-liquidation', 'Liquidation', { type: 'Água', category: 'Físico', pp: 10, power: 85, accuracy: 100, makesContact: true, effectSummary: '20% de chance de reduzir DEF.', effectFull: 'Após acertar, role 1d10. Resultado 9 ou 10: o alvo recebe -1 estágio de DEF.', statusChances: [{ effect: 'DEF -1', chance: 20 }] }),
  curatedAttack('attack-bubble-beam', 'Bubble Beam', { type: 'Água', category: 'Especial', pp: 20, power: 65, accuracy: 100, effectSummary: '10% de chance de reduzir SPEED.', effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo recebe -1 estágio de SPEED.', statusChances: [{ effect: 'SPEED -1', chance: 10 }] }),

  curatedAttack('attack-blizzard', 'Blizzard', { type: 'Gelo', category: 'Especial', pp: 5, power: 110, accuracy: 70, target: 'Todos os oponentes próximos', effectSummary: '10% de chance de Congelamento.', effectFull: 'Uma nevasca atinge os oponentes próximos. Cada alvo tem 10% de chance de Congelamento.', statusChances: [{ effect: 'Congelamento', chance: 10 }] }),
  curatedAttack('attack-aurora-beam', 'Aurora Beam', { type: 'Gelo', category: 'Especial', pp: 20, power: 65, accuracy: 100, effectSummary: '10% de chance de reduzir ATK.', effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo recebe -1 estágio de ATK.', statusChances: [{ effect: 'ATK -1', chance: 10 }] }),
  curatedAttack('attack-ice-punch', 'Ice Punch', { type: 'Gelo', category: 'Físico', pp: 15, power: 75, accuracy: 100, makesContact: true, effectSummary: '10% de chance de Congelamento.', effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Congelado, conforme as regras da mesa.', statusChances: [{ effect: 'Congelamento', chance: 10 }] }),
  curatedAttack('attack-avalanche', 'Avalanche', { type: 'Gelo', category: 'Físico', pp: 10, power: 60, accuracy: 100, makesContact: true, effectSummary: 'Dobra o poder se o usuário já foi ferido.', effectFull: 'Se o usuário sofreu dano neste turno, o poder deste movimento é dobrado.' }),
  curatedAttack('attack-freeze-dry', 'Freeze-Dry', { type: 'Gelo', category: 'Especial', pp: 20, power: 70, accuracy: 100, effectSummary: '10% de chance de Congelamento; eficaz contra Água.', effectFull: 'Após acertar, role 1d10. Resultado 10: Congelamento. Contra Pokémon de Água, considere eficácia super efetiva.', statusChances: [{ effect: 'Congelamento', chance: 10 }] }),
  curatedAttack('attack-triple-axel', 'Triple Axel', { type: 'Gelo', category: 'Físico', pp: 10, power: 20, accuracy: 90, makesContact: true, effectSummary: 'Pode acertar até três vezes, aumentando o poder.', effectFull: 'Faça até 3 testes de ataque; cada acerto consecutivo aumenta o poder em 20 (20, 40 e 60).' }),

  curatedAttack('attack-brave-bird', 'Brave Bird', { type: 'Voador', category: 'Físico', pp: 15, power: 120, accuracy: 100, makesContact: true, effectSummary: 'O usuário também sofre dano de recuo.', effectFull: 'Depois do dano, o usuário perde PV igual a um terço do dano causado, arredondado para baixo.' }),
  curatedAttack('attack-hurricane', 'Hurricane', { type: 'Voador', category: 'Especial', pp: 10, power: 110, accuracy: 70, effectSummary: '30% de chance de causar Confusão.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo fica Confuso por 1d4 turnos.', statusChances: [{ effect: 'Confusão', chance: 30 }] }),
  curatedAttack('attack-air-slash', 'Air Slash', { type: 'Voador', category: 'Especial', pp: 15, power: 75, accuracy: 95, effectSummary: '30% de chance de causar Flinch.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo perde a ação.', statusChances: [{ effect: 'Flinch', chance: 30 }] }),
  curatedAttack('attack-wing-attack', 'Wing Attack', { type: 'Voador', category: 'Físico', pp: 35, power: 60, accuracy: 100, makesContact: true, effectSummary: 'Ataque físico básico de voo.', effectFull: 'O usuário golpeia o alvo com suas asas.' }),
  curatedAttack('attack-fly', 'Fly', { type: 'Voador', category: 'Físico', pp: 15, power: 90, accuracy: 95, makesContact: true, effectSummary: 'Fica fora de alcance e ataca no turno seguinte.', effectFull: 'No primeiro turno, o usuário voa e evita a maioria dos ataques. No turno seguinte, atinge o alvo.' }),
  curatedAttack('attack-tailwind', 'Tailwind', { type: 'Voador', category: 'Status', pp: 15, power: null, accuracy: 100, target: 'Aliados', effectSummary: 'Aumenta a velocidade dos aliados por 4 turnos.', effectFull: 'Os aliados recebem +2 estágios de SPEED por 4 turnos.' }),

  curatedAttack('attack-dig', 'Dig', { type: 'Terra', category: 'Físico', pp: 10, power: 80, accuracy: 100, makesContact: true, effectSummary: 'Enterra-se e ataca no turno seguinte.', effectFull: 'No primeiro turno, o usuário escava e evita a maioria dos ataques. No turno seguinte, atinge o alvo.' }),
  curatedAttack('attack-mud-shot', 'Mud Shot', { type: 'Terra', category: 'Especial', pp: 15, power: 55, accuracy: 95, effectSummary: 'Reduz SPEED do alvo em 1 estágio.', effectFull: 'Depois de causar dano, o alvo recebe -1 estágio de SPEED.' }),
  curatedAttack('attack-bulldoze', 'Bulldoze', { type: 'Terra', category: 'Físico', pp: 20, power: 60, accuracy: 100, target: 'Todos os oponentes próximos', effectSummary: 'Atinge oponentes próximos e reduz SPEED.', effectFull: 'Atinge todos os oponentes próximos e reduz o SPEED de cada alvo em 1 estágio.' }),
  curatedAttack('attack-bonemerang', 'Bonemerang', { type: 'Terra', category: 'Físico', pp: 10, power: 50, accuracy: 90, effectSummary: 'Atinge duas vezes.', effectFull: 'O usuário lança um osso que atinge o alvo duas vezes; faça um teste para cada acerto.' }),
  curatedAttack('attack-mud-slap', 'Mud-Slap', { type: 'Terra', category: 'Especial', pp: 10, power: 20, accuracy: 100, effectSummary: 'Reduz a precisão do alvo em 1 estágio.', effectFull: 'Após acertar, o alvo recebe -1 estágio de Precisão.' }),
  curatedAttack('attack-high-horsepower', 'High Horsepower', { type: 'Terra', category: 'Físico', pp: 10, power: 95, accuracy: 95, makesContact: true, effectSummary: 'Investida terrestre poderosa.', effectFull: 'O usuário avança com força contra o alvo.' }),

  curatedAttack('attack-stone-edge', 'Stone Edge', { type: 'Pedra', category: 'Físico', pp: 5, power: 100, accuracy: 80, effectSummary: 'Alta chance de crítico.', effectFull: 'Este movimento causa crítico com 18 ou mais no teste de ataque.', critRange: 18 }),
  curatedAttack('attack-rock-blast', 'Rock Blast', { type: 'Pedra', category: 'Físico', pp: 10, power: 25, accuracy: 90, effectSummary: 'Atinge de 2 a 5 vezes.', effectFull: 'Role 1d4+1 para determinar o número de acertos; cada acerto causa o dano deste movimento.' }),
  curatedAttack('attack-power-gem', 'Power Gem', { type: 'Pedra', category: 'Especial', pp: 20, power: 80, accuracy: 100, effectSummary: 'Dispara energia em forma de pedras preciosas.', effectFull: 'O usuário dispara pedras preciosas brilhantes contra o alvo.' }),
  curatedAttack('attack-ancient-power', 'Ancient Power', { type: 'Pedra', category: 'Especial', pp: 5, power: 60, accuracy: 100, effectSummary: '10% de chance de aumentar todos os atributos.', effectFull: 'Após acertar, role 1d10. Resultado 10: o usuário recebe +1 estágio em ATK, DEF, SP.ATK, SP.DEF e SPEED.', statusChances: [{ effect: 'Atributos +1', chance: 10 }] }),
  curatedAttack('attack-accelerock', 'Accelerock', { type: 'Pedra', category: 'Físico', pp: 20, power: 40, accuracy: 100, priority: 1, makesContact: true, effectSummary: 'Ataque de pedra com prioridade.', effectFull: 'O usuário ataca em alta velocidade e age antes de movimentos sem prioridade.' }),
  curatedAttack('attack-rock-tomb', 'Rock Tomb', { type: 'Pedra', category: 'Físico', pp: 15, power: 60, accuracy: 95, effectSummary: 'Reduz SPEED do alvo em 1 estágio.', effectFull: 'Depois de causar dano, o alvo recebe -1 estágio de SPEED.' }),

  curatedAttack('attack-hex', 'Hex', { type: 'Fantasma', category: 'Especial', pp: 10, power: 65, accuracy: 100, effectSummary: 'Dobra o poder contra alvo com condição negativa.', effectFull: 'Se o alvo estiver com uma condição negativa, o poder deste movimento é dobrado.' }),
  curatedAttack('attack-shadow-sneak', 'Shadow Sneak', { type: 'Fantasma', category: 'Físico', pp: 30, power: 40, accuracy: 100, priority: 1, makesContact: true, effectSummary: 'Ataque fantasma com prioridade.', effectFull: 'O usuário surge por uma sombra e age antes de ataques sem prioridade.' }),
  curatedAttack('attack-phantom-force', 'Phantom Force', { type: 'Fantasma', category: 'Físico', pp: 10, power: 90, accuracy: 100, makesContact: true, effectSummary: 'Desaparece e ataca no turno seguinte, ignorando Proteção.', effectFull: 'O usuário desaparece no primeiro turno e ataca no próximo. O golpe ignora Proteção e efeitos semelhantes.' }),
  curatedAttack('attack-lick', 'Lick', { type: 'Fantasma', category: 'Físico', pp: 30, power: 30, accuracy: 100, makesContact: true, effectSummary: '30% de chance de causar Paralisia.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo fica Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 30 }] }),
  curatedAttack('attack-astonish', 'Astonish', { type: 'Fantasma', category: 'Físico', pp: 15, power: 30, accuracy: 100, makesContact: true, effectSummary: '30% de chance de causar Flinch.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo perde a ação.', statusChances: [{ effect: 'Flinch', chance: 30 }] }),
  curatedAttack('attack-spirit-shackle', 'Spirit Shackle', { type: 'Fantasma', category: 'Físico', pp: 10, power: 80, accuracy: 100, makesContact: true, effectSummary: 'Impede o alvo de sair de campo.', effectFull: 'Depois de acertar, o alvo fica preso e não pode ser trocado até o fim do próximo turno.' }),

  curatedAttack('attack-dragon-pulse', 'Dragon Pulse', { type: 'Dragão', category: 'Especial', pp: 10, power: 85, accuracy: 100, effectSummary: 'Pulso de energia dracônica.', effectFull: 'O usuário dispara uma onda de energia dracônica contra o alvo.' }),
  curatedAttack('attack-outrage', 'Outrage', { type: 'Dragão', category: 'Físico', pp: 10, power: 120, accuracy: 100, makesContact: true, effectSummary: 'Ataca por vários turnos e depois causa Confusão.', effectFull: 'O usuário ataca por 2 ou 3 turnos; ao terminar, fica Confuso por 1d4 turnos.' }),
  curatedAttack('attack-dragon-dance', 'Dragon Dance', { type: 'Dragão', category: 'Status', pp: 20, power: null, accuracy: 100, target: 'Usuário', effectSummary: 'Aumenta ATK e SPEED em 1 estágio.', effectFull: 'O usuário recebe +1 estágio de ATK e +1 estágio de SPEED.' }),
  curatedAttack('attack-draco-meteor', 'Draco Meteor', { type: 'Dragão', category: 'Especial', pp: 5, power: 130, accuracy: 90, effectSummary: 'Grande dano, mas reduz SP.ATK do usuário.', effectFull: 'Depois de causar dano, o usuário recebe -2 estágios de SP.ATK.' }),
  curatedAttack('attack-dragon-breath', 'Dragon Breath', { type: 'Dragão', category: 'Especial', pp: 20, power: 60, accuracy: 100, effectSummary: '30% de chance de causar Paralisia.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo fica Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 30 }] }),
  curatedAttack('attack-dual-chop', 'Dual Chop', { type: 'Dragão', category: 'Físico', pp: 15, power: 40, accuracy: 90, makesContact: true, effectSummary: 'Atinge duas vezes.', effectFull: 'O usuário golpeia o alvo duas vezes; faça um teste de ataque para cada acerto.' }),

  curatedAttack('attack-poison-jab', 'Poison Jab', { type: 'Veneno', category: 'Físico', pp: 20, power: 80, accuracy: 100, makesContact: true, effectSummary: '30% de chance de causar Veneno.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo fica Envenenado.', statusChances: [{ effect: 'Veneno', chance: 30 }] }),
  curatedAttack('attack-sludge-bomb', 'Sludge Bomb', { type: 'Veneno', category: 'Especial', pp: 10, power: 90, accuracy: 100, effectSummary: '30% de chance de causar Veneno.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo fica Envenenado.', statusChances: [{ effect: 'Veneno', chance: 30 }] }),
  curatedAttack('attack-venoshock', 'Venoshock', { type: 'Veneno', category: 'Especial', pp: 10, power: 65, accuracy: 100, effectSummary: 'Dobra o poder contra alvo envenenado.', effectFull: 'Se o alvo estiver Envenenado, o poder deste movimento é dobrado.' }),
  curatedAttack('attack-poison-tail', 'Poison Tail', { type: 'Veneno', category: 'Físico', pp: 25, power: 50, accuracy: 100, makesContact: true, effectSummary: '10% de chance de envenenar e alta chance de crítico.', effectFull: 'Causa crítico com 18 ou mais no teste de ataque; após acertar, 10% de chance de Veneno.', critRange: 18, statusChances: [{ effect: 'Veneno', chance: 10 }] }),
  curatedAttack('attack-acid-spray', 'Acid Spray', { type: 'Veneno', category: 'Especial', pp: 20, power: 40, accuracy: 100, effectSummary: 'Reduz SP.DEF do alvo em 2 estágios.', effectFull: 'Depois de causar dano, o alvo recebe -2 estágios de SP.DEF.' }),
  curatedAttack('attack-cross-poison', 'Cross Poison', { type: 'Veneno', category: 'Físico', pp: 20, power: 70, accuracy: 100, makesContact: true, effectSummary: '10% de chance de causar Veneno e alta chance de crítico.', effectFull: 'Causa crítico com 18 ou mais no teste de ataque; após acertar, 10% de chance de Veneno.', critRange: 18, statusChances: [{ effect: 'Veneno', chance: 10 }] }),

  curatedAttack('attack-iron-head', 'Iron Head', { type: 'Metálico', category: 'Físico', pp: 15, power: 80, accuracy: 100, makesContact: true, effectSummary: '30% de chance de causar Flinch.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo perde a ação.', statusChances: [{ effect: 'Flinch', chance: 30 }] }),
  curatedAttack('attack-flash-cannon', 'Flash Cannon', { type: 'Metálico', category: 'Especial', pp: 10, power: 80, accuracy: 100, effectSummary: '10% de chance de reduzir SP.DEF.', effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo recebe -1 estágio de SP.DEF.', statusChances: [{ effect: 'SP.DEF -1', chance: 10 }] }),
  curatedAttack('attack-bullet-punch', 'Bullet Punch', { type: 'Metálico', category: 'Físico', pp: 30, power: 40, accuracy: 100, priority: 1, makesContact: true, effectSummary: 'Soco metálico com prioridade.', effectFull: 'O usuário golpeia com um punho veloz e age antes de ataques sem prioridade.' }),
  curatedAttack('attack-gyro-ball', 'Gyro Ball', { type: 'Metálico', category: 'Físico', pp: 5, power: 1, accuracy: 100, makesContact: true, effectSummary: 'Mais forte quanto mais lento o usuário.', effectFull: 'O mestre pode aumentar o poder conforme a diferença de velocidade: base 60, +20 por categoria em que o alvo for mais rápido (máximo 150).' }),
  curatedAttack('attack-metal-claw', 'Metal Claw', { type: 'Metálico', category: 'Físico', pp: 35, power: 50, accuracy: 95, makesContact: true, effectSummary: '10% de chance de aumentar ATK.', effectFull: 'Após acertar, role 1d10. Resultado 10: o usuário recebe +1 estágio de ATK.', statusChances: [{ effect: 'ATK +1', chance: 10 }] }),
  curatedAttack('attack-meteor-mash', 'Meteor Mash', { type: 'Metálico', category: 'Físico', pp: 10, power: 90, accuracy: 90, makesContact: true, effectSummary: '20% de chance de aumentar ATK.', effectFull: 'Após acertar, role 1d10. Resultado 9 ou 10: o usuário recebe +1 estágio de ATK.', statusChances: [{ effect: 'ATK +1', chance: 20 }] }),
  curatedAttack('attack-steel-wing', 'Steel Wing', { type: 'Metálico', category: 'Físico', pp: 25, power: 70, accuracy: 90, makesContact: true, effectSummary: '10% de chance de aumentar DEF.', effectFull: 'Após acertar, role 1d10. Resultado 10: o usuário recebe +1 estágio de DEF.', statusChances: [{ effect: 'DEF +1', chance: 10 }] }),
  curatedAttack('attack-steel-beam', 'Steel Beam', { type: 'Metálico', category: 'Especial', pp: 5, power: 140, accuracy: 95, effectSummary: 'Ataque de aço extremo; o usuário perde metade dos PV máximos.', effectFull: 'Depois de causar dano, o usuário perde PV igual à metade dos seus PV máximos, arredondada para cima.' }),

  curatedAttack('attack-stun-spore', 'Stun Spore', { type: 'Planta', category: 'Status', pp: 30, power: null, accuracy: 75, effectSummary: 'Causa Paralisia.', effectFull: 'Após acertar, o alvo fica Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 100 }] }),
  curatedAttack('attack-sleep-powder', 'Sleep Powder', { type: 'Planta', category: 'Status', pp: 15, power: null, accuracy: 75, effectSummary: 'Causa Sono.', effectFull: 'Após acertar, o alvo fica Dormindo.', statusChances: [{ effect: 'Sono', chance: 100 }] }),
  curatedAttack('attack-spore', 'Spore', { type: 'Planta', category: 'Status', pp: 15, power: null, accuracy: 100, effectSummary: 'Causa Sono.', effectFull: 'Após acertar, o alvo fica Dormindo.', statusChances: [{ effect: 'Sono', chance: 100 }] }),
  curatedAttack('attack-leech-seed', 'Leech Seed', { type: 'Planta', category: 'Status', pp: 10, power: null, accuracy: 90, effectSummary: 'Drena PV do alvo ao fim de cada turno.', effectFull: 'O alvo perde 1d4 PV ao fim de cada turno; o usuário recupera a mesma quantidade. Não afeta Pokémon de Planta.' }),
  curatedAttack('attack-razor-leaf', 'Razor Leaf', { type: 'Planta', category: 'Físico', pp: 25, power: 55, accuracy: 95, critRange: 18, effectSummary: 'Corte de folhas com alta chance de crítico.', effectFull: 'O ataque causa crítico com 18 ou mais no teste de ataque.' }),
  curatedAttack('attack-solar-beam', 'Solar Beam', { type: 'Planta', category: 'Especial', pp: 10, power: 120, accuracy: 100, effectSummary: 'Carrega no primeiro turno e ataca no seguinte.', effectFull: 'O usuário absorve luz no primeiro turno e dispara um raio no turno seguinte; sob sol intenso, pode atacar imediatamente.' }),
  curatedAttack('attack-giga-drain', 'Giga Drain', { type: 'Planta', category: 'Especial', pp: 10, power: 75, accuracy: 100, effectSummary: 'Recupera metade do dano causado.', effectFull: 'Depois de causar dano, o usuário recupera PV igual à metade do dano causado, arredondado para baixo.' }),

  curatedAttack('attack-flame-wheel', 'Flame Wheel', { type: 'Fogo', category: 'Físico', pp: 25, power: 60, accuracy: 100, makesContact: true, effectSummary: '10% de chance de causar Queimadura.', effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Queimado.', statusChances: [{ effect: 'Queimadura', chance: 10 }] }),
  curatedAttack('attack-fire-punch', 'Fire Punch', { type: 'Fogo', category: 'Físico', pp: 15, power: 75, accuracy: 100, makesContact: true, effectSummary: '10% de chance de causar Queimadura.', effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Queimado.', statusChances: [{ effect: 'Queimadura', chance: 10 }] }),
  curatedAttack('attack-lava-plume', 'Lava Plume', { type: 'Fogo', category: 'Especial', pp: 15, power: 80, accuracy: 100, target: 'Todos os oponentes próximos', effectSummary: 'Atinge oponentes próximos; 30% de chance de Queimadura.', effectFull: 'Atinge todos os oponentes próximos; cada alvo tem 30% de chance de ficar Queimado.', statusChances: [{ effect: 'Queimadura', chance: 30 }] }),
  curatedAttack('attack-flare-blitz', 'Flare Blitz', { type: 'Fogo', category: 'Físico', pp: 15, power: 120, accuracy: 100, makesContact: true, effectSummary: 'Causa recuo e pode Queimar.', effectFull: 'Depois do dano, o usuário perde PV igual a um terço do dano causado; 10% de chance de Queimadura.', statusChances: [{ effect: 'Queimadura', chance: 10 }] }),

  curatedAttack('attack-water-pulse', 'Water Pulse', { type: 'Água', category: 'Especial', pp: 20, power: 60, accuracy: 100, effectSummary: '20% de chance de causar Confusão.', effectFull: 'Após acertar, role 1d10. Resultado 9 ou 10: o alvo fica Confuso por 1d4 turnos.', statusChances: [{ effect: 'Confusão', chance: 20 }] }),
  curatedAttack('attack-aqua-tail', 'Aqua Tail', { type: 'Água', category: 'Físico', pp: 10, power: 90, accuracy: 90, makesContact: true, effectSummary: 'Ataque físico de água.', effectFull: 'O usuário atinge o alvo com uma cauda coberta de água.' }),
  curatedAttack('attack-muddy-water', 'Muddy Water', { type: 'Água', category: 'Especial', pp: 10, power: 90, accuracy: 85, target: 'Todos os oponentes próximos', effectSummary: '30% de chance de reduzir a Precisão.', effectFull: 'Atinge oponentes próximos; cada alvo tem 30% de chance de receber -1 estágio de Precisão.', statusChances: [{ effect: 'ACC -1', chance: 30 }] }),
  curatedAttack('attack-rain-dance', 'Rain Dance', { type: 'Água', category: 'Status', pp: 5, power: null, accuracy: 100, target: 'Campo', effectSummary: 'Faz chover por 5 turnos.', effectFull: 'Por 5 turnos, ataques de Água ficam mais fortes e ataques de Fogo mais fracos, conforme as regras da mesa.' }),

  curatedAttack('attack-thunder-punch', 'Thunder Punch', { type: 'Elétrico', category: 'Físico', pp: 15, power: 75, accuracy: 100, makesContact: true, effectSummary: '10% de chance de causar Paralisia.', effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 10 }] }),
  curatedAttack('attack-nuzzle', 'Nuzzle', { type: 'Elétrico', category: 'Físico', pp: 20, power: 20, accuracy: 100, makesContact: true, effectSummary: 'Causa Paralisia.', effectFull: 'Após acertar, o alvo fica Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 100 }] }),
  curatedAttack('attack-discharge', 'Discharge', { type: 'Elétrico', category: 'Especial', pp: 15, power: 80, accuracy: 100, target: 'Todos os oponentes próximos', effectSummary: '30% de chance de causar Paralisia.', effectFull: 'Atinge oponentes próximos; cada alvo tem 30% de chance de ficar Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 30 }] }),
  curatedAttack('attack-charge-beam', 'Charge Beam', { type: 'Elétrico', category: 'Especial', pp: 10, power: 50, accuracy: 90, effectSummary: '70% de chance de aumentar SP.ATK.', effectFull: 'Após acertar, role 1d10. Resultado 1 a 7: o usuário recebe +1 estágio de SP.ATK.', statusChances: [{ effect: 'SP.ATK +1', chance: 70 }] }),
  curatedAttack('attack-volt-tackle', 'Volt Tackle', { type: 'Elétrico', category: 'Físico', pp: 15, power: 120, accuracy: 100, makesContact: true, effectSummary: 'Causa recuo e pode Paralisar.', effectFull: 'Depois do dano, o usuário perde PV igual a um terço do dano causado; 10% de chance de Paralisia.', statusChances: [{ effect: 'Paralisia', chance: 10 }] }),

  curatedAttack('attack-double-kick', 'Double Kick', { type: 'Lutador', category: 'Físico', pp: 30, power: 30, accuracy: 100, makesContact: true, effectSummary: 'Atinge duas vezes.', effectFull: 'O usuário chuta o alvo duas vezes; faça um teste de ataque para cada acerto.' }),
  curatedAttack('attack-force-palm', 'Force Palm', { type: 'Lutador', category: 'Físico', pp: 10, power: 60, accuracy: 100, makesContact: true, effectSummary: '30% de chance de causar Paralisia.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo fica Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 30 }] }),
  curatedAttack('attack-superpower', 'Superpower', { type: 'Lutador', category: 'Físico', pp: 5, power: 120, accuracy: 100, makesContact: true, effectSummary: 'Reduz ATK e DEF do usuário após o golpe.', effectFull: 'Depois de causar dano, o usuário recebe -1 estágio de ATK e -1 estágio de DEF.' }),

  curatedAttack('attack-quick-attack', 'Quick Attack', { type: 'Normal', category: 'Físico', pp: 30, power: 40, accuracy: 100, priority: 1, makesContact: true, effectSummary: 'Ataque rápido com prioridade.', effectFull: 'O usuário age antes de movimentos sem prioridade.' }),
  curatedAttack('attack-body-slam', 'Body Slam', { type: 'Normal', category: 'Físico', pp: 15, power: 85, accuracy: 100, makesContact: true, effectSummary: '30% de chance de causar Paralisia.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo fica Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 30 }] }),
  curatedAttack('attack-double-edge', 'Double-Edge', { type: 'Normal', category: 'Físico', pp: 15, power: 120, accuracy: 100, makesContact: true, effectSummary: 'O usuário sofre recuo.', effectFull: 'Depois do dano, o usuário perde PV igual a um terço do dano causado, arredondado para baixo.' }),
  curatedAttack('attack-hyper-beam', 'Hyper Beam', { type: 'Normal', category: 'Especial', pp: 5, power: 150, accuracy: 90, effectSummary: 'O usuário precisa descansar no turno seguinte.', effectFull: 'Depois de atacar, o usuário não pode usar outro movimento no próximo turno.' }),
  curatedAttack('attack-facade', 'Facade', { type: 'Normal', category: 'Físico', pp: 20, power: 70, accuracy: 100, makesContact: true, effectSummary: 'Dobra o poder se o usuário estiver com condição negativa.', effectFull: 'Se o usuário estiver Queimado, Envenenado ou Paralisado, o poder deste ataque dobra.' }),
  curatedAttack('attack-extreme-speed', 'Extreme Speed', { type: 'Normal', category: 'Físico', pp: 5, power: 80, accuracy: 100, priority: 2, makesContact: true, effectSummary: 'Ataque muito rápido com prioridade alta.', effectFull: 'O usuário age antes de movimentos de prioridade 1 ou menor.' }),

  curatedAttack('attack-gust', 'Gust', { type: 'Voador', category: 'Especial', pp: 35, power: 40, accuracy: 100, effectSummary: 'Rajada de vento contra o alvo.', effectFull: 'O usuário cria uma rajada de vento que atinge o alvo.' }),
  curatedAttack('attack-peck', 'Peck', { type: 'Voador', category: 'Físico', pp: 35, power: 35, accuracy: 100, makesContact: true, effectSummary: 'Ataque físico básico de voo.', effectFull: 'O usuário atinge o alvo com o bico.' }),

  curatedAttack('attack-psyshock', 'Psyshock', { type: 'Psíquico', category: 'Especial', pp: 10, power: 80, accuracy: 100, effectSummary: 'Dano psíquico que considera a Defesa do alvo.', effectFull: 'Calcule o dano usando SP.ATK do usuário contra DEF do alvo.' }),
  curatedAttack('attack-calm-mind', 'Calm Mind', { type: 'Psíquico', category: 'Status', pp: 20, power: null, accuracy: 100, target: 'Usuário', effectSummary: 'Aumenta SP.ATK e SP.DEF em 1 estágio.', effectFull: 'O usuário recebe +1 estágio de SP.ATK e +1 estágio de SP.DEF.' }),
  curatedAttack('attack-zen-headbutt', 'Zen Headbutt', { type: 'Psíquico', category: 'Físico', pp: 15, power: 80, accuracy: 90, makesContact: true, effectSummary: '20% de chance de causar Flinch.', effectFull: 'Após acertar, role 1d10. Resultado 9 ou 10: o alvo perde a ação.', statusChances: [{ effect: 'Flinch', chance: 20 }] }),

  curatedAttack('attack-icy-wind', 'Icy Wind', { type: 'Gelo', category: 'Especial', pp: 15, power: 55, accuracy: 95, target: 'Todos os oponentes próximos', effectSummary: 'Reduz SPEED dos alvos em 1 estágio.', effectFull: 'Atinge oponentes próximos; cada alvo recebe -1 estágio de SPEED.' }),
  curatedAttack('attack-icicle-crash', 'Icicle Crash', { type: 'Gelo', category: 'Físico', pp: 10, power: 85, accuracy: 90, effectSummary: '30% de chance de causar Flinch.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo perde a ação.', statusChances: [{ effect: 'Flinch', chance: 30 }] }),

  curatedAttack('attack-acid', 'Acid', { type: 'Veneno', category: 'Especial', pp: 30, power: 40, accuracy: 100, target: 'Todos os oponentes próximos', effectSummary: '10% de chance de reduzir SP.DEF.', effectFull: 'Atinge oponentes próximos; cada alvo tem 10% de chance de receber -1 estágio de SP.DEF.', statusChances: [{ effect: 'SP.DEF -1', chance: 10 }] }),
  curatedAttack('attack-poison-fang', 'Poison Fang', { type: 'Veneno', category: 'Físico', pp: 15, power: 50, accuracy: 100, makesContact: true, effectSummary: '50% de chance de causar Veneno.', effectFull: 'Após acertar, role 1d10. Resultado 1 a 5: o alvo fica Envenenado.', statusChances: [{ effect: 'Veneno', chance: 50 }] }),

  curatedAttack('attack-earth-power', 'Earth Power', { type: 'Terra', category: 'Especial', pp: 10, power: 90, accuracy: 100, effectSummary: '10% de chance de reduzir SP.DEF.', effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo recebe -1 estágio de SP.DEF.', statusChances: [{ effect: 'SP.DEF -1', chance: 10 }] }),
  curatedAttack('attack-drill-run', 'Drill Run', { type: 'Terra', category: 'Físico', pp: 10, power: 80, accuracy: 95, makesContact: true, critRange: 18, effectSummary: 'Investida com alta chance de crítico.', effectFull: 'O ataque causa crítico com 18 ou mais no teste de ataque.' }),

  curatedAttack('attack-rock-throw', 'Rock Throw', { type: 'Pedra', category: 'Físico', pp: 15, power: 50, accuracy: 90, effectSummary: 'Lança uma pedra contra o alvo.', effectFull: 'O usuário arremessa uma pedra no alvo.' }),

  curatedAttack('attack-pin-missile', 'Pin Missile', { type: 'Inseto', category: 'Físico', pp: 20, power: 25, accuracy: 95, effectSummary: 'Atinge de 2 a 5 vezes.', effectFull: 'Role 1d4+1 para determinar o número de acertos; cada acerto causa o dano deste movimento.' }),
  curatedAttack('attack-spider-web', 'Spider Web', { type: 'Inseto', category: 'Status', pp: 10, power: null, accuracy: 100, effectSummary: 'Impede o alvo de sair do campo.', effectFull: 'O alvo fica preso e não pode ser trocado até o fim do próximo turno.' }),

  curatedAttack('attack-shadow-claw', 'Shadow Claw', { type: 'Fantasma', category: 'Físico', pp: 15, power: 70, accuracy: 100, makesContact: true, critRange: 18, effectSummary: 'Ataque fantasma com alta chance de crítico.', effectFull: 'O ataque causa crítico com 18 ou mais no teste de ataque.' }),

  curatedAttack('attack-dragon-tail', 'Dragon Tail', { type: 'Dragão', category: 'Físico', pp: 10, power: 60, accuracy: 90, makesContact: true, priority: -6, effectSummary: 'Afasta o alvo e pode forçar uma troca.', effectFull: 'Depois de causar dano, o alvo é afastado; em batalha com substituições, o oponente escolhe outro Pokémon.' }),

  curatedAttack('attack-bite', 'Bite', { type: 'Sombrio', category: 'Físico', pp: 25, power: 60, accuracy: 100, makesContact: true, effectSummary: '30% de chance de causar Flinch.', effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo perde a ação.', statusChances: [{ effect: 'Flinch', chance: 30 }] }),
  curatedAttack('attack-crunch', 'Crunch', { type: 'Sombrio', category: 'Físico', pp: 15, power: 80, accuracy: 100, makesContact: true, effectSummary: '20% de chance de reduzir DEF.', effectFull: 'Após acertar, role 1d10. Resultado 9 ou 10: o alvo recebe -1 estágio de DEF.', statusChances: [{ effect: 'DEF -1', chance: 20 }] }),

  curatedAttack('attack-heavy-slam', 'Heavy Slam', { type: 'Metálico', category: 'Físico', pp: 10, power: 80, accuracy: 100, makesContact: true, effectSummary: 'O poder depende do peso do usuário.', effectFull: 'O mestre pode aumentar o poder conforme a diferença de peso: 40, 60, 80, 100 ou 120.' }),
  curatedAttack('attack-fairy-lock', 'Fairy Lock', { type: 'Fada', category: 'Status', pp: 10, power: null, accuracy: 100, target: 'Campo', effectSummary: 'Impede trocas no próximo turno.', effectFull: 'Até o fim do próximo turno, nenhum Pokémon pode sair do campo por troca.' }),
];

export const defaultAttacks: Attack[] = [
  commonAttack('attack-tackle', 'Tackle', {
    type: 'Normal', category: 'Físico', pp: 35, power: 40, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: true, effectSummary: 'Ataque físico básico.',
    effectFull: 'O Pokémon investe contra o alvo. Não possui efeito adicional.', statusChances: [], stab: true,
  }),
  commonAttack('attack-growl', 'Growl', {
    type: 'Normal', category: 'Status', pp: 40, power: null, accuracy: 100, critRange: 20,
    target: 'Todos os oponentes próximos', priority: 0, makesContact: false, effectSummary: 'Reduz ATK em 1 estágio.',
    effectFull: 'O alvo recebe -1 estágio de ATK. Em uma mesa, registre o estágio na ficha do alvo.', statusChances: [], stab: true,
  }),
  commonAttack('attack-tail-whip', 'Tail Whip', {
    type: 'Normal', category: 'Status', pp: 30, power: null, accuracy: 100, critRange: 20,
    target: 'Todos os oponentes próximos', priority: 0, makesContact: false, effectSummary: 'Reduz DEF em 1 estágio.',
    effectFull: 'O alvo recebe -1 estágio de DEF.', statusChances: [], stab: true,
  }),
  commonAttack('attack-protect', 'Protect', {
    type: 'Normal', category: 'Status', pp: 10, power: null, accuracy: 100, critRange: 20,
    target: 'Usuário', priority: 4, makesContact: false, effectSummary: 'Anula o próximo ataque recebido.',
    effectFull: 'Até o próximo turno, o usuário ignora o primeiro ataque que o acertaria. O mestre pode limitar usos consecutivos.', statusChances: [], stab: true,
  }),
  commonAttack('attack-rest', 'Rest', {
    type: 'Psíquico', category: 'Status', pp: 10, power: null, accuracy: 100, critRange: 20,
    target: 'Usuário', priority: 0, makesContact: false, effectSummary: 'Recupera PV, mas causa Sono.',
    effectFull: 'O usuário recupera 1d10 PV e fica com Sono por 2 turnos.', statusChances: [], stab: false,
  }),
  commonAttack('attack-bug-bite', 'Bug Bite', {
    type: 'Inseto', category: 'Físico', pp: 20, power: 60, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: true, effectSummary: 'Ataque físico de inseto.',
    effectFull: 'Se o alvo estiver segurando uma fruta, o usuário pode consumi-la conforme a decisão do mestre.', statusChances: [], stab: true,
  }),
  commonAttack('attack-confusion', 'Confusion', {
    type: 'Psíquico', category: 'Especial', pp: 25, power: 50, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '10% de chance de causar Confusão.',
    effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Confuso por 1d4 turnos.', statusChances: [{ effect: 'Confusão', chance: 10 }], stab: true,
  }),
  commonAttack('attack-psybeam', 'Psybeam', {
    type: 'Psíquico', category: 'Especial', pp: 20, power: 65, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '10% de chance de causar Confusão.',
    effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Confuso por 1d4 turnos.', statusChances: [{ effect: 'Confusão', chance: 10 }], stab: true,
  }),
  commonAttack('attack-struggle-bug', 'Struggle Bug', {
    type: 'Inseto', category: 'Especial', pp: 20, power: 50, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: 'Reduz SP.ATK em 1 estágio.',
    effectFull: 'O alvo recebe -1 estágio de SP.ATK.', statusChances: [], stab: true,
  }),
  commonAttack('attack-reflect', 'Reflect', {
    type: 'Psíquico', category: 'Status', pp: 20, power: null, accuracy: 100, critRange: 20,
    target: 'Aliados', priority: 0, makesContact: false, effectSummary: 'Aumenta a proteção física.',
    effectFull: 'Aliados recebem +2 em RD Física por 5 turnos.', statusChances: [], stab: false,
  }),
  commonAttack('attack-leaf-blade', 'Leaf Blade', {
    type: 'Planta', category: 'Físico', pp: 15, power: 90, accuracy: 100, critRange: 18,
    target: 'Alvo único', priority: 0, makesContact: true, effectSummary: 'Alta chance de acerto crítico.',
    effectFull: 'Este movimento causa crítico com 18 ou mais no teste de ataque.', statusChances: [], stab: true,
  }),
  commonAttack('attack-leaf-tornado', 'Leaf Tornado', {
    type: 'Planta', category: 'Especial', pp: 10, power: 65, accuracy: 90, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '10% de chance de reduzir ACC.',
    effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo recebe -1 estágio de Precisão.', statusChances: [{ effect: 'Precisão -1', chance: 10 }], stab: true,
  }),
  commonAttack('attack-fake-out', 'Fake Out', {
    type: 'Normal', category: 'Físico', pp: 10, power: 40, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 3, makesContact: true, effectSummary: 'Pode causar Flinch.',
    effectFull: 'No primeiro turno em que o usuário entra em cena, após acertar, role 1d10. Resultado 10: o alvo perde a ação.', statusChances: [{ effect: 'Flinch', chance: 10 }], stab: true,
  }),
  commonAttack('attack-feint', 'Feint', {
    type: 'Normal', category: 'Físico', pp: 10, power: 30, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 2, makesContact: true, effectSummary: 'Atinge mesmo sob Proteção.',
    effectFull: 'Ignora o efeito de Proteção do alvo neste turno.', statusChances: [], stab: true,
  }),
  commonAttack('attack-faint-attack', 'Faint Attack', {
    type: 'Sombrio', category: 'Físico', pp: 20, power: 60, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: true, effectSummary: 'Ataque que não falha por evasão.',
    effectFull: 'O teste de ataque não sofre penalidade por estágios de Evasão do alvo.', statusChances: [], stab: true,
  }),
  commonAttack('attack-growth', 'Growth', {
    type: 'Normal', category: 'Status', pp: 20, power: null, accuracy: 100, critRange: 20,
    target: 'Usuário', priority: 0, makesContact: false, effectSummary: 'Aumenta ATK e SP.ATK em 1 estágio.',
    effectFull: 'O usuário recebe +1 estágio de ATK e +1 estágio de SP.ATK.', statusChances: [], stab: true,
  }),
  commonAttack('attack-mega-drain', 'Mega Drain', {
    type: 'Planta', category: 'Especial', pp: 15, power: 40, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: 'Recupera PV igual à metade do dano.',
    effectFull: 'Depois do dano, o usuário recupera PV igual à metade do dano causado, arredondado para baixo.', statusChances: [], stab: true,
  }),
  commonAttack('attack-cotton-spore', 'Cotton Spore', {
    type: 'Planta', category: 'Status', pp: 40, power: null, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: 'Reduz SPEED em 2 estágios.',
    effectFull: 'O alvo recebe -2 estágios de SPEED.', statusChances: [], stab: true,
  }),
  commonAttack('attack-fairy-wind', 'Fairy Wind', {
    type: 'Fada', category: 'Especial', pp: 30, power: 40, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: 'Ataque especial de fada.',
    effectFull: 'Um sopro de energia feérica atinge o alvo.', statusChances: [], stab: true,
  }),
  commonAttack('attack-draining-kiss', 'Draining Kiss', {
    type: 'Fada', category: 'Especial', pp: 10, power: 50, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: 'Recupera PV igual à metade do dano.',
    effectFull: 'Depois do dano, o usuário recupera PV igual à metade do dano causado, arredondado para baixo.', statusChances: [], stab: true,
  }),
  commonAttack('attack-ember', 'Ember', {
    type: 'Fogo', category: 'Especial', pp: 25, power: 40, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '10% de chance de causar Queimadura.',
    effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Queimado.', statusChances: [{ effect: 'Queimadura', chance: 10 }], stab: true,
  }),
  commonAttack('attack-flamethrower', 'Flamethrower', {
    type: 'Fogo', category: 'Especial', pp: 15, power: 90, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '10% de chance de causar Queimadura.',
    effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Queimado.', statusChances: [{ effect: 'Queimadura', chance: 10 }], stab: true,
  }),
  commonAttack('attack-water-gun', 'Water Gun', {
    type: 'Água', category: 'Especial', pp: 25, power: 40, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: 'Ataque especial básico de água.',
    effectFull: 'O usuário dispara um jato de água contra o alvo.', statusChances: [], stab: true,
  }),
  commonAttack('attack-surf', 'Surf', {
    type: 'Água', category: 'Especial', pp: 15, power: 90, accuracy: 100, critRange: 20,
    target: 'Todos os oponentes próximos', priority: 0, makesContact: false, effectSummary: 'Atinge todos os oponentes próximos.',
    effectFull: 'Uma grande onda atinge todos os alvos próximos. O mestre decide os efeitos narrativos fora de combate.', statusChances: [], stab: true,
  }),
  commonAttack('attack-thunder-shock', 'Thunder Shock', {
    type: 'Elétrico', category: 'Especial', pp: 30, power: 40, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '10% de chance de causar Paralisia.',
    effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 10 }], stab: true,
  }),
  commonAttack('attack-thunderbolt', 'Thunderbolt', {
    type: 'Elétrico', category: 'Especial', pp: 15, power: 90, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '10% de chance de causar Paralisia.',
    effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Paralisado.', statusChances: [{ effect: 'Paralisia', chance: 10 }], stab: true,
  }),
  commonAttack('attack-vine-whip', 'Vine Whip', {
    type: 'Planta', category: 'Físico', pp: 25, power: 45, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: true, effectSummary: 'Ataque físico básico de planta.',
    effectFull: 'O usuário golpeia o alvo com vinhas.', statusChances: [], stab: true,
  }),
  commonAttack('attack-energy-ball', 'Energy Ball', {
    type: 'Planta', category: 'Especial', pp: 10, power: 90, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '10% de chance de reduzir SP.DEF.',
    effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo recebe -1 estágio de SP.DEF.', statusChances: [{ effect: 'SP.DEF -1', chance: 10 }], stab: true,
  }),
  commonAttack('attack-ice-shard', 'Ice Shard', {
    type: 'Gelo', category: 'Físico', pp: 30, power: 40, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 1, makesContact: false, effectSummary: 'Ataque de gelo com prioridade.',
    effectFull: 'O usuário lança um fragmento de gelo e age antes de ataques sem prioridade.', statusChances: [], stab: true,
  }),
  commonAttack('attack-ice-beam', 'Ice Beam', {
    type: 'Gelo', category: 'Especial', pp: 10, power: 90, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '10% de chance de causar Congelamento.',
    effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo fica Congelado, conforme as regras da mesa.', statusChances: [{ effect: 'Congelamento', chance: 10 }], stab: true,
  }),
  commonAttack('attack-mach-punch', 'Mach Punch', {
    type: 'Lutador', category: 'Físico', pp: 30, power: 40, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 1, makesContact: true, effectSummary: 'Ataque físico com prioridade.',
    effectFull: 'O usuário desfere um soco veloz e age antes de ataques sem prioridade.', statusChances: [], stab: true,
  }),
  commonAttack('attack-close-combat', 'Close Combat', {
    type: 'Lutador', category: 'Físico', pp: 5, power: 120, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: true, effectSummary: 'Grande dano, mas reduz DEF e SP.DEF do usuário.',
    effectFull: 'Depois do dano, o usuário recebe -1 estágio de DEF e -1 estágio de SP.DEF.', statusChances: [], stab: true,
  }),
  commonAttack('attack-brick-break', 'Brick Break', {
    type: 'Lutador', category: 'Físico', pp: 15, power: 75, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: true, effectSummary: 'Remove Reflect e efeitos defensivos semelhantes.',
    effectFull: 'Antes do dano, remova Reflect, Light Screen ou efeito equivalente do lado do alvo.', statusChances: [], stab: true,
  }),
  commonAttack('attack-earthquake', 'Earthquake', {
    type: 'Terra', category: 'Físico', pp: 10, power: 100, accuracy: 100, critRange: 20,
    target: 'Todos os oponentes próximos', priority: 0, makesContact: false, effectSummary: 'Atinge todos os oponentes próximos.',
    effectFull: 'O usuário provoca um terremoto que atinge todos os alvos próximos.', statusChances: [], stab: true,
  }),
  commonAttack('attack-rock-slide', 'Rock Slide', {
    type: 'Pedra', category: 'Físico', pp: 10, power: 75, accuracy: 90, critRange: 20,
    target: 'Todos os oponentes próximos', priority: 0, makesContact: false, effectSummary: '30% de chance de causar Flinch.',
    effectFull: 'Após acertar, role 1d10. Resultado 8, 9 ou 10: o alvo perde a ação.', statusChances: [{ effect: 'Flinch', chance: 30 }], stab: true,
  }),
  commonAttack('attack-aerial-ace', 'Aerial Ace', {
    type: 'Voador', category: 'Físico', pp: 20, power: 60, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: true, effectSummary: 'Não falha por evasão.',
    effectFull: 'O teste de ataque não sofre penalidade por estágios de Evasão do alvo.', statusChances: [], stab: true,
  }),
  commonAttack('attack-psychic', 'Psychic', {
    type: 'Psíquico', category: 'Especial', pp: 10, power: 90, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '10% de chance de reduzir SP.DEF.',
    effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo recebe -1 estágio de SP.DEF.', statusChances: [{ effect: 'SP.DEF -1', chance: 10 }], stab: true,
  }),
  commonAttack('attack-shadow-ball', 'Shadow Ball', {
    type: 'Fantasma', category: 'Especial', pp: 15, power: 80, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '20% de chance de reduzir SP.DEF.',
    effectFull: 'Após acertar, role 1d10. Resultado 9 ou 10: o alvo recebe -1 estágio de SP.DEF.', statusChances: [{ effect: 'SP.DEF -1', chance: 20 }], stab: true,
  }),
  commonAttack('attack-dark-pulse', 'Dark Pulse', {
    type: 'Sombrio', category: 'Especial', pp: 15, power: 80, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: '20% de chance de causar Flinch.',
    effectFull: 'Após acertar, role 1d10. Resultado 9 ou 10: o alvo perde a ação.', statusChances: [{ effect: 'Flinch', chance: 20 }], stab: true,
  }),
  commonAttack('attack-dragon-claw', 'Dragon Claw', {
    type: 'Dragão', category: 'Físico', pp: 15, power: 80, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: true, effectSummary: 'Ataque físico confiável de dragão.',
    effectFull: 'O usuário corta o alvo com garras afiadas.', statusChances: [], stab: true,
  }),
  commonAttack('attack-play-rough', 'Play Rough', {
    type: 'Fada', category: 'Físico', pp: 10, power: 90, accuracy: 90, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: true, effectSummary: '10% de chance de reduzir ATK.',
    effectFull: 'Após acertar, role 1d10. Resultado 10: o alvo recebe -1 estágio de ATK.', statusChances: [{ effect: 'ATK -1', chance: 10 }], stab: true,
  }),
  commonAttack('attack-u-turn', 'U-turn', {
    type: 'Inseto', category: 'Físico', pp: 20, power: 70, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: true, effectSummary: 'Permite trocar depois de causar dano.',
    effectFull: 'Depois do dano, o usuário pode sair de cena e ser substituído por um aliado disponível.', statusChances: [], stab: true,
  }),
  commonAttack('attack-volt-switch', 'Volt Switch', {
    type: 'Elétrico', category: 'Especial', pp: 20, power: 70, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: 'Permite trocar depois de causar dano.',
    effectFull: 'Depois do dano, o usuário pode sair de cena e ser substituído por um aliado disponível.', statusChances: [], stab: true,
  }),
  commonAttack('attack-roost', 'Roost', {
    type: 'Voador', category: 'Status', pp: 10, power: null, accuracy: 100, critRange: 20,
    target: 'Usuário', priority: 0, makesContact: false, effectSummary: 'Recupera metade dos PV máximos.',
    effectFull: 'O usuário recupera 1d10 PV ou metade de seus PV máximos, conforme o padrão usado na mesa.', statusChances: [], stab: true,
  }),
  commonAttack('attack-swords-dance', 'Swords Dance', {
    type: 'Normal', category: 'Status', pp: 20, power: null, accuracy: 100, critRange: 20,
    target: 'Usuário', priority: 0, makesContact: false, effectSummary: 'Aumenta ATK em 2 estágios.',
    effectFull: 'O usuário recebe +2 estágios de ATK.', statusChances: [], stab: true,
  }),
  commonAttack('attack-nasty-plot', 'Nasty Plot', {
    type: 'Sombrio', category: 'Status', pp: 20, power: null, accuracy: 100, critRange: 20,
    target: 'Usuário', priority: 0, makesContact: false, effectSummary: 'Aumenta SP.ATK em 2 estágios.',
    effectFull: 'O usuário recebe +2 estágios de SP.ATK.', statusChances: [], stab: true,
  }),
  commonAttack('attack-thunder-wave', 'Thunder Wave', {
    type: 'Elétrico', category: 'Status', pp: 20, power: null, accuracy: 90, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: 'Causa Paralisia.',
    effectFull: 'O alvo fica Paralisado. O mestre pode aplicar as penalidades de velocidade e chance de perder a ação da mesa.', statusChances: [{ effect: 'Paralisia', chance: 100 }], stab: true,
  }),
  commonAttack('attack-will-o-wisp', 'Will-O-Wisp', {
    type: 'Fogo', category: 'Status', pp: 15, power: null, accuracy: 85, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: 'Causa Queimadura.',
    effectFull: 'O alvo fica Queimado.', statusChances: [{ effect: 'Queimadura', chance: 100 }], stab: true,
  }),
  commonAttack('attack-toxic', 'Toxic', {
    type: 'Veneno', category: 'Status', pp: 10, power: null, accuracy: 90, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: 'Causa Veneno grave.',
    effectFull: 'O alvo fica Envenenado. O mestre pode aumentar o dano do veneno a cada rodada.', statusChances: [{ effect: 'Veneno', chance: 100 }], stab: true,
  }),
  commonAttack('attack-taunt', 'Taunt', {
    type: 'Sombrio', category: 'Status', pp: 20, power: null, accuracy: 100, critRange: 20,
    target: 'Alvo único', priority: 0, makesContact: false, effectSummary: 'Impede o uso de golpes de Status.',
    effectFull: 'Por 3 turnos, o alvo só pode usar golpes Físicos ou Especiais.', statusChances: [], stab: true,
  }),
  commonAttack('attack-substitute', 'Substitute', {
    type: 'Normal', category: 'Status', pp: 10, power: null, accuracy: 100, critRange: 20,
    target: 'Usuário', priority: 0, makesContact: false, effectSummary: 'Cria um substituto que absorve dano.',
    effectFull: 'O usuário perde 1d4 PV para criar um substituto. O substituto absorve dano até ser destruído.', statusChances: [], stab: true,
  }),
  ...additionalAttacks,
];

const seededStats = (hp: number, atk: number, def: number, spAtk: number, spDef: number, spe: number) => ({
  hp: { base: hp, levelPoints: 0, ev: 0, iv: 'C' as const },
  atk: { base: atk, levelPoints: 0, ev: 0, iv: 'C' as const },
  def: { base: def, levelPoints: 0, ev: 0, iv: 'C' as const },
  spAtk: { base: spAtk, levelPoints: 0, ev: 0, iv: 'C' as const },
  spDef: { base: spDef, levelPoints: 0, ev: 0, iv: 'C' as const },
  spe: { base: spe, levelPoints: 0, ev: 0, iv: 'C' as const },
});

const seededPokemon = (
  id: string,
  name: string,
  species: string,
  level: number,
  types: Pokemon['types'],
  stats: Pokemon['stats'],
  attacks: string[],
  description: string,
): Omit<Pokemon, 'id' | 'createdAt'> => ({
  ...defaultPokemonTemplate,
  hp: computeDerivedStats(stats, 21, { ...defaultStages }).hp,
  hpMax: computeDerivedStats(stats, 21, { ...defaultStages }).hp,
  name, species, level, types, stats, attacks, inDex: true,
  pokedexDescription: description,
  stages: { ...defaultStages },
  id,
} as Omit<Pokemon, 'id' | 'createdAt'>);

export const defaultPokemon: Array<Omit<Pokemon, 'id' | 'createdAt'>> = [
  seededPokemon('pokemon-orbeetle', 'Orbeetle', 'Orbeetle', 32, ['Inseto', 'Psíquico'], seededStats(60, 45, 110, 80, 120, 90), ['attack-tackle', 'attack-confusion', 'attack-struggle-bug', 'attack-reflect'], 'Um Pokémon observador que usa ondas psíquicas para mapear o ambiente e proteger seu treinador.'),
  seededPokemon('pokemon-duosion', 'Duosion', 'Duosion', 34, ['Psíquico'], seededStats(65, 40, 50, 125, 60, 30), ['attack-tackle', 'attack-confusion', 'attack-psybeam', 'attack-rest'], 'As duas mentes de Duosion raramente concordam, mas juntas produzem uma força psíquica extraordinária.'),
  seededPokemon('pokemon-shiftry', 'Shiftry', 'Shiftry', 14, ['Planta', 'Sombrio'], seededStats(90, 100, 60, 90, 60, 80), ['attack-tackle', 'attack-fake-out', 'attack-growth', 'attack-leaf-blade'], 'Dizem que o vento criado pelos leques de suas folhas pode carregar um viajante para longe.'),
  seededPokemon('pokemon-cottonne', 'Cottonne', 'Cottonne', 17, ['Planta', 'Fada'], seededStats(40, 27, 60, 37, 50, 66), ['attack-tackle', 'attack-fairy-wind', 'attack-cotton-spore', 'attack-mega-drain'], 'Leve como uma nuvem, Cottonne se deixa levar pelo vento e espalha sementes macias por onde passa.'),
];

const berry = (id: string, name: string, detail: string) => ({
  id: `berry-${id}`,
  name,
  category: 'Berries',
  weight: 0,
  detail,
  holdable: true,
});

export const defaultProvisionalItems = [
  { id: 'item-potion', name: 'Poção', category: 'Consumíveis', weight: 1, detail: 'Recupera 1d10 PV de um Pokémon.', holdable: true },
  { id: 'item-super-potion', name: 'Super Poção', category: 'Consumíveis', weight: 1, detail: 'Recupera 2d10 PV de um Pokémon.', holdable: true },
  { id: 'item-hyper-potion', name: 'Hiper Poção', category: 'Consumíveis', weight: 1, detail: 'Recupera 4d10 PV de um Pokémon.', holdable: true },
  { id: 'item-max-potion', name: 'Poção Máxima', category: 'Consumíveis', weight: 1, detail: 'Recupera todos os PV de um Pokémon.', holdable: true },
  { id: 'item-antidote', name: 'Antídoto', category: 'Consumíveis', weight: 1, detail: 'Remove Veneno de um Pokémon.', holdable: true },
  { id: 'item-paralyze-heal', name: 'Cura Paralisia', category: 'Consumíveis', weight: 1, detail: 'Remove Paralisia de um Pokémon.', holdable: true },
  { id: 'item-awakening', name: 'Despertar', category: 'Consumíveis', weight: 1, detail: 'Remove Sono de um Pokémon.', holdable: true },
  { id: 'item-burn-heal', name: 'Cura Queimadura', category: 'Consumíveis', weight: 1, detail: 'Remove Queimadura de um Pokémon.', holdable: true },
  { id: 'item-ice-heal', name: 'Cura Congelamento', category: 'Consumíveis', weight: 1, detail: 'Remove Congelamento de um Pokémon.', holdable: true },
  { id: 'item-full-heal', name: 'Cura Total', category: 'Consumíveis', weight: 1, detail: 'Remove todos os estados negativos de um Pokémon.', holdable: true },
  { id: 'item-revive', name: 'Reviver', category: 'Consumíveis', weight: 1, detail: 'Um Pokémon Incapacitado retorna com 1d10 PV.', holdable: true },
  { id: 'item-max-revive', name: 'Reviver Máximo', category: 'Consumíveis', weight: 1, detail: 'Um Pokémon Incapacitado retorna com todos os PV.', holdable: true },
  { id: 'item-pokeball', name: 'Poké Bola', category: 'Pokebolas', weight: 1, detail: 'Tente capturar um Pokémon selvagem: role 1d20 + bônus de captura contra a DT definida pelo mestre.', holdable: false },
  { id: 'item-greatball', name: 'Great Ball', category: 'Pokebolas', weight: 1, detail: 'Poké Bola aprimorada: +2 no teste de captura.', holdable: false },
  { id: 'item-ultraball', name: 'Ultra Ball', category: 'Pokebolas', weight: 1, detail: 'Poké Bola avançada: +4 no teste de captura.', holdable: false },
  { id: 'item-premierball', name: 'Premier Ball', category: 'Pokebolas', weight: 1, detail: 'Poké Bola comemorativa, sem bônus mecânico adicional.', holdable: false },
  { id: 'item-escape-rope', name: 'Corda de Fuga', category: 'Itens Chave', weight: 1, detail: 'Fora de combate, retorna o grupo ao último local seguro conhecido.', holdable: false },
  { id: 'item-repel', name: 'Repelente', category: 'Itens Chave', weight: 1, detail: 'Por uma cena, encontros selvagens comuns não interrompem a exploração.', holdable: false },
  { id: 'item-rare-candy', name: 'Rare Candy', category: 'Especiais', weight: 0, detail: 'Concede EXP suficiente para alcançar o próximo nível, sem ultrapassar o limite.', holdable: false },
  { id: 'item-x-attack', name: 'X Attack', category: 'Batalha', weight: 1, detail: 'Ação: concede +1 estágio de ATK por 3 turnos.', holdable: true },
  { id: 'item-x-defend', name: 'X Defend', category: 'Batalha', weight: 1, detail: 'Ação: concede +1 estágio de DEF por 3 turnos.', holdable: true },
  { id: 'item-x-special', name: 'X Special', category: 'Batalha', weight: 1, detail: 'Ação: concede +1 estágio de SP.ATK por 3 turnos.', holdable: true },
  { id: 'item-x-speed', name: 'X Speed', category: 'Batalha', weight: 1, detail: 'Ação: concede +1 estágio de SPEED por 3 turnos.', holdable: true },
  { id: 'item-guard-spec', name: 'Guard Spec.', category: 'Batalha', weight: 1, detail: 'Protege os aliados contra redução de estágios por 3 turnos.', holdable: true },
  { id: 'item-dire-hit', name: 'Dire Hit', category: 'Batalha', weight: 1, detail: 'Concede +1 estágio de crítico por 3 turnos.', holdable: true },
  { id: 'item-leftovers', name: 'Leftovers', category: 'Batalha', weight: 1, detail: 'No fim de cada turno, recupera 1d4 PV enquanto estiver segurado.', holdable: true },
  { id: 'item-focus-sash', name: 'Focus Sash', category: 'Batalha', weight: 1, detail: 'Uma vez por cena, ao sofrer dano que o deixaria Incapacitado com PV cheio, fica com 1 PV.', holdable: true },
  { id: 'item-life-orb', name: 'Life Orb', category: 'Batalha', weight: 1, detail: 'Ataques causam +2 de dano, mas o usuário perde 1 PV após causar dano.', holdable: true },
  { id: 'item-razor-claw', name: 'Razor Claw', category: 'Batalha', weight: 1, detail: 'Reduz em 2 a margem necessária para um acerto crítico.', holdable: true },
  { id: 'item-lucky-egg', name: 'Lucky Egg', category: 'Batalha', weight: 1, detail: 'Quando participa de um encontro, recebe +20% de EXP ao final.', holdable: true },
  { id: 'item-sitrus', name: 'Sitrus Berry', category: 'Berries', weight: 0, detail: 'Ao chegar a metade dos PV ou menos, consome-se e recupera 2d6 PV.', holdable: true },
  berry('cheri', 'Cheri Berry', 'Ao ser consumida, remove Paralisia.'),
  berry('chesto', 'Chesto Berry', 'Ao ser consumida, remove Sono.'),
  berry('pecha', 'Pecha Berry', 'Ao ser consumida, remove Veneno.'),
  berry('rawst', 'Rawst Berry', 'Ao ser consumida, remove Queimadura.'),
  berry('aspear', 'Aspear Berry', 'Ao ser consumida, remove Congelamento.'),
  berry('leppa', 'Leppa Berry', 'Ao ser consumida, recupera 1 uso de um ataque esgotado.'),
  berry('oran', 'Oran Berry', 'Ao chegar a metade dos PV ou menos, consome-se e recupera 1d10 PV.'),
  berry('persim', 'Persim Berry', 'Ao ser consumida, remove Confusão.'),
  berry('lum', 'Lum Berry', 'Ao ser consumida, remove um estado negativo à escolha do mestre.'),
  berry('figy', 'Figy Berry', 'Recupera 2d6 PV; em uma falha de Vontade (DT 10), causa Confusão por 1 turno.'),
  berry('wiki', 'Wiki Berry', 'Recupera 2d6 PV; em uma falha de Vontade (DT 10), causa Confusão por 1 turno.'),
  berry('mago', 'Mago Berry', 'Recupera 2d6 PV; em uma falha de Vontade (DT 10), causa Confusão por 1 turno.'),
  berry('aguav', 'Aguav Berry', 'Recupera 2d6 PV; em uma falha de Vontade (DT 10), causa Confusão por 1 turno.'),
  berry('iapapa', 'Iapapa Berry', 'Recupera 2d6 PV; em uma falha de Vontade (DT 10), causa Confusão por 1 turno.'),
  berry('razz', 'Razz Berry', 'Em captura, concede +2 no teste quando oferecida ao Pokémon selvagem.'),
  berry('bluk', 'Bluk Berry', 'Em testes de Artes ou Diplomacia para acalmar um Pokémon, concede +2.'),
  berry('nanab', 'Nanab Berry', 'Em testes de Furtividade ou Reflexo para se aproximar, concede +2.'),
  berry('wepear', 'Wepear Berry', 'Ingrediente: após uma cena de descanso, recupera 1d6 PE de um treinador.'),
  berry('pinap', 'Pinap Berry', 'Ao capturar um Pokémon, dobra os recursos ou materiais obtidos na cena.'),
  berry('pomeg', 'Pomeg Berry', 'Remove 1d4 pontos de EV de HP, se a mesa usar redução de EV.'),
  berry('kelpsy', 'Kelpsy Berry', 'Remove 1d4 pontos de EV de ATK, se a mesa usar redução de EV.'),
  berry('qualot', 'Qualot Berry', 'Remove 1d4 pontos de EV de DEF, se a mesa usar redução de EV.'),
  berry('hondew', 'Hondew Berry', 'Remove 1d4 pontos de EV de SP.ATK, se a mesa usar redução de EV.'),
  berry('grepa', 'Grepa Berry', 'Remove 1d4 pontos de EV de SP.DEF, se a mesa usar redução de EV.'),
  berry('tamato', 'Tamato Berry', 'Remove 1d4 pontos de EV de SPEED, se a mesa usar redução de EV.'),
  berry('cornn', 'Cornn Berry', 'Ingrediente raro: concede +2 em um teste de Ofício para preparar alimentos.'),
  berry('magost', 'Magost Berry', 'Ingrediente raro: concede +2 em um teste de Medicina para preparar remédios.'),
  berry('rabuta', 'Rabuta Berry', 'Ingrediente raro: concede +2 em um teste de Sobrevivência em ambiente selvagem.'),
  berry('nomel', 'Nomel Berry', 'Ingrediente raro: concede +2 em um teste de Tecnologia para improvisar equipamento.'),
  berry('spelon', 'Spelon Berry', 'Ingrediente raro: concede +2 em um teste de Intimidação após ser oferecida como troféu.'),
  berry('pamtre', 'Pamtre Berry', 'Ingrediente raro: concede +2 em um teste de Diplomacia com colecionadores.'),
  berry('watmel', 'Watmel Berry', 'Ingrediente raro: concede +2 em um teste de Artes ou Performance.'),
  berry('durin', 'Durin Berry', 'Ingrediente raro: concede +2 em um teste de Fortitude contra calor.'),
  berry('belue', 'Belue Berry', 'Ingrediente raro: concede +2 em um teste de Intuição para perceber emoções.'),
  berry('occa', 'Occa Berry', 'Reduz pela metade o dano de um ataque de Fogo, uma vez, e então é consumida.'),
  berry('passho', 'Passho Berry', 'Reduz pela metade o dano de um ataque de Água, uma vez, e então é consumida.'),
  berry('wacan', 'Wacan Berry', 'Reduz pela metade o dano de um ataque Elétrico, uma vez, e então é consumida.'),
  berry('rindo', 'Rindo Berry', 'Reduz pela metade o dano de um ataque de Planta, uma vez, e então é consumida.'),
  berry('yache', 'Yache Berry', 'Reduz pela metade o dano de um ataque de Gelo, uma vez, e então é consumida.'),
  berry('chople', 'Chople Berry', 'Reduz pela metade o dano de um ataque Lutador, uma vez, e então é consumida.'),
  berry('kebia', 'Kebia Berry', 'Reduz pela metade o dano de um ataque de Veneno, uma vez, e então é consumida.'),
  berry('shuca', 'Shuca Berry', 'Reduz pela metade o dano de um ataque de Terra, uma vez, e então é consumida.'),
  berry('coba', 'Coba Berry', 'Reduz pela metade o dano de um ataque Voador, uma vez, e então é consumida.'),
  berry('payapa', 'Payapa Berry', 'Reduz pela metade o dano de um ataque Psíquico, uma vez, e então é consumida.'),
  berry('tanga', 'Tanga Berry', 'Reduz pela metade o dano de um ataque de Inseto, uma vez, e então é consumida.'),
  berry('charti', 'Charti Berry', 'Reduz pela metade o dano de um ataque de Pedra, uma vez, e então é consumida.'),
  berry('kasib', 'Kasib Berry', 'Reduz pela metade o dano de um ataque Fantasma, uma vez, e então é consumida.'),
  berry('haban', 'Haban Berry', 'Reduz pela metade o dano de um ataque Dragão, uma vez, e então é consumida.'),
  berry('colbur', 'Colbur Berry', 'Reduz pela metade o dano de um ataque Sombrio, uma vez, e então é consumida.'),
  berry('babiri', 'Babiri Berry', 'Reduz pela metade o dano de um ataque Metálico, uma vez, e então é consumida.'),
  berry('chilan', 'Chilan Berry', 'Reduz pela metade o dano de um ataque Normal, uma vez, e então é consumida.'),
  berry('roseli', 'Roseli Berry', 'Reduz pela metade o dano de um ataque Fada, uma vez, e então é consumida.'),
  berry('liechi', 'Liechi Berry', 'Ao chegar a 25% dos PV ou menos, concede +1 estágio de ATK e é consumida.'),
  berry('ganlon', 'Ganlon Berry', 'Ao chegar a 25% dos PV ou menos, concede +1 estágio de DEF e é consumida.'),
  berry('salac', 'Salac Berry', 'Ao chegar a 25% dos PV ou menos, concede +1 estágio de SPEED e é consumida.'),
  berry('petaya', 'Petaya Berry', 'Ao chegar a 25% dos PV ou menos, concede +1 estágio de SP.ATK e é consumida.'),
  berry('apicot', 'Apicot Berry', 'Ao chegar a 25% dos PV ou menos, concede +1 estágio de SP.DEF e é consumida.'),
  berry('lansat', 'Lansat Berry', 'Ao chegar a 25% dos PV ou menos, concede +1 estágio de crítico e é consumida.'),
  berry('starf', 'Starf Berry', 'Ao chegar a 25% dos PV ou menos, concede +2 em um estágio aleatório e é consumida.'),
  berry('enigma', 'Enigma Berry', 'Ao sofrer dano super efetivo, recupera 2d6 PV e é consumida.'),
  berry('micle', 'Micle Berry', 'Ao chegar a 25% dos PV ou menos, concede +2 no próximo teste de ataque e é consumida.'),
  berry('custap', 'Custap Berry', 'Ao chegar a 25% dos PV ou menos, permite agir imediatamente uma vez e é consumida.'),
  berry('jaboca', 'Jaboca Berry', 'Quando atingido por golpe físico, o atacante perde 1d6 PV e a berry é consumida.'),
  berry('rowap', 'Rowap Berry', 'Quando atingido por golpe especial, o atacante perde 1d6 PV e a berry é consumida.'),
  berry('kee', 'Kee Berry', 'Ao ser atingido por golpe físico, concede +1 estágio de DEF e é consumida.'),
  berry('maranga', 'Maranga Berry', 'Ao ser atingido por golpe especial, concede +1 estágio de SP.DEF e é consumida.'),
];
