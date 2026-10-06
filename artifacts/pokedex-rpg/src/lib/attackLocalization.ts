import type { Attack } from './types';

const moveNames: Record<string, { english: string; portuguese: string }> = {
  'attack-tackle': { english: 'Tackle', portuguese: 'Investida' },
  'attack-growl': { english: 'Growl', portuguese: 'Rosnado' },
  'attack-tail-whip': { english: 'Tail Whip', portuguese: 'Chicote de Cauda' },
  'attack-protect': { english: 'Protect', portuguese: 'Proteção' },
  'attack-rest': { english: 'Rest', portuguese: 'Descanso' },
  'attack-bug-bite': { english: 'Bug Bite', portuguese: 'Mordida de Inseto' },
  'attack-confusion': { english: 'Confusion', portuguese: 'Confusão' },
  'attack-psybeam': { english: 'Psybeam', portuguese: 'Raio Psíquico' },
  'attack-struggle-bug': { english: 'Struggle Bug', portuguese: 'Investida de Inseto' },
  'attack-reflect': { english: 'Reflect', portuguese: 'Reflexo' },
  'attack-leaf-blade': { english: 'Leaf Blade', portuguese: 'Lâmina de Folha' },
  'attack-leaf-tornado': { english: 'Leaf Tornado', portuguese: 'Tornado de Folhas' },
  'attack-fake-out': { english: 'Fake Out', portuguese: 'Surpresa' },
  'attack-feint': { english: 'Feint', portuguese: 'Finta' },
  'attack-faint-attack': { english: 'Faint Attack', portuguese: 'Ataque Surpresa' },
  'attack-growth': { english: 'Growth', portuguese: 'Crescimento' },
  'attack-mega-drain': { english: 'Mega Drain', portuguese: 'Mega Dreno' },
  'attack-cotton-spore': { english: 'Cotton Spore', portuguese: 'Esporo de Algodão' },
  'attack-fairy-wind': { english: 'Fairy Wind', portuguese: 'Vento de Fada' },
  'attack-draining-kiss': { english: 'Draining Kiss', portuguese: 'Beijo Drenante' },
  'attack-ember': { english: 'Ember', portuguese: 'Brasa' },
  'attack-flamethrower': { english: 'Flamethrower', portuguese: 'Lança-Chamas' },
  'attack-water-gun': { english: 'Water Gun', portuguese: 'Jato d’Água' },
  'attack-surf': { english: 'Surf', portuguese: 'Surfe' },
  'attack-thunder-shock': { english: 'Thunder Shock', portuguese: 'Choque do Trovão' },
  'attack-thunderbolt': { english: 'Thunderbolt', portuguese: 'Relâmpago' },
  'attack-vine-whip': { english: 'Vine Whip', portuguese: 'Chicote de Cipó' },
  'attack-energy-ball': { english: 'Energy Ball', portuguese: 'Esfera de Energia' },
  'attack-ice-shard': { english: 'Ice Shard', portuguese: 'Estilhaço de Gelo' },
  'attack-ice-beam': { english: 'Ice Beam', portuguese: 'Raio de Gelo' },
  'attack-mach-punch': { english: 'Mach Punch', portuguese: 'Soco Rápido' },
  'attack-close-combat': { english: 'Close Combat', portuguese: 'Combate Corpo a Corpo' },
  'attack-brick-break': { english: 'Brick Break', portuguese: 'Quebra de Tijolo' },
  'attack-earthquake': { english: 'Earthquake', portuguese: 'Terremoto' },
  'attack-rock-slide': { english: 'Rock Slide', portuguese: 'Deslizamento de Rochas' },
  'attack-aerial-ace': { english: 'Aerial Ace', portuguese: 'Ás Aéreo' },
  'attack-psychic': { english: 'Psychic', portuguese: 'Psíquico' },
  'attack-shadow-ball': { english: 'Shadow Ball', portuguese: 'Bola Sombria' },
  'attack-dark-pulse': { english: 'Dark Pulse', portuguese: 'Pulso Sombrio' },
  'attack-dragon-claw': { english: 'Dragon Claw', portuguese: 'Garra de Dragão' },
  'attack-play-rough': { english: 'Play Rough', portuguese: 'Brincadeira Bruta' },
  'attack-u-turn': { english: 'U-turn', portuguese: 'Reviravolta' },
  'attack-volt-switch': { english: 'Volt Switch', portuguese: 'Troca Elétrica' },
  'attack-roost': { english: 'Roost', portuguese: 'Pouso' },
  'attack-swords-dance': { english: 'Swords Dance', portuguese: 'Dança das Espadas' },
  'attack-nasty-plot': { english: 'Nasty Plot', portuguese: 'Trama Maliciosa' },
  'attack-thunder-wave': { english: 'Thunder Wave', portuguese: 'Onda de Trovão' },
  'attack-will-o-wisp': { english: 'Will-O-Wisp', portuguese: 'Fogo-Fátuo' },
  'attack-toxic': { english: 'Toxic', portuguese: 'Tóxico' },
  'attack-taunt': { english: 'Taunt', portuguese: 'Provocação' },
  'attack-substitute': { english: 'Substitute', portuguese: 'Substituto' },
  'attack-thunder': { english: 'Thunder', portuguese: 'Trovão' },
  'attack-spark': { english: 'Spark', portuguese: 'Faísca' },
  'attack-wild-charge': { english: 'Wild Charge', portuguese: 'Carga Selvagem' },
  'attack-bug-buzz': { english: 'Bug Buzz', portuguese: 'Zumbido de Inseto' },
  'attack-x-scissor': { english: 'X-Scissor', portuguese: 'Tesoura X' },
  'attack-leech-life': { english: 'Leech Life', portuguese: 'Dreno Vital' },
  'attack-pollen-puff': { english: 'Pollen Puff', portuguese: 'Bola de Pólen' },
  'attack-first-impression': { english: 'First Impression', portuguese: 'Primeira Impressão' },
  'attack-moonblast': { english: 'Moonblast', portuguese: 'Explosão Lunar' },
  'attack-dazzling-gleam': { english: 'Dazzling Gleam', portuguese: 'Brilho Deslumbrante' },
  'attack-misty-terrain': { english: 'Misty Terrain', portuguese: 'Terreno Nebuloso' },
  'attack-play-nice': { english: 'Play Nice', portuguese: 'Brincar Junto' },
  'attack-spirit-break': { english: 'Spirit Break', portuguese: 'Quebra de Espírito' },
  'attack-fire-blast': { english: 'Fire Blast', portuguese: 'Explosão de Fogo' },
  'attack-heat-wave': { english: 'Heat Wave', portuguese: 'Onda de Calor' },
  'attack-flame-charge': { english: 'Flame Charge', portuguese: 'Investida Flamejante' },
  'attack-fire-fang': { english: 'Fire Fang', portuguese: 'Presa de Fogo' },
  'attack-overheat': { english: 'Overheat', portuguese: 'Superaquecimento' },
  'attack-focus-blast': { english: 'Focus Blast', portuguese: 'Explosão Focalizada' },
  'attack-drain-punch': { english: 'Drain Punch', portuguese: 'Soco Drenante' },
  'attack-bulk-up': { english: 'Bulk Up', portuguese: 'Aumento de Massa' },
  'attack-low-sweep': { english: 'Low Sweep', portuguese: 'Rasteira' },
  'attack-aura-sphere': { english: 'Aura Sphere', portuguese: 'Esfera de Aura' },
  'attack-hydro-pump': { english: 'Hydro Pump', portuguese: 'Hidrobomba' },
  'attack-aqua-jet': { english: 'Aqua Jet', portuguese: 'Jato Aquático' },
  'attack-waterfall': { english: 'Waterfall', portuguese: 'Cachoeira' },
  'attack-scald': { english: 'Scald', portuguese: 'Escaldar' },
  'attack-liquidation': { english: 'Liquidation', portuguese: 'Liquidação' },
  'attack-bubble-beam': { english: 'Bubble Beam', portuguese: 'Raio de Bolhas' },
  'attack-blizzard': { english: 'Blizzard', portuguese: 'Nevasca' },
  'attack-aurora-beam': { english: 'Aurora Beam', portuguese: 'Raio Aurora' },
  'attack-ice-punch': { english: 'Ice Punch', portuguese: 'Soco de Gelo' },
  'attack-avalanche': { english: 'Avalanche', portuguese: 'Avalanche' },
  'attack-freeze-dry': { english: 'Freeze-Dry', portuguese: 'Secagem Congelante' },
  'attack-triple-axel': { english: 'Triple Axel', portuguese: 'Triplo Axel' },
  'attack-brave-bird': { english: 'Brave Bird', portuguese: 'Pássaro Bravo' },
  'attack-hurricane': { english: 'Hurricane', portuguese: 'Furacão' },
  'attack-air-slash': { english: 'Air Slash', portuguese: 'Corte de Ar' },
  'attack-wing-attack': { english: 'Wing Attack', portuguese: 'Ataque de Asa' },
  'attack-fly': { english: 'Fly', portuguese: 'Voar' },
  'attack-tailwind': { english: 'Tailwind', portuguese: 'Vento a Favor' },
  'attack-dig': { english: 'Dig', portuguese: 'Escavar' },
  'attack-mud-shot': { english: 'Mud Shot', portuguese: 'Tiro de Lama' },
  'attack-bulldoze': { english: 'Bulldoze', portuguese: 'Pisoteio' },
  'attack-bonemerang': { english: 'Bonemerang', portuguese: 'Bumerangue de Osso' },
  'attack-mud-slap': { english: 'Mud-Slap', portuguese: 'Tapa de Lama' },
  'attack-high-horsepower': { english: 'High Horsepower', portuguese: 'Força Equina' },
  'attack-stone-edge': { english: 'Stone Edge', portuguese: 'Gume de Pedra' },
  'attack-rock-blast': { english: 'Rock Blast', portuguese: 'Rajada de Pedras' },
  'attack-power-gem': { english: 'Power Gem', portuguese: 'Joia do Poder' },
  'attack-ancient-power': { english: 'Ancient Power', portuguese: 'Poder Antigo' },
  'attack-accelerock': { english: 'Accelerock', portuguese: 'Pedra Veloz' },
  'attack-rock-tomb': { english: 'Rock Tomb', portuguese: 'Tumba de Pedra' },
  'attack-hex': { english: 'Hex', portuguese: 'Maldição' },
  'attack-shadow-sneak': { english: 'Shadow Sneak', portuguese: 'Ataque Furtivo' },
  'attack-phantom-force': { english: 'Phantom Force', portuguese: 'Força Fantasma' },
  'attack-lick': { english: 'Lick', portuguese: 'Lambida' },
  'attack-astonish': { english: 'Astonish', portuguese: 'Assombro' },
  'attack-spirit-shackle': { english: 'Spirit Shackle', portuguese: 'Grilhão Espiritual' },
  'attack-dragon-pulse': { english: 'Dragon Pulse', portuguese: 'Pulso do Dragão' },
  'attack-outrage': { english: 'Outrage', portuguese: 'Fúria' },
  'attack-dragon-dance': { english: 'Dragon Dance', portuguese: 'Dança do Dragão' },
  'attack-draco-meteor': { english: 'Draco Meteor', portuguese: 'Meteoro Draco' },
  'attack-dragon-breath': { english: 'Dragon Breath', portuguese: 'Sopro do Dragão' },
  'attack-dual-chop': { english: 'Dual Chop', portuguese: 'Corte Duplo' },
  'attack-poison-jab': { english: 'Poison Jab', portuguese: 'Golpe Venenoso' },
  'attack-sludge-bomb': { english: 'Sludge Bomb', portuguese: 'Bomba de Lodo' },
  'attack-venoshock': { english: 'Venoshock', portuguese: 'Choque Venenoso' },
  'attack-poison-tail': { english: 'Poison Tail', portuguese: 'Cauda Venenosa' },
  'attack-acid-spray': { english: 'Acid Spray', portuguese: 'Jato Ácido' },
  'attack-cross-poison': { english: 'Cross Poison', portuguese: 'Veneno Cruzado' },
  'attack-iron-head': { english: 'Iron Head', portuguese: 'Cabeçada de Ferro' },
  'attack-flash-cannon': { english: 'Flash Cannon', portuguese: 'Canhão de Luz' },
  'attack-bullet-punch': { english: 'Bullet Punch', portuguese: 'Soco Bala' },
  'attack-gyro-ball': { english: 'Gyro Ball', portuguese: 'Bola Giroscópica' },
  'attack-metal-claw': { english: 'Metal Claw', portuguese: 'Garra de Metal' },
  'attack-meteor-mash': { english: 'Meteor Mash', portuguese: 'Soco Meteoro' },
  'attack-steel-wing': { english: 'Steel Wing', portuguese: 'Asa de Aço' },
  'attack-steel-beam': { english: 'Steel Beam', portuguese: 'Raio de Aço' },
};

