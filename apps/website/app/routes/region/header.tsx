import "@scss/header.scss"
import logo from "@assets/logo.png"
import { Select } from "@components/select";
import { type Region } from "esi-server-store/types";
import { useState } from "react";
import { Link, useNavigate, useParams } from "@remix-run/react";
import Label from "@components/label";

export interface HeaderProps {
  regions: Region[]
}

export default function Header({ regions }: HeaderProps) {
  const navigate = useNavigate()
  const params = useParams()

  const isValidRegion = regions.findIndex(r => r.id.toString() == params.region) != -1
  const [selectValue, setSelectValue] = useState(isValidRegion ? params.region : '')

  function setRegion(region: string) {
    setSelectValue(region)
    navigate(params.type ? `/region/${region}/type/${params.type}` : `/region/${region}`)
  }

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
        items={regions.map(({ id, name }) => ({ key: id.toString(), name }))}
        value={selectValue}
        onValueChange={setRegion} />
    </header>
  );
}
