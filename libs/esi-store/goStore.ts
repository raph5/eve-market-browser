import http from "http"
import type { Order, HistoryDay } from "./types"

const socketPath = "/tmp/esi-store.sock"

export function requestStoreOrders(typeId: number, regionId: number): Promise<Order[]> {
  const options: http.RequestOptions = {
    socketPath: socketPath,
    path: `/order?region=${regionId}&type=${typeId}`,
    method: 'GET',
  }

  return new Promise((res, rej) => {
    const request = http.request(options, (response) => {
      let data = ''

      response.on('data', chunk => data += chunk)
      response.on('end', () => {
        if(response.statusCode == 200) {
          res(JSON.parse(data))
        } else {
          rej(`Go store request failed with code ${response.statusCode}: ${data}`)
        }
      })
    })

    request.on('error', (error) => {
      rej(error)
    })

    request.end()
  })
}

export function requestStoreHistory(typeId: number, regionId: number): Promise<HistoryDay[]> {
  const options: http.RequestOptions = {
    socketPath: socketPath,
    path: `/history?region=${regionId}&type=${typeId}`,
    method: 'GET',
  }

  return new Promise((res, rej) => {
    const request = http.request(options, (response) => {
      let data = ''

      response.on('data', chunk => data += chunk)
      response.on('end', () => {
        if(response.statusCode == 200) {
          res(JSON.parse(data))
        } else {
          rej(`Go store request failed with code ${response.statusCode}: ${data}`)
        }
      })
    })

    request.on('error', (error) => {
      rej(error)
    })

    request.end()
  })
}