const statLabels: Array<[RegExp, string]> = [
  [/^SP\.ATK\b/i, 'Ataque Especial'],
  [/^SP\.DEF\b/i, 'Defesa Especial'],
  [/^ATK\b/i, 'Ataque'],
  [/^DEF\b/i, 'Defesa'],
  [/^SPEED\b/i, 'Velocidade'],
  [/^ACC(?:URACY)?\b/i, 'Precisão'],
];

function localizeEffectLabel(effect: string): string {
  let localized = effect.trim()
    .replace(/\bFlinch\b/gi, 'Perda de ação')
    .replace(/\bSleep\b/gi, 'Sono');
  for (const [pattern, label] of statLabels) {
    if (pattern.test(localized)) return localized.replace(pattern, label);
  }
  return localized;
}

function localizeDescription(text: string): string {
  return text
    .replace(/\bLight Screen\b/gi, 'Barreira de Luz')
    .replace(/\bReflect\b/gi, 'Reflexo')
    .replace(/\bFlinch\b/gi, 'perda de ação')
    .replace(/\bSleep\b/gi, 'Sono')
    .replace(/\bSPEED\b/gi, 'Velocidade');
}

function describeStatusEffect(effect: string): string {
  const label = localizeEffectLabel(effect);
  const statChange = label.match(/^(Ataque Especial|Defesa Especial|Ataque|Defesa|Velocidade|Precisão)\s*([+-])\s*(\d+)/i);

  if (/^Perda de ação$/i.test(label)) return 'o alvo perde a próxima ação';
  if (/^Paralisia$/i.test(label)) return 'o alvo fica Paralisado';
  if (/^Queimadura$/i.test(label)) return 'o alvo fica Queimado';
  if (/^Veneno$/i.test(label)) return 'o alvo fica Envenenado';
  if (/^Sono$/i.test(label)) return 'o alvo fica Dormindo';
  if (/^Congelamento$/i.test(label)) return 'o alvo fica Congelado';
  if (/^Confusão$/i.test(label)) return 'o alvo fica Confuso por 1d4 turnos';
  if (/^Atributos\s*\+1$/i.test(label)) return 'o usuário aumenta todos os atributos em 1 estágio';
  if (statChange) {
    const [, stat, direction, amount] = statChange;
    const stages = `${amount} ${Number(amount) === 1 ? 'estágio' : 'estágios'}`;
    return direction === '+'
      ? `o usuário aumenta ${stat} em ${stages}`
      : `o alvo reduz ${stat} em ${stages}`;
  }
  return `o efeito “${label}” é aplicado`;
}

