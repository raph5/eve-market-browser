
export interface Type {
  id: number
  name: string
}

export interface Region {
  id: number
  name: string
}

export interface MarketGroup {
  id: number
  parentId?: number
  childsId: number[]
  name: string
  description: string
  types: number[]
}