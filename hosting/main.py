"""MediIdenta staging web service for Render and ordinary Docker/Linux.

- Ships the existing public PWA from the same origin.
- Uses Supabase PostgreSQL as the central read source when configured.
- The user JWT goes to a SECURITY DEFINER PostgreSQL review RPC; no secret
  Supabase key is exposed to visitors or accepted from client-provided fields.
- With no Supabase project, serves ONLY clearly marked static demo snapshots.
- Deployment is for DEVELOPMENT, not a validated medical decision system.
"""
from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

BASE = Path(__file__).resolve().parent.parent
SITE = BASE / "medidenta-preview"
log = logging.getLogger("medidenta")
app = FastAPI(
    title="MediIdenta development API",
    description="Protected, source-bound medicinal catalog review; not clinically validated software",
    version="0.9.0",
    docs_url=None, redoc_url=None,
)

URL = os.environ.get("MEDIIDENTA_SUPABASE_URL", "").strip().rstrip("/")
KEY = os.environ.get("MEDIIDENTA_SUPABASE_PUBLISHABLE_KEY", "").strip()
HOST_PATTERN = re.compile(r"https://[a-z0-9-]+\.supabase\.co")
KEY_PATTERN = re.compile(r"sb_publishable_[A-Za-z0-9_-]{12,}")
IS_LIVE_CONFIGURED = bool(HOST_PATTERN.fullmatch(URL) and KEY_PATTERN.fullmatch(KEY))
PARTIAL_CONFIG = bool(URL or KEY) and not IS_LIVE_CONFIGURED
MAX_LIST = 1000
VALID_ID = re.compile(r"^[A-Za-z0-9_-]{1,120}$")

# Never place a service_role or sb_secret_ key on this web service.
# The private importer keeps its database credential in GitHub Actions Secrets.


def no_store(data: dict, status: int = 200):
    return JSONResponse(data, status_code=status,
                        headers={"Cache-Control": "no-store",
                                 "X-Content-Type-Options": "nosniff"})


def _demo(name: str):
    return json.loads((SITE / name).read_text("utf-8"))


def _current_mode():
    return "LIVE_SUPABASE" if IS_LIVE_CONFIGURED else "STATIC_DEVELOPMENT_PREVIEW"


async def _read_table(table: str, *, columns: str, limit: int = MAX_LIST, offset: int = 0):
    if not IS_LIVE_CONFIGURED:
        raise HTTPException(status_code=503, detail="Supabase not yet configured")
    params = {"select": columns, "order": "id.asc", "limit": str(limit)}
    if offset:
        params["offset"] = str(offset)
    if table == "medidenta_catalog_metadata":
        params = {"select": columns, "singleton": "eq.1", "limit": "1"}
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        try:
            resp = await client.get(
                f"{URL}/rest/v1/{table}",
                headers={"apikey": KEY, "Accept": "application/json"},
                params=params
            )
            resp.raise_for_status()
            result = resp.json()
            if not isinstance(result, list) or (len(result) >= limit and limit == MAX_LIST):
                raise ValueError("Unexpected database response or catalog pagination limit")
            return result
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("Supabase read failure for %s: %s", table, type(exc).__name__)
            raise HTTPException(status_code=503, detail="Zentrale Medikamentendatenbank derzeit nicht verfügbar") from None


async def _read_all_table(table: str, *, columns: str, page_size: int = 900,
                          max_rows: int = 27000):
    """Exhaust validated PostgREST pages; never silently truncate at 1,000.

    This keeps the current snapshot API compatible while large catalogs are
    migrated to dedicated server-side searches. Limits are fail-closed.
    """
    records = await _read_table(table, columns=columns, limit=page_size)
    while len(records) == page_size:
        if len(records) + page_size > max_rows:
            raise HTTPException(503, "Katalog zu groß für den aktuellen Snapshot-Endpunkt")
        page = await _read_table(table, columns=columns, limit=page_size,
                                 offset=len(records))
        records.extend(page)
        if len(page) < page_size:
            break
    return records


