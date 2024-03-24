import { esiStore } from "@app/.server/esiServerStore";
import { json, type MetaFunction } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import Navigation from "./navigation";
import { useMemo } from "react";
import { createRecord } from "utils";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
}

export async function loader() {
  const marketGroups = await esiStore.getMarketGroups()
    .catch(() => {
      throw json("Can't Find Market Groups", { status: 500 })
    })

  const marketGroupsRecord = createRecord(marketGroups, 'id')

  const types = await esiStore.getTypes()
    .catch(() => {
      throw json("Can't Find Types Names", { status: 500 })
    })

  return json({ types, marketGroups, marketGroupsRecord })
}

export default function Layout() {
  const { types, marketGroups, marketGroupsRecord } = useLoaderData<typeof loader>();

  return (
    <>
      <Navigation typeRecord={types} marketGroups={marketGroups} marketGroupRecord={marketGroupsRecord} />
      <Outlet />
    </>
  );
}