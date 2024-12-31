import { QuickbarState } from "@hooks/useQuickbar";
import { Type } from "@lib/esiStore/types";
import { uid } from "@lib/utils";

/**
 * EVE online quickbar export format :
 *
 * + drone
 * ++ gecko
 * -- Gecko
 * - Ogre II
 * - Praetor I
 * + rig
 * - Capital Warp Core Optimizer I
 * Decayed 500MN Microwarpdrive Mutaplasmid
 * Decayed Heavy Warp Scrambler Mutaplasmid
 */

function stringifyFolder(quickbar: QuickbarState, typeRecord: Record<string, Type>, folderId: string, depth: number) {
  let folder = '+'.repeat(depth) + ' ' + quickbar[folderId].name + '\n'
  for(const child of quickbar[folderId].childFolders) {
    folder += stringifyFolder(quickbar, typeRecord, child, depth + 1)
  }
  for(const type of quickbar[folderId].types) {
    folder += '-'.repeat(depth) + ' ' + typeRecord[type].name + '\n'
  }
  return folder
}

export function stringifyQuickbar(quickbar: QuickbarState, typeRecord: Record<string, Type>) {
  let output = ''
  for(const folder of quickbar.__root__.childFolders) {
    output += stringifyFolder(quickbar, typeRecord, folder, 1)
  }
  for(const type of quickbar.__root__.types) {
    if(typeRecord[type].name[0] == '+') {
      throw Error(`quickbar parser can't handle type ${typeRecord[type].name} at root`)
    }
    output += typeRecord[type].name + '\n'
  }
  return output.substring(0, output.length-1)
}


export function parseQuickbar(quickbarString: string, types: Type[]) {
  const quickbarTypes: Record<string, string> = {}
  const folderStack: string[] = ['__root__']
  const quickbar: QuickbarState = {
    __root__: {
      name: '__root__',
      types: [],
      childFolders: []
    }
  }

  const lines = quickbarString.split(/\r\n|\r|\n/)

  let isFolder: boolean
  let depth: number
  for(const line of lines) {
    if(line == '') continue

    isFolder = line[0] == '+'

    if(isFolder) {
      for(depth=0; depth<line.length; depth++) {
        if(line[depth] == '-') {
          return null
        }
        if(line[depth] != '+') {
          break
        }
      }
    }
    else {
      for(depth=0; depth<line.length; depth++) {
        if(depth != 0 && line[depth] == '+') {
          return null
        }
        if(line[depth] != '-') {
          break
        }
      }
    }

    if(depth == folderStack.length - 2) {
      folderStack.pop()
    }
    else if(depth == folderStack.length - 1) {
      if(isFolder) {
        folderStack.pop()
      }
    }
    else if(depth != folderStack.length) {
      return null
    }
    
    if(isFolder) {
      const folderName = line.substring(depth+1)
      const folderId = uid()

      quickbar[folderStack.at(-1) as string].childFolders.push(folderId)
      folderStack.push(folderId)

      quickbar[folderId] = {
        name: folderName,
        types: [],
        childFolders: []
      }
    }
    else {
      const typeName = depth == 0 ? line : line.substring(depth+1)

      if(quickbarTypes[typeName]) {
        return null
      }

      quickbarTypes[typeName] = folderStack.at(-1) as string
    }
  }

  let validTypes = 0
  for(const type of types) {
    if(quickbarTypes[type.name]) {
      quickbar[quickbarTypes[type.name]].types.push(type.id)
      validTypes++
    }
  }

  if(validTypes != Object.values(quickbarTypes).length) {
    return null
  }

  return quickbar
}

export function mergeQuickbar(quickbar1: QuickbarState, quickbar2: QuickbarState) {
  const quickbar1Types = new Set(
    Object.values(quickbar1).map(f => f.types).flat()
  )

  for(const folderId in quickbar2) {
    if(quickbar1[folderId]) {
      quickbar1[folderId].name = quickbar2[folderId].name
      quickbar1[folderId].childFolders = Array.from(
        new Set([ ...quickbar1[folderId].childFolders, ...quickbar2[folderId].childFolders ])
      )
      quickbar1[folderId].types = Array.from(
        new Set([ ...quickbar1[folderId].types, ...quickbar2[folderId].types ])
      )
    }
    else {
      quickbar1[folderId] = {
        name: quickbar2[folderId].name,
        childFolders: quickbar2[folderId].childFolders,
        types: quickbar2[folderId].types.filter(t => !quickbar1Types.has(t))
      }
    }
  }

  return quickbar1
}