async def _bundle():
    if not IS_LIVE_CONFIGURED:
        if PARTIAL_CONFIG:
            raise HTTPException(status_code=503, detail="Ungültige Supabase-Konfiguration")
        return {
            "catalog": _demo("catalog_snapshot.json"),
            "clinical": _demo("clinical_review_drafts.json"),
            "sync": {**_demo("sync_status.json"), "mode": "STATIC_DEVELOPMENT_PREVIEW"},
        }
    rows = await _read_table("medidenta_catalog_metadata",
                             columns="singleton,source_commit,source_date,source_schema_version,imported_at")
    if len(rows) != 1:
        raise HTTPException(503, "Supabase-Katalog wurde noch nicht importiert")
    meta = rows[0]
    products = await _read_all_table("medidenta_catalog_products", columns="id,payload")
    facts = await _read_all_table("medidenta_catalog_facts",
                                  columns="id,payload,editorial_status,reviewed_at")
    if not products or not facts:
        raise HTTPException(503, "Medikamentendatenbank wurde noch nicht vollständig initialisiert")
    rev = meta["source_commit"]
    out_products = [p["payload"] for p in products]
    draft_facts, reviewed_facts = [], []
    for entry in facts:
        f = dict(entry["payload"])
        status = entry["editorial_status"]
        f["editorial_status"] = status
        if status == "clinically_reviewed":
            f["reviewed_at"] = entry["reviewed_at"]
            f["review_status_label"] = "Fachlich freigegeben durch registriertes Prüfkonto"
            reviewed_facts.append(f)
        elif status == "draft_unreviewed":
            f.pop("reviewed_at", None)
            draft_facts.append(f)
        else:
            raise HTTPException(503, "Unbekannter Status im klinischen Katalog")
    counts = {
        "products": len(out_products), "fact_drafts": len(draft_facts),
        "matched_facts": sum(x.get("assignment_status") != "unmatched" for x in draft_facts),
        "unmatched_facts": sum(x.get("assignment_status") == "unmatched" for x in draft_facts),
    }
    catalog = {
        "format": "medidenta-identity-only-v1", "clinical_release_ready": False,
        "notice": "MediIdenta Entwicklungs-Katalog aus Supabase PostgreSQL; keine Freigabe der gesamten App",
        "source_catalog_schema_version": meta["source_schema_version"],
        "source_commit": rev, "products": out_products,
    }
    clinical = {
        "format": "medidenta-editorial-review-only-v1",
        "notice": "Alle Fachtexte mit ihrem individuellen Prüfstatus; keine therapeutische Softwarefreigabe",
        "clinical_release_ready": False, "source_commit": rev,
        "reviewed_facts": len(reviewed_facts),
        "facts": draft_facts, "reviewed_facts_list": reviewed_facts, "stats": counts,
    }
    sync = {
        "format": "medidenta-public-sync-v1",
        "mode": _current_mode(), "source_of_truth": "Supabase PostgreSQL",
        "source_commit": rev, "source_date": meta["source_date"],
        "identity_count": len(out_products), "draft_count": len(draft_facts),
        "reviewed_count": len(reviewed_facts),
        "unmatched_count": counts["unmatched_facts"],
        "medical_release_ready": False,
        "last_catalog_import_at": meta.get("imported_at"),
        "last_ema_check_at": None, # Not claimed until a real EMA fetch/check is audited.
        "release_phase": "alpha",
        "beta_gate": {
            "target_clinically_validated_product_coverage": 0.70,
            "requires_verified_pack_identification": True,
            "requires_broad_catalog_coverage": True,
            "ready": False,
        },
    }
    return {"catalog": catalog, "clinical": clinical, "sync": sync}


@app.get("/api/v1/health")
async def health():
    return no_store({
        "service": "MediIdenta", "status": "ok", "mode": _current_mode(),
        "supabase_configured": IS_LIVE_CONFIGURED,
        "clinical_app_release_ready": False,
    })


@app.get("/api/v1/features")
async def features():
    """Enable collaboration only after the operator applies the atomic v0.9 SQL migration."""
    if not IS_LIVE_CONFIGURED:
        return no_store({"collaboration_enabled": False, "reason": "no_live_database"})
    async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as client:
        try:
            response = await client.get(
                f"{URL}/rest/v1/medidenta_fact_comments",
                headers={"apikey": KEY, "Accept": "application/json"},
                params={"select": "id", "limit": "0"},
            )
            return no_store({
                "collaboration_enabled": response.status_code == 200,
                "reason": "available" if response.status_code == 200 else "database_migration_pending",
            })
        except httpx.HTTPError:
            return no_store({"collaboration_enabled": False, "reason": "database_unavailable"})


@app.get("/api/v1/readiness")
async def readiness():
    if not IS_LIVE_CONFIGURED:
        return no_store({"ready": False, "reason": "Supabase setup pending"}, 503)
    try:
        await _bundle()
    except HTTPException:
        return no_store({"ready": False, "reason": "database not seeded or not reachable"}, 503)
    return no_store({"ready": True, "source": "Supabase PostgreSQL"})


@app.get("/medidenta-preview/catalog_snapshot.json")
async def catalog_json():
    return no_store((await _bundle())["catalog"])


@app.get("/medidenta-preview/clinical_review_drafts.json")
async def clinical_json():
    return no_store((await _bundle())["clinical"])


@app.get("/medidenta-preview/sync_status.json")
async def status_json():
    return no_store((await _bundle())["sync"])


