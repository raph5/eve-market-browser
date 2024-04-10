import { useEffect, useState } from "react"

export type useLocalStorageHook<T> = [T, (v: T) => void]

export function useLocalStorage<T>(key: string, defaultValue: T|null = null): useLocalStorageHook<T> {
  const localStorageData = typeof localStorage != 'undefined' ? localStorage.getItem(key) : null

  const [state, setState] = useState<T>(localStorageData ? JSON.parse(localStorageData) : defaultValue)
  
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state))
  }, [state, key])

  return [state, setState]
}