import "@scss/header.scss"
import logo from "@assets/logo.png"
import { Select } from "@components/select";
import { type Region } from "esi-store/types";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "@remix-run/react";
import Label from "@components/label";
import { usePath } from "@hooks/usePath";

export interface HeaderProps {
  regions: Region[]
}

export default function Header({ regions }: HeaderProps) {
  const navigate = useNavigate()
  const params = useParams()
  const path = usePath()

  const isValidRegion = params.region == '0' || regions.findIndex(r => r.id.toString() == params.region) != -1
  const [selectValue, setSelectValue] = useState(isValidRegion ? params.region : '')

  useEffect(() => {
    setSelectValue(isValidRegion ? params.region : '')
  }, [params])

  return (
    <header className="header">
      <Link to="/" className="header__title-link">
        <img className="header__logo" src={logo} alt="eve market browser logo" />
        <h1 className="header__title">EVE Market Browser</h1>
      </Link>
      
      <ul className="header__nav">
        <li className="header__nav-item">
          <Link to="/about" className="header__link">About</Link>
        </li>
      </ul>

      <Label value="Region :" className="header__region-label" htmlFor="regionSelect" />
      <Select
        id="htmlFor"
        className="header__region"
        placeholder="Select a region"
        items={[
          {key: '0', name: "All Regions"},
          ...regions.map(({ id, name }) => ({ key: id.toString(), name }))
        ]}
        value={selectValue}
        onValueChange={(regionId) => navigate(path.setRegionId(regionId))} />
    </header>
  );
}