@app.get("/medidenta-preview/review-auth-config.js")
async def client_config():
    public_url = URL if IS_LIVE_CONFIGURED else ""
    public_key = KEY if IS_LIVE_CONFIGURED else ""
    config = {
        "supabaseUrl": public_url,
        "publishableKey": public_key,
        "reviewApiBase": "/api/v1" if IS_LIVE_CONFIGURED else "",
    }
    return Response(
        "window.MEDIIDENTA_AUTH_CONFIG=Object.freeze(" +
        json.dumps(config, ensure_ascii=True, separators=(",", ":")) + ");\n",
        media_type="text/javascript",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )


@app.get("/api/v1/meta")
async def meta():
    b = await _bundle()
    return no_store({
        "products_published": len(b["catalog"]["products"]),
        "published_facts": len(b["clinical"]["reviewed_facts_list"]),
        "source_commit": b["sync"].get("source_commit"),
        "mode": b["sync"]["mode"],
        "last_catalog_import_at": b["sync"].get("last_catalog_import_at"),
        "last_ema_check_at": b["sync"].get("last_ema_check_at"),
        "release_phase": "alpha",
        "published_images": 0,
        "clinical_release_ready": False,
    })


@app.get("/api/v1/attributions")
async def attributions():
    return no_store({
        "sources": [
            {"source_key": "EMA_EPAR", "name": "European Medicines Agency (EMA), EPAR",
             "license_code": "EMA-REUSE-ATTRIBUTION",
             "homepage_url": "https://www.ema.europa.eu/en/medicines"},
            {"source_key": "EU_UR", "name": "European Commission – EU Union Register",
             "license_code": "CC-BY-4.0",
             "homepage_url": "https://ec.europa.eu/health/documents/community-register"},
        ]
    })


async def _live_search_rpc(q: str, limit: int, offset: int) -> list[dict]:
    """Read a bounded search page directly from PostgreSQL, not all snapshots."""
    params = {"p_query": q, "p_limit": limit, "p_offset": offset}
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        try:
            response = await client.get(
                f"{URL}/rest/v1/rpc/medidenta_search_catalog",
                headers={"apikey": KEY, "Accept": "application/json"},
                params=params)
            response.raise_for_status()
            rows = response.json()
            if not isinstance(rows, list) or len(rows) > limit:
                raise ValueError("Unexpected catalog search page")
            products = []
            for row in rows:
                if (not isinstance(row, dict) or not isinstance(row.get("payload"), dict)
                        or row.get("id") != row["payload"].get("id")):
                    raise ValueError("Invalid catalog product record")
                products.append(dict(row["payload"]))
            return products
        except (httpx.HTTPError, ValueError):
            # Never silently fall back to an old snapshot if live search fails.
            raise HTTPException(503, "Zentrale Medikamentensuche derzeit nicht verfügbar") from None


async def _live_product(product_id: str) -> dict | None:
    """Targeted PostgREST identity lookup; no full-catalog materialization."""
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        try:
            response = await client.get(
                f"{URL}/rest/v1/medidenta_catalog_products",
                headers={"apikey": KEY, "Accept": "application/json"},
                params={"select": "id,payload,source_commit", "id": "eq." + product_id, "limit": "1"})
            response.raise_for_status()
            items = response.json()
            if not isinstance(items, list) or len(items) > 1:
                raise ValueError("Unexpected product detail response")
            if not items:
                return None
            row = items[0]
            if (not isinstance(row, dict) or row.get("id") != product_id
                    or not isinstance(row.get("payload"), dict)
                    or row["payload"].get("id") != product_id):
                raise ValueError("Untrusted product identity")
            return {**row["payload"], "catalog_source_commit": row.get("source_commit")}
        except (httpx.HTTPError, ValueError):
            raise HTTPException(503, "Zentrale Produktdatenbank derzeit nicht verfügbar") from None


@app.get("/api/v1/search")
async def search(q: str = Query(min_length=2, max_length=100),
                 limit: int = Query(20, ge=1, le=50),
                 offset: int = Query(0, ge=0, le=100000)):
    if IS_LIVE_CONFIGURED:
        matches = await _live_search_rpc(q, limit, offset)
    else:
        import unicodedata
        def norm(s: str):
            s = unicodedata.normalize("NFKD", s.casefold())
            return "".join(c for c in s if not unicodedata.combining(c))
        terms = norm(q).split()
        products = (await _bundle())["catalog"]["products"]
        matches = [dict(p) for p in products
                   if all(t in norm(str(p.get("name",""))+" "+str(p.get("substances","")))
                          for t in terms)][offset:offset+limit]
    return no_store({"query": q, "results": matches, "offset": offset,
                     "limit": limit, "has_more": len(matches) == limit})


