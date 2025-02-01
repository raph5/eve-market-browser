import classNames from "classnames"
import type React from "react"
import "@scss/error-message.scss"
import { isRouteErrorResponse } from "@remix-run/react"

export interface ErrorMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  error: any
}

export function ErrorMessage({ error, children, className, ...props }: ErrorMessageProps) {
  if(isRouteErrorResponse(error)) {
    return (
      <div className={classNames('error-message', className)} {...props}>
        <h1 className="error-message__title">
          {error.status} {error.statusText}
        </h1>
        <p className="error-message__message">{error.data}</p>
      </div>
    );
  } else if (error instanceof Error) {
    return (
      <div className={classNames('error-message', className)} {...props}>
        <h1 className="error-message__title">
          Error
        </h1>
        <p className="error-message__message">{error.message}</p>
      </div>
    );
  } else {
    return (
      <div className={classNames('error-message', className)} {...props}>
        <h1 className="error-message__title">
          Unknown Error
        </h1>
      </div>
    )
  }
}
