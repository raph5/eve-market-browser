import { Blueprint, esiStore } from "@app/esiStore.server";
import { MetaFunction, json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation, useMatches, useOutletContext, useRouteError } from "@remix-run/react";
import EveIcon, { typeIconSrc } from "@components/eveIcon";
import { ErrorMessage } from "@components/errorMessage";
import { RegionContext } from "./region/route";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import QuickbarContext from "@contexts/quickbarContext";
import "@scss/item-page.scss"
import { MarketGroup, Type as EsiType } from "@app/esiStore.server";
import MarketTreeContext from "@app/contexts/marketTreeContext";
import { esiFetch } from "@app/esiFetch";
import * as Dialog from "@radix-ui/react-dialog";
import { Tab, TabsRoot } from "@components/tabs";
import targetIcon from "@assets/target.png"
import infoIcon from "@assets/info-transparent.png"
import showInfoIcon from "@assets/info.png"
import closeIcon from "@assets/close.png"
import nanoIcon from "@assets/nano.png"
import bulkheadsIcon from "@assets/bulkheads.png"
import cargoIcon from "@assets/cargo.png"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if(!data || !data.regionName || !data.typeName) {
    return []
  }

  return [
    { title: `${data.typeName} in ${data.regionName} - EVE Market Browser` },
    { name: "description", content: `Explore real-time market data for ${data.typeName} in ${data.regionName} region of EVE Online. Track current prices, trends, and trade opportunities for a wide range of commodities, ships, modules, and more.` },
    { property: "og:type", content: "website" },
    { property: "og:image", content: "https://evemarketbrowser.com/thumbnail.png" },
    { property: "og:image:type", content: "image/png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image:src", content: "https://evemarketbrowser.com/thumbnail.png" }
  ]
}

export async function loader({ params }: LoaderFunctionArgs) {
  if(!params.type || !params.region) {
    throw json("Type or Region Not Found", { status: 404 })
  }

  let typeId: number
  let regionId: number
  try {
    typeId = parseInt(params.type)
    regionId = parseInt(params.region)
  } catch {
    throw json("Type or Region Not Found", { status: 404 })
  }

  const typeName = await esiStore.getTypeName(typeId)
  const regionName = regionId != 0 ? await esiStore.getRegionName(regionId) : "All Regions"
  if(!typeName || !regionName) {
    throw json("Type or Region Not Found", { status: 404 })
  }

  const blueprints = await esiStore.blueprints

  return json(
    { typeId, typeName, regionId, regionName, blueprints },
  )
}