function d10SuccessFaces(chance: number): number {
  return Math.max(0, Math.min(10, Math.round(chance / 10)));
}

export function formatStatusChance(chance: number): string {
  if (chance >= 100) return 'Garantido';
  const faces = d10SuccessFaces(chance);
  if (faces <= 0) return 'Nunca';
  return `d10: ${faces === 1 ? '1' : `1–${faces}`}`;
}

function buildChanceRule(statusChances: Attack['statusChances']): string {
  const guaranteed = statusChances.filter(status => status.chance >= 100);
  const random = statusChances.filter(status => status.chance < 100);
  const clauses = [
    ...guaranteed.map(status => `garantido: ${describeStatusEffect(status.effect)}`),
    ...random.map(status => {
      const faces = d10SuccessFaces(status.chance);
      return faces > 0
        ? `d10 ${faces === 1 ? '1' : `1–${faces}`}: ${describeStatusEffect(status.effect)}`
        : `sem chance no d10: ${describeStatusEffect(status.effect)}`;
    }),
  ];

  if (random.length === 1) {
    const status = random[0];
    const faces = d10SuccessFaces(status.chance);
    return faces > 0
      ? `Após acertar, role 1d10. Resultado ${faces === 1 ? '1' : `1 a ${faces}`}: ${describeStatusEffect(status.effect)}.`
      : `Após acertar, o efeito não é ativado em uma rolagem de 1d10.`;
  }

  if (random.length > 1) {
    return `Após acertar, role 1d10 separadamente para cada efeito: ${clauses.slice(guaranteed.length).join('; ')}.`;
  }

  return `Após acertar, ${clauses.join('; ')}.`;
}

