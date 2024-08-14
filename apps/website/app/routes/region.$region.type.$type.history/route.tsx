import { ErrorMessage } from "@components/errorMessage"
import { useRouteError } from "@remix-run/react"

export function ErrorBoundary() {
  const error = useRouteError()  
  return <ErrorMessage error={error} />
}
