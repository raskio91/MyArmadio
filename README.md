# Armadio

Web app per iPhone: categorie di vestiti, capi fotografati e outfit (al massimo un capo per categoria).
Tutti i dati restano sul telefono (IndexedDB); niente viene caricato online.

## Installazione sull'iPhone
1. Apri il link GitHub Pages in **Safari**.
2. Tocca **Condividi → Aggiungi alla schermata Home**.
3. Apri Armadio dall'icona: si apre a tutto schermo e funziona anche offline.

> I dati dell'app sulla schermata Home sono separati da quelli di Safari: usa sempre l'icona.

## Backup
Armadio → pulsante con la freccia in alto, accanto al "+" → **Esporta backup** → Salva su File (iCloud Drive).
Per ripristinare: **Importa backup** e scegli il file `.json`.

## Capi senza sfondo
In Foto tieni premuto sul capo → **Copia**, poi nella schermata del nuovo capo tocca **Incolla**.

## Pubblicazione
Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
Dopo ogni modifica aumenta `VERSION` in `sw.js`.

## File
- `index.html`, `style.css`: interfaccia
- `app.js`: logica (categorie, capi, outfit, backup)
- `db.js`: archivio locale
- `sw.js`, `manifest.webmanifest`, `icons/`: installazione e uso offline
- `fonts/`: Figtree e Familjen Grotesk (SIL Open Font License)
