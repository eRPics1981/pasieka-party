# Pasieka Party — instrukcja dla agentów

## Kontekst
Gra imprezowa HTML5 Canvas + MediaPipe Hands. Sterowanie gestami (pinch=klik).
Repo: https://github.com/eRPics1981/pasieka-party
Pliki: `game/js/main.js` (~2830 linii), `game/js/hand-tracking.js`, `game/js/rounds.js`, `game/js/graphics.js`

## ZASADY
- Edytuj TYLKO pliki w `C:\Users\erpic\.herdr\packages\standalone\releases\0.9.1-x86_64-pc-windows-msvc\game\js\`
- Po każdej zmianie: `node --check js/main.js` i `node --check js/hand-tracking.js`
- NIE twórz nowych plików
- NIE dodawaj bibliotek zewnętrznych
- Po naprawie: `cd game && git add -A && git commit -m "fix: opis" && git push origin master`

## ZNANE BUGI DO NAPRAWIENIA

### 1. Profil gracza — wciąż może się wieszać
- **Plik:** `js/main.js`, funkcje `confirmProfile()` (linia ~870), `update()` (linia ~1930)
- **Problem:** Po zrobieniu zdjęcia pasek odlicza 2.2s ale czasem nie przechodzi dalej
- **Fix:** W `confirmProfile()` jest już try-catch na `PlayerProfiles.saveProfile()`. Jeśli nadal wisi — sprawdź w konsoli przeglądarki (F12) co rzuca błąd. Upewnij się że `game.screen` zmienia się na `'gameSelect'` po `confirmProfile()`.
- **Test:** Otwórz http://localhost:8080, kliknij Start, zrób zdjęcie — po 2.2s lub po kliknięciu powinno przejść do wyboru rundy.

### 2. Brak ekranu kalibracji kamery na start
- **Plik:** `js/main.js`, funkcja `startGameLoopWhenTrackerIsReady()` (linia ~2818)
- **Problem:** Gra sprawdza `calibrationWasDone()` — jeśli zwraca true, przeskakuje kalibrację. Na nowym urządzeniu powinien pojawić się ekran kalibracji.
- **Szukaj:** `beginCalibration`, `drawCalibration`, `calibrationWasDone`
- **Fix:** Upewnij się że `calibrationWasDone()` zwraca false gdy brak zapisanej kalibracji w localStorage.

### 3. Dwie ręce — kursor skacze
- **Plik:** `js/hand-tracking.js`, funkcja `processResults()` (linia ~209)
- **Problem:** Już naprawione częściowo — preferuje rękę bliżej pincha. Ale kursor może nadal skakać.
- **Fix:** Dodaj zmienną `let lastActiveHandIndex = 0` i trzymaj tę samą rękę dopóki jest widoczna. Zmieniaj tylko gdy aktywna ręka zniknie.

### 4. Frogger — niesprawdzony
- **Plik:** `js/main.js`, funkcje `updateFrogger()` (~1674), `drawFrogger()` (~2443)
- **Problem:** Wymaga DWÓCH rąk (handsUp, handsDown, waving). Sprawdź czy gesty działają.
- **Gesty:** Obie ręce w górę = skok, obie w dół = kucnięcie, machanie = latanie

### 5. Ekran końcowy — brak konfetti
- **Plik:** `js/main.js`, funkcja `drawPartyReport()` (~2616)
- **Fix:** Dodaj tablicę `confettiParticles` w globalnym scope gry. Przy wejściu w `'partyReport'` zainicjalizuj 80 cząstek: `{x: random*W, y: -random*100, vx: (random-0.5)*2, vy: 1+random*3, color: randomColor, size: 4+random*6}`. W `drawPartyReport` update i rysuj je jako `fillRect`.

## ARCHITEKTURA (skrót)
- `game` — główny obiekt stanu (`game.screen`, `game.round`, `game.players`, etc.)
- `update(delta)` — logika gry, obsługa gestów/kliknięć
- `draw()` → `drawScene()` — renderowanie na Canvas
- `frame()` — główna pętla (requestAnimationFrame), try-catch chroni przed crashem
- Ekrany: `menu` → `profile` → `gameSelect` → `roundIntro` → `playing` → `roundResult` → `partyReport`
- `HandTracker` singleton z `hand-tracking.js` — `.cursor`, `.circleMotion`, `.handsUp`, `.waving`
- `Rounds` z `rounds.js` — definicje rund, `roundsFor(apiaryId)`, `get(index, apiaryId)`
- `GFX` z `graphics.js` — canvas helper (`.drawTitle`, `.drawBigButton`, `.drawMeadowBg`)

## URUCHOMIENIE
```powershell
cd C:\Users\erpic\.herdr\packages\standalone\releases\0.9.1-x86_64-pc-windows-msvc\game
python -m http.server 8080
# Otwórz http://localhost:8080
```
