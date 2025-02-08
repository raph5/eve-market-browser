
// meta is a number provided by holy www.fuzzwork.co.uk
// see https://www.fuzzwork.co.uk/dump/latest/invMetaGroups.csv
export function getMetaRarity(meta: number) {
  switch(meta) {
    case 1 : return 0
    case 2 : return 1
    case 3 : return 2
    case 4 : return 2
    case 5 : return 4
    case 6 : return 3
    default : return meta == 14 ? 2 : 1
  }
}

export function getRarityName(rarity: number) {
  switch(rarity) {
    case 0 : return "Tech 1"
    case 1 : return "Tech 2"
    case 2 : return "Faction & Storyline"
    case 3 : return "Officer" 
    case 4 : return "Deadspace"
    default : throw "unreachable place"
  }
}

export function getRarityIcon(rarity: number) {
  switch(rarity) {
    case 2 : return "/meta-icons/faction.png"
    case 3 : return "/meta-icons/deadspace.png"
    case 4 : return "/meta-icons/officer.png"
    default : return ""
  }
}
