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


async def _read_table(table: str, *, columns: str, limit: int = MAX_LIST):
    if not IS_LIVE_CONFIGURED:
        raise HTTPException(status_code=503, detail="Supabase not yet configured")
    params = {"select": columns, "order": "id.asc", "limit": str(limit)}
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
    products = await _read_table("medidenta_catalog_products", columns="id,payload")
    facts = await _read_table("medidenta_catalog_facts",
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


@app.get("/api/v1/search")
async def search(q: str = Query(min_length=2, max_length=100), limit: int = Query(20, ge=1, le=50)):
    import unicodedata
    def norm(s: str):
        s = unicodedata.normalize("NFKD", s.casefold())
        return "".join(c for c in s if not unicodedata.combining(c))
    terms = norm(q).split()
    products = (await _bundle())["catalog"]["products"]
    matches = [dict(p) for p in products
               if all(t in norm(str(p.get("name", ""))+" "+str(p.get("substances", "")))
                      for t in terms)][:limit]
    return no_store({"query": q, "results": matches})


@app.get("/api/v1/products/{product_id}")
async def get_product(product_id: str):
    if not VALID_ID.fullmatch(product_id):
        raise HTTPException(400, "Ungültige Produkt-ID")
    products = (await _bundle())["catalog"]["products"]
    p = next((x for x in products if x.get("id") == product_id), None)
    if not p:
        raise HTTPException(404, "Produktidentität nicht gefunden")
    subs = [{"name": s.strip()} for s in p.get("substances", "").split(",") if s.strip()]
    return no_store({
        **p, "substances": subs, "facts": [],
        "presentations": [], "photos": [], "identifiers": [],
        "source": {"key": p.get("source_key"), "name": p.get("source_name"),
                   "url": p.get("source_url"), "license": p.get("license")},
        "clinical_content_complete": False,
        "clinical_notice": "Nur individuell geprüfte Fakten dürfen als fachlich freigegeben gekennzeichnet werden.",
    })


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


@app.post("/api/v1/facts/{fact_id}/moderator-notes")
async def add_note(fact_id: str, payload: ModeratorNoteInput, request: Request):
    if not VALID_ID.fullmatch(fact_id):
        raise HTTPException(400, "Ungültige Text-ID")
    if payload.assessment not in ("checked", "needs_revision", "source_question"):
        raise HTTPException(422, "Unbekanntes Prüfmerkmal")
    result = await _supabase_rpc("medidenta_add_moderator_note",
                     {"p_fact_id": fact_id, "p_assessment": payload.assessment,
                      "p_note": payload.note}, _user_bearer(request))
    return no_store(result)


@app.post("/api/v1/comments/{comment_id}/moderate")
async def moderate_comment(comment_id: str, payload: ModerateCommentInput, request: Request):
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", comment_id):
        raise HTTPException(400, "Ungültige Kommentar-ID")
    result = await _supabase_rpc("medidenta_moderate_comment",
                     {"p_comment_id": comment_id, "p_approve": payload.approve},
                     _user_bearer(request))
    return no_store(result)


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
