import EsiStore from "esi-store"

if(process.env.ESI_CACHE == undefined) {
  throw new Error("environnement variable ESI_CACHE is not defined")
}

console.log("esiStore")

export const esiStore = new EsiStore(process.env.ESI_CACHE as string)
