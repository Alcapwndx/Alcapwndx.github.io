# MediIdenta v0.14 – Gemeinsame Suche, lesbare PMS-Daten und Themenbereiche

## Nutzung in der Alpha

Die gewöhnliche Suche sucht jetzt parallel in zwei Bereichen:
- **MediIdenta-Katalog:** bereits vorhandene Produktidentitäten und redaktionelle Fachtexte;
- **EMA PMS Beta:** aktuelle strukturierte Produktquellen mit dem eindeutigen Hinweis
  **nicht klinisch validiert**.

Die PMS-Quelle erscheint in derselben Suchseite. Beim Öffnen eines PMS-Treffers
wird dieselbe Detail-Ansicht geöffnet und der Quelldatensatz lesbar dargestellt.
PMS-ID und MediIdenta-ID bleiben intern **verschiedene Identitäten**. Ein gleicher
Handelsname ist keine geprüfte Übereinstimmung. PMS-Stoffe werden daher nicht
automatisch an eine andere Produktidentität oder deutsche PZN angehängt.

## Lesbare FHIR-Darstellung

Die bisherigen JSON-Codeblöcke werden im normalen Benutzerbereich durch
verständlich beschriftete Gruppen und Werte ersetzt: Produktnamen, Wirkstoffe,
Wirkstärken mit **Originaleinheiten und Originalbezugsgrößen**, Arzneiformen,
Applikationswege, Kennungen, Zulassungen und Packungsangaben. ClinicalUseDefinition
bleibt nur eine **ungeprüfte klinische Quellkategorie**, keine generierte
Therapie-/Kontraindikationsinformation. Wo die EMA ausschließlich Quellcodes ohne
lesbaren Titel übermittelt, bleibt das ausdrücklich als **uninterpretierter
Quellcode** gekennzeichnet. Technische FHIR-Rohdaten stehen nur Admins im
aufklappbaren Quellenprüfbereich zur Verfügung.

Keine Dosisumrechnung, keine Gleichwertigkeitsaussage, keine PZN-Ableitung.

## Inhaltliche Dubletten

- Fachinformationen werden pro Arzneimittel nach **Fachtexttyp**
  (etwa Warnhinweise, Nebenwirkungen, Wechselwirkungen) in **einem Themenblock**
  zusammengefasst.
- Innerhalb eines Themenblocks werden nur bei normalisiert exakt gleichem Text
  (Unicode, Groß-/Kleinschreibung, überflüssige Leerzeichen) doppelte
  Ausgaben ausgeblendet. Inhaltlich unterschiedliche Aussagen bleiben
  getrennt; insbesondere werden "Nicht ..." und "..." nicht gleichgesetzt.
- In der globalen Wissensansicht werden zusätzlich Produktzuordnung und
  Zielname zur Gruppierung berücksichtigt. Kein Vermischen von Medikamenten.
- Bei PMS werden identische strukturierte Werte **nur innerhalb desselben
  Feldtyps** zusammengefasst. Abweichende Stärken, Einheiten oder Bezugsgrößen
  bleiben jeweils eigenständig.
- **Alle ursprünglichen Datensatz-IDs und Quellenreferenzen bleiben erhalten.**
  Hinter "Quellen und Einzelprüfungen" sind sie bei Bedarf einsehbar.
  Eine validierte Einzelangabe bestätigt **nicht automatisch** einen
  dazu gleichlautenden, aber unvalidierten Datensatz.
- Dies ist reine **Darstellungs-Deduplizierung**; weder Supabase-Daten noch
  Admin-Prüfhistorie werden verändert oder gelöscht.

## Nächste Stufe

Später können PMS-Angaben zusätzlich direkt auf der **bestehenden**
MediIdenta-Produktdetailseite erscheinen, **nachdem** ein Admin eine
nachvollziehbare Produktzuordnung mit überprüfter Zulassungskennung,
Wirkstoff/Salt, Wirkstärke und Arzneiform bestätigt hat. Eine automatische
Namensgleichsetzung ist ausdrücklich ausgeschlossen.

Die UI-Version verwendet `medication-view.js` für beide Gruppierungen;
Node-Tests kontrollieren Quellennachweis, Duplikate, unterschiedliche
Wirkstärken und ungeprüfte Prüfstände. Beim Wechsel auf eine neue Version
wird der PWA-Service-Worker-Cache aktualisiert.
