import EsiStore from "esi-store"

export const esiStore = new EsiStore(process.env.ESI_CACHE as string)