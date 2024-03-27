import { type LoaderFunctionArgs, json, type MetaFunction } from "@remix-run/node";
import { esiStore } from "@app/.server/esiServerStore";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import Header from "./header";
import { ErrorMessage } from "@components/errorMessage";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
}

export async function loader({ params }: LoaderFunctionArgs) {
  const regions = await esiStore.getRegions()
    .catch(() => {
      throw json("Can't Find Regions Data", { status: 500 })
    });

  if(!params.region) {
    throw json("Region Not Found", { status: 404 })
  }

  const currentRegion = regions.find(r => r.id.toString() == params.region)
  
  if(!currentRegion) {
    throw json("Region Not Found", { status: 404 })
  }
  
  return json({
    regions,
    regionId: currentRegion.id,
    regionName: currentRegion.name
  })
}

export default function Region() {
  const { regions, regionId, regionName } = useLoaderData<typeof loader>()

  return (
    <>
      <Header
        regions={regions}
        regionId={regionId} />
      <main>
        <Outlet />
      </main>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError()  
  return <ErrorMessage error={error} />
}