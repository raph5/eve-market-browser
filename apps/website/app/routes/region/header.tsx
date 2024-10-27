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
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    setSelectValue(isValidRegion ? params.region : '')
  }, [params])

  function openDropdown() {
    setDropdownOpen(true)
    document.body.style.overflow = "hidden"
  }
  function closeDropdown() {
    setDropdownOpen(false)
    document.body.style.overflow = ""
  }
  function unfreez() {
    document.body.style.overflow = ""
  }

  return (
    <>
      <header className="header header--desktop">
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
          placeholder="Select a region"
          items={[
            {key: '0', name: "All Regions"},
            ...regions.map(({ id, name }) => ({ key: id.toString(), name }))
          ]}
          value={selectValue}
          onValueChange={(regionId) => navigate(path.setRegionId(regionId))} />
      </header>
      <header className="header header--mobile">
        <Link to="/" className="header__title-link">
          <img className="header__logo" src={logo} alt="eve market browser logo" />
          <h1 className="header__title">EVE Market Browser</h1>
        </Link>

        <button onClick={() => isDropdownOpen ? closeDropdown() : openDropdown()} className="header__trigger">
          Menu
        </button>
        
        <div className={`header__dropdown ${isDropdownOpen ? 'header__dropdown--open' : ''}`}>
          <ul className="header__nav">
            <li className="header__nav-item">
              <Link to="/about" onClick={unfreez} className="header__link">About</Link>
            </li>
          </ul>

          <div className="header__region">
            <Label value="Region :" className="header__region-label" htmlFor="regionSelect" />
            <select
              className="header__region-select select"
              value={selectValue}
              onChange={(event) => {
                closeDropdown()
                navigate(path.setRegionId(event.target.value))
              }}
            >
              <option value="0">All Regions</option>
              {regions.map(({ id, name }) => (
                <option value={id} key={id}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>
    </>
  );
}
