
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