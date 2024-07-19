import http from "http"

const socketPath = "/tmp/esi-store.sock"

const options: http.RequestOptions = {
  socketPath: socketPath,
  path: '/regions',
  method: 'get',
}

const request = http.request(options, (response) => {
  let data = ''

  response.on('data', chunk => data += chunk)
  response.on('end', () => console.log(data))
})

// TODO: manage connection collapse
request.on('error', (error) => {
  console.error(`Problem with request: ${error.message}`);
})

request.end()
