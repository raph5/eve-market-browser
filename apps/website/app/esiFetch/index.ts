export type httpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export interface EsiResponse<T> {
  data: T
  pages: number
}

const esiRoot = "https://esi.evetech.net/latest"
const requestTimeout = 5000  // 5s

export class EsiError extends Error {
  public code: number

  constructor(message: string, code: number) {
    super(message)
    this.name = "EsiError"
    this.code = code
  }

  toString() {
    return `EsiError ${this.code}: ${this.message}`
  }
}

export async function esiFetch<T>(
  method: httpMethod = "GET",
  uri: string,
  body: any = {},
  trails: number = 5
): Promise<EsiResponse<T>> {
  const serializedBody = JSON.stringify(body)
  const headers = {
    'content-type': 'application/json',
    'User-Agent': 'evemarketbrowser.com - contact me at raphguyader@gmail.com'
  }

  const response = await fetch(esiRoot + uri, {
    body: method == 'POST' || method == 'PUT' ? serializedBody : null,
    method: method,
    headers: headers,
    signal: AbortSignal.timeout(requestTimeout)
  })

  // implicit timeout
  if (response.status == 503 || response.status == 500) {
    if (trails <= 1) {
      throw Error("No more trails left")
    }

    console.log(`esiFetch: 10s implicit timeout: ${response.statusText}`)
    await sleep(10)
    return await esiFetch(method, uri, body, trails-1)
  }

  // error rate timeout
  if (response.status == 420) {
    if (trails <= 1) {
      throw Error("No more trails left")
    }

    const xLimitReset = response.headers.get("X-Esi-Error-Limit-Reset")
    if (xLimitReset == null) {
      throw Error("Header X-Esi-Error-Limit-Reset is not present in a 420 response")
    }
    let timeout = parseInt(xLimitReset)
    if (timeout < 0 || timeout > 120) {
      timeout = 10
      console.log(`esiFetch: X-Esi-Error-Limit-Reset out of range: ${timeout}`)
    }
    console.log(`esiFetch: ${timeout}s error rate timeout`)
    await sleep(timeout)
    return await esiFetch(method, uri, body, trails-1)
  }

  // explicit timeout
  if (response.status == 504) {
    if (trails <= 1) {
      throw Error("No more trails left")
    }

    const error = await response.json().catch(() => null)
    if (!error || !error.timeout || typeof error.timeout !== "number") {
      throw Error("Invalid esi timeout error")
    }
    let timeout = error.timeout
    if (timeout < 0 || timeout > 120) {
      timeout = 10
      console.log(`esiFetch: timeout out of range: ${timeout}`)
    }
    console.log(`esiFetch: ${timeout}s explicit timeout`)
    await sleep(timeout)
    return await esiFetch(method, uri, body, trails-1)
  }

  // esi error
  if (response.status != 200) {
    const error = await response.json().catch(() => null)
    if (!error || !error.error || typeof error.error !== "string") {
      throw Error("Invalid esi error")
    }
    throw new EsiError(error.error, response.status)
  }

  const data = await response.json()
  const xPages = response.headers.get("X-Pages")
  const pages = xPages ? parseInt(xPages) : 0

  return { data, pages }
}

function sleep(s: number) {
  return new Promise(resolve => setTimeout(resolve, 1000*s));
}
