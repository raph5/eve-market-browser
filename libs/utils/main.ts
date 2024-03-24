
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