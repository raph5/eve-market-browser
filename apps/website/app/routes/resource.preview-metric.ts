import { esiStore } from "@app/esiStore.server";
import { json, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({
  request,
}: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const typeId = parseInt(url.searchParams.get("type") ?? "")
  const regionId = parseInt(url.searchParams.get("region") ?? "")
  if (!Number.isFinite(typeId) || !Number.isFinite(regionId)) {
    throw json("Type or Region Not Found", { status: 404 })
  }

  try {
    const previewMetrics = await esiStore.getPreviewMetrics(typeId, regionId)
    return json(previewMetrics)
  } catch (error) {
    console.log(error);
    throw json("Internal Server Error", { status: 500 })
  }
}
