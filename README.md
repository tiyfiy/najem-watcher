# najem-watcher

Opozorilnik za nove najemniške oglase v Ljubljani. Vsakih ~90 sekund pregleda
nepremicnine.net, bolha.com, mkvadrat.si (in poljubne RSS vire), primerja z že
videnimi oglasi in ti ob novem zadetku takoj pošlje sporočilo na Telegram —
skupaj z že pripravljenim besedilom povpraševanja, ki ga samo kopiraš in
prilepiš.

TypeScript, Node 20+, brez baze. nepremicnine.net in bolha.com odgovorita samo
pravemu brskalniku (403 oz. captcha), zato en headless Chromium teče v ozadju:
računaj na ~400 MB RAM. Hetzner CX22 (2 vCPU / 4 GB) je dovolj.

---

## 1. Hitri zagon lokalno

```bash
npm install
npx playwright install chromium   # brskalnik za nepremicnine.net in bolha.com
cp .env.example .env              # in izpolni Telegram token
npm run test-notify               # preveri, da obvestila pridejo na telefon
npm run once                      # en cikel, brez zanke
npm run dev                       # neprekinjeno
```

Prvi zagon **namenoma ne pošlje oglasov**: zabeleži vse obstoječe kot "videne",
da te ne zasuje, in pošlje samo eno potrditveno sporočilo. Od drugega cikla
naprej dobiš samo novosti.

## 2. Telegram na telefon (3 minute)

1. V Telegramu odpri **@BotFather** → `/newbot` → dobiš `TELEGRAM_BOT_TOKEN`.
2. Svojemu novemu botu napiši `/start` (drugače ti ne sme pisati).
3. Odpri `https://api.telegram.org/bot<TOKEN>/getUpdates` in prepiši
   `"chat":{"id": ...}` v `TELEGRAM_CHAT_ID`.
4. `npm run test-notify` → na telefonu mora priti testni oglas. Če ne pride,
   ukaz izpiše natančno napako Telegrama (401 = napačen token, 400
   `chat not found` = napačen chat id ali botu še nisi pisal).
5. Na telefonu za ta pogovor vklopi zvok in ga pripni na vrh.

