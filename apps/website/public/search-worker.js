
onmessage = function ({ data }) {
  const { query, list } = data
  if (query.length < 3) return

  const matches = []
  const regex = new RegExp(query, 'i')

  for (let i = 0; i < list.length; i++) {
    if (list[i].search(regex) != -1) {
      matches.push(i)
    }
  }

  postMessage({ matches })
}
