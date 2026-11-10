# Wstawienie do repo SW-Development

Wszystko poniżej jest przygotowane, ale w repo `SW-Development` nic nie zostało zmienione.

## 1. Demo pod `/atrium-poludnie/`

```bash
npm run build
```

Skopiuj zawartość `dist/` do `SW-Development/public/atrium-poludnie/`.
Build ma ścieżki względne, więc nie potrzebuje `.htaccess` ani zmian w `vite.config.ts`.

## 2. Okładka

Skopiuj `do-portfolio/atrium-poludnie.webp` (1200 × 750, jak pozostałe okładki) do `SW-Development/src/img/`.

## 3. Wpis w `src/content.ts`

Import na górze pliku, obok pozostałych:

```ts
import shotAtrium from './img/atrium-poludnie.webp'
```

Wpis do tablicy `projects` (kolejność w tablicy to kolejność na stronie):

```ts
  {
    id: 'atrium-poludnie',
    name: { pl: 'Atrium Południe — wyszukiwarka mieszkań', en: 'Atrium Południe — apartment finder' },
    category: 'web',
    year: '2026',
    image: shotAtrium,
    tagline: {
      pl: 'Klient wybiera mieszkanie prosto na bryle budynku i sprawdza, o której godzinie słońce wpada do salonu.',
      en: 'The buyer picks a flat straight on the building and checks at what time the sun reaches the living room.',
    },
    role: { pl: 'Projekt i wdrożenie', en: 'Design & build' },
    stack: ['React', 'TypeScript', 'Vite', 'SVG', 'Vitest', 'Playwright'],
    highlights: [
      {
        pl: 'Bryła budynku rysowana w SVG z danych: każde mieszkanie jest klikalne, a lista i budynek podświetlają to samo.',
        en: 'The building is drawn in SVG from data: every flat is clickable, and the list and the building highlight the same one.',
      },
      {
        pl: 'Suwak pory dnia zmienia słońce, cień budynku i jasność elewacji; dla każdego mieszkania widać, w jakich godzinach salon ma słońce.',
        en: 'A time-of-day slider moves the sun, the building’s shadow and the light on the façades; each flat shows the hours its living room gets sun.',
      },
      {
        pl: 'Karta mieszkania z rzutem generowanym z danych, kalkulatorem raty i formularzem zapytania.',
        en: 'A flat card with a floor plan generated from data, a mortgage calculator and an enquiry form.',
      },
    ],
    results: [
      {
        pl: 'Bez bibliotek do wykresów i grafiki: bryła, rzuty i wykres nasłonecznienia to własny SVG.',
        en: 'No chart or graphics libraries: the building, the floor plans and the sunlight chart are hand-built SVG.',
      },
      {
        pl: 'Całość da się obsłużyć z klawiatury: po budynku chodzi się strzałkami, a logikę pokrywają 53 testy.',
        en: 'Everything works from the keyboard: you move around the building with arrow keys, and 53 tests cover the logic.',
      },
    ],
    about: {
      pl: 'Demo dla deweloperów mieszkaniowych. Zamiast tabeli z numerami lokali klient widzi budynek, wybiera piętro i stronę świata, filtruje po cenie i metrażu, a potem sprawdza rzut, nasłonecznienie i ratę kredytu. Inwestycja jest fikcyjna, a demo działa w całości w przeglądarce.',
      en: 'A demo for residential developers. Instead of a table of unit numbers the buyer sees the building, picks a floor and an aspect, filters by price and size, then checks the floor plan, sunlight and mortgage payment. The development is fictional and the demo runs entirely in the browser.',
    },
    liveUrl: '/atrium-poludnie/',
  },
```

Liczba testów (53) jest zmierzona: `npm test` w tym projekcie. Jeśli testy się zmienią, popraw ją we wpisie.

## 4. Opcjonalnie

`src/components/AppBuilder.tsx` ma tablicę `FEATURES` z polem `proof` (id projektów, które naprawdę mają daną funkcję).
Atrium nie ma backendu, map ani płatności, więc nie pasuje do żadnej z istniejących pozycji — nie dopisuj go tam.
