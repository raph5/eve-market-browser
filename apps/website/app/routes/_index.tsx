import { MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "EVE Market Browser" },
    { name: "description", content: "Explore real-time market data from EVE Online. Track current prices, trends, and trade opportunities for a wide range of commodities, ships, modules, and more." },
    { property: "og:type", content: "website" },
    { property: "og:image", content: "https://evemarketbrowser.com/thumbnail.png" },
    { property: "og:image:type", content: "image/png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image:src", content: "https://evemarketbrowser.com/thumbnail.png" }
  ];
}

export async function loader() {
  return redirect("/region/10000002/type/11393")
}
