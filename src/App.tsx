import { ApartmentList } from './components/ApartmentList'
import { Building } from './components/Building'
import { DetailPanel } from './components/DetailPanel'
import { FilterBar } from './components/FilterBar'
import { Hero } from './components/Hero'
import { SunControl } from './components/SunControl'
import { TopNav } from './components/TopNav'
import { StoreProvider } from './state/store'

export default function App() {
  return (
    <StoreProvider>
      {/* pierwszy przystanek Tab: bez niego do bryły dochodzi się przez całą listę */}
      <a className="btn skip-link" href="#budynek">
        Przejdź do bryły budynku
      </a>
      <div className="topbar">
        <a className="topbar__logo" href="#top">
          Atrium <em>Południe</em>
        </a>
        <TopNav />
        <a className="btn btn--outline topbar__cta" href="#mieszkania">
          Wybierz <span className="topbar__cta-long">mieszkanie</span>
        </a>
      </div>

      <main className="stage" id="top">
        <div className="stage__content">
          <Hero />
          <div className="section-title" id="mieszkania">
            <h2>Mieszkania</h2>
            <p className="eyebrow">wyszukiwarka</p>
          </div>
          <FilterBar />
          <ApartmentList />
        </div>
        <section className="stage__scene" id="budynek" tabIndex={-1} aria-label="Bryła budynku i pora dnia">
          <Building />
          <SunControl />
        </section>
      </main>

      <footer className="footer">
        Atrium Południe to inwestycja fikcyjna. Strona jest demonstracją wyszukiwarki mieszkań: ceny,
        dostępność, wnętrza i nasłonecznienie są przykładowe.
      </footer>
      <DetailPanel />
    </StoreProvider>
  )
}
