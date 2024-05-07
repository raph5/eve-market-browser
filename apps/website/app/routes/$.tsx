
export async function loader() {
  throw new Response(null, {
    status: 404,
    statusText: "Not Found"
  })
}
