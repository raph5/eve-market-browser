/**
 * @typedef {Object} Type
 * @property {number} id
 * @property {string} name
 * @property {number} meta
 *
 * @typedef {Object} Region
 * @property {number} id
 * @property {string} name
 *
 * @typedef {Object} MarketGroup
 * @property {number} id
 * @property {number | null} parentId
 * @property {number[]} childsId
 * @property {string} name
 * @property {string} description
 * @property {number[]} types
 * @property {string} iconFile
 * @property {string} iconAlt
 *
 * @typedef {Object} HistoryDay
 * @property {string} date
 * @property {number} average
 * @property {number} average5d
 * @property {number} average20d
 * @property {number} highest
 * @property {number} lowest
 * @property {number} orderCount
 * @property {number} volume
 * @property {number} donchianTop
 * @property {number} donchianBottom
 *
 * @typedef {Object} Order
 * @property {number} duration
 * @property {boolean} isBuyOrder
 * @property {string} issued
 * @property {string} location
 * @property {number} minVolume
 * @property {number} orderId
 * @property {number} price
 * @property {'station' | 'region' | 'solarsystem' | '1' | '2' | '3' | '4' | '5' | '10' | '20' | '30' | '40'} range
 * @property {number} regionId
 * @property {number} systemId
 * @property {number} typeId
 * @property {number} volumeRemain
 * @property {number} volumeTotal
 */

const csv = require("async-csv")

const hubRegion = [10000002, 10000043, 10000030, 10000032, 10000042]

/**
 * @returns {Promise<Region[]>}
 */
async function fetchRegions() {
  const regionDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/mapRegions.csv')

  if(!regionDumpResponse.ok) throw new Error("cant fetch fuzzwork dumps")

  const regionDump = await regionDumpResponse.text()
    .then(t => parseCsv(t))

  const regions = regionDump
    .map(({ regionID, regionName }) => ({ id: parseInt(regionID), name: regionName }))

  const minorRegions = regions
    .filter(({ id }) => id != 10000004 && id != 10000017 && id != 10000019 && id < 11000000 && !hubRegion.includes(id))
    .sort((a, b) => {
      if(a.name == b.name) return 0
      if(a.name < b.name) return -1
      return 1
    })

  const hubRegions = hubRegion
    .map(hubId => {
      const region = regions.find(r => r.id == hubId)
      if(!region) throw new Error("cant find hub in region dump")
      return region
    })

  return hubRegions.concat(minorRegions)
}

/**
 * @returns {Promise<MarketGroup[]>}
 */
async function fetchMarketGroups() {
  const typeDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/invTypes.csv')
  const groupDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/invMarketGroups.csv')
  const iconDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/eveIcons.csv')

  if(!groupDumpResponse.ok || !iconDumpResponse.ok || !typeDumpResponse.ok) {
    throw new Error("cant fetch fuzzwork dumps")
  }

  const groupDump = await groupDumpResponse.text().then(t => parseCsv(t))
  const typeDump = await typeDumpResponse.text().then(t => parseCsv(t))
  const iconDump = await iconDumpResponse.text().then(t => parseCsv(t))

  const iconsDumpRecord = createRecord(iconDump, 'iconID')
  const typeNameRecord = {}

  const groupRecord = {}

  for(const group of groupDump) {
    if(iconsDumpRecord[group.iconID]) '7_64_15.png'

    groupRecord[group.marketGroupID] = {
      id: parseInt(group.marketGroupID),
      parentId: group.parentGroupID != 'None' ? parseInt(group.parentGroupID) : null,
      childsId: [],
      types: [],
      name: group.marketGroupName,
      description: group.description,
      iconFile: iconsDumpRecord[group.iconID] ? iconsDumpRecord[group.iconID].iconFile.split('/').at(-1) : '7_64_15.png',
      iconAlt: iconsDumpRecord[group.iconID] ? iconsDumpRecord[group.iconID].description : 'Unknown'
    }
  }

  for(const type of typeDump) {
    typeNameRecord[type.typeID] = type.typeName
    if(type.marketGroupID != 'None') {
      groupRecord[type.marketGroupID].types.push(parseInt(type.typeID))
    }
  }

  let parentId
  for(const groupId in groupRecord) {
    parentId = groupRecord[groupId].parentId
    if(parentId != null) {
      groupRecord[parentId].childsId.push(parseInt(groupId))
    }
  }

  for(const groupId in groupRecord) {
    groupRecord[groupId].types = groupRecord[groupId].types.sort(stringSort(t => typeNameRecord[t]))
    groupRecord[groupId].childsId = groupRecord[groupId].childsId.sort(stringSort(g => groupRecord[g].name))
  }

  return Object.values(groupRecord)
}

/**
 * @param {MarketGroup[]} marketGroups 
 * @return {Promise<Type[]>}
 */
async function fetchTypes(marketGroups) {
  const typeDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/invTypes.csv')
  const metaTypeDumpResponse = await fetch('https://www.fuzzwork.co.uk/dump/latest/invMetaTypes.csv')

  if(!typeDumpResponse.ok || !metaTypeDumpResponse.ok) throw new Error("cant fetch fuzzwork dumps")

  const typeDump = await typeDumpResponse.text()
    .then(t => parseCsv(t))
  const metaTypeDump = await metaTypeDumpResponse.text()
    .then(t => parseCsv(t))

  const nameRecord = {}
  const metaRecord = {}
  typeDump.forEach((t) => nameRecord[t.typeID] = t.typeName)
  metaTypeDump.forEach((t) => {
    metaRecord[t.typeID] = parseInt(t.metaGroupID)
  })

  const types = []
  for(const group of marketGroups) {
    for(const typeId of group.types) {
      types.push({
        id: typeId,
        name: nameRecord[typeId] ?? 'Unknown',
        meta: metaRecord[typeId] ?? 1
      })
    }
  }

  const sortedTypes = types.sort(stringSort(t => t.name))

  return sortedTypes
}

/**
 * @param {string} str
 * @return {any}
 */
function parseCsv(str) {
  return csv.parse(str, {columns: true})
}

/**
 * @param {Array} array
 * @param {string} keyField
 * @return {any}
 */
function createRecord(array, keyField) {
  const record = {}
  for(let i=0; i<array.length; i++) {
    record[array[i][keyField]] = array[i]
  }
  return record
}

/**
 * @param {(v: any) => string} getValue
 * @returns {(a: any, b: any) => number}
 */
function stringSort(getValue = (v => v)) {
  return (a, b) => getValue(a).localeCompare(getValue(b))
}

module.exports = {
  fetchTypes,
  fetchRegions,
  fetchMarketGroups
}
