import React from 'react';
import { PokemonType } from '../lib';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import NormalIcon   from '@assets/Normal_icon_SwSh_1784467064368.png';
import FireIcon     from '@assets/Fire_icon_SwSh_1784467064373.png';
import WaterIcon    from '@assets/Water_icon_SwSh_1784472323208.png';
import GrassIcon    from '@assets/Grass_icon_SwSh_1784467064375.png';
import ElectricIcon from '@assets/Electric_icon_SwSh_1784467064369.png';
import IceIcon      from '@assets/Ice_icon_SwSh_1784467064381.png';
import FightingIcon from '@assets/Fighting_icon_SwSh_1784467064378.png';
import PoisonIcon   from '@assets/Poison_icon_SwSh_1784467064376.png';
import GroundIcon   from '@assets/Ground_icon_SwSh_1784467064370.png';
import FlyingIcon   from '@assets/Flying_icon_SwSh_1784467064374.png';
import PsychicIcon  from '@assets/Psychic_icon_SwSh_1784467064371.png';
import BugIcon      from '@assets/Bug_icon_SwSh_1784467064377.png';
import RockIcon     from '@assets/Rock_icon_SwSh_1784467064367.png';
import GhostIcon    from '@assets/Ghost_icon_SwSh_1784467064378.png';
import DragonIcon   from '@assets/Dragon_icon_SwSh_1784467064379.png';
import DarkIcon     from '@assets/Dark_icon_SwSh_1784467064372.png';
import SteelIcon    from '@assets/Steel_icon_SwSh_1784467064380.png';
import FairyIcon    from '@assets/Fairy_icon_SwSh_1784467064372.png';

import PhysicalIcon from '@assets/Physical_icon_HOME_1784472846790.png';
import SpecialIcon  from '@assets/Special_icon_HOME_1784472846788.png';
import StatusIcon   from '@assets/Status_icon_HOME_1784472846789.png';

export { PhysicalIcon, SpecialIcon, StatusIcon };

export const TYPE_ICON_SOURCES: Record<PokemonType, string> = {
  "Normal":   NormalIcon,
  "Fogo":     FireIcon,
  "Água":     WaterIcon,
  "Planta":   GrassIcon,
  "Elétrico": ElectricIcon,
  "Gelo":     IceIcon,
  "Lutador":  FightingIcon,
  "Veneno":   PoisonIcon,
  "Terra":    GroundIcon,
  "Voador":   FlyingIcon,
  "Psíquico": PsychicIcon,
  "Inseto":   BugIcon,
  "Pedra":    RockIcon,
  "Fantasma": GhostIcon,
  "Dragão":   DragonIcon,
  "Sombrio":  DarkIcon,
  "Metálico": SteelIcon,
  "Fada":     FairyIcon,
};

export const TYPE_COLORS: Record<PokemonType, string> = {
  "Normal":   "#A8A878",
  "Fogo":     "#F08030",
  "Água":     "#6890F0",
  "Planta":   "#78C850",
  "Elétrico": "#F8D030",
  "Gelo":     "#98D8D8",
  "Lutador":  "#C03028",
  "Veneno":   "#A040A0",
  "Terra":    "#E0C068",
  "Voador":   "#A890F0",
  "Psíquico": "#F85888",
  "Inseto":   "#A8B820",
  "Pedra":    "#B8A038",
  "Fantasma": "#705898",
  "Dragão":   "#7038F8",
  "Sombrio":  "#705848",
  "Metálico": "#B8B8D0",
  "Fada":     "#EE99AC",
};

interface TypeIconProps { type: PokemonType; className?: string; size?: number; }

export function TypeIconBadge({ type, className, size = 32 }: TypeIconProps) {
  const iconSrc = TYPE_ICON_SOURCES[type];
  const color   = TYPE_COLORS[type];
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className={`rounded-full flex items-center justify-center shrink-0 border-2 overflow-hidden shadow-sm ${className}`}
            style={{ width: size, height: size, backgroundColor: color, borderColor: 'rgba(255,255,255,0.2)' }}
          >
            <img src={iconSrc} alt={type} className="w-[80%] h-[80%] object-contain" />
          </div>
        </TooltipTrigger>
        <TooltipContent><p>{type}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function CategoryIcon({ category, size = 20 }: { category: string; size?: number }) {
  const src = category === 'Físico' ? PhysicalIcon : category === 'Especial' ? SpecialIcon : StatusIcon;
  const label = category;
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <img src={src} alt={label} style={{ width: size, height: size, objectFit: 'contain' }} />
        </TooltipTrigger>
        <TooltipContent><p>{label}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
