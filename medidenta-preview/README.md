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

## Automatische Datenaktualisierung (v0.6.2)

Der private MediIdenta-Datenkern enthält jetzt den sicheren Exporter und eine GitHub Action für den öffentlichen Testkatalog. Sobald im privaten Repository das eng begrenzte Actions-Secret `MEDIIDENTA_PAGES_TOKEN` hinterlegt wird, können Änderungen an veröffentlichten Produktidentitäten und redaktionellen Entwürfen regelmäßig in die drei öffentlichen JSON-Dateien synchronisiert werden.

Die App zeigt den letzten Quell-Datenstand im Qualitätscenter, bietet „Öffentlich verfügbare Daten neu laden“ und prüft bei Rückkehr zum Tab beziehungsweise alle fünf Minuten auf Änderungen. Bis der automatische Upload aktiviert wurde, lautet die Kennzeichnung ausdrücklich „manueller Testdatenstand“. Es bleibt eine öffentliche statische Vorschau ohne Live-Datenbank-API.

## Geschützte Prüfung (Version 0.7, derzeit noch ohne aktiviertes Backend)

Eine neue Kontooberfläche ist auf der öffentlichen Demo vorbereitet. Supabase Auth soll sechsstellige E-Mail-Codes für die Anmeldung verwenden. Nur als `reviewer` oder `admin` in einer Supabase-Rollentabelle freigeschaltete Nutzer dürfen eine fachliche Prüfentscheidung abgeben.

Die Bestätigung dokumentiert die geprüfte Original-EMA-Quelle, die konkrete GitHub-Katalogrevision und einen SHA-256-Fingerabdruck der Aussage. Prüfereignisse sind nach dem vorgesehenen RLS-Schema nur anhängbar, nicht editierbar oder löschbar. Diese Prüfdaten liegen getrennt vom öffentlichen GitHub-Pages-Quellcode.

**Aktivierung steht aus:** Das Supabase-Projekt, die RLS-Migration und die `review-auth-config.js` mit öffentlicher Projekt-URL und Publishable Key müssen erst eingerichtet werden. Kein Service-Role- oder Secret-Key darf in öffentliche Dateien gelangen. Bis dahin zeigt die App transparent „Anmeldung vorbereitet“.

Persönliche lokale Prüfnotizen und zentral gespeicherte, authentifizierte Prüfentscheidungen sind unterschiedliche Funktionen. **Eine authentifizierte Bestätigung ist noch keine klinische Freigabe** für die private MediIdenta-Datenbank; ein separater kontrollierter Publikationsprozess ist nötig.

Siehe private Dokumentation im Repository `Alcapwndx/MediIdenta` unter `docs/KLINISCHER_REVIEW_LOGIN.md`.