@app.get("/api/v1/products/{product_id}")
async def get_product(product_id: str):
    if not VALID_ID.fullmatch(product_id):
        raise HTTPException(400, "Ungültige Produkt-ID")
    if IS_LIVE_CONFIGURED:
        p = await _live_product(product_id)
    else:
        products = (await _bundle())["catalog"]["products"]
        p = next((x for x in products if x.get("id") == product_id), None)
    if not p:
        raise HTTPException(404, "Produktidentität nicht gefunden")
    subs = [{ "name": s.strip() } for s in p.get("substances","").split(",") if s.strip()]
    pms_sources, pms_unavailable = [], False
    if IS_LIVE_CONFIGURED:
        try:
            pms_sources = await _live_pms_sources(product_id, p)
        except HTTPException:
            # PMS Beta is an OPTIONAL extra source, not a reason to hide the
            # existing medicine identity and its reviewed clinical statements.
            log.warning("Additional PMS Beta metadata unavailable for product details")
            pms_unavailable = True
    return no_store({
        **p, "substances": subs, "facts": [], "pms_sources": pms_sources,
        "pms_unavailable": pms_unavailable,
        "presentations": [], "photos": [], "identifiers": [],
        "source": {"key": p.get("source_key"), "name": p.get("source_name"),
                   "url": p.get("source_url"), "license": p.get("license")},
        "clinical_content_complete": False,
        "clinical_notice": "Nur individuell geprüfte Fakten dürfen als fachlich freigegeben gekennzeichnet werden.",
    })


# Public PMS Beta metadata is a SEPARATE source catalog. Never conflate
# these IDs with licensed German packs, reviewed SmPCs or existing product IDs.
_PMS_TABLES = {"medidenta_pms_products", "medidenta_pms_fields", "medidenta_pms_identity_links"}


async def _pms_read(table: str, params: dict) -> list[dict]:
    if not IS_LIVE_CONFIGURED:
        raise HTTPException(503, "PMS Live-Alpha benötigt die zentrale Supabase-Datenbank")
    if table not in _PMS_TABLES:
        raise HTTPException(500, "Unzulässige PMS-Tabelle")
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        try:
            response = await client.get(f"{URL}/rest/v1/{table}",
                headers={"apikey": KEY, "Accept": "application/json"}, params=params)
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, list):
                raise ValueError("Unexpected PMS response")
            return data
        except (httpx.HTTPError, ValueError):
            raise HTTPException(503, "PMS-Quelldatenbank derzeit nicht verfügbar") from None


def _same_pms_brand_name(catalog_name: str, candidate_name: str) -> bool:
    """Discover related EMA Beta SOURCES, not asserted medicine identities.

    An exact product name or one followed by strength/form wording may be shown
    under the catalog's detail page. This match does not prove strength,
    formulation, substance, route, market or package equivalence.
    """
    import unicodedata
    def clean(value: str) -> str:
        return " ".join(unicodedata.normalize("NFKC", value).casefold().split())
    name, candidate = clean(catalog_name), clean(candidate_name)
    if len(name) < 4 or not name[0].isalnum():
        return False
    return (candidate == name or
            any(candidate.startswith(name + delim) for delim in (" ", " (")))


