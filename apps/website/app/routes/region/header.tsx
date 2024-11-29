import "@scss/header.scss"
import logo from "@assets/logo.png"
import { Select } from "@components/select";
import { type Region } from "esi-store/types";
import { useEffect, useState } from "react";
import { Link, useMatches, useNavigate, useParams } from "@remix-run/react";
import Label from "@components/label";
import { usePath } from "@hooks/usePath";

export interface HeaderProps {
  regions?: Region[]
}

export default function Header({ regions }: HeaderProps) {
  const navigate = useNavigate()
  const matches = useMatches()
  const params = useParams()
  const path = usePath()

  /**
   * The header can be render in two ways:
   * If the user is on the market page (/region/...) then `Header` will be
   * provided with a `regions` param and the header will have a select widget
   * for choosing the market region.
   * Else `regions` will be undef and the header will be rendered without the
   * select widget.
   */
  const isMarketHeader = regions != undefined;

  let isValidRegion = false
  if (isMarketHeader) {
    isValidRegion = params.region == '0' || regions.findIndex(r => r.id.toString() == params.region) != -1
  }

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
          <li className={`header__nav-item ${matches[1]?.id == "routes/about" ? "header__nav-item--active" : ""}`}>
            <Link to="/about" className="header__link">About</Link>
          </li>
        </ul>

        {isMarketHeader && <>
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
        </>}
      </header>

      <header className="header header--mobile">
        <Link to="/" className="header__title-link">
          <img className="header__logo" src={logo} alt="eve market browser logo" />
          <h1 className="header__title">EVE Market Browser</h1>
        </Link>

        <button onClick={() => isDropdownOpen ? closeDropdown() : openDropdown()} className="header__trigger">
          {isDropdownOpen ? "Close" : "Menu"}
        </button>
        
        <div className={`header__dropdown ${isDropdownOpen ? 'header__dropdown--open' : ''}`}>
          <ul className="header__nav">
            <li className={`header__nav-item ${matches[1]?.id == "routes/region" ? "header__nav-item--active" : ""}`}>
              <Link to="/region/0/type/44992" onClick={unfreez} className="header__link">Market</Link>
            </li>
            <li className={`header__nav-item ${matches[1]?.id == "routes/about" ? "header__nav-item--active" : ""}`}>
              <Link to="/about" onClick={unfreez} className="header__link">About</Link>
            </li>
          </ul>

          {isMarketHeader && <>
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
          </>}
        </div>
      </header>
    </>
  );
}
