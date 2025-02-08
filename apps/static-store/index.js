/**
 * The static store fetches and serialize essential static data for the website:
 * - types
 * - regions
 * - market-groups
 *
 * Though I would now write it in go, it was originaly written in js as a part
 * of the remix app. For better separation of concerns I is isolate this
 * script in a separate node module.
 */

const {fetchTypes, fetchMarketGroups, fetchRegions} = require("./lib.js")
const fs = require("node:fs")

const REGION_CACHE = 'regions.json'
const MARKET_GROUP_CACHE = 'market-group.json'
const TYPE_CACHE = 'types.json'
const CACHE_DIR = process.env.ESI_CACHE
if (typeof CACHE_DIR != "string" || CACHE_DIR.length == 0) {
  throw "ESI_CACHE environnement variable not set"
}

console.log("downloading types, regions, and market groups...")

const regionPromise = fetchRegions()
  .then(regions => fs.writeFileSync(`${CACHE_DIR}/${REGION_CACHE}`, JSON.stringify(regions)))

const typeAndMarketGroupPromise = fetchMarketGroups()
  .then(groups => {
    fs.writeFileSync(`${CACHE_DIR}/${MARKET_GROUP_CACHE}`, JSON.stringify(groups))
    fetchTypes(groups)
      .then(types => fs.writeFileSync(`${CACHE_DIR}/${TYPE_CACHE}`, JSON.stringify(types)))
  })

Promise.all([regionPromise, typeAndMarketGroupPromise])
  .then(() => console.log("success"))
