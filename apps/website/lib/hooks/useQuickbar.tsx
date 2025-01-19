import { useLocalStorage } from "@hooks/useLocalStorage"
import { uid } from "@lib/utils"
import { useCallback, useRef } from "react"
import { Type } from "@lib/esiStore/types"
import { parseQuickbar, stringifyQuickbar, mergeQuickbar } from "@lib/quickbarUtils"

export interface QuickbarState {
  [folder: string]: {
    name: string
    types: number[]
    childFolders: string[]
  }
}

export type useQuickbarHook = {
  state: QuickbarState
  has: (typeId: number) => boolean

  addItem: (typeId: number) => void
  removeItem: (typeId: number) => void
  moveItem: (typeId: number, destinationFolderId: string) => void

  createFolder: (name: string) => string
  removeFolder: (folderId: string) => void
  renameFolder: (folderId: string, name: string) => void
  moveFolder: (folderId: string, destinationFolderId: string) => void

  importQuickbar: (quickbarString: string) => void
  exportQuickbar: () => string

  clear: () => void
}

export function useQuickbar(types: Type[], typeRecord: Record<string, Type>): useQuickbarHook {

  const [quickbar, setQuickbar] = useLocalStorage<QuickbarState>(
    'quickbar',
    {
      __root__: {
        name: '__root__',
        types: [],
        childFolders: []
      }
    }
  )

  const quickbarTypes = useRef<Set<number>>(
    new Set( Object.values(quickbar).map(f => f.types).flat() )
  )

  const addItem = useCallback((typeId: number) => {
    if(quickbarTypes.current.has(typeId)) {
      console.error(`can't add type ${typeId} to quickbar it's already in`)
      return
    }

    quickbarTypes.current.add(typeId)

    setQuickbar(quickbar => {
      const { __root__, ...folders } = quickbar
      return {
        __root__: {
          ...__root__,
          types: [ typeId, ...__root__.types ]
        },
        ...folders
      }
    })
  }, [setQuickbar, quickbarTypes])

  const removeItem = useCallback((typeId: number) => {
    setQuickbar(quickbar => {
      let typeFolder: string = ''
      let typeIndex: number = -1
      for(const folder in quickbar) {
        const index = quickbar[folder].types.findIndex(t => t == typeId)
        if(index != -1) {
          typeFolder = folder
          typeIndex = index
          break
        }
      }

      if(typeIndex != -1) {
        const { [typeFolder]: folder, ...folders } = quickbar
        folder.types.splice(typeIndex, 1)
        quickbarTypes.current.delete(typeId)
        return { [typeFolder]: folder, ...folders }
      }
      else {
        console.error(`can't remove type ${typeId} from quickbar because it is not in quickbar`)
        return quickbar
      }
    })
  }, [setQuickbar, quickbarTypes])

  const clear = useCallback(() => {
    setQuickbar({
      __root__: {
        name: '__root__',
        types: [],
        childFolders: []
      }
    })
  }, [setQuickbar])

  const moveItem = useCallback((typeId: number, destinationFolderId: string) => {
    setQuickbar(quickbar => {
      if(!quickbar[destinationFolderId]) {
        quickbar = {
          [destinationFolderId]: {
            name: destinationFolderId,
            types: [],
            childFolders: []
          },
          ...quickbar
        }
      }
      else if(quickbar[destinationFolderId].types.includes(typeId)) {
        console.error(`type ${typeId} is already in destination folder`)
        return quickbar
      }

      let parentFolderId: string = ''
      let typeIndex: number = -1
      for(const folder in quickbar) {
        const index = quickbar[folder].types.findIndex(t => t == typeId)
        if(index != -1) {
          parentFolderId = folder
          typeIndex = index
          break
        }
      }

      if(parentFolderId == '') {
        console.error(`can't move type ${typeId} to folder ${destinationFolderId} because it is not in quickbar`)
        return quickbar
      }

      const {
        [parentFolderId]: parentFolder,
        [destinationFolderId]: destinationFolder,
        ...folders
      } = quickbar
      parentFolder.types.splice(typeIndex, 1)
      destinationFolder.types.unshift(typeId)
      
      return {
        [parentFolderId]: parentFolder,
        [destinationFolderId]: destinationFolder,
        ...folders
      }
    })
  }, [setQuickbar, quickbarTypes])

  const createFolder = useCallback((name: string) => {
    const folderId = uid()
    
    setQuickbar(quickbar => {
      if(quickbar[folderId]) {
        console.error(`folder ${folderId} alredy created`)
        return quickbar
      }
      if(name == '' || folderId == '' || folderId == '__root__') {
        console.error(`folder id "${folderId}" or name "${name}" is incorrect`)
        return quickbar
      }

      const { __root__, ...folders } = quickbar
      return {
        __root__: {
          ...__root__,
          childFolders: [ folderId, ...__root__.childFolders ]
        },
        [folderId]: {
          name,
          types: [],
          childFolders: []
        },
        ...folders
      }
    })

    return folderId
  }, [setQuickbar])

  const moveFolder = useCallback((movedFolderId: string, destinationFolderId: string) => {
    setQuickbar(quickbar => {
      if(!quickbar[destinationFolderId]) {
        quickbar = {
          [destinationFolderId]: {
            name: destinationFolderId,
            types: [],
            childFolders: []
          },
          ...quickbar
        }
      }
      else if(quickbar[destinationFolderId].childFolders.includes(movedFolderId)) {
        console.error(`folder ${movedFolderId} is already in destination folder`)
        return quickbar
      }
      else if(movedFolderId == destinationFolderId) {
        console.error(`can't move folder ${movedFolderId} in it self`)
        return quickbar
      }

      function isDestinationFolderAChildOf(folderId: string) {
        if(quickbar[folderId].childFolders.length == 0) {
          return false
        }
        for(const child of quickbar[folderId].childFolders) {
          if(destinationFolderId == child || isDestinationFolderAChildOf(child)) {
            return true
          }
        }
        return false
      }
      if(isDestinationFolderAChildOf(movedFolderId)) {
        console.error(`destination folder ${destinationFolderId} is a child of moved folder ${movedFolderId}`)
        return quickbar
      }

      let parentFolderId: string = ''
      let parentIndex: number = -1
      for(const folder in quickbar) {
        const index = quickbar[folder].childFolders.findIndex(f => f == movedFolderId)
        if(index != -1) {
          parentFolderId = folder
          parentIndex = index
          break
        }
      }

      if(parentFolderId == '') {
        console.error(`can't move folder ${movedFolderId} to folder ${destinationFolderId} because it is not in quickbar`)
        return quickbar
      }

      const {
        [parentFolderId]: parentFolder,
        [destinationFolderId]: destinationFolder,
        ...folders
      } = quickbar
      parentFolder.childFolders.splice(parentIndex, 1)
      destinationFolder.childFolders.unshift(movedFolderId)
      
      return {
        [parentFolderId]: parentFolder,
        [destinationFolderId]: destinationFolder,
        ...folders
      }
    })
  }, [setQuickbar])

  const removeFolder = useCallback((folderId: string) => {
    setQuickbar(quickbar => {
      if(!quickbar[folderId]) {
        console.error(`folder ${folderId} do not exist`)
        return quickbar
      }

      let parentFolderId: string = ''
      let parentIndex: number = -1
      for(const folder in quickbar) {
        const index = quickbar[folder].childFolders.findIndex(f => f == folderId)
        if(index != -1) {
          parentFolderId = folder
          parentIndex = index
          break
        }
      }

      if(parentFolderId == '') {
        console.error(`can't find ${folderId} parent folder`)
        return quickbar
      }

      const {
        [parentFolderId]: parentFolder,
        [folderId]: folder,
        ...folders
      } = quickbar
      parentFolder.childFolders.splice(parentIndex, 1)
      return {
        [parentFolderId]: {
          ...parentFolder,
          childFolders: [ ...parentFolder.childFolders, ...folder.childFolders ],
          types: [ ...parentFolder.types, ...folder.types ]
        },
        ...folders
      }
    })
  }, [setQuickbar])

  const renameFolder = useCallback((folderId: string, name: string) => {
    setQuickbar(quickbar => {
      if(!quickbar[folderId]) {
        console.error(`folder ${folderId} do not exist`)
        return quickbar
      }

      const { [folderId]: folder, ...folders } = quickbar
      return {
        [folderId]: { ...folder, name, },
        ...folders
      }
    })
  }, [setQuickbar])
  
  const importQuickbar = useCallback((quickbarString: string) => {
    setQuickbar(quickbar => {
      const parsedQuickbar = parseQuickbar(quickbarString, types)

      if(parsedQuickbar == null) {
        console.error("Not valid quickbar import")
        return quickbar
      }

      return mergeQuickbar({ ...quickbar }, parsedQuickbar)
    })
  }, [setQuickbar])

  const exportQuickbar = useCallback(() => {
    return stringifyQuickbar(quickbar, typeRecord)
  }, [quickbar, typeRecord])

  const has = useCallback((typeId: number) => {
    return quickbarTypes.current.has(typeId)
  }, [quickbarTypes])

  return {
    state: quickbar,
    addItem,
    removeItem,
    clear,
    moveItem,
    createFolder,
    removeFolder,
    moveFolder,
    renameFolder,
    importQuickbar,
    exportQuickbar,
    has
  }
}