function removeLegacyChanceRule(text: string, statusChances: Attack['statusChances']): string {
  let narrative = text
    .replace(/\bapós acertar\b[\s\S]*$/i, '')
    .replace(/(?:após acertar,\s*)?role\s+1d10\b(?:\.\s*resultado\b[^.!?]*)?[^.!?]*[.!?]?/gi, '')
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => !/\b1d10\b|\bchance\b|\d+(?:[.,]\d+)?\s*%|\bflinch\b/i.test(sentence))
    .join(' ')
    .replace(/(?:cada alvo tem|cada alvo possui)\s*\.?/gi, '')
    .replace(/\bapós acertar,\s*(?=[.!?]|$)/gi, '')
    .replace(/\s+([.!?])/g, '$1');

  for (const status of statusChances) {
    const outcome = describeStatusEffect(status.effect).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    narrative = narrative.replace(new RegExp(`\\b${outcome}[.!?]?`, 'i'), '');
  }

  return narrative
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,;:.]+|[\s,;:.]+$/g, '')
    .trim();
}

export function localizeAttack(attack: Attack): Attack {
  const translation = moveNames[attack.id];
  const name = translation && attack.name.trim().toLowerCase() === translation.portuguese.toLowerCase()
    ? translation.english
    : attack.name;
  const originalStatuses = Array.isArray(attack.statusChances) ? attack.statusChances : [];
  const statusChances = originalStatuses.map(status => ({
    ...status,
    effect: localizeEffectLabel(status.effect),
  }));
  const originalSummary = attack.effectSummary || '';
  const originalFull = attack.effectFull || '';
  const summary = localizeDescription(originalSummary);
  const full = localizeDescription(originalFull);
  const hasLegacyChanceText = /\b1d10\b|\bchance\b|\d+(?:[.,]\d+)?\s*%|\bflinch\b/i.test(
    `${originalSummary} ${originalFull} ${originalStatuses.map(status => status.effect).join(' ')}`,
  );

  if (statusChances.length && hasLegacyChanceText) {
    const chanceRule = buildChanceRule(statusChances);
    const narrative = removeLegacyChanceRule(full, statusChances).replace(/[.!?]+\s*$/, '');
    return {
      ...attack,
      name,
      statusChances,
      effectSummary: chanceRule,
      effectFull: narrative ? `${narrative}. ${chanceRule}` : chanceRule,
    };
  }

  return {
    ...attack,
    name,
    statusChances,
    effectSummary: summary,
    effectFull: full,
  };
}