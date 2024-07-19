
export interface Type {
  id: number
  name: string
  metaLevel: number
}

export interface Region {
  id: number
  name: string
}

export interface MarketGroup {
  id: number
  parentId: number | null
  childsId: number[]
  name: string
  description: string
  types: number[]
  iconFile: string
  iconAlt: string
}

export interface HistoryDay {
  date: string,
  average: number,
  average5d: number,
  average20d: number,
  highest: number,
  lowest: number,
  orderCount: number,
  volume: number,
  donchianTop: number,
  donchianBottom: number
}

export interface Order {
  duration: number,
  isBuyOrder: boolean,
  issued: string,
  location: string,
  minVolume: number,
  orderId: number,
  price: number,
  range: 'station' | 'region' | 'solarsystem' | '1' | '2' | '3' | '4' | '5' | '10' | '20' | '30' | '40',
  systemId: number,
  typeId: number,
  volumeRemain: number,
  volumeTotal: number
}