async def _live_pms_sources(product_id: str, product: dict) -> list[dict]:
    """Unreviewed EMA PMS data are PUBLIC and visible inside medicine details.

    Admin-confirmed identity links remain separately indicated, but are NOT a
    prerequisite for showing clearly labelled, name-associated Beta metadata.
    No clinical release status or product identity is inferred from a name.
    """
    catalog_name = product.get("name") or ""
    sources = {}
    # The optional, admin-only identity-link table must never be required
    # to display public EMA PMS Beta source data.
    try:
        rows = await _pms_read("medidenta_pms_identity_links", {
            "select": "pms_id,verified_at,confirmed",
            "catalog_product_id": "eq." + product_id,
            "order": "verified_at.desc", "limit": "12"})
    except HTTPException:
        rows = []  # Source-name association remains explicitly unconfirmed.
    for link in rows:
        pid = link.get("pms_id")
        if (not isinstance(pid, str) or
            not re.fullmatch(r"[A-Za-z0-9._-]{1,96}", pid) or
            link.get("confirmed") is not True):
            raise HTTPException(503, "PMS-Quellzuordnung enthält ungültige Daten")
        sources[pid] = ("ADMIN_CONFIRMED_SOURCE_LINK_ONLY", link.get("verified_at"))

    # Do not query the whole PMS table; use a bounded initial-name lookup.
    # A very broad name match is never presented as a confirmed relation.
    if (isinstance(catalog_name, str) and
        re.fullmatch(r"[A-Za-z0-9ÄÖÜäöüßÀ-ž][A-Za-z0-9ÄÖÜäöüßÀ-ž ._/-]{3,78}", catalog_name)):
        candidates = await _pms_read("medidenta_pms_products", {
            "select": "pms_id,display_name,source_url,bundle_sha256,imported_at",
            "display_name": "ilike." + catalog_name.strip() + "*",
            "order": "pms_id.asc", "limit": "30"})
        for entry in candidates:
            pid = entry.get("pms_id")
            if (isinstance(pid, str) and
                re.fullmatch(r"[A-Za-z0-9._-]{1,96}", pid) and
                _same_pms_brand_name(catalog_name, entry.get("display_name") or "")):
                sources.setdefault(pid, ("NAME_SIMILARITY_UNCONFIRMED", None))
    if len(sources) > 12:
        # Never omit an admin-confirmed link in favor of name similarity.
        confirmed = [k for k,v in sources.items() if v[0]=="ADMIN_CONFIRMED_SOURCE_LINK_ONLY"]
        unconfirmed = [k for k,v in sources.items() if v[0]!="ADMIN_CONFIRMED_SOURCE_LINK_ONLY"]
        chosen = confirmed + unconfirmed[:max(0,12-len(confirmed))]
        sources = {k:sources[k] for k in chosen}
    out = []
    for pid,(kind,at) in sources.items():
        products = await _pms_read("medidenta_pms_products", {
            "select": "pms_id,display_name,source_url,bundle_sha256,imported_at",
            "pms_id": "eq." + pid, "limit": "1"})
        if len(products) != 1 or products[0].get("pms_id") != pid:
            raise HTTPException(503, "Referenzierter EMA PMS-Quelldatensatz fehlt")
        fields = await _pms_read("medidenta_pms_fields", {
            "select": "id,pms_id,resource_type,resource_id,attribute_key,value_json,relation_status,source_url,statement_sha256,editorial_status,reviewed_at",
            "pms_id": "eq." + pid, "is_current": "eq.true",
            "order": "attribute_key.asc,id.asc", "limit": "500"})
        if len(fields) >= 500:
            raise HTTPException(503, "PMS-Felddaten unvollständig, bitte Quelle einzeln prüfen")
        if any(f.get("pms_id") != pid for f in fields):
            raise HTTPException(503, "PMS-Felddaten weisen falsche Quelle aus")
        out.append({
            "product": products[0], "fields": fields,
            "identity_association": kind, "link_verified_at": at,
            "clinical_release_ready": False,
            "display_notice": (
                "Admin-bestätigte Quellverknüpfung, keine klinische Produktfreigabe."
                if kind == "ADMIN_CONFIRMED_SOURCE_LINK_ONLY" else
                "Ungeprüfte Namensähnlichkeit: Stärke, Form, Wirkstoff und Land können abweichen."),
        })
    return out

class PmsIdentityLinkReviewInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    catalog_product_id: str = Field(min_length=1,max_length=100,pattern=r"^[A-Za-z0-9_-]+$")
    pms_id: str = Field(min_length=1,max_length=96,pattern=r"^[A-Za-z0-9._-]+$")
    catalog_source_commit: str = Field(pattern=r"^[0-9a-f]{40}$")
    pms_bundle_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    decision: str
    identifiers_checked: bool
    form_strength_checked: bool
    region_checked: bool
    evidence_note: str = Field(min_length=40,max_length=3000)


@app.post("/api/v1/pms/identity-links")
async def review_pms_identity_link(payload: PmsIdentityLinkReviewInput, request: Request):
    if not IS_LIVE_CONFIGURED:
        raise HTTPException(503,"PMS-Identitätsverknüpfung nur über Supabase")
    bearer=_user_bearer(request)
    if payload.decision not in ("confirm","revoke"):
        raise HTTPException(422,"Ungültige Identitätsentscheidung")
    if payload.decision=="confirm" and not (
        payload.identifiers_checked and payload.form_strength_checked and payload.region_checked):
        raise HTTPException(422,"Identifikatoren, Arzneiform/Stärke und Marktgebiet getrennt prüfen")
    result=await _supabase_rpc("medidenta_review_pms_identity_link",{
        "p_catalog_product_id":payload.catalog_product_id,
        "p_pms_id":payload.pms_id,
        "p_catalog_source_commit":payload.catalog_source_commit,
        "p_pms_bundle_sha256":payload.pms_bundle_sha256,
        "p_decision":payload.decision,
        "p_identifiers_checked":payload.identifiers_checked,
        "p_form_strength_checked":payload.form_strength_checked,
        "p_region_checked":payload.region_checked,
        "p_evidence_note":payload.evidence_note,
    },bearer)
    if (not isinstance(result,dict)
            or result.get("catalog_product_id")!=payload.catalog_product_id
            or result.get("pms_id")!=payload.pms_id
            or result.get("confirmed") != (payload.decision=="confirm")):
        raise HTTPException(503,"PMS-Zuordnungsbestätigung passt nicht zur Anfrage")
    return no_store([result])


