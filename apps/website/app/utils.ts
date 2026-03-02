import http from "http"

const BASE_64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+"

export interface Tree extends Record<any, any> {
  value: string|number
  childs: Record<string|number, Tree>
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

interface ErrnoException extends Error {
  errno?: number;
  code?: string;
  path?: string;
  syscall?: string;
  stack?: string;
}

// run a GET http request
export async function unixSocketFetch(socket: string, path: string): Promise<string> {
  const options = { socketPath: socket, path: path, method: 'GET' }

  return new Promise((res, rej) => {
    const request = http.request(options, (response) => {
      let data = ''

      response.on('data', chunk => data += chunk)
      response.on('end', () => {
        if(response.statusCode == 200) {
          res(data)
        } else {
          rej(new Error(`unix socket fetch "${path}" failed with code ${response.statusCode}: ${data}`))
        }
      })
    })

    request.on('error', (error: ErrnoException) => {
      if(error?.code == "ENOENT" && error?.syscall == "connect") {
        rej(new Error(`unix socket "${socket}" is not available`))
      }
      rej(error)
    })

    request.end()
  })
}

export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}
