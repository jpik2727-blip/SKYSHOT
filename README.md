# Skyshot Polska — strona internetowa

Strona jest zbudowana tak, żebyś mógł samodzielnie zmieniać teksty, ceny i zdjęcia
przez panel w przeglądarce, bez dotykania kodu.

## Jak to działa

```
src/content/*.json   ← treść strony (to edytuje panel)
src/styles.css       ← wygląd
media/               ← zdjęcia i logo
build.mjs            ← składa z tego gotową stronę
dist/                ← wynik, to trafia do internetu (tworzy się sam)
```

Zmieniasz coś w panelu → zmiana zapisuje się w repozytorium → Netlify automatycznie
przebudowuje stronę → po około minucie widać ją na żywo.

## Uruchomienie — pięć kroków

### 1. Konto GitHub

Załóż darmowe konto na [github.com](https://github.com). To magazyn na pliki strony
i historia wszystkich zmian — jeśli coś popsujesz, można cofnąć.

### 2. Repozytorium

Na GitHubie kliknij **New repository**, nazwij je `skyshot-polska`, ustaw jako
**Private**. Następnie **uploading an existing file** i przeciągnij tam całą
zawartość tego folderu.

### 3. Netlify — hosting

Załóż konto na [netlify.com](https://netlify.com) (logowanie przez GitHub jest
najprostsze). Wybierz **Add new site → Import an existing project → GitHub**
i wskaż repozytorium `skyshot-polska`.

Netlify sam odczyta ustawienia z pliku `netlify.toml` — nic nie wpisujesz ręcznie.
Po chwili strona działa pod darmowym adresem typu `skyshot-polska.netlify.app`.

### 4. Panel do edycji

Wejdź na [app.pagescms.org](https://app.pagescms.org), zaloguj się przez GitHub
i wskaż repozytorium `skyshot-polska`. Panel odczyta plik `.pages.yml` i pokaże
formularze: Nagłówek strony, Usługi, Realizacje, Proces, Cennik, Kontakt,
Ustawienia strony.

Od tego momentu edytujesz stronę jak formularz — wpisujesz nowe ceny, wgrywasz
zdjęcia, klikasz zapisz.

### 5. Domena

Kup domenę `skyshotpolska.pl` (OVH, home.pl, nazwa.pl — orientacyjnie 50–100 zł
rocznie). W Netlify: **Domain settings → Add a domain**, a u sprzedawcy domeny
ustaw serwery nazw wskazane przez Netlify. Certyfikat HTTPS Netlify wystawia sam.

Po podpięciu domeny zmień pole **Adres strony** w sekcji *Ustawienia strony*
na `https://skyshotpolska.pl` — od tego zależą podglądy linków w social mediach
i mapa strony dla Google.

## Co warto uzupełnić

- adres e-mail (teraz `kontakt@skyshotpolska.pl` — zastępczy)
- prawdziwy link do Instagrama
- zdjęcie z Białegostoku lub Podlasia w nagłówku, zamiast Warszawy

## Podgląd na własnym komputerze (opcjonalnie)

Wymaga zainstalowanego [Node.js](https://nodejs.org):

```bash
node build.mjs      # zbuduj stronę
npm start           # podgląd na http://localhost:4321
```

## Formularz kontaktowy

Formularz otwiera program pocztowy odbiorcy z gotową treścią wiadomości — działa
bez żadnego serwera. Jeśli wolisz, żeby zapytania wpadały prosto na skrzynkę,
Netlify ma wbudowaną obsługę formularzy (wystarczy dopisać jeden atrybut) —
poproś o zmianę, kiedy strona będzie już postawiona.
