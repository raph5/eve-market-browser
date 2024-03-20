import { type LoaderFunctionArgs, json, type MetaFunction } from "@remix-run/node";
import { esiStore } from "@app/.server/esiServerStore";
import { Outlet, useLoaderData } from "@remix-run/react";
import Header from "./header";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
}

export async function loader({ params }: LoaderFunctionArgs) {
  const regionData = await esiStore.getRegions()
    .catch(() => {
      throw json("Can't Find Regions Data", { status: 500 })
    });

  if(!params.region) {
    throw json("Region Not Found", { status: 404 })
  }

  
  
  const currentRegion = regionData.find(r => r.id.toString() == params.region)
  
  if(!currentRegion) {
    throw json("Region Not Found", { status: 404 })
  }
  
  return json({
    regionData,
    regionId: currentRegion.id,
    regionName: currentRegion.name
  })
}

export default function Region() {
  const { regionData, regionId, regionName } = useLoaderData<typeof loader>()

  return (
    <>
      <Header
        regionData={Object.values(regionData)}
        regionId={regionId} />
      <main>
        <p>{regionName}</p>
        <Outlet />
      </main>
    </>
  );
}