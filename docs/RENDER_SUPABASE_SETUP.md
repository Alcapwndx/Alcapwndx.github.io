# MediIdenta – Render + Supabase Deployment (geschützte Testversion)

> **Status:** Docker/Web-API, Datenbankschema, Datenimport und Login-Freigabefunktion sind vorbereitet. Es wurde **noch kein Render-/Supabase-Projekt angelegt oder verbunden**. Die Anwendung ist ausdrücklich nur für Entwicklung, nicht für die klinische Versorgung geeignet.

## Überblick

| Komponente | Zuständigkeit |
| --- | --- |
| Render Free, Frankfurt | FastAPI-Backend, aktuelle MediIdenta-PWA, sichere API |
| Supabase Free, nach Möglichkeit EU-Region | PostgreSQL mit Medikamenten-/Fachdatensätzen, Supabase Auth, Audit-Protokoll |
| `Alcapwndx/MediIdenta` (privat) | geprüfte Quellidentitäten, redaktionelle Entwürfe, Exporter und Sicherheitsregeln |
| `Alcapwndx/Alcapwndx.github.io` (öffentlich) | Render-Dockerfile, API, statische PWA für die Entwicklung |
| GitHub Actions (privat) | Eigenständiger Live-Sync nach Supabase mit privatem Datenbankzugang; GitHub Pages bleibt optional |

**Das Hosting ist nicht länger von GitHub Pages abhängig.** Die bisherige öffentliche JSON-Demo kann als Fallback und Vergleich bestehen bleiben. Wenn Supabase verbunden ist, werden die App-Datensätze live aus PostgreSQL geladen.

## Schritt A – Supabase-Projekt erstellen

1. Unter https://supabase.com/dashboard ein neues Projekt mit einem eigenen, starken Datenbankpasswort und passender EU-Region erstellen.
2. Unter **SQL Editor** zuerst den Inhalt der Datei im **privaten** GitHub-Repository
   `ops/supabase/medidenta_review_rls.sql` ausführen.
3. Anschließend `ops/supabase/medidenta_live_catalog.sql` ausführen. Die zweite Migration erstellt die Produkt- und Fachdaten-Tabellen, schützt sie per Row-Level Security und stellt die sichere Review-Funktion `medidenta_submit_clinical_review` bereit.
4. Unter **Authentication → Sign In / Providers → Email** die E-Mail-Anmeldung aktivieren. **Keine E-Mail-Vorlage ändern:** Supabase Free sperrt seit dem 03.06.2026 die Template-Anpassung ohne eigenes SMTP. MediIdenta verwendet stattdessen die unveränderten **Magic-Link-E-Mails**, die direkt zur App zurückführen. Unter **Authentication → URL Configuration** die Site URL auf `https://alcapwndx-github-io.onrender.com/medidenta-preview/` setzen und unter Redirect URLs **exakt dieselbe URL** erlauben. Der eingebaute Test-Maildienst versendet nur an E-Mail-Adressen von Mitgliedern des Supabase-Projektteams und maximal zwei E-Mails/Stunde; für andere Empfänger später einen eigenen SMTP-Dienst konfigurieren. Quellen: https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier und https://supabase.com/docs/guides/auth/testing-auth-flows.
5. Unter **Settings → API Keys** den **Publishable Key** (`sb_publishable_...`) und die öffentliche Projekt-URL (`https://<projekt>.supabase.co`) für Render notieren. Das sind keine Administrator-Schlüssel.
6. Unter **Connect** den PostgreSQL-Datenbank-Verbindungsstring für eine serverseitige Verbindung beziehen. Ist IPv6 aus dem GitHub Runner nicht verfügbar, bietet Supabase den **Session Pooler** als IPv4-kompatible Verbindung an. Das Datenbankpasswort bleibt ausschließlich im privaten Repository-Secret.

**WICHTIG:** Niemals `sb_secret_...`, `service_role`, den PostgreSQL-Verbindungsstring oder das Datenbankpasswort in den Render-Webdienst, öffentliche GitHub-Dateien oder den Chat kopieren. Das Backend braucht nur **öffentliche** Supabase-Clientdaten und die Auth-JWTs der angemeldeten Nutzer.

## Schritt B – Render Free bereitstellen

1. Unter https://dashboard.render.com das GitHub-Konto verknüpfen und den Zugriff auf das **öffentliche** Repository `Alcapwndx/Alcapwndx.github.io` freigeben.
2. Im Render Dashboard **New → Blueprint** wählen und die Datei `render.yaml` aus diesem Repo nutzen. Alternativ eine Web Service mit `runtime: Docker`, Root `/`, Dockerfile `./Dockerfile`, Region **Frankfurt**, Plan **Free** anlegen.
3. Als **Render Environment Variables** hinterlegen:
   - `MEDIIDENTA_SUPABASE_URL` = öffentliche Projekt-URL.
   - `MEDIIDENTA_SUPABASE_PUBLISHABLE_KEY` = öffentlicher `sb_publishable_...`-Schlüssel.
4. Den Dienst deployen. Das Ergebnis ist eine von Render zugeteilte, nicht im Voraus bekannte `https://...onrender.com`-Adresse.
5. Testen:
   - `https://DEIN-RENDER-DIENST.onrender.com/api/v1/health` → `supabase_configured: true`.
   - `https://DEIN-RENDER-DIENST.onrender.com/api/v1/readiness` → nach dem Import `ready: true`.
   - `https://DEIN-RENDER-DIENST.onrender.com/medidenta-preview/` → PWA.
