import { Link, useParams } from "@remix-run/react"
import { useContext } from "react"
import { NavContext } from "./navContext"

export interface NavItemProps {
  typeId: number
  depth?: number
}

export default function NavItem({ typeId, depth }: NavItemProps) {
  const params = useParams()
  const { typeRecord } = useContext(NavContext)

  return (
    <Link
      to={`/region/${params.region}/type/${typeId}`}
      className="nav-item"
      data-depth={depth}
    >
      {typeRecord[typeId]}
    </Link>
  )
}