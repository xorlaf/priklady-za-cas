# Zadání: „Příklady za čas“ – webová aplikace (PWA) pro dítě s Family Link

## Cíl

Dítě má na tabletu s Androidem omezený čas přes Google Family Link. Když mu čas vyprší, má si ho moct „vydělat“ výpočtem příkladů. Aplikace:

1. běží jako PWA nainstalovaná na ploše tabletu (rodič ji ve Family Link nastaví jako **Vždy povoleno**, takže funguje i po vypršení limitu),
2. dá dítěti sadu příkladů,
3. po úspěšném splnění pošle rodiči notifikaci do telefonu,
4. rodič pak ručně přidá bonusový čas ve Family Link (to se automatizovat nedá – Family Link nemá API, s tím nepočítej).

Aplikace sama nic neodemyká a do systému nesahá. Je to jen procvičování a kanál pro oznámení rodiči.

## Krok 0 – ověření proveditelnosti (udělat jako první, než se staví zbytek)

Není jisté, že se PWA objeví v seznamu aplikací ve Family Link. Proto nejdřív:

- Udělej minimální PWA (manifest, service worker, ikona, `display: standalone`) se stránkou „Test“ a nasaď ji na HTTPS.
- Napiš uživateli přesný postup: otevřít na tabletu v Chromu → nabídka ⋮ → „Nainstalovat aplikaci“ / „Přidat na plochu“ → ve Family Link na telefonu: dítě → Ovládací prvky → Limity aplikací → najít aplikaci → Vždy povoleno.
- Počkej na potvrzení od uživatele, že to funguje (aplikace se dá otevřít i na zamčeném tabletu po vypršení limitu). Teprve pak pokračuj.
- Když to nepůjde: zastav se a nabídni záložní variantu (Chrome jako Vždy povoleno + ve Family Link povolit jen schválené weby). Nic nestav naslepo.

Pozor: aby Chrome vytvořil skutečnou nainstalovanou aplikaci (WebAPK), musí PWA splňovat kritéria instalovatelnosti – platný manifest s ikonami 192 a 512 px, `start_url`, `scope`, service worker s `fetch` handlerem, HTTPS.

## Funkce pro dítě

- Úvodní obrazovka: velké tlačítko „Chci čas navíc – počítat příklady“.
- Sada N příkladů (výchozí 10), náhodně generovaných podle nastavení.
- Vlastní velká číselná klávesnice na obrazovce (ne systémová klávesnice), tlačítka vhodná pro dětské prsty, ovládání na výšku i na šířku.
- Po odpovědi hned zpětná vazba (správně / špatně). Při chybě se příklad započítá jako chybný a do sady přibude nový příklad navíc – sada je splněná, až je N správně.
- Pravidlo proti „ťukání naslepo“: minimální úspěšnost (výchozí 80 % napoprvé) a minimální čas na sadu (výchozí např. 3 s na příklad). Když neprojde, sada se neuzná a dítě začne znovu.
- Po splnění: obrazovka „Hotovo! Rodič dostal zprávu.“ a stav odeslání notifikace (odesláno / chyba – zkus znovu).
- Denní strop počtu uznaných sad (výchozí 2) – po jeho dosažení aplikace napíše, že dnes už to nejde.
- Celé UI česky, jednoduché, veselé, ale bez rušivých animací.

## Typy příkladů (konfigurovatelné)

Rodič v nastavení zaškrtne, co se má generovat, a nastaví rozsah:

- sčítání a odčítání (do 10 / 20 / 100 / 1000, s přechodem přes desítku ano/ne),
- násobilka (výběr řad, např. 2–10) a dělení beze zbytku,
- příklady se závorkami / více operacemi (volitelně),
- doplňování neznámé (např. `7 + _ = 15`) (volitelně).

Výsledky nikdy záporné, dělení vždy beze zbytku. Generátor udělej jako samostatný modul s testy.

## Nastavení pro rodiče

- Přístup za PIN (4 číslice, nastaví se při prvním spuštění; uloženo lokálně v zařízení jako hash).
- Nastavení: typy a rozsahy příkladů, počet příkladů v sadě, minimální úspěšnost, minimální čas, denní strop, jméno dítěte (pro text notifikace), notifikační kanál.
- Tlačítko „Poslat zkušební notifikaci“.
- Historie posledních sad (datum, čas řešení, počet chyb, uznáno ano/ne) – lokálně v zařízení.

## Notifikace rodiči

Výchozí řešení: **ntfy.sh** (zdarma, bez vlastního backendu, rodič si nainstaluje aplikaci ntfy do telefonu a odebírá téma).

- Aplikace pošle `POST https://ntfy.sh/<téma>` s textem např.: „Anička splnila 10 příkladů (9/10 napoprvé, 4 min 12 s). Můžeš přidat bonusový čas.“ Titulek, priorita a tag dle možností ntfy.
- Téma se generuje náhodně (dlouhý náhodný řetězec) při nastavení, ať ho nejde uhodnout. Do textu zprávy nedávej žádné další osobní údaje.
- Udělej to jako vyměnitelný „odesílač“, aby šlo později přidat jiný kanál (e-mail přes vlastní server apod.).
- Když zařízení není online, notifikaci zařaď do fronty a odešli, jakmile se spojení obnoví; dítěti ukaž stav.
- Do návodu pro uživatele napiš, jak si nainstalovat ntfy na telefon a přihlásit se k tématu (ideálně QR kód s tématem v nastavení aplikace).

## Technické požadavky

- Čistě statický web (HTML/CSS/JS, klidně Vite + vanilla JS/TS nebo malý framework – volba na tobě, preferuj jednoduchost a malou velikost), žádný backend.
- Funguje offline (service worker cachuje vše potřebné); bez sítě jde počítat, jen notifikace čeká ve frontě.
- Stav a nastavení v `localStorage`/IndexedDB.
- Hosting na HTTPS. Zeptej se uživatele, kam nasadit (má vlastní server s Dockerem; jinak připadá v úvahu např. GitHub Pages nebo Cloudflare Pages). Nasazení ani push nedělej bez jeho souhlasu.
- Testy pro generátor příkladů a pro vyhodnocení sady (úspěšnost, minimální čas, denní strop).
- Ověř v prohlížeči v náhledu velikosti tabletu (na výšku i na šířku) a zkontroluj, že PWA splňuje kritéria instalovatelnosti.

## Výstup

- Funkční aplikace v repozitáři, README s postupem: nasazení, instalace na tablet, nastavení „Vždy povoleno“ ve Family Link, nastavení ntfy na telefonu rodiče.
- Krátké shrnutí, co je hotové a co zbývá ověřit přímo na tabletu.

## Doplní uživatel (zeptej se, pokud to není uvedené)

- Ročník dítěte / jaké typy příkladů mají být výchozí: ______
- Jméno dítěte do notifikace (nebo jen „Dítě“): ______
- Kde aplikaci hostovat: ______
