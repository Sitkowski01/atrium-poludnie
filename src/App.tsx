import { ApartmentList } from './components/ApartmentList'
import { Building } from './components/Building'
import { DetailPanel } from './components/DetailPanel'
import { FilterBar } from './components/FilterBar'
import { Hero } from './components/Hero'
import { SunControl } from './components/SunControl'
import { StoreProvider } from './state/store'

export default function App() {
  return (
    <StoreProvider>
      <div className="page">
        <Hero />
        <main className="explorer" id="mieszkania">
          <section className="explorer__scene" aria-label="Bryła budynku i pora dnia">
            <Building />
            <SunControl />
          </section>
          <section className="explorer__side" aria-label="Filtry i lista mieszkań">
            <FilterBar />
            <ApartmentList />
          </section>
        </main>
        <footer className="footer">
          Atrium Południe to inwestycja fikcyjna. Strona jest demonstracją wyszukiwarki mieszkań: ceny,
          dostępność i nasłonecznienie są przykładowe.
        </footer>
        <DetailPanel />
      </div>
    </StoreProvider>
  )
}
