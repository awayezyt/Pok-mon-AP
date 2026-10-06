export type IVRank = "SS" | "S" | "A" | "B" | "C" | "D";
export type PokemonType = "Normal" | "Fogo" | "Água" | "Planta" | "Elétrico" | "Gelo" | "Lutador" | "Veneno" | "Terra" | "Voador" | "Psíquico" | "Inseto" | "Pedra" | "Fantasma" | "Dragão" | "Sombrio" | "Metálico" | "Fada";
export type PokemonGrowthRate = "Errático" | "Rápido" | "Meio rápido" | "Meio devagar" | "Devagar" | "Muito devagar";

export interface StatEntry {
  base: number;
  levelPoints: number;
  ev: number;
  iv: IVRank;
}

export interface PokemonStages {
  atk: number;      // -6 to +6
  spAtk: number;    // -6 to +6
  def: number;      // -6 to +6
  spDef: number;    // -6 to +6
  spe: number;      // -6 to +6
  accuracy: number; // -6 to +6
  evasion: number;  // -3 to +3
  crit: number;     // -6 to +6
}

export const defaultStages: PokemonStages = {
  atk: 0, spAtk: 0, def: 0, spDef: 0, spe: 0,
  accuracy: 0, evasion: 0, crit: 0
};

export interface Pokemon {
  id: string;
  name: string;
  species: string;
  image: string | null;
  trainerName: string;
  history: string;
  notes?: string;
  pokedexDescription: string;
  types: PokemonType[];
  gender: "Macho" | "Fêmea" | "Indefinido";
  catchRate: number;
  level: number;
  hp: number;
  hpMax: number;
  evGained: string;
  xp: number;
  growthRate: PokemonGrowthRate;
  affection: number;
  item: string;
  itemDescription: string;
  ability: string;
  abilityDescription: string;
  natureNumber: number;
  stages: PokemonStages;
  
  stats: {
    hp: StatEntry;
    atk: StatEntry;
    def: StatEntry;
    spAtk: StatEntry;
    spDef: StatEntry;
    spe: StatEntry;
  };
  
  attacks: string[];
  inDex: boolean;
  createdAt: string;
}

export interface Attack {
  id: string;
  name: string;
  type: PokemonType;
  category: "Físico" | "Especial" | "Status";
  pp: number;
  power: number | null;
  accuracy: number;
  critRange: number;
  target: string;
  priority: number;
  makesContact: boolean;
  effectSummary: string;
  effectFull: string;
  statusChances: { effect: string; chance: number }[];
  stab: boolean;
}

export interface DiceRollResult {
  id: string;
  timestamp: string;
  pokemonName: string;
  actionName: string;
  notation: string;
  diceResults: number[];
  keptResult: number;
  bonus: number;
  total: number;
  isCrit: boolean;
  isStab: boolean;
  statusEffects: string[];
  // Damage roll fields
  damageNotation?: string;
  damageResults?: number[];
  damageTotal?: number;
  attackTestTotal?: number;
}
