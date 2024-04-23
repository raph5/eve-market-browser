import EsiStore from "esi-server-store"

export const esiStore = new EsiStore(process.env.ESI_CACHE as string)