@app.get("/api/v1/pms/products")
async def pms_products(q: str = Query("", max_length=80),
                       limit: int = Query(25,ge=1,le=50),
                       offset: int = Query(0,ge=0,le=100000)):
    if any(x in q for x in ("%", "*", ",", "(", ")")):
        raise HTTPException(400, "Ungültige Suchzeichen")
    params = {"select":"pms_id,display_name,source_url,bundle_sha256,imported_at",
              "order":"pms_id.asc","limit":str(limit),"offset":str(offset)}
    if q.strip():
        params["display_name"]="ilike.*"+q.strip()+"*"
    rows=await _pms_read("medidenta_pms_products",params)
    return no_store({
        "status":"PUBLIC_ALPHA_SOURCE_DATA_NOT_CLINICALLY_VALIDATED",
        "results":[{**item,"editorial_status":"draft_unreviewed_or_individually_reviewed",
                    "product_identity_verified":False} for item in rows],
        "returned":len(rows),"offset":offset,"limit":limit,
        "has_more":len(rows)==limit,
        "notice":"PMS-Produktidentität und Wirkstoffangaben noch nicht automatisch verifiziert."
    })


@app.get("/api/v1/pms/products/{pms_id}")
async def pms_product_detail(pms_id: str):
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,96}",pms_id):
        raise HTTPException(400,"Ungültige PMS-ID")
    product=await _pms_read("medidenta_pms_products",{
        "select":"pms_id,display_name,source_url,bundle_sha256,imported_at",
        "pms_id":"eq."+pms_id,"limit":"1"})
    if not product:
        raise HTTPException(404,"PMS-Quelle nicht im Alpha-Katalog")
    fields=await _pms_read("medidenta_pms_fields",{
        "select":"id,pms_id,resource_type,resource_id,attribute_key,value_json,relation_status,source_url,statement_sha256,editorial_status,reviewed_at",
        "pms_id":"eq."+pms_id,"is_current":"eq.true",
        "order":"attribute_key.asc,id.asc","limit":"500"})
    if len(fields)>=500:
        raise HTTPException(503,"PMS-Quelldaten unvollständig: zu viele Attribute")
    return no_store({
        "product":product[0],"fields":fields,"clinical_release_ready":False,
        "status":"PMS_BETA_SOURCE_REVIEW_ONLY",
        "notice":"Jede einzelne Angabe ist bis zur Adminprüfung unverifiziert; keine Dosierungs- oder Austauschhinweise."
    })


class PmsReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    field_id: str = Field(pattern=r"^pms_[0-9a-f]{40}$")
    statement_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    decision: str
    source_checked: bool
    notes: str = Field(default="",max_length=3000)


@app.post("/api/v1/pms/reviews")
async def submit_pms_review(payload: PmsReviewInput, request: Request):
    if not IS_LIVE_CONFIGURED:
        raise HTTPException(503,"PMS-Quellenprüfung noch nicht konfiguriert")
    bearer = _user_bearer(request)
    if payload.decision not in ("verified","needs_revision","rejected") or not payload.source_checked:
        raise HTTPException(422,"Ungültige PMS-Prüfentscheidung")
    if payload.decision!="verified" and len(payload.notes.strip())<10:
        raise HTTPException(422,"Für Ablehnung oder Überarbeitung ist eine Begründung erforderlich")
    result=await _supabase_rpc("medidenta_submit_pms_review",{
        "p_field_id":payload.field_id,
        "p_statement_sha256":payload.statement_sha256,
        "p_decision":payload.decision,
        "p_source_checked":payload.source_checked,
        "p_notes":payload.notes,
    },bearer)
    if result.get("id")!=payload.field_id or result.get("statement_sha256")!=payload.statement_sha256:
        raise HTTPException(503,"PMS-Prüfbestätigung hat eine unerwartete Version")
    return no_store([result])


@app.get("/api/v1/identify/{system}/{value}")
async def identify(system: str, value: str):
    if system.upper() not in ("PZN8", "GTIN") or not re.fullmatch(r"[0-9]{8,14}", value):
        raise HTTPException(400, "Ungültige Packungskennzeichnung")
    return no_store({"system": system.upper(), "value": value, "matches": [],
                     "notice": "Keine unabhängig geprüften Packungskennungen im aktuellen Entwicklungsbestand."})


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    fact_id: str = Field(pattern=r"^[A-Za-z0-9_-]{5,120}$")
    source_commit: str = Field(pattern=r"^[0-9a-f]{40}$")
    statement_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    decision: str
    source_checked: bool
    notes: str = Field(default="", max_length=3000)



def _user_bearer(request: Request, *, required: bool = True) -> str:
    """Forward only well-formed end-user JWTs, never server-admin credentials."""
    bearer = request.headers.get("authorization", "")
    if not bearer and not required:
        return ""
    if not re.fullmatch(r"Bearer [A-Za-z0-9._~+/-]{40,8192}", bearer):
        raise HTTPException(401, "Bitte mit deinem MediIdenta-Konto anmelden")
    return bearer


