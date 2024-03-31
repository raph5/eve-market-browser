import "@scss/header.scss"
import logo from "@assets/logo.png"
import { Select } from "@components/select";
import { type Region } from "esi-server-store/types";
import { useState } from "react";
import { useNavigate, useParams } from "@remix-run/react";
import Label from "@components/label";

export interface HeaderProps {
  regions: Region[]
  regionId: number
}

export default function Header({ regions, regionId }: HeaderProps) {
  const navigate = useNavigate()
  const params = useParams()

  const [selectValue, setSelectValue] = useState(regionId.toString())

  function setRegion(region: string) {
    setSelectValue(region)
    navigate(params.type ? `/region/${region}/type/${params.type}` : `/region/${region}`)
  }

  return (
    <header className="header">
      <img className="header__logo" src={logo} alt="eve market browser logo" />
      <h1 className="header__title">EVE Market Browser</h1>

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