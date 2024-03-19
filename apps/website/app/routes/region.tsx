import type { MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function RegionLayout() {
  return (
    <>
      <header>
        <h1>EVE Market Browser</h1>
      </header>
      <div>
        <nav>
          
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}
