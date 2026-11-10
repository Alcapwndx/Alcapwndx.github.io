# MediIdenta 0.14.1 – Klinische Themen und PMS-Quellkategorien übersichtlich

## Umsetzung

Die in v0.14 bereits eingeführte Suche bleibt unverändert: Der zentrale
MediIdenta-Katalog und der EMA-PMS-Beta-Quellenbestand sind in **einer Suche
und Detailnavigation** erreichbar, aber nicht ohne geprüfte Identitätszuordnung
als gleiches Präparat gekoppelt.

**Fachtexte:** Neben der Produktdetailseite zeigt nun auch die globale
**Wissens-/Fachtextansicht** maximal eine Themenbox pro Medikament und
Fachtexttyp (Warnhinweise, Kontraindikationen, Nebenwirkungen ...).
Wortgleiche Texte werden optisch einmal dargestellt. Originaldatensatz,
Quellenfundstelle und Admin-Prüfentscheidung bleiben je Datensatz
erhalten. Die globale Ansicht gruppiert *zusätzlich nach Produktidentität*
und Zielname, damit gleichlautende Texte verschiedener Arzneimittel
niemals zusammengezogen werden. Die Seitennavigation zählt Themen
statt redundante Datensätze.

**PMS:** Einzelne PMS-Schlüssel werden zu sechs lesbaren Themenbereichen
zusammengefasst, z.B. „Wirkstoffe und Wirkstärken“, „Arzneiform und Anwendung“
oder „Klinische Quellkategorien (keine Fachtexte)“. Die originalen PMS-
Feldarten und Quell-IDs bleiben darin als Unterabschnitte einzeln
erkennbar; Inhalte und Admin-Formulare verschwinden nicht. Unverstandene
Codes bleiben ausdrücklich unübersetzt, und original übermittelte
Wirkstärken behalten Einheiten und Bezugsgrößen.

## Sicherheitsgrenzen

- Das ist **ausschließlich eine Änderung der Darstellung**, keine
  Löschung/Neuschreibung von DB-Inhalten oder Reviewer-Events.
- Ein validierter Datensatz validiert **keine** gleichlautende ungeprüfte
  andere FHIR-Ressource bzw. keinen vollständigen Medikationsdatensatz.
- Keine automatische Produktidentität aufgrund des Handelsnamens.
  Für gemeinsame Produktdetails aus beiden Quellen ist ein gesonderter
  Admin-bestätigter Identitätsabgleich nötig.
- Keine Dosisumrechnung, PZN-Vermutung oder Freigabe als Medizinsoftware.

Regressionstests kontrollieren insbesondere unterschiedliche Wirkstärken,
getrennte Quell-IDs, deduplizierte Texte und Themenboxen in der globalen
Fachtextansicht.
