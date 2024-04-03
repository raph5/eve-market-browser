import { Outlet, useOutletContext, useRouteError } from "@remix-run/react";
import { ErrorMessage } from "@components/errorMessage";

export default function Region() {
  const parentOutletContext = useOutletContext();

  return (
    <Outlet context={parentOutletContext} />
  );
}

export function ErrorBoundary() {
  const error = useRouteError()  
  return <ErrorMessage error={error} />
}