export default function Type() {
  const { marketGroups, types } = useOutletContext<RegionContext>()
  const { typeId, regionId, blueprints } = useLoaderData<typeof loader>()
  const quickbar = useContext(QuickbarContext)
  const marketTree = useContext(MarketTreeContext)
  const [inQuickbar, setInQuickbar] = useState(false)
  const matches = useMatches()
  const type = getType(types, typeId)

  const isMarketTreeInitialized = useRef(false)
  useEffect(() => {
    if (!isMarketTreeInitialized.current) {
      isMarketTreeInitialized.current = true
      marketTree.openType(typeId, false)
    }
  }, [])

  const breadcrumbs = useMemo(() => computeBreadcrumbs(marketGroups, typeId), [marketGroups, typeId])

  // To avoid hydration errors
  useEffect(() => {
    setInQuickbar(quickbar.has(typeId))
  }, [typeId, quickbar.state])

  const dataTabState = (matches.at(-1)?.id == "routes/region.$region.type.$type._index") ? "active" : ""
  const historyTabState = (matches.at(-1)?.id == "routes/region.$region.type.$type.history") ? "active" : ""

  return (
    <div className="item-page">
      <div className="item-header">
        <EveIcon className="item-header__icon" alt={`${type.name} icon`} src={typeIconSrc(typeId)} />
        <div className="item-header__info">
          <span className="item-header__breadcrumbs">
            {breadcrumbs.map((bc, index) => (<span key={bc.id}>
              {index > 0 && ' / '}
              <button key={bc.id} onClick={() => marketTree.openGroup(bc.id)}>{bc.name}</button>
            </span>))}
          </span>
          <div className="item-header__name-box">
            <h2 className="item-header__name">{type.name}</h2>
            <button className="item-header__target" onClick={() => marketTree.openType(type.id, true)}>
              <img src={targetIcon} />
            </button>
          </div>
        </div>
        <div className="item-header__action">
          {inQuickbar ? (
            <button className="button button--corner-left item-header__button" onClick={() => quickbar.removeItem(typeId)}>
              <span>Remove From Quickbar</span>
            </button>
          ) : (
            <button className="button button--corner-left item-header__button" onClick={() => quickbar.addItem(typeId)}>
              <PlusIcon className="button__icon" />
              <span>Add To Quickbar</span>
            </button>
          )}
          <ShowInfo typeId={typeId} blueprints={blueprints} />
        </div>
      </div>
      <div className="item-body">
        <div className="tabs item-body__tabs">
          <div className="tabs__list">
            <Link to={`/region/${regionId}/type/${typeId}`} className="tabs__trigger" data-state={dataTabState}>
              Market Data
            </Link>
            <Link to={`/region/${regionId}/type/${typeId}/history`} className="tabs__trigger" data-state={historyTabState}>
              Price History
            </Link>
          </div>
          <div className="tabs__content item-body__tab">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError()  
  return <ErrorMessage error={error} />
}

interface TypeData {
  id: number,
  name: string,
  description: string,
  volume?: number,
  packaged_volume?: number,
  capacity?: number,
  mass?: number,
}

interface ShowInfoProps {
  blueprints: Blueprint[],
  typeId: number,
}

function ShowInfo({typeId, blueprints}: ShowInfoProps) {
  const [type, setType] = useState<TypeData|null>(null);
  const [error, setError] = useState<Error|null>(null);

  const description = useMemo(() => (
    type && sanitizeHtml(removeUnsupportedTags(type.description))
  ), [type]) ?? ""

  useEffect(() => {
    esiFetch("GET", `/universe/types/${typeId}`, {}, 1)
      .then(repsonse => {
        setType(repsonse.data as TypeData)
        setError(null)
      })
      .catch(error => {
        setType(null)
        setError(error)
      });
  }, [typeId]);

  const tabs = [
    { value: 'attributes', label: 'Attributes' },
    { value: 'industry', label: 'Industry' },
    { value: 'description', label: 'Description' },
  ]

  return (
    <Dialog.Root>
      <Dialog.Trigger className="button show-info__tirgger" title="Show Info">
        <img src={infoIcon} className="" />
        <span>Show Info</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog__overlay" />
        <Dialog.Content className="dialog show-info">
          {type != null && <>
            <div className="show-info__header">
              <img src={showInfoIcon} className="show-info__header-icon"/>
              <Dialog.Title className="show-info__header-title">Information</Dialog.Title>
              <Dialog.Close className="show-info__header-close">
                <img src={closeIcon} />
              </Dialog.Close>
            </div>

            <div className="show-info__banner">
              <EveIcon className="show-info__banner-icon" alt={`${type.name} icon`} src={typeIconSrc(typeId)} />
              <div className="show-info__banner-text">
                <span className="show-info__name">{type.name}</span>
                {/* TODO: Add Price estimate */}
              </div>
            </div>

            <TabsRoot tabs={tabs} defaultValue="attributes">
              <Tab value="attributes" className="show-info__attributes">
                {type.volume &&
                  <div className="show-info__line">
                    <img src={nanoIcon} />
                    <span>Volume</span>
                    <span>
                      {type.volume} TODO
                      {type.packaged_volume && type.packaged_volume != type.volume && `(${type.packaged_volume}))`}
                    </span>
                  </div>
                }
                {!!type.capacity &&
                  <div className="show-info__line">
                    <img src={cargoIcon} />
                    <span>Capacity</span>
                    <span>{type.capacity}</span>
                  </div>
                }
                {!!type.mass &&
                  <div className="show-info__line">
                      <img src={bulkheadsIcon} />
                    <span>Mass</span>
                    <span>{type.mass}</span>
                  </div>
                }
              </Tab>
              <Tab value="industry" className="show-info__industry"></Tab>
              <Tab value="description" className="show-info__description">
                {/* TODO: Check for the rendering of the PLEX description */}
                <span dangerouslySetInnerHTML={{__html: description}} />
              </Tab>
            </TabsRoot>
          </>}
          {error != null &&
            <ErrorMessage className="show-info__error" error={error} />
          }
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function computeBreadcrumbs(marketGroups: MarketGroup[], typeId: number): MarketGroup[] {
  const bc: MarketGroup[] = []

  let group = marketGroups.find(g => g.types.includes(typeId))
  if(group === undefined) return []

  while(group.parentId) {
    bc.unshift(group)
    // @ts-ignore
    group = marketGroups.find(g => g.id === group.parentId)
    if(group === undefined) return []
  }
  bc.unshift(group)

  return bc
}

function sanitizeHtml(input: string): string {
  input = input.replaceAll("<b>", "@b@");
  input = input.replaceAll("</b>", "@/b@");
  input = input.replaceAll("<i>", "@i@");
  input = input.replaceAll("</i>", "@/i@");
  input = input.replaceAll("<", "&lt");
  input = input.replaceAll(">", "&gt");
  input = input.replaceAll("@b@", "<b>");
  input = input.replaceAll("@/b@", "</b>");
  input = input.replaceAll("@i@", "<i>");
  input = input.replaceAll("@/i@", "</i>");
  return input;
}

function removeUnsupportedTags(input: string): string {
  input = input.replaceAll(/<font.+?>/g, "")
  input = input.replaceAll("</font>", "")
  input = input.replaceAll(/<url.+?>/g, "")
  input = input.replaceAll("</url>", "")
  return input;
}

function getType(types: EsiType[], typeId: number): EsiType {
  for(let i=0; i<types.length; i++) {
    if(types[i].id == typeId) {
      return types[i]
    }
  }
  return {id: typeId, name: `Unknown Item ${typeId}`, meta: 1, volume: 0}
}

function getBlueprint(blueprints: Blueprint[], typeId: number): Blueprint {
  for(let i=0; i<blueprints.length; i++) {
    if(blueprints[i].product.typeId == typeId) {
      return blueprints[i]
    }
  }
  return {product: {typeId: typeId, quantity: 0}, time: 0, blueprint: 0, materials: []}
}
