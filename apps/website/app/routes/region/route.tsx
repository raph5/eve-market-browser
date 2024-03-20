import { esiStore } from "@app/.server/esiServerStore";
import { json, type MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

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
    });

  return json({ marketGroups })
}

export default function Layout() {
  return (
    <>
      <nav></nav>
      <Outlet />
    </>
  );
}