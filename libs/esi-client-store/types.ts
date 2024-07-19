
export interface HistoryDay {
  date: string,
  average: number,
  average_5d: number,
  average_20d: number,
  highest: number,
  lowest: number,
  order_count: number,
  volume: number,
  donchian_top: number,
  donchian_bottom: number
}

export interface Order {
  duration: number,
  is_buy_order: boolean,
  issued: string,
  location_id: number,
  min_volume: number,
  order_id: number,
  price: number,
  range: 'station' | 'region' | 'solarsystem' | '1' | '2' | '3' | '4' | '5' | '10' | '20' | '30' | '40',
  system_id: number,
  type_id: number,
  volume_remain: number,
  volume_total: number
}

export interface Meta {
  name: string
  iconSrc: string
  rarity: number
}
