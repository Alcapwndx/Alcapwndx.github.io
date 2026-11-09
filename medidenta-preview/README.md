# MediIdenta – öffentliche GitHub-Pages-Testversion 0.6
Status: **Nur Entwicklung. Keine klinische Freigabe.**

## Öffentlicher Umfang (09.11.2026)

- 36 in der privaten Datenpipeline als Identitäten veröffentlichte Produkt-Einträge (12 Union-Register, 24 EMA-EPAR).
- 178 **ungeprüfte, redaktionelle Fachtextentwürfe**, die hier ausdrücklich zur nachfolgenden eigenen medizinischen Prüfung sichtbar sind: 45 Alttexte, 47 v0.8, 86 EMA-Addendum.
- 174 Entwürfe können anhand exakter Wirkstoff- bzw. Produktnamen verknüpft werden; 4 bleiben ohne Zuordnung sichtbar und müssen manuell geprüft werden.
- 0 fachlich freigegebene Aussagen, 0 originalverifizierte Tablettenfotos, 0 verifizierte PZN-/GTIN-Packungen.
- Der größere deutsche Artikel-57-Stagingbestand verbleibt **ausschließlich privat und in Review**; seine Kandidaten werden nicht als publizierte Produktidentitäten ausgegeben.

## Bedienung

Start/Suche: Produktidentitäten; Details: zugeordnete Redaktionstexte mit EMA-Quellenlink.
Wissen: alle Entwürfe suchen, nach Risiko und Zuordnung filtern, lokal Notizen/Status markieren und eine JSON-Prüfliste herunterladen.
**Wichtig:** Markierungen wie „persönlich gesichtet“ sind keine klinische Freigabe und werden nicht an die private Datenbank übertragen.

## Herkunft / Rechte

Die präparatespezifischen Kurztexte stammen aus den eigenständig erstellten und versionsgebundenen MediIdenta-Datensätzen:
`data/clinical_drafts_v08.json`, `data/clinical_drafts_ema_addendum_v08.json`,
`tools/seed_facts.py`. Je Aussage ist die offizielle EMA-Quelle verlinkt.
Der Produktkatalog wurde aus `seed_eu_public_2026.json` (Union Register, CC BY 4.0) und
`ema_verified_identity_2026.json` (EMA-EPAR, Quellen-Namensnennung) zusammengestellt.

Die Seite ist öffentlich und die Entwürfe sind dadurch ebenfalls öffentlich lesbar. Keine privaten SQL-Daten, Zugangsdaten, Reviewaufgaben oder Patientendaten wurden mitkopiert.

## Technische Grenzen

Statische GitHub Pages ohne Python-API; kein Echtzeitdatenbankabgleich. Kamera-Barcodeerkennung browserabhängig, ohne verifizierte Kennungen keine Identifizierung. Tablettenfotos sind nur Vorschau ohne KI-Zuordnung. Nicht für Dosierung, Medikamentengabe oder Therapieentscheidungen benutzen.
