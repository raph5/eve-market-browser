import { Type } from "@app/esiStore/types";
import { useMemo, useState } from "react";

async function getMatchingIndex(search: string, data: string[]) {
  const regex = new RegExp(search, 'i')
  const matches: number[] = []
  for(let i=0; i<data.length; i++) {
    if(matches.length == 50) return matches
    if(data[i].search(regex) != -1) {
      matches.push(i)
    }
  }
  return matches
}

// [ search, setSearch, results ]
export type useTypeSearchHook = [ string, (v: string) => void, Type[] ]

export function useTypeSearch(types: Type[]): useTypeSearchHook {
  const typeNames = useMemo(() => types.map(t => t.name), [])

  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Type[]>([])

  function _setSearch(s: string) {
    setSearch(s)

    if(s.length < 4) {
      setResults([])
      return
    }

    getMatchingIndex(s, typeNames).then(matches => {
      setResults(matches.map(i => types[i]))
    })
  }

  return [search, _setSearch, results]
}
