
const BASE_64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+"

export const DAY = 1000*60*60*24
export const HOUR = 1000*60*60
export const MINUTE = 1000*60
export const SECOND = 1000

export interface Tree extends Record<any, any> {
  value: string|number
  childs: Record<string|number, Tree>
}

export function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createRecord<T=any>(array: T[], keyField: string) {
  const record: Record<string, T> = {}
  for(let i=0; i<array.length; i++) {
    // @ts-ignore
    record[array[i][keyField] as string] = array[i]
  }
  return record
}

export function breadthFirstSearch(tree: Tree | Record<string|number, Tree>, value: string | number): Tree | null {
  let queue = tree.value ? [ tree ] : Object.values(tree)
  let node
  while(queue.length != 0) {
    node = queue.shift() as Tree
    if(node.value === value) {
      return node
    }
    queue = queue.concat(Object.values(node.childs))
  }
  return null
}

export function removeDuplicates(array: any[]) {
  return [ ...new Set(array) ]
}

const formater = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 })
export function formatIsk(isk: number) {
  return `${formater.format(isk)} ISK`
}

export function expiresIn(issued: string, duration: number, time: number) {
  const creationTime = (new Date(issued)).valueOf()
  const endTime = creationTime + duration * DAY
  
  let diffTime = endTime - time
  if(diffTime < 0) return 'expired'
  
  const days = Math.floor(diffTime / DAY)
  diffTime -= days * DAY
  const hours = Math.floor(diffTime / HOUR)
  diffTime -= hours * HOUR
  const minutes = Math.floor(diffTime / MINUTE)
  diffTime -= minutes * MINUTE
  const seconds = Math.floor(diffTime / SECOND)

  return `${days}d ${hours}h ${minutes}m ${seconds}s`
}

export function stringSort<T=any>(getValue: ((v: T) => string) = (v => v as string)) {
  return (a: T, b: T) => getValue(a).localeCompare(getValue(b))
}
export function numberSort<T=any>(getValue: ((v: T) => number) = (v => v as number)) {
  return (a: T, b: T) => getValue(a) - getValue(b)
}

export function intToBase64(integer: number) {
  let result = ''
  let residual: number
  let digit: number
  while(integer != 0) {
    residual = integer >> 6
    digit = integer - (residual << 6)
    integer = residual
    result = BASE_64[digit] + result
  }
  return result
}

export function uid() {
  return intToBase64(Math.floor(Math.random() * 1e8))
}

export function clamp(x: number, inf: number, sup: number) {
  return Math.max(inf, Math.min(x, sup))
}
