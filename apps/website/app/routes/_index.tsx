import { redirect } from "@remix-run/react";

export async function loader() {
  return redirect("/region/10000002")
}