import { useLocalStorage } from "@hooks/useLocalStorage"
import { useCallback, useEffect, useRef } from "react"

export type useQuickbarHook = {
  quickbar: Record<string, number[]>  // { __root__: [typeId], folder: [typeId] }
  addToQuickbar: (typeId: number) => void
  removeFromQuickbar: (typeId: number) => void
  moveToFolder: (typeId: number, destinationFolder: string) => void
  createFolder: (folder: string) => void
  removeFolder: (folder: string) => void
  isInQuickbar: (typeId: number) => boolean
}

export function useQuickbar(): useQuickbarHook {

  const [quickbar, setQuickbar] = useLocalStorage<Record<string, number[]>>('quickbar', { __root__: [] })
  const quickbarTypes = useRef<Set<number>>(new Set(Object.values(quickbar).flat()))

  const addToQuickbar = useCallback((typeId: number) => {
    if(quickbarTypes.current.has(typeId)) {
      console.error(`can't add type ${typeId} to quickbar it's already in`)
      return
    }

    const { __root__, ...folders } = quickbar
    setQuickbar({
      __root__: [ typeId, ...__root__ ],
      ...folders
    })
    quickbarTypes.current.add(typeId)
  }, [quickbar])

  const removeFromQuickbar = useCallback((typeId: number) => {
    let typeFolder: string = ''
    let typeIndex: number = -1
    for(const folder in quickbar) {
      const index = quickbar[folder].findIndex(t => t == typeId)
      if(index != -1) {
        typeFolder = folder
        typeIndex = index
        break
      }
    }

    if(typeIndex != -1) {
      const { [typeFolder]: types, ...folders } = quickbar
      types.splice(typeIndex, 1)
      setQuickbar({ [typeFolder]: types, ...folders })
      quickbarTypes.current.delete(typeId)
    }
    else {
      console.error(`can't remove type ${typeId} from quickbar because it is not in quickbar`)
    }
  }, [quickbar])

  const moveToFolder = useCallback((typeId: number, destinationFolder: string) => {
    if(!quickbar[destinationFolder]) {
      setQuickbar({ [destinationFolder]: [], ...quickbar })
    }
    else if(quickbar[destinationFolder].includes(typeId)) {
      console.error(`type ${typeId} is already in destination folder`)
      return
    }

    let typeFolder: string = ''
    let typeIndex: number = -1
    for(const folder in quickbar) {
      const index = quickbar[folder].findIndex(t => t == typeId)
      if(index != -1) {
        typeFolder = folder
        typeIndex = index
        break
      }
    }

    if(typeFolder == '') {
      console.error(`can't move type ${typeId} to folder ${destinationFolder} because it is not in quickbar`)
      return
    }

    const {
      [typeFolder]: types,
      [destinationFolder]: destinationTypes,
      ...folders
    } = quickbar
    types.splice(typeIndex, 1)
    destinationTypes.unshift(typeId)
    setQuickbar({
      [typeFolder]: types,
      [destinationFolder]: destinationTypes,
      ...folders
    })
  }, [quickbar])

  const createFolder = useCallback((folder: string) => {
    if(quickbar[folder]) {
      console.error(`folder ${folder} alredy created`)
      return
    }
    if(folder == '' || folder == '__root__') {
      console.error(`folder name "${folder}" is incorrect`)
      return
    }

    setQuickbar({ [folder]: [], ...quickbar })
  }, [quickbar])

  const removeFolder = useCallback((folder: string) => {
    if(!quickbar[folder]) {
      console.error(`folder ${folder} does not exist`)
      return
    }

    const { [folder]: types, __root__, ...folders } = quickbar
    setQuickbar({
      __root__: [ ...types, ...__root__ ],
      ...folders
    })
  }, [quickbar])

  const isInQuickbar = useCallback((typeId: number) => {
    return quickbarTypes.current.has(typeId)
  }, [quickbar])

  return {
    quickbar,
    addToQuickbar,
    removeFromQuickbar,
    moveToFolder,
    createFolder,
    removeFolder,
    isInQuickbar
  }
}
