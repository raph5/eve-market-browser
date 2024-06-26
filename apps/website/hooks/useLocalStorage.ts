import { useEffect, useState } from "react"

export type useLocalStorageHook<T> = [T, React.Dispatch<React.SetStateAction<T>>]

export function useLocalStorage<T>(key: string, defaultValue: T): useLocalStorageHook<T> {
  const localStorageData = typeof localStorage != 'undefined' ? localStorage.getItem(key) : null

  const [state, setState] = useState<T>(localStorageData ? JSON.parse(localStorageData) : defaultValue)
  
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state))
  }, [state, key])

  return [state, setState]
}