E-pošta je rezerva in se sproži samo, kadar Telegram ni nastavljen ali je
pošiljanje padlo: izpolni `SMTP_*` in `EMAIL_TO`. Za Gmail rabiš
[App password](https://myaccount.google.com/apppasswords), navadno geslo ne dela.

## 3. Nastavljanje virov

V `.env` prilepi **URL-je iskanj, ne domov**. Odpri portal, nastavi filtre
(Ljubljana, oddaja, cena, soba/stanovanje), kopiraj URL iz naslovne vrstice.
Privzeto so nastavljeni preverjeni URL-ji:

```
NEPREMICNINE_URLS=https://www.nepremicnine.net/oglasi-oddaja/ljubljana-mesto/stanovanje/cena-do-500-eur-na-mesec/?s=16,https://www.nepremicnine.net/oglasi-oddaja/ljubljana-mesto/posamezna-soba/?s=16
BOLHA_URLS=https://www.bolha.com/oddaja-stanovanja/ljubljana
MKVADRAT_URLS=https://www.mkvadrat.si/seznam-prostih-sob
```

Dve pasti:

- `?s=16` na nepremicnine.net pomeni **novejši oglasi naprej**. Prebere se samo
  prva stran (25 oglasov), zato brez tega novi oglasi sploh ne pridejo do tebe.
- Pot `/soba/` na nepremicnine.net je 404 — pravilna je `/posamezna-soba/`.

**Preveri, da parser dejansko kaj najde:**

```bash
npm run dump -- "https://www.nepremicnine.net/oglasi-oddaja/ljubljana-mesto/posamezna-soba/?s=16"
npm run dump -- "https://www.bolha.com/oddaja-stanovanja/ljubljana" --browser
```

Izpiše, koliko oglasov je razbral s ceno in kvadraturo, in shrani `dump.html`.
Če je rezultat 0, so spremenili postavitev strani — odpri `dump.html`, poglej,
kako izgledajo povezave do oglasov, in popravi ustrezno datoteko v
`src/sources/`. Parserji ne visijo na imenih CSS razredov: lovijo povezave do
strani oglasa (`…_7429917/`, `…-oglas-15528280`, `/seznam-prostih-sob/411`) in
ceno preberejo iz najmanjšega bloka okoli povezave.

## 4. Filtri

```
MAX_PRICE=500        # najemnina + stroški skupaj
MIN_PRICE=150        # nižje = skoraj zagotovo vaba
REQUIRE_ANY=ljubljana
EXCLUDE=dvoposteljna,turisti,poslovni prostor,prodam,...
BOOST=enoposteljna,dolgoročno,takoj vseljivo,bežigrad,...
```

`EXCLUDE` je trd rez, `BOOST` samo dvigne prioriteto v vrsti obvestil.
Oglasi brez razvidne cene se **pošljejo** (veliko dobrih cene ne navaja), samo
z nižjo prioriteto.

## 5. Deploy na Hetzner

> **Pozor — nepremicnine.net s podatkovnega centra ne dela.** Cloudflare vrne
> 403 vsem IP-jem Hetznerja (preverjeno: tudi pravi Chromium in Cloudflare WARP
> dobita `Attention Required` oz. neskončni `Trenutek...`). Z domačega
> (rezidenčnega) IP-ja isti program deluje. Na VPS zato zanesljivo delujeta
> samo bolha.com in mkvadrat.si; za nepremicnine.net glej razdelek 9.

Na Ubuntu 24.04 ali 26.04 (26.04 ima Node 22 že v svojih paketih):

```bash
sudo apt update && sudo apt install -y nodejs npm git
node -v    # >= 20

# koda: kloniraj PRED ustvarjanjem uporabnika (adduser --system ustvari domači
# imenik, git clone pa zavrne nepraznega)
sudo git clone git@github.com:<ti>/najem-watcher.git /opt/najem-watcher
sudo adduser --system --group --home /opt/najem-watcher najem
sudo chown -R najem:najem /opt/najem-watcher
cd /opt/najem-watcher
sudo -u najem npm ci
sudo -u najem npm run build
sudo -u najem mkdir -p data

# Chromium + sistemske knjižnice zanj
sudo PLAYWRIGHT_BROWSERS_PATH=/opt/najem-watcher/.cache/ms-playwright \
  npx playwright install --with-deps chromium
sudo chown -R najem:najem /opt/najem-watcher/.cache

# nastavitve
sudo -u najem cp .env.example .env && sudo -u najem nano .env
sudo chmod 600 .env

# test na telefon (program sam prebere .env iz delovnega imenika)
sudo -u najem env PLAYWRIGHT_BROWSERS_PATH=/opt/najem-watcher/.cache/ms-playwright \
  node dist/tools/test-notify.js

# servis
sudo cp deploy/najem-watcher.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now najem-watcher
journalctl -u najem-watcher -f
```

Ne poskušaj spremenljivk podajati z `env $(grep -v '^#' .env | xargs)` —
`EXCLUDE` in `BOOST` vsebujeta presledke in ukaz razpade. Program `.env`
prebere sam (dotenv), systemd pa prek `EnvironmentFile=`.

Servis se sam ponovno zažene ob padcu in ob ponovnem zagonu strežnika.
`data/seen.json` preživi restart, tako da po ponovnem zagonu ne dobiš
podvojenih obvestil. Če hočeš namerno začeti znova, ustavi servis in zbriši
`data/seen.json`.

Posodobitev kode (git teče kot `root`, ker deploy ključ leži v `/root/.ssh`;
`najem` ga ne more brati):

```bash
cd /opt/najem-watcher \
  && sudo git pull \
  && sudo chown -R najem:najem /opt/najem-watcher \
  && sudo -u najem npm ci \
  && sudo -u najem npm run build \
  && sudo systemctl restart najem-watcher
```

## 6. Facebook (neobvezno, na lastno odgovornost)

Avtomatsko branje FB skupin **krši Facebookove pogoje uporabe** in računi, ki to
počnejo, redno dobijo omejitev ali blokado. Adapter je priložen
(`src/sources/facebook.ts`), ampak:

- uporabi **burner račun**, ne svojega glavnega,
- `POLL_SECONDS` naj bo pri vklopljenem FB vsaj 300,
- blokado pričakuj kot normalen izid, ne kot napako.

```bash
npm run fb:login          # enkratna prijava, seja se shrani
# v .env: FACEBOOK_ENABLED=true, FACEBOOK_GROUPS=https://www.facebook.com/groups/xxxx
```

Zanesljivejša pot za FB: v aplikaciji odpri skupino → **Following → All posts**
in vklopi obvestila. Push dobiš takoj in brez tveganja.

## 7. Higiena scrapanja

- `POLL_SECONDS=90` je dovolj hitro; nižje ti ne prinese prednosti, poveča pa
  možnost, da te portal blokira.
- Med posameznimi iskalnimi URL-ji je 1,5–2,5 s premora, zahteve imajo naključen
  zamik (`JITTER_SECONDS`), da vzorec ni robotski.
- Če dobiš HTTP 403 ali captcha stran, si prehiter: dvigni interval, ne menjaj
  User-Agenta v krogu.
- Pobiraj samo javno dostopne sezname in ne preprodajaj podatkov naprej.

## 8. Struktura

```
src/
  index.ts          zanka: viri -> dedup -> filter -> obvestila
  config.ts         branje .env
  store.ts          JSON zapis videnih oglasov (brez baze), atomarni zapis
  filter.ts         cena, prepovedane in bonus besede, točkovanje
  sources/          nepremicnine, bolha, mkvadrat, rss, facebook
  notify/           telegram (primarno), email (rezerva)
  util/             http+parsanje cen, headless brskalnik, iskanje kartice, log
  tools/            dump, test-notify, fb-login
deploy/             systemd unit
inquiry.txt         besedilo, ki ga dobiš zraven vsakega obvestila
data/seen.json      spomin na že videne oglase
```

Nov vir dodaš tako, da napišeš datoteko v `src/sources/`, ki vrne
`Listing[]`, in jo registriraš v `src/sources/index.ts`. Vse ostalo
(dedup, filtriranje, obveščanje) dobiš zastonj.

## 9. nepremicnine.net s strežnika (Cloudflare blok)

Preverjeno stanje, september 2026:

| od kod | nepremicnine.net | bolha.com | mkvadrat.si |
| --- | --- | --- | --- |
| domači/rezidenčni IP | deluje (25 oglasov/stran) | deluje | deluje |
| Hetzner CX22 (DE) | **403 Cloudflare** | deluje (10) | deluje (23) |
| Hetzner + Cloudflare WARP | **neskončni "Trenutek..."** | — | — |

Blokada visi na ugledu IP-ja, ne na brskalniku: isti headless Chromium z
domačega omrežja stran normalno prebere. Menjava User-Agenta, polni Chromium
namesto headless-shella in WARP proxy ne pomagajo.

Možnosti, od najcenejše navzgor:

1. **Teči doma** (prenosnik, Raspberry Pi, NAS) — vsi trije viri delujejo,
    zastonj, naprava mora biti prižgana.
2. **Rezidenčni/mobilni proxy samo za nepremicnine.net** — nekaj €/mesec.
3. **Samo bolha.com + mkvadrat.si na VPS**, nepremicnine.net pa prek njihovih
    lastnih shranjenih iskanj (brezplačen račun → obveščanje o novih oglasih).
