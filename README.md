# Příklady za čas

Aplikace pro tablet s Google Family Link. Když dítěti vyprší čas, otevře si tuhle aplikaci, vypočítá sadu příkladů a rodiči přijde do telefonu zpráva. Rodič pak ve Family Link přidá bonusový čas.

Aplikace nic neodemyká a do systému nesahá. Přidání času zůstává vždycky na rodiči (Family Link na to nemá rozhraní).

## Jak to funguje

1. Dítěti vyprší čas a Family Link tablet zamkne.
2. Tahle aplikace je ve Family Link nastavená jako **Vždy povoleno**, takže jde otevřít dál.
3. Dítě vypočítá sadu příkladů (výchozí 10 příkladů, sčítání a odčítání do 10).
4. Rodiči přijde do telefonu zpráva přes aplikaci **ntfy**, např. „Anička: příklady hotové. Splněno 10 příkladů, 1 chyba, za 3 min 12 s…“
5. Rodič ve Family Link klepne na **Bonusový čas**.

Pravidla (vše se dá změnit v nastavení):

- sada je hotová, až má dítě 10 správných odpovědí; za špatnou odpověď přijde další příklad navíc,
- úspěšnost musí být aspoň 80 % (při 10 příkladech tedy nejvýš 2 chyby), jinak sada hned končí a dítě může začít znovu,
- sada musí trvat aspoň 2 s na příklad (ochrana proti ťukání naslepo),
- uznají se nejvýš 2 sady za den,
- bez internetu se dá počítat, zpráva rodiči se pošle, jakmile bude tablet zase online.

## Instalace na tablet

Aplikace se jednou nainstaluje z webové adresy (musí být HTTPS), pak má na tabletu vlastní ikonu a běží i bez internetu.

1. Na tabletu otevřete adresu aplikace v **Chromu**.
2. Nabídka **⋮ → Nainstalovat aplikaci** (nebo „Přidat na plochu“ → „Nainstalovat“).
3. Spusťte aplikaci z plochy a zvolte **PIN rodiče** (4 číslice).
4. V nastavení vyplňte jméno dítěte a zkontrolujte typy příkladů.

### Family Link – nastavit „Vždy povoleno“

V telefonu rodiče: aplikace **Family Link → dítě → Ovládací prvky → Limity aplikací** (případně „Aplikace“) → najít **Příklady za čas** → **Vždy povoleno**.

Pak vyzkoušejte: nechte tabletu vypršet limit (nebo ho dočasně snižte) a ověřte, že aplikace jde otevřít.

**Pokud se aplikace v seznamu Family Link neobjeví** (tahle část se dá ověřit jen na skutečném tabletu): záložní řešení je nastavit **Chrome** jako Vždy povoleno a ve Family Link v nastavení Chromu zvolit „Povolit jen schválené weby“ a schválit jen adresu aplikace. Nevýhoda: dítě pak v Chromu nemůže na jiné weby ani v běžném čase.

### Zprávy do telefonu rodiče (ntfy)

1. Do telefonu nainstalujte aplikaci **ntfy** (Google Play / App Store, zdarma).
2. V aplikaci Příklady za čas otevřete nastavení (ozubené kolečko vpravo dole + PIN).
3. V ntfy klepněte na **+** a zadejte **téma** z nastavení (nebo naskenujte QR kód).
4. V nastavení klepněte na **Poslat zkušební zprávu** a zkontrolujte, že dorazila.

Téma je náhodný řetězec, který nejde uhodnout. Kdo ho zná, může zprávy číst i posílat, proto ho nikde nezveřejňujte. Tlačítkem **Nové téma** se dá kdykoli vyměnit (v ntfy ho pak přidejte znovu).

### Zapomenutý PIN

V Chromu na tabletu: Nastavení → Nastavení webů → Všechny weby → adresa aplikace → Vymazat a resetovat. Smaže se i nastavení, historie a téma pro zprávy.

## Vývoj

Čistý statický web bez závislostí a bez sestavování (HTML, CSS, JS moduly).

```
index.html             obrazovky
css/app.css            vzhled (světlý i tmavý režim)
js/app.js              ovládání obrazovek
js/generator.js        generátor příkladů
js/session.js          vyhodnocení sady, denní limit
js/notify.js           text zprávy a odeslání přes ntfy
js/storage.js          nastavení, historie, fronta zpráv, PIN (localStorage)
js/vendor/qrcode.mjs   QR kódy (qrcode-generator, MIT)
sw.js                  service worker – offline běh
manifest.webmanifest   údaje pro instalaci
tools/serve.py         vývojový server
tests/                 testy (node --test)
```

- Testy: `npm test`
- Náhled: `npm start` → http://localhost:8642 (vlastní server, protože `python -m http.server` na Windows posílá `.js` se špatným MIME typem)

**Při každé změně souborů zvyšte `VERSION` v `sw.js`** (a `VERSION` v `js/app.js`), jinak si nainstalované aplikace nové soubory nestáhnou. Tablet novou verzi načte při druhém spuštění po nasazení.