async def _supabase_rpc(name: str, args: dict, bearer: str):
    if not IS_LIVE_CONFIGURED:
        raise HTTPException(503, "Redaktionsfunktionen noch nicht initialisiert")
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        try:
            response = await client.post(
                f"{URL}/rest/v1/rpc/{name}",
                headers={"apikey": KEY, "Authorization": bearer,
                         "Content-Type": "application/json", "Accept": "application/json"},
                json=args,
            )
        except httpx.HTTPError:
            raise HTTPException(503, "Redaktionsdatenbank nicht erreichbar") from None
    if response.status_code in (401, 403):
        raise HTTPException(403, "Keine Berechtigung für diese Aktion")
    if response.status_code >= 400:
        raise HTTPException(409 if response.status_code in (400, 404) else 503,
                            "Aktion abgelehnt. Berechtigung oder Datenbankmigration überprüfen.")
    try:
        result = response.json()
        if not isinstance(result, dict) or not result.get("id", result.get("fact_id")):
            raise ValueError("Unexpected Supabase RPC response")
    except ValueError:
        raise HTTPException(503, "Prüfung der Datenbankbestätigung fehlgeschlagen") from None
    return result


class CommentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    body: str = Field(min_length=10, max_length=2000)


class ModeratorNoteInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_commit: str = Field(pattern=r"^[0-9a-f]{40}$")
    statement_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    assessment: str
    note: str = Field(min_length=10, max_length=3000)


class ModerateCommentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    approve: bool


@app.get("/api/v1/facts/{fact_id}/comments")
async def fact_comments(fact_id: str, request: Request):
    if not VALID_ID.fullmatch(fact_id):
        raise HTTPException(400, "Ungültige Text-ID")
    if not IS_LIVE_CONFIGURED:
        raise HTTPException(503, "Diskussion noch nicht verfügbar")
    bearer = _user_bearer(request, required=False)
    # RLS reveals visible comments to everyone, pending comments only to
    # author and moderators. Never include user UUID or e-mail in response.
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        try:
            response = await client.get(
                f"{URL}/rest/v1/medidenta_fact_comments",
                headers={"apikey": KEY, "Accept": "application/json",
                         **({"Authorization": bearer} if bearer else {})},
                params={"fact_id": "eq." + fact_id,
                        "select": "id,body,moderation_status,created_at",
                        "order": "created_at.desc", "limit": "40"},
            )
        except httpx.HTTPError:
            raise HTTPException(503, "Kommentare derzeit nicht erreichbar") from None
    if response.status_code in (401, 403):
        raise HTTPException(403, "Zugriff auf Kommentare nicht erlaubt")
    if response.status_code >= 400:
        raise HTTPException(503, "Kommentarfunktion noch nicht aktiviert") from None
    try:
        comments = response.json()
        if not isinstance(comments, list):
            raise ValueError("Bad response")
    except ValueError:
        raise HTTPException(503, "Kommentarantwort ungültig") from None
    return no_store({"comments": comments})


@app.post("/api/v1/facts/{fact_id}/comments")
async def post_fact_comment(fact_id: str, payload: CommentInput, request: Request):
    if not VALID_ID.fullmatch(fact_id):
        raise HTTPException(400, "Ungültige Text-ID")
    result = await _supabase_rpc("medidenta_post_comment",
                     {"p_fact_id": fact_id, "p_body": payload.body},
                     _user_bearer(request))
    return no_store(result)


@app.get("/api/v1/facts/{fact_id}/moderator-notes")
async def fact_moderator_notes(fact_id: str, request: Request):
    if not VALID_ID.fullmatch(fact_id):
        raise HTTPException(400, "Ungültige Text-ID")
    bearer = _user_bearer(request)
    if not IS_LIVE_CONFIGURED:
        raise HTTPException(503, "Interne Prüfung noch nicht verfügbar")
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        try:
            response = await client.get(
                f"{URL}/rest/v1/medidenta_moderator_notes",
                headers={"apikey": KEY, "Authorization": bearer,
                         "Accept": "application/json"},
                params={"fact_id": "eq." + fact_id,
                        "select": "id,source_commit,statement_sha256,assessment,note,created_at",
                        "order": "created_at.desc", "limit": "20"},
            )
        except httpx.HTTPError:
            raise HTTPException(503, "Interne Notizen nicht erreichbar") from None
    if response.status_code in (401,403):
        raise HTTPException(403, "Kein Zugriff auf interne Notizen")
    if response.status_code >= 400:
        raise HTTPException(503, "Moderatorfunktion noch nicht eingerichtet") from None
    try:
        notes = response.json()
        if not isinstance(notes, list):
            raise ValueError("Invalid notes response")
    except ValueError:
        raise HTTPException(503, "Notizantwort ungültig") from None
    return no_store({"notes": notes})


