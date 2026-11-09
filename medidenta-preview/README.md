# MediIdenta – öffentliche Smartphone-Vorschau 0.5

Diese Dateien bilden ausschließlich eine **öffentliche statische UI-Demo** der privaten MediIdenta-Datenbank-App.

## Geprüfte Grenzen

- Dieser Ordner enthält weder SQLite-Datenbank noch Python-Backend, Geheimnisse, interne Reviewprozesse, Quarantänedatensätze oder Fachtextentwürfe.
- Die sichtbaren 12 Produktidentitäten sind ein begrenzter Ausschnitt aus der versionierten Quelle `data/seed_eu_public_2026.json` des privaten Repositorys `Alcapwndx/MediIdenta`. Die Zuordnung ist keine klinische Verifikation.
- Es gibt **keine** verifizierten PZN/GTIN-Packungstreffer und keine automatische KI-Fotoidentifikation.
- Die PWA läuft ohne Live-Backend und zeigt nur öffentliche Produktnamen, zugeordnete Wirkstoffe und Quellenbeleg.
- Quelle der Einträge: European Commission – Union Register, https://ec.europa.eu/health/documents/community-register/html/reg_last.htm; in der Quellregistrierung als CC-BY-4.0 eingestuft. Weitere externe Daten/Bilder bedürfen eigener Nutzungsrechtsklärung.
- Private App- und Datenbankentwicklung bleibt ausschließlich im privaten Repository.

## Aktualisierung

Die Testversion wird bei Bedarf aus freigegebenen Identitätsdatensätzen neu gebaut. Keine direkte Verbindung zum privaten GitHub-Repository.
