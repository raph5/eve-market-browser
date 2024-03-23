
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