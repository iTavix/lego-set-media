# Set Media

App HTML in un file solo: inserisci il codice di un set LEGO e ti restituisce
**tutte le immagini e i video** della pagina prodotto dello shop ufficiale,
nei file originali.

Shop di riferimento: https://www.lego.com/it-it
Pagina di esempio: https://www.lego.com/it-it/product/75457

## Cosa fa

- Cerca per **codice set** (`75457`) o incollando l'indirizzo della pagina prodotto.
- Se il set non è sullo store italiano, prova da solo US, UK e DE.
- Mostra la galleria completa: render, box art, foto lifestyle, video.
- Per ogni file: dimensioni reali in pixel, formato e peso esatto.
- **Filtra per tipo**: render senza sfondo, lifestyle, confezione, prodotto, video.
  I filtri compaiono solo se il set ha più di una categoria.
- **Salva** i file uno a uno o tutti insieme, video compresi.
- Su telefono li manda nella libreria **Foto**; su computer li scarica.
- Tema chiaro/scuro: segue il sistema, il pulsante in alto a destra lo forza
  e la scelta resta memorizzata.

I file arrivano **byte per byte identici all'originale**: nessuna ricompressione,
nessun ridimensionamento, e i PNG dei render restano **senza sfondo**, con la
trasparenza intatta. Verificato confrontando lo SHA-256 dei file salvati con
quelli serviti dal CDN LEGO.

## Il salvataggio in Foto (iPhone)

Avviene in **due tocchi**, e non è una scelta di stile: iOS concede
`navigator.share()` solo entro pochi secondi da un'attivazione utente. Scaricare
prima e condividere dopo farebbe scadere l'attivazione e iOS rifiuterebbe con
`NotAllowedError`. Quindi:

1. **Primo tocco** — l'app scarica il lotto e mostra l'avanzamento.
2. Il pulsante diventa **verde**.
3. **Secondo tocco** — apre il pannello iOS all'istante, con i file già in
   memoria: da lì `Salva immagine` / `Salva video` li mette nel rullino.

Due dettagli che fanno la differenza:

- **Immagini e video vanno in lotti separati.** Un pannello con dentro entrambi
  fa proporre a iOS un'azione generica che non finisce in Foto; separandoli
  compaiono `Salva N immagini` e `Salva video`.
- **Un lotto per volta in memoria** (max 8 file o 80 MB): Safari su iPhone non
  regge centinaia di MB tutti insieme.

Verificato che `share()` parte a 0 ms dal clic, nello stesso task — la
condizione che iOS richiede — e che nessun lotto mischia immagini e video.

## Come funziona

1. La pagina prodotto di lego.com è protetta da Cloudflare e non è leggibile
   con una `fetch` diretta (risponde `403 Just a moment…`). L'app la legge
   tramite `r.jina.ai`, che restituisce l'HTML renderizzato ed espone gli
   header CORS necessari.
2. Dall'HTML estrae `__NEXT_DATA__` → `__APOLLO_STATE__`, la cache dati del
   sito. Da lì legge `productMediaAssets`, che contiene la galleria nell'ordine
   giusto: `ProductAssetImage` (URL originale) e `ProductAssetVideo`
   (formati MP4 + anteprima).
3. Poi passa in rassegna il resto della cache per i media della pagina fuori
   dalla galleria, tenendo solo i file il cui nome contiene il codice del set
   (così i prodotti consigliati restano fuori).
4. **Il CDN LEGO (`www.lego.com/cdn/cs/set/assets/…`) espone gli header CORS.**
   Quindi immagini e video si scaricano direttamente dal browser, senza proxy:
   è per questo che i file restano gli originali esatti.
5. Dimensioni e peso si leggono senza scaricare tutto: una `HEAD` per il
   `content-length`, e i primi 64 KB per l'intestazione PNG (IHDR) o i marker
   SOF del JPEG.

Nessuna libreria esterna, nessun build step: un unico `index.html`.

## Il vincolo CORS del CDN LEGO

`www.lego.com/cdn/cs/set/assets/…` riflette l'header `Origin` **solo** per
`localhost` (qualsiasi porta) e per i domini `lego.com`. Verificato:

