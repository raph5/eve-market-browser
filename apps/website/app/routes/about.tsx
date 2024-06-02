
/**
 * The goal of this page :
 * 1. Link the github page
 * 2. Allow users to report a bug
 * 3. Share contact information
 * 4. Add legal mentions and rgpd stuff
 */

import { Link } from "@remix-run/react"
import { MetaFunction } from "@remix-run/node"
import logo from "@assets/logo.png"
import "@scss/header.scss"
import "@scss/about.scss"

export const meta: MetaFunction = () => {
  return [
    { title: "About - EVE Market Browser" },
    { name: "description", content: "Contact informations and Github repository" },
    { property: "og:type", content: "website" },
    { property: "og:image", content: "https://evemarketbrowser.com/thumbnail.png" }
  ]
}

export default function About() {
  
  return (
    <>
      <header className="header">
        <Link to="/" className="header__title-link">
          <img className="header__logo" src={logo} alt="eve market browser logo" />
          <h1 className="header__title">EVE Market Browser</h1>
        </Link>
        
        <ul className="header__nav">
          <li className="header__nav-item header__nav-item--active">
            <Link to="/about" className="header__link">About</Link>
          </li>
        </ul>
      </header>
      <main className="about">
        <section className="about__feedback">
          <p>This site is currently under active development. If you have any feedback, please let me know.</p>
        </section>
        <section className="about__contact">
          <h2>Contact Informations</h2>
          <p>
            In-game name : Raph Toulouse<br/>
            Email : <a href="mailto:raphguyader@gmail.com">raphguyader@gmail.com</a><br/>
            Discord : raph_5#0989<br/>
            My killboard 😛 : <a href="https://zkillboard.com/character/2113183745/">zkillborad</a>
          </p>
        </section>

        <section className="about__github">
          <h2>Bug report</h2>
          <p>
            If you found a bug or you have a feature request <a href="https://github.com/raph5/eve-market-browser/issues/new">create new issue</a> on the github repository<br/>
          </p>
          <p>
            This project is fully open source. The github repo is available <a href="https://github.com/raph5/eve-market-browser">here</a><br/>
            Don't forget to like the repo !
          </p>
        </section>

        <section className="about__legal">
          <p>
            EVE Online, the EVE logo, EVE and all associated logos and designs are the intellectual property of CCP hf. All artwork, screenshots, characters, vehicles, storylines, world facts or other recognizable features of the intellectual property relating to these trademarks are likewise the intellectual property of CCP hf. EVE Online and the EVE logo are the registered trademarks of CCP hf. All rights are reserved worldwide. All other trademarks are the property of their respective owners. CCP hf. has granted permission to Adam4EVE to use EVE Online and all associated logos and designs for promotional and information purposes on its website but does not endorse, and is not in any way affiliated with, Adam4EVE. CCP is in no way responsible for the content on or functioning of this website, nor can it be liable for any damage arising from the use of this website.
          </p>
        </section>
      </main>
    </>
  )
}
