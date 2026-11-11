import type { ReactNode } from 'react'
import { ApartmentList } from './components/ApartmentList'
import { Building } from './components/Building'
import { ContactSection } from './components/ContactSection'
import { DetailPanel } from './components/DetailPanel'
import { FilterBar } from './components/FilterBar'
import { Hero } from './components/Hero'
import { LightFinder } from './components/LightFinder'
import { SunControl } from './components/SunControl'
import { TopNav } from './components/TopNav'
import { TypeGallery } from './components/TypeGallery'
import { StoreProvider } from './state/store'

/** Rozdział lewej kolumny: numer, tytuł, lead. Bryła po prawej reaguje na to, co się w nim dzieje. */
function Chapter({ id, num, title, lead, children }: { id: string; num: string; title: ReactNode; lead: ReactNode; children: ReactNode }) {
  return (
    <section className="chapter" id={id} tabIndex={-1} aria-labelledby={`${id}-title`}>
      <div className="chapter__head">
        <span className="chapter__num" aria-hidden="true">
          {num}
        </span>
        <h2 className="chapter__title" id={`${id}-title`}>
          {title}
        </h2>
        <p className="chapter__lead">{lead}</p>
      </div>
      {children}
    </section>
  )
}

export default function App() {
  return (
    <StoreProvider>
      {/* pierwszy przystanek Tab: bez niego do bryły dochodzi się przez całą stronę */}
      <a className="btn skip-link" href="#budynek">
        Przejdź do bryły budynku
      </a>
      <header className="topbar">
        <a className="topbar__logo" href="#top">
          Atrium <em>Południe</em>
        </a>
        <TopNav />
        <a className="btn btn--outline topbar__cta" href="#mieszkania">
          Wybierz <span className="topbar__cta-long">mieszkanie</span>
        </a>
      </header>

      <main className="stage" id="top">
        <Hero />
        <section className="stage__scene" id="budynek" tabIndex={-1} aria-label="Bryła budynku i pora dnia">
          <Building />
          <SunControl />
        </section>
          <Chapter
            id="typy"
            num="02"
            title={
              <>
                Pięć układów, <em>jedno</em> światło
              </>
            }
            lead="Każdy typ powtarza się na siedmiu piętrach. Wskaż kartę, a bryła pokaże, gdzie są te mieszkania; wybierz ją, żeby zobaczyć je w wyszukiwarce."
          >
            <TypeGallery />
          </Chapter>
          <Chapter
            id="swiatlo"
            num="03"
            title={
              <>
                Kiedy jesteś <em>w&nbsp;domu</em>?
              </>
            }
            lead="Zaznacz pory, które spędzasz w mieszkaniu. Policzymy, w których salonach słońce jest właśnie wtedy — z orientacji okien, piętra i budynku obok."
          >
            <LightFinder />
          </Chapter>
          <Chapter
            id="mieszkania"
            num="04"
            title="Wszystkie mieszkania"
            lead="Pasek przy każdym mieszkaniu to jego dzień od 5:00 do 21:00: złoty odcinek to słońce w salonie."
          >
            <FilterBar />
            <ApartmentList />
          </Chapter>
      </main>

      <ContactSection />
      <DetailPanel />
    </StoreProvider>
  )
}
