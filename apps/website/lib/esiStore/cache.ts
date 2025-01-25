import { readFile, writeFile } from "node:fs/promises"

export async function readCacheFile(cacheFolder: string, cacheFile: string): Promise<string> {
  return await readFile(`${cacheFolder}/${cacheFile}.json`, { encoding: 'utf8' })
}

export async function writeCacheFile(cacheFolder: string, cacheFile: string, text: string) {
  await writeFile(`${cacheFolder}/${cacheFile}.json`, text, { encoding: 'utf8' }).catch()
}
