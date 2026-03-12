import { Type } from "@app/esiStore.server";
import { useMemo, useState } from "react";

function getMatches(search: string, types: Type[]) {
  const matches: Type[] = []
  const words = search
    .split(' ')
    .map(w => new RegExp(w, 'i'))

  for (let i = 0; i < types.length; i++) {
    for (let j = 0; j < words.length; j++) {
      if (types[i].name.search(words[j]) != -1) {
        matches.push(types[i])
        break
      }
    }
  }
  return matches
}

// [ search, setSearch, results ]
export type useTypeSearchHook = [ string, (v: string) => void, Type[] ]

export function useTypeSearch(types: Type[]): useTypeSearchHook {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Type[]>([])

  function _setSearch(s: string) {
    setSearch(s)

    if (s.length < 3) {
      setResults([])
      return
    }

    setTimeout(() => {
      setResults(getMatches(s, types))
    }, 0)
  }

  return [search, _setSearch, results]
}
