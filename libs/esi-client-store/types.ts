
export interface History {
  average: number,
  date: string,
  highest: number,
  lowest: number,
  order_count: number,
  volume: number
}[]

export interface Order {
  duration: number,
  order_type: 'buy' | 'sell',
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