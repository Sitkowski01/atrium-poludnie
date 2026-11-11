# Atrium Południe

Demo wyszukiwarki mieszkań dla fikcyjnej inwestycji deweloperskiej. Sam frontend, bez backendu:
dane są generowane w kodzie, formularz niczego nie wysyła.

- **Bryła budynku** to 12 renderów z Blendera (Cycles) na różne pory dnia, przenikających się
  wraz z suwakiem; niewidoczna warstwa SVG nad renderem robi z każdego z 35 mieszkań przycisk.
- **Spacer 360°**: panoramy każdego pomieszczenia, rysowane jednym shaderem WebGL, z punktami
  przejść przy drzwiach, mini-mapą i obsługą z klawiatury.
- **Panel mieszkania**: okładka z renderu wnętrza, makieta 3D i rzut z wymiarami, wykres
  nasłonecznienia salonu, kalkulator raty, formularz zapytania.
- Filtry (na telefonie zwijane), sortowanie, ulubione zapisywane w przeglądarce.

## Uruchomienie

```bash
npm install
npm run dev        # podgląd z odświeżaniem
npm test           # testy logiki (dane, słońce, filtry, kredyt, przejścia, punkty kamer)
npm run build      # typy + build do dist/
```

## Grafika z Blendera

Wszystko powstaje ze skryptów, w tle (`blender --background --python ...`), z tych samych danych co strona.

```bash
node blender/pobierz-zasoby.mjs    # tekstury, modele i HDRI z Poly Haven (CC0) do blender/assets/
node blender/eksport.mjs           # rzuty, przejścia i punkty kamer -> blender/plany.json
blender --background --python blender/budynek.py -- blender/render/budynek <godzina> 128 2
blender --background --python blender/wnetrze.py -- blender/plany.json <s0..s4n> blender/render/pano3 - 2560 96
blender --background --python blender/wnetrze.py -- blender/plany.json <id> blender/render/gora3 - 1536 96 gora
node blender/budynek-web.mjs       # rendery budynku -> public/budynek/*.webp
node blender/pano-web.mjs          # panoramy -> public/pano/<id>/<pokój>.webp
node blender/okladki.mjs           # okładki panelu i makiety 3D -> public/okladki, public/rzut3d
```

Przejścia między pomieszczeniami i miejsca kamer liczą `src/domain/walk.ts` (`links`, `viewpoint`);
test w `src/domain/viewpoint.test.ts` pilnuje, żeby `blender/plany.json` był z nimi zgodny.
Skrypt wnętrz sam usuwa meble, które stanęłyby w drzwiach albo w miejscu kamery, i wypisuje, co usunął.

## Wstawienie do innej strony

Build używa ścieżek względnych (`base: './'`), więc zawartość `dist/` działa pod dowolnym adresem,
np. skopiowana do `public/atrium-poludnie/` strony firmowej. Przy wdrożeniu trzeba wpisać pełny
adres w `og:image` w `index.html` (serwisy społecznościowe nie przyjmują adresów względnych).

## Struktura

- `src/domain/` — czysta logika bez Reacta: dane, model słońca, filtry, kredyt, przejścia, formatowanie.
- `src/state/store.tsx` — wspólny stan; pora dnia ma osobny kontekst (`useHour`), bo zmienia się co klatkę.
- `src/components/` — widoki; każdy ma swój plik CSS.
- `src/styles/tokens.css` — kolory, kroje, promienie, cienie; `app.css` — układ i wspólne klasy.
- `blender/` — skrypty renderów i przygotowania obrazów.