@app.post("/api/v1/facts/{fact_id}/moderator-notes")
async def add_note(fact_id: str, payload: ModeratorNoteInput, request: Request):
    if not VALID_ID.fullmatch(fact_id):
        raise HTTPException(400, "Ungültige Text-ID")
    if payload.assessment not in ("checked", "needs_revision", "source_question"):
        raise HTTPException(422, "Unbekanntes Prüfmerkmal")
    result = await _supabase_rpc("medidenta_add_moderator_note",
                     {"p_fact_id": fact_id, "p_source_commit": payload.source_commit,
                      "p_statement_sha256": payload.statement_sha256,
                      "p_assessment": payload.assessment, "p_note": payload.note}, _user_bearer(request))
    return no_store(result)


@app.post("/api/v1/comments/{comment_id}/moderate")
async def moderate_comment(comment_id: str, payload: ModerateCommentInput, request: Request):
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", comment_id):
        raise HTTPException(400, "Ungültige Kommentar-ID")
    result = await _supabase_rpc("medidenta_moderate_comment",
                     {"p_comment_id": comment_id, "p_approve": payload.approve},
                     _user_bearer(request))
    return no_store(result)


class RoleAssignmentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: str = Field(pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
    role: str


@app.post("/api/v1/admin/roles")
async def assign_role(payload: RoleAssignmentInput, request: Request):
    if payload.role not in ("user", "moderator", "admin"):
        raise HTTPException(422, "Ungültige Benutzerrolle")
    result = await _supabase_rpc("medidenta_admin_set_role",
            {"p_user_id": payload.user_id, "p_role": payload.role},
            _user_bearer(request))
    return no_store({"user_id": result.get("id"), "role": result.get("role")})


@app.post("/api/v1/reviews")
async def submit_review(payload: ReviewInput, request: Request):
    if not IS_LIVE_CONFIGURED:
        raise HTTPException(503, "Supabase review backend not configured")
    bearer = _user_bearer(request)
    # Defense in depth: old Supabase installations still permit 'reviewer' in
    # their legacy RPC. Never forward a non-admin review even before migration.
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        try:
            rights = await client.get(
                f"{URL}/rest/v1/medidenta_reviewer_roles",
                headers={"apikey": KEY, "Authorization": bearer},
                params={"select": "role", "limit": "1"},
            )
            if rights.status_code != 200 or not isinstance(rights.json(), list) or                not any(x.get("role") == "admin" for x in rights.json()):
                raise HTTPException(403, "Nur Administratoren dürfen Fachtexte freigeben")
        except httpx.HTTPError:
            raise HTTPException(503, "Adminberechtigung nicht überprüfbar") from None
    if payload.decision not in ("verified", "needs_revision", "rejected"):
        raise HTTPException(422, "Unknown review decision")
    # User JWT is forwarded to PostgREST. PostgreSQL auth.uid() + reviewer role
    # and the exact current fact hash are verified in the single atomic RPC.
    args = {
        "p_fact_id": payload.fact_id,
        "p_source_commit": payload.source_commit,
        "p_statement_sha256": payload.statement_sha256,
        "p_decision": payload.decision,
        "p_source_checked": payload.source_checked,
        "p_notes": payload.notes,
    }
    async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
        try:
            response = await client.post(
                f"{URL}/rest/v1/rpc/medidenta_submit_clinical_review",
                headers={"apikey": KEY, "Authorization": bearer,
                         "Content-Type": "application/json", "Accept": "application/json"},
                json=args,
            )
        except httpx.HTTPError:
            raise HTTPException(503, "Prüfdatenbank nicht erreichbar") from None
    if response.status_code in (401, 403):
        raise HTTPException(403, "Authentifizierung oder Prüferberechtigung abgelehnt")
    if response.status_code >= 400:
        # Do NOT return raw PostgREST/SQL error text containing private details.
        raise HTTPException(409 if response.status_code == 400 else 503,
                            "Prüfung nicht übertragbar: Datenstand, Berechtigung und Quelle kontrollieren")
    try:
        result = response.json()
        if not isinstance(result, dict) or result.get("fact_id") != payload.fact_id or \
           result.get("source_commit") != payload.source_commit or \
           result.get("statement_sha256") != payload.statement_sha256:
            raise ValueError("Unexpected RPC return")
    except ValueError:
        raise HTTPException(503, "Datenbankbestätigung nicht verifizierbar") from None
    return no_store([result])


@app.get("/")
async def root():
    return RedirectResponse("/medidenta-preview/", status_code=307)


@app.get("/robots.txt")
async def robots():
    return Response("User-agent: *\nDisallow: /\n", media_type="text/plain")


# This mount MUST stay last, so verified database routes take precedence.
app.mount("/medidenta-preview", StaticFiles(directory=SITE, html=True), name="web")
