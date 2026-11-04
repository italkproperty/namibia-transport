# Typefaces for the PDF quotation

Three woff2 subsets, vendored here so `build-quote.py` runs on a clean
checkout with no `npm run build` first. They are the same files `next/font`
serves to the website, lifted from `.next/static/media/`, so a printed quote
and the site cannot drift apart typographically.

| File | Family | Notes |
|---|---|---|
| `archivo-variable.woff2` | Archivo | Variable, weight 100–900. Reports itself as "Archivo SemiBold" because 600 is the default instance. |
| `ibm-plex-mono-400.woff2` | IBM Plex Mono | Regular — figures and references. |
| `ibm-plex-mono-500.woff2` | IBM Plex Mono | Medium — emphasised figures. |

Both families are licensed under the **SIL Open Font License 1.1**, which
permits redistribution, including bundled in a repository. The subsetting is
`next/font`'s, which strips the name table's licence record; the upstream
projects are Archivo (Omnibus-Type) and IBM Plex Mono (IBM).

These are a Latin subset. A quote needing other scripts needs the fuller
subsets from `.next/static/media/` instead.
