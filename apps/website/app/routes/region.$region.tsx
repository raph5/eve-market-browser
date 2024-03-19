import { type LoaderFunctionArgs, json } from "@remix-run/node";
import { esiStore } from "../.server/esiServerStore";
import { Outlet, useLoaderData } from "@remix-run/react";

export async function loader({ params }: LoaderFunctionArgs) {
  const regionData = await esiStore.getRegions()
  
  if(!params.region || !regionData[params.region]) {
    throw json("Region Not Found", { status: 404 })
  }
  
  return json({
    regionId: params.region,
    regionName: regionData[params.region].name
  })
}

export default function Region() {
  const { regionId, regionName } = useLoaderData<typeof loader>()

  return (
    <section>
      <p>{regionName}</p>
      <Outlet />
    </section>
  );
}