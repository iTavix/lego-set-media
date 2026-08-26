/**
 * Passaggio intermedio verso il CDN LEGO, sullo stesso dominio dell'app.
 *
 * Il CDN riflette l'header Origin solo per localhost e per i domini lego.com:
 * da un sito pubblico il browser non può leggere i byte dei file. Servendo la
 * richiesta dallo stesso dominio la questione CORS non si pone proprio, e i
 * byte arrivano identici all'originale — nessuna ricompressione, video inclusi.
 *
 * Non è un proxy aperto: passa solo il percorso degli asset dei set.
 */

const CONSENTITO = /^cdn\/cs\/set\/assets\/[A-Za-z0-9._\-/]+$/;

// Header che vanno riportati al browser perché download e riproduzione funzionino.
const DA_RIPORTARE = [
  "content-type", "content-length", "content-range",
  "accept-ranges", "last-modified", "etag",
];

export async function onRequest({ request, params }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Metodo non consentito", { status: 405 });
  }

  const percorso = (params.path || []).join("/");
  if (!CONSENTITO.test(percorso)) {
    return new Response("Percorso non consentito", { status: 403 });
  }

  const origine = new URL(request.url);
  const destinazione = "https://www.lego.com/" + percorso + origine.search;

  const inoltrati = new Headers({
    // Senza questi la protezione bot davanti al CDN può rispondere 403.
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Referer": "https://www.lego.com/",
    "Accept": "*/*",
  });
  const range = request.headers.get("Range");
  if (range) inoltrati.set("Range", range);   // serve allo scrubbing dei video

  let risposta;
  try {
    risposta = await fetch(destinazione, { method: request.method, headers: inoltrati, redirect: "follow" });
  } catch (e) {
    return new Response("CDN LEGO irraggiungibile: " + e.message, { status: 502 });
  }

  const uscita = new Headers();
  for (const h of DA_RIPORTARE) {
    const v = risposta.headers.get(h);
    if (v) uscita.set(h, v);
  }
  uscita.set("Cache-Control", "public, max-age=86400");

  return new Response(request.method === "HEAD" ? null : risposta.body, {
    status: risposta.status,
    headers: uscita,
  });
}
