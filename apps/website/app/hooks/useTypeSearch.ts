import { Type } from "@app/esiStore.server";
import { useEffect, useMemo, useRef, useState } from "react";

// [ search, setSearch, results ]
export type useTypeSearchHook = [ string, (v: string) => void, Type[] ]

export function useTypeSearch(types: Type[]): useTypeSearchHook {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Type[]>([])
  const names = useMemo(() => types.map(t => t.name), [types])
  const worker = useRef<Worker>()

  function _setSearch(s: string) {
    setSearch(s)

    if (s.length >= 2 && worker.current) {
      worker.current.postMessage({ query: search, list: names })
    } else {
      setResults([])
    }
  }

  interface WorkerMessage {
    matches: number[],
  }
  function handleMessage({ data }: MessageEvent<WorkerMessage>) {
    setResults(data.matches.map(i => types[i]))
  }

  useEffect(() => {
    worker.current = new Worker("/search-worker.js")
    worker.current.addEventListener('message', handleMessage)
    return () => {
      if (worker.current) {
        worker.current.removeEventListener('message', handleMessage)
        worker.current.terminate()
        worker.current = undefined
      }
    }
  }, [])

  return [search, _setSearch, results]
}