6. Im Supabase Dashboard unter Authentication den **Site URL** und erlaubte Redirect-URLs passend zur konkreten Render-Adresse setzen.

**Beachte:** Die Render-Konfiguration ohne diese zwei Variablen zeigt eine transparente statische Testversion. Wenn die Variablen gesetzt sind, die Supabase-Datenbank aber noch nicht importiert wurde, melden die dynamischen Katalogendpunkte einen Fehler statt heimlich veraltete Fakten als live auszugeben.

## Schritt C – Private Datenquelle nach Supabase übertragen

1. Im privaten Repository `Alcapwndx/MediIdenta` unter **Settings → Secrets and variables → Actions → New repository secret** ein Secret anlegen:
   - Name: `MEDIIDENTA_SUPABASE_DB_URL`
   - Wert: der **private PostgreSQL-Verbindungsstring**, wie er im Supabase Dashboard unter Connect angezeigt wird, einschließlich URL-kodiertem Passwort. Wird **nicht** an Render übergeben.
2. Im selben privaten Repo unter **Actions** den Workflow **„MediIdenta – zentrale Supabase-Datenbank synchronisieren“** einmal manuell auf `main` starten.
3. Der Workflow baut die private SQLite-Quelldatenbank auf, testet sie, exportiert nur den freigabefähigen öffentlichen Teil und schreibt über eine SSL-geschützte PostgreSQL-Verbindung transaktional in Supabase. Bereits fachlich bestätigte **oder widerrufene** Aussagen bleiben bei einem Import derselben unveränderten Quelle in ihrem Status bestehen.
4. `/api/v1/readiness` erneut aufrufen. Erst bei `ready: true` ist der zentrale Datenbestand verfügbar.

Der private Datenkern bleibt Eigentümer der Quelldaten. **Quarantänedaten des Artikel-57-Staging, Fotos, PZN und interne Daten werden nicht übertragen.**

## Schritt D – Dein Admin-Konto aktivieren

1. In der Render-App das Kontosymbol öffnen, eine **Anmeldelink-E-Mail** anfordern und den Link im Browser öffnen. Nach der Rückleitung zur MediIdenta-App wird die Supabase-Sitzung aus dem URL-Fragment übernommen und der sensible Fragmentteil unmittelbar entfernt.
2. Nach der ersten Anmeldung gibt es zunächst **keine Berechtigung**, Fachinformationen zu bestätigen.
3. Supabase Dashboard → **Authentication → Users** → eigene Benutzer-UUID kopieren.
4. Im SQL Editor als Projektinhaber ausführen (UUID ersetzen):

```sql
insert into public.medidenta_reviewer_roles (user_id, role)
values ('00000000-0000-0000-0000-000000000000'::uuid, 'admin')
on conflict (user_id) do update set role = excluded.role;
```

5. Konto in der App neu laden oder erneut anmelden und kontrollieren, dass **Administrator/in** angezeigt wird. In der Fachtextansicht eine **bekannte, anhand der aktuellen Originalquelle kontrollierte** Aussage öffnen. Die Freigabe geht **direkt** an die serverseitige Supabase-Funktion; nur die unveränderte registrierte Textversion kann bestätigt werden.
6. Eine Ablehnung oder Überarbeitung widerruft die fachliche Freigabe derselben Version ebenfalls direkt in der zentralen Datenbank.

**Achtung:** Der Schreibschutz der Audit-Tabelle wird durch die zweite Migration auf eine einzige überprüfte serverseitige RPC beschränkt. Die alte GitHub-Pages-Login-Demo ohne Backend ist absichtlich nicht für produktive Freigaben verwendbar.

## Technischer Betrieb und spätere Migration

- Die Web-Anwendung und API laufen im Docker-Container. Für einen eigenen Linux-Server dasselbe Dockerfile und dieselben beiden öffentlichen Umgebungsvariablen verwenden.
- Auf Render Free wird **keine** dauerhafte SQLite-Datei verwendet. Dauerhafte Daten liegen in PostgreSQL und werden mit standardisierten SQL-Migrationen eingerichtet.
- Beim späteren vollständigen Umzug wird PostgreSQL samt RLS/Audit und gegebenenfalls Supabase Auth separat exportiert. Benutzer-/JWT-Migration, SMTP, Secrets und RLS benötigen einen gezielten Testlauf.
- Alle Secrets regelmäßig rotieren; Freigabe-Events und Datenbank regelmäßig exportieren/prüfen. Keine Patientendaten in Freitextfelder aufnehmen.
- Nach Aktivierung des Backends echte Integrationsprüfungen durchführen: Gast kann keine Fachfreigabe erteilen; Nicht-Prüfer erhält 403; falscher Hash/alter Commit wird abgewiesen; Änderung und Widerruf werden gespeichert; der Browser zeigt die aktualisierten Daten.
- App und Backend sind trotz individueller Fachtextprüfung **nicht** für therapeutische Entscheidungen oder als reguliertes Medizinprodukt freigegeben. Ein eigener Releaseprozess ist notwendig.

## Kosten- und Verfügbarkeitsgrenzen

Render Free kann nach Inaktivität einschlafen und ist nicht für zuverlässigen medizinischen Produktionseinsatz vorgesehen. Supabase Free kann Einschränkungen und Inaktivitäts-Pausen haben. Vor einem offenen Release einen dauerhaft verfügbaren, überwachten Dienst mit Backups und Datensicherheits-/Regulatory-Prüfung wählen.

Quellen: https://render.com/docs/free, https://render.com/docs/docker, https://supabase.com/docs/guides/database/connecting-to-postgres, https://supabase.com/docs/guides/database/postgres/row-level-security.
