
onmessage = function ({ data }) {
  const { query, list } = data
  const matches = []
  const words = query
    .split(' ')
    .filter(w => w.length >= 3)
    .map(w => new RegExp(w, 'i'))

  for (let i = 0; i < list.length; i++) {
    for (let j = 0; j < words.length; j++) {
      if (list[i].search(words[j]) != -1) {
        matches.push(i)
        break
      }
    }
  }

  postMessage({ matches })
}
