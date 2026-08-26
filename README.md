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
- **Salva** i file uno a uno o tutti insieme, video compresi.
- Su telefono li manda nella libreria **Foto**; su computer li scarica.

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

## Pubblicazione

È una pagina statica: basta metterla su GitHub Pages.
Le immagini e i video appartengono al Gruppo LEGO; lo strumento non è
affiliato né approvato da LEGO System A/S.
