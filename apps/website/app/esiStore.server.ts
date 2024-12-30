import EsiStore from "@lib/esiStore"

if(process.env.ESI_CACHE == undefined) {
  throw new Error("environnement variable ESI_CACHE is not defined")
}

export const esiStore = new EsiStore(process.env.ESI_CACHE as string)
