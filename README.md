# Minecraft Vote Server

**Jeden serwer Minecraft Java dla graczy Vanilla, Fabric, Forge i NeoForge**, z wersjami **26.3, 26.2, 1.21.11, 1.21.1, 1.20.1**. Użytkownicy nie instalują dodatkowego moda do głosowania.

Architektura:
- **Paper 26.3 / Java 25**: serwer gry i plugin `MKAVote`.
- **ViaVersion + ViaBackwards 5.12.2+**: tłumaczenie protokołów starszych klientów na Paper 26.3.
- **Node.js 22+**: uwierzytelnione API zapisu głosów, baza JSON, synchronizacja apelu, panel WWW.
- **Minecraft inventory GUI** (zamiast Dialogs API): współdzielony interfejs dla starych i nowych klientów.
- Jeden pokój 10 x 10 w pustym świecie. Dwa Lectern, brak generowania terenu, Adventure Mode.

## Szybki start z Docker Compose

Wymagane: Docker + Docker Compose, połączenie z internetem podczas pierwszej instalacji i dostęp do portu TCP 25565.

```bash
git clone https://github.com/peterwolf-pl/minecraft_vote_serwer.git
cd minecraft_vote_serwer
cp .env.example .env
# Ustaw MC_BRIDGE_TOKEN na wygenerowany sekret (minimum 32 znaki):
openssl rand -hex 32
# Wklej wynik do .env jako MC_BRIDGE_TOKEN=...
docker compose up -d --build
docker compose logs -f
```

**Nie wklejaj sekretu do GitHuba.** `.env` jest ignorowany przez Git.

Minecraft: `ADRES_IP:25565`.
Panel WWW: `127.0.0.1:3000` na serwerze hosta.
Wyniki JSON: `GET /api/results`, stan: `GET /api/health`.

Compose:
1. Buduje plugin `MKAVote.jar` z Gradle 9.2.1 i Java 25.
2. Uruchamia usługę Node.js API.
3. Tworzy serwer Paper 26.3 z `online-mode=true`.
4. Instaluje ViaVersion i ViaBackwards przez oficjalne paczki Modrinth (najnowsze kompatybilne wydania).
5. Wszystkie usługi komunikują się przez prywatną sieć Docker. Na zewnątrz otwarty jest Minecraft (TCP 25565). Panel WWW związany jest lokalnie z 127.0.0.1.

Wolumeny `minecraft-data`, `vote-data`, `plugins` zachowują dane między restartami.

> Uruchomienie kontenera z `EULA=TRUE` oznacza akceptację licencji Minecraft. Przed uruchomieniem zapoznaj się z EULA.

## Głosowanie w grze

Po wejściu gracz pojawia się w sali głosowania:
- Lewy Lectern: **głosowanie**. Kliknięcie PPM otwiera menu, wybierz zieloną lub czerwoną wełnę.
- Prawy Lectern: **podpisanie apelu**. Menu pokazuje informację o publicznym UUID i przycisk świadomej zgody.
- Alternatywa: `/vote yes`, `/vote no`, `/appeal sign`, `/results`.

Wszystkie wersje korzystają z tego samego menu ekwipunku Minecraft, nie z nowszego Dialogs API.

Każdy gracz musi mieć autentyczne konto Minecraft. UUID pobiera Paper z uwierzytelnionej sesji w `online-mode=true`; nie jest przyjmowane z wiadomości tekstowej gracza. API sprawdza sekret mostka i odrzuca niezaufane zgłoszenia. Jeden głos na UUID i `ballot.id`. Podpis apelu można złożyć raz na UUID.

## Obsługiwane klienty

| Klient | Zakres wersji | Warunki |
| --- | --- | --- |
| Vanilla | 26.3, 26.2, 1.21.11, 1.21.1, 1.20.1 | Bez modów |
| Fabric | Jak wyżej | Bez modów wymaganych przez serwer |
| Forge | Jak wyżej, jeśli loader istnieje dla wersji | Niektóre modpacki mają wymagany handshake serwera |
| NeoForge | Jak wyżej, jeśli loader istnieje dla wersji | Niektóre modpacki mają wymagany handshake serwera |

**ViaBackwards nie oznacza automatycznej zgodności każdego modpacka.** Testuj wybraną konfigurację modów klienta. Potrzebna jest też wersja Via obsługująca Paper 26.3, np. wydanie 5.12.2 z 27 października 2026.

