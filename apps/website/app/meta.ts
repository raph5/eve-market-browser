
export interface Meta {
  name: string
  iconSrc: string
  rarity: number
}

export const T1: Meta = {
  name: 'Tech 1',
  iconSrc: '',
  rarity: 1
}
export const T2: Meta = {
  name: 'Tech 2',
  iconSrc: '/meta-icons/t2.png',
  rarity: 2
}
export const FACTION_STORYLINE: Meta = {
  name: 'Faction & Storyline',
  iconSrc: '/meta-icons/faction.png',
  rarity: 3
}
export const DEADSPACE: Meta = {
  name: 'Deadspace',
  iconSrc: '/meta-icons/deadspace.png',
  rarity: 4
}
export const OFFICER: Meta = {
  name: 'Officer',
  iconSrc: '/meta-icons/officer.png',
  rarity: 5
}
export const RARITY_TO_META: Record<string, Meta> = {
  1: T1,
  2: T2,
  3: FACTION_STORYLINE,
  4: DEADSPACE,
  5: OFFICER
}

export function getMeta(metaType: number): Meta {
  switch(metaType) {
    case 1 : return T1
    case 2 : return T2
    case 3 : return FACTION_STORYLINE
    case 4 : return FACTION_STORYLINE
    case 5 : return OFFICER
    case 6 : return DEADSPACE
    default : return T1
  }
}

