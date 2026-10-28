# Minecraft Vote Server

Mały serwer głosowania Minecraft **Java Edition 1.21.4**, napisany w Node.js. Nie wymaga modów u graczy ani serwera Java.

## Funkcje
- Jedno pomieszczenie **10 x 10** bloków, umieszczone w jednym chunku 16 x 16. Poza nim brak generowania terenu.
- Dwa pulpity Lectern: głosowanie i podpisanie apelu MKA. Kliknij PPM, aby zobaczyć instrukcje na czacie.
- Głosowanie: `/vote yes` albo `/vote no`, jeden głos na uwierzytelnione UUID i identyfikator głosowania.
- Apel: `/appeal sign`, jeden podpis na UUID. Imię i nazwisko = UUID, miasto = `MINECRAFT`, bez emaila.
- Tryb Adventure, brak uprawnień operatora dla graczy, `online-mode=true` (weryfikacja kont Microsoft).
- Trwały zapis do JSON (atomowa zamiana pliku), brak mapy na dysku.
- Panel WWW i publiczne API **tylko do odczytu**: `GET /api/results`, `GET /api/health`.
- Opcjonalna synchronizacja podpisów przez bezpieczny webhook HTTPS z retry i kluczem idempotencji.
- Testy automatyczne i GitHub Actions.

## Instalacja
Wymaga **Node.js 22 lub nowszego**.

```bash
git clone https://github.com/peterwolf-pl/minecraft_vote_serwer.git
cd minecraft_vote_serwer
npm install
npm test
npm start
```

Adres Minecraft (domyślnie): `<IP serwera>:25565`. W launcherze wybierz **Minecraft Java 1.21.4**. Gracze **nie instalują modów**.

Panel wyników jest domyślnie dostępny lokalnie na porcie `3000`. Aby wystawić go publicznie, ustaw `HTTP_HOST=0.0.0.0` i skonfiguruj proxy HTTPS. Do integracji ze stroną WWW wystarczy JSON z `/api/results`.

## Konfiguracja
```bash
cp .env.example .env
node --env-file=.env src/main.js
```
Pola: `MC_HOST`, `MC_PORT`, `HTTP_HOST`, `HTTP_PORT`, `DATA_FILE`, `APPEAL_SYNC_URL`, `APPEAL_SYNC_TOKEN`.

Pytanie i opcje edytuj w `config/ballot.json`; restart serwera wczytuje zmiany. **Uwaga:** zmień `ballot.id` przy nowym, osobnym głosowaniu. Zachowaj kopię katalogu `data/`.

## Jak głosować w grze
1. Gracz wchodzi na serwer Java 1.21.4 przy użyciu konta Microsoft.
2. PPM w **lewy Lectern** pokazuje pytanie i instrukcje na czacie.
3. Gracz wpisuje `/vote yes` lub `/vote no`.
4. PPM w **prawy Lectern** pokazuje zgodę na publiczne UUID i informację o apelu.
5. Gracz wpisuje `/appeal sign` i zapisuje lokalny podpis.
6. `/results` pokazuje aktualne głosy i liczbę podpisów.

## Integracja mkal.pl
Strona `mkal.pl/apel` używa formularza z weryfikacją e-mail. **Nie jest potwierdzony publiczny endpoint przyjmujący podpisy Minecraft bez e-maila.** Ten projekt celowo nie omija formularza ani weryfikacji. Bez `APPEAL_SYNC_URL` podpisy są **wyłącznie lokalne**, niewidoczne na mkal.pl.

Aby je publikować, należy dodać **zaufany serwerowy endpoint** na mkal.pl i skonfigurować `APPEAL_SYNC_URL` oraz `APPEAL_SYNC_TOKEN`. Serwer wysyła JSON:
```json
{
  "source": "minecraft",
  "signature_id": "01234567-89ab-cdef-0123-456789abcdef",
  "uuid": "01234567-89ab-cdef-0123-456789abcdef",
  "name": "01234567-89ab-cdef-0123-456789abcdef",
  "city": "MINECRAFT",
  "consent_publication": true,
  "consent_processing": true,
  "signed_at": "2026-10-28T05:00:00.000Z"
}
```
Pole `email` nie jest wysyłane. Nagłówek `Authorization: Bearer <token>` jest opcjonalny; nagłówek `Idempotency-Key` pomaga uniknąć duplikatów po ponowieniu. **Tylko odpowiedź HTTP 2xx** oznacza zsynchronizowanie. Endpoint powinien atomowo weryfikować token, UUID, zgodę i idempotencję.

## Ograniczenia
- **1.21.4**, ponieważ Flying Squid 1.12.0 nie deklaruje wsparcia dla 1.21.6 ani 26.x. Natywne Dialogs API istnieje dopiero od **1.21.6**, dlatego tu interfejsem jest chat z komendami.
- Lectern w świecie jest blokiem bez umieszczonej książki. PPM działa przez zdarzenie interakcji serwera, **nie** otwiera natywnego GUI książki.
- Jeden głos na UUID ogranicza powtórzenia tego samego konta, ale nie zapobiega użyciu wielu kont.
- Nie przeprowadzono ręcznego testu z rzeczywistym klientem Minecraft w tym środowisku. Testy repozytorium obejmują zapis, HTTP i geometrię pokoju.

## Uruchomienie produkcyjne
Udostępnij TCP 25565 dla Minecrafta. Nie wyłączaj `online-mode`. Dla WWW użyj reverse proxy HTTPS i limitów żądań; publiczny jest tylko odczyt wyników. Zapis `data/votes.json` jest lokalny, dlatego uruchamiaj jedną instancję i rób backup danych.

## Licencja
MIT (kod projektu). Zewnętrzne biblioteki zachowują własne licencje.