## API Node.js

Głosy:
```http
POST /internal/vote
Authorization: Bearer <MC_BRIDGE_TOKEN>
Content-Type: application/json

{"uuid":"01234567-89ab-cdef-0123-456789abcdef","choice":"yes"}
```

Podpis:
```http
POST /internal/appeal
Authorization: Bearer <MC_BRIDGE_TOKEN>
Content-Type: application/json

{"uuid":"01234567-89ab-cdef-0123-456789abcdef","consent":true}
```

Odpowiedź:
```json
{"ok":true,"created":true,"choice":"yes"}
```

Przy powtórnym oddaniu głosu `created=false` i pierwotny wybór pozostaje zapisany. API **nie wystawia publicznego endpointu zapisu bez autoryzacji**. Sekret musi być trzymany tylko na serwerach Node i Paper.

Uwaga bezpieczeństwa: HTTP bridge uznaje tożsamość UUID po stronie zaufanego Paper. Sam token API ma prawo zapisywać podpisy i głosy: nie udostępniaj go graczom, modom klienta ani stronom WWW. Przy instalacji rozdzielonej na wiele hostów użyj HTTPS lub VPN, nie przesyłaj tokenu otwartą siecią.

## Konfiguracja

- `config/ballot.json`: tekst pytania i `ballot.id`.
- `MC_BRIDGE_TOKEN`: wspólny sekret usług Paper i Node.
- `MC_BRIDGE_URL`: adres API widziany z Paper, w Compose domyślnie `http://vote-api:3000`.
- `APPEAL_SYNC_URL` i `APPEAL_SYNC_TOKEN`: opcjonalna synchronizacja podpisów do strony MKA.
- `DATA_FILE`: lokalny zapis głosów JSON; zachowuj backup.
- `HTTP_HOST`, `HTTP_PORT`: nasłuchiwanie HTTP.

**Interfejs menu Paper ma obecnie stały tekst pytania.** Edycja `config/ballot.json` zmienia treść i identyfikator po stronie API, ale nie aktualizuje automatycznie tekstu w GUI wtyczki. Dla nowego pytania zmień też etykiety w `MkaVotePlugin.java` i przebuduj plugin.

## Podpisy apelu MKA

- Imię i nazwisko: UUID konta Minecraft.
- Miasto: `MINECRAFT`.
- Email: nie jest wysyłany.
- Zapis lokalny działa od razu.
- Publikacja na `mkal.pl/apel` **wymaga osobnego autoryzowanego endpointu serwerowego**; obecny formularz WWW nie jest używany ani obchodzony.

Jeśli brak `APPEAL_SYNC_URL`, podpis otrzymuje stan `pending`. Gdy zaufany endpoint odpowie 2xx, podpis staje się `synced`. Wysłanie jest idempotentne po UUID. Nie pokazuj podpisów na stronie jako opublikowanych, dopóki endpoint nie potwierdzi zapisu.

## Praca bez Docker

Uruchom API Node z wygenerowanym `MC_BRIDGE_TOKEN`:

```bash
cp .env.example .env
node --env-file=.env src/main.js
npm test
```

Wymagana osobna instalacja Paper 26.3 z Java 25, pluginami ViaVersion i ViaBackwards oraz skompilowanym `MKAVote.jar`. Wtyczkę zbudujesz w katalogu głównym za pomocą:

```bash
gradle -p paper-plugin clean build
```

Plik wynikowy: `paper-plugin/build/libs/mka-vote-1.0.0.jar`. Umieść go w katalogu `plugins/` serwera Paper i ustaw `MC_BRIDGE_URL` oraz `MC_BRIDGE_TOKEN` w środowisku procesu Java.

## Testy i ograniczenia

- `npm test`: kontrola unikalności głosów, podpisów, autoryzacji HTTP i odczytu wyników.
- `npm run check`: kontrola składni JS.
- `gradle -p paper-plugin build`: kompilacja Java 25 z Paper API 26.3.
- GitHub Actions uruchamia testy Node 22/24 oraz kompilację Paper pluginu.
- **Niezweryfikowane ręcznie:** faktyczne połączenia pięciu klientów oraz ich wariantów z Fabric, Forge i NeoForge. Rzeczywista zgodność modpacków wymaga testów w grze.
- Ten serwer służy głosowaniu kont Minecraft, nie wyborom powszechnym. Jedna osoba może mieć wiele kont.