| Origin                     | `Access-Control-Allow-Origin` |
|----------------------------|-------------------------------|
| `http://localhost:8931`    | riflesso — consentito         |
| `https://www.lego.com`     | riflesso — consentito         |
| `https://itavix.github.io` | assente — bloccato            |
| `https://example.com`      | assente — bloccato            |

Conseguenza: **servita da localhost l'app scarica tutto**; servita da un dominio
pubblico mostra galleria, anteprime e indirizzi, ma non può leggere i byte dei
file. In quel caso compare un riquadro che chiede l'indirizzo di un passaggio
intermedio (`{url}` al posto del file), salvato poi in `localStorage`.

Nessun proxy pubblico gratuito si è rivelato utilizzabile: `allorigins`,
`codetabs`, `corsproxy.io`, `corsfix`, `cors.lol`, `cors.eu.org` rispondono
403/429/522 o richiedono un piano a pagamento. `images.weserv.nl` funziona ma
ricomprime (quindi niente byte originali) e non gestisce i video.

## Limiti noti

- `r.jina.ai` senza chiave ha un limite di richieste al minuto: cercando molti
  set di fila l'app mostra un avviso e basta aspettare una trentina di secondi.
- I set ritirati da anni non hanno più una pagina sullo shop e non sono
  recuperabili.
- Con una selezione grossa il pannello si apre più volte, una per lotto:
  il set 75457 sono 21 file per 370 MB, cioè 6 lotti. Alcuni video
  promozionali superano da soli i 130 MB.
- La logica del salvataggio è stata verificata simulando le API di
  condivisione (tempi, lotti, tipi di file), ma **non su un iPhone reale**:
  sul Mac di sviluppo manca Xcode completo e il simulatore iOS non era
  disponibile. Il comportamento effettivo del pannello iOS resta da
  confermare sul dispositivo.

## Pubblicazione su Cloudflare Pages

Il codice resta su GitHub; Cloudflare lo prende dal repo e ripubblica a ogni push.

Serve perché `functions/lego/[[path]].js` gira solo su Cloudflare: è una
funzione che rilancia le richieste al CDN LEGO **dallo stesso dominio dell'app**,
così la questione CORS non si pone e i byte arrivano identici, video inclusi.
Non è un proxy aperto: accetta solo percorsi `cdn/cs/set/assets/…`.

Impostazioni del progetto Pages:

- Framework preset: **None**
- Build command: **vuoto**
- Build output directory: **/**

L'app sceglie da sola la strada per i file, provando in quest'ordine:
proxy configurato a mano → `/lego/…` sullo stesso dominio → richiesta diretta
(che funziona solo da `localhost`). Se nessuna funziona, lo dice invece di
fallire in silenzio.

GitHub Pages non è più attivo per questo repo: da lì il download non poteva
funzionare, e tenere online una copia monca creava solo confusione.

## Pubblicazione

Le immagini e i video appartengono al Gruppo LEGO; lo strumento non è
affiliato né approvato da LEGO System A/S.


## Come sono divisi i filtri

Le categorie si ricavano dai nomi file, che sullo shop LEGO seguono
convenzioni costanti:

| Categoria      | Riconosciuta da        |
|----------------|------------------------|
| Senza sfondo   | `_NOBG` nel nome       |
| Lifestyle      | `Lifestyle`            |
| Confezione     | `box` / `boxprod`      |
| Video          | file `.mp4`            |
| Prodotto       | tutto il resto         |

Cambiando filtro la selezione si riallinea a ciò che si vede, così
"filtra e salva" funziona senza dover riselezionare a mano.

## Logo

`logo_itavix.png` è l'originale (3154 × 1502). `logo.png` è la versione per il
web: ritagliata ai pixel non trasparenti, ridotta a 428 × 240 e quantizzata a
192 colori — da 398 KB a 29 KB, con scarto di colore medio 2,4/255 e
trasparenza conservata. Rimanda a Instagram sia in testa sia nel footer.

## Instagram
https://www.instagram.com/itavix_bricks/
