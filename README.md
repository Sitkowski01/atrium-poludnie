# Atrium Południe

Demo interaktywnej wyszukiwarki mieszkań dla fikcyjnej inwestycji deweloperskiej.
Sam frontend, bez backendu: dane są generowane w kodzie, formularz niczego nie wysyła.

- Bryła budynku w SVG: każde z 35 mieszkań jest klikalne, a lista i bryła podświetlają to samo.
- Suwak pory dnia: słońce, cień bryły, jasność elewacji i okna zmieniają się z godziną.
- Panel mieszkania: rzut generowany z danych, wykres nasłonecznienia salonu, kalkulator raty, formularz zapytania.
- Filtry, sortowanie, ulubione zapisywane w przeglądarce.

## Uruchomienie

```bash
npm install
npm run dev        # podgląd z odświeżaniem
npm test           # testy logiki (dane, słońce, filtry, kredyt)
npm run build      # typy + build do dist/
```

## Wstawienie do innej strony

Build używa ścieżek względnych (`base: './'`), więc zawartość `dist/` działa pod dowolnym adresem.
Żeby pokazać demo pod `/atrium-poludnie/` w repo strony firmowej, skopiuj zawartość `dist/`
do `public/atrium-poludnie/` tamtego repo, tak jak jest to zrobione dla `public/balance-lab/`.

## Struktura

- `src/domain/` — czysta logika bez Reacta: dane, model słońca, filtry, kredyt, formatowanie.
- `src/state/store.tsx` — wspólny stan (filtry, godzina, najechane i wybrane mieszkanie, ulubione).
- `src/components/` — widoki; każdy ma swój plik CSS.
- `src/styles/tokens.css` — kolory, typografia, promienie; `app.css` — układ i wspólne klasy.
