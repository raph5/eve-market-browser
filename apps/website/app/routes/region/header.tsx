import "@scss/header.scss"
import logo from "@assets/logo.png"
import { Select } from "@components/select";
import type { Region } from "@app/esiStore.server";
import { useEffect, useState } from "react";
import { Link, useMatches, useNavigate, useParams } from "@remix-run/react";
import Label from "@components/label";
import { usePath } from "@hooks/usePath";

export interface HeaderProps {
}

export default function Header({}: HeaderProps) {
  const matches = useMatches()

  const [isDropdownOpen, setDropdownOpen] = useState(false);

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
        </div>
      </header>
    </>
  );
}
