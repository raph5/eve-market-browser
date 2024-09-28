import { useLocation, useNavigate, useParams } from "@remix-run/react"

export type usePathHook = {
  setTypeId: (id: number|string) => string
  setRegionId: (id: number|string) => string
}

export function usePath() {
  const location = useLocation()
  const params = useParams()

  const setTypeId = (id: number|string) => {
    if(params.type != undefined) {
      const strId = typeof id == "string" ? id : id.toString()
      return location.pathname.replace(params.type, strId)
    }
    else if(params.region != undefined) {
      return `/region/${params.region}/type/${id}`
    }
    else {
      console.error("Can't find regionId in urls params")
      return `/region/0/type/${id}`
    }
  }

  const setRegionId = (id: number|string) => {
    if(params.region != undefined) {
      const strId = typeof id == "string" ? id : id.toString()
      return location.pathname.replace(params.region, strId)
    }
    else {
      return `/region/${id}`
    }
  }

  return { setTypeId, setRegionId }
}
