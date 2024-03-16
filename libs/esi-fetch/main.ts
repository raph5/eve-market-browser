import { timeout } from "utils";

type httpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface queryParams {
  [parameter: string]: string
}


const ESI_ROOT = "https://esi.evetech.net/latest"

/**
 * ESI fetcher
 * https://esi.evetech.net/ui
 * @param uri api uri (/universe/regions for exemple)
 * @param query search parameters for a request (?datasource=tranquility for exemple)
 * @param body json-able body
 * @param method http method
 * @param trails number of time the request is resended after a gateway timeout
 */
async function esiFetch(uri: string, query: queryParams = {}, body: any = {}, method: httpMethod = 'GET', trails: number = 5) {

  const serializedBody = JSON.stringify(body)
  const searchParams = new URLSearchParams(query)
  const headers = new Headers({
    'content-type': 'application/json',
    'User-Agent': 'evemarketbrowser.com - contact me at raphguyader@gmail.com'
  })

  const esiResponse = await fetch(ESI_ROOT + uri + searchParams, {
    body: method == 'POST' || method == 'PUT' ? serializedBody : null,
    method: method,
    headers: headers
  })

  // handle gateway timeout
  if(esiResponse.status == 504) {
    if(trails <= 1) {
      return { 'error': 'esiFetch: too many failed trails'}
    }

    const error = await esiResponse.json().catch(() => null)
    if(!error || !error.timeout || typeof error.timeout !== 'number') {
      return { 'error': 'esiFetch: gateway timeout error is not valid'}
    }

    await timeout(1000 * error.timeout)
    return await esiFetch(uri, query, body, method, trails-1)
  }
  
  const data = await esiResponse.json().catch(() => ({ 'error': 'esiFetch: cant parse response body'}))

  return data

}


export default esiFetch