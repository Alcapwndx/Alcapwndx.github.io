"""No-external-account API verification for staging Render deployment."""
import json
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from hosting import main

client=TestClient(main.app)


class AppTests(unittest.TestCase):
    def test_staging_without_keys_is_honest_and_operational(self):
        with patch.object(main, "IS_LIVE_CONFIGURED", False),patch.object(main, "PARTIAL_CONFIG", False):
            h=client.get("/api/v1/health")
            self.assertEqual(h.status_code,200)
            self.assertFalse(h.json()["supabase_configured"])
            self.assertFalse(h.json()["clinical_app_release_ready"])
            self.assertEqual(client.get("/api/v1/readiness").status_code,503)
            cat=client.get("/medidenta-preview/catalog_snapshot.json")
            self.assertGreater(len(cat.json()["products"]),20)
            self.assertFalse(cat.json()["clinical_release_ready"])
            self.assertEqual(cat.headers["cache-control"],"no-store")
            snap=client.get("/medidenta-preview/sync_status.json").json()
            self.assertEqual(snap["mode"],"STATIC_DEVELOPMENT_PREVIEW")
            cfg=client.get("/medidenta-preview/review-auth-config.js").text
            self.assertIn('reviewApiBase',cfg)
            self.assertIn('"supabaseUrl":""',cfg)
            self.assertNotIn("sb_secret_",cfg)
            self.assertNotIn("service_role",cfg)
            self.assertEqual(client.post("/api/v1/reviews",json={}).status_code,422)

    def test_assets_and_redirect(self):
        self.assertEqual(client.get("/",follow_redirects=False).status_code,307)
        self.assertEqual(client.get("/medidenta-preview/").status_code,200)
        self.assertIn("review-auth.js",client.get("/medidenta-preview/").text)
        self.assertEqual(client.get("/medidenta-preview/app.js").status_code,200)
        self.assertEqual(client.get("/robots.txt").status_code,200)

    def test_live_postgres_data_is_not_mixed_with_static_demo(self):
        async def fake_read(table, *, columns, limit=1000):
            if table == "medidenta_catalog_metadata":
                return [{"singleton":1,"source_commit":"a"*40,"source_date":"2026-11-09T16:00:00Z","source_schema_version":5}]
            if table == "medidenta_catalog_products":
                return [{"id":"p1","payload":{"id":"p1","name":"Approved only in test","substances":"stoff x","source_key":"EMA_EPAR"}}]
            if table == "medidenta_catalog_facts":
                return [{"id":"f1","editorial_status":"clinically_reviewed","reviewed_at":"2026-11-09T16:00:00Z",
                         "payload":{"id":"f1","target_type":"product","target_name":"Approved only in test","fact_type":"summary","content_text":"Mock fact, not a real medicine.","linked_product_ids":["p1"],"editorial_status":"draft_unreviewed"}},
                        {"id":"f2","editorial_status":"draft_unreviewed","reviewed_at":None,
                         "payload":{"id":"f2","target_type":"product","target_name":"Approved only in test","fact_type":"summary","content_text":"Unreviewed mock fact.","linked_product_ids":["p1"],"editorial_status":"draft_unreviewed"}}]
            raise ValueError(table)
        async def fake_search(q, limit, offset):
            assert q == "approved"
            assert offset == 0
            return [{"id":"p1","name":"Approved only in test","substances":"stoff x","source_key":"EMA_EPAR"}]
        async def fake_product(pid):
            assert pid == "p1"
            return {"id":"p1","name":"Approved only in test","substances":"stoff x","source_key":"EMA_EPAR"}
        with patch.object(main,"IS_LIVE_CONFIGURED",True),patch.object(main,"_read_table",side_effect=fake_read),patch.object(main,"_live_search_rpc",side_effect=fake_search),patch.object(main,"_live_product",side_effect=fake_product),patch.object(main,"_live_verified_pms_links",return_value=[]):
            meta=client.get("/medidenta-preview/sync_status.json").json()
            self.assertEqual(meta["mode"],"LIVE_SUPABASE")
            self.assertEqual(meta["release_phase"], "alpha")
            self.assertFalse(meta["beta_gate"]["ready"])
            self.assertIsNone(meta["last_ema_check_at"])
            self.assertEqual((meta["identity_count"],meta["draft_count"],meta["reviewed_count"]),(1,1,1))
            reviewed=client.get("/medidenta-preview/clinical_review_drafts.json").json()
            self.assertEqual(reviewed["reviewed_facts_list"][0]["editorial_status"],"clinically_reviewed")
            self.assertEqual(reviewed["facts"][0]["editorial_status"],"draft_unreviewed")
            self.assertFalse(reviewed["clinical_release_ready"])
            self.assertEqual(client.get("/api/v1/search?q=approved").json()["results"][0]["id"],"p1")
            self.assertEqual(client.get("/api/v1/products/p1").json()["id"],"p1")
            self.assertEqual(client.get("/api/v1/readiness").json()["ready"],True)

    def test_alpha_permissions_fail_closed_without_login(self):
        with patch.object(main, "IS_LIVE_CONFIGURED", True):
            p = {"body": "Eine sachliche Quellenrückfrage für Testdaten"}
            self.assertEqual(
                client.post("/api/v1/facts/legacy-v05-001/comments", json=p).status_code, 401)
            self.assertEqual(
                client.post("/api/v1/facts/legacy-v05-001/moderator-notes",
                            json={"source_commit": "a"*40, "statement_sha256": "b"*64,
                                  "assessment": "checked", "note": "Synthetische Notiz"}).status_code, 401)
            self.assertEqual(
                client.get("/api/v1/facts/legacy-v05-001/moderator-notes").status_code, 401)
            self.assertEqual(
                client.post("/api/v1/comments/11111111-1111-4111-8111-111111111111/moderate",
                            json={"approve": True}).status_code, 401)
            self.assertEqual(
                client.post("/api/v1/admin/roles",
                            json={"user_id": "11111111-1111-4111-8111-111111111111",
                                  "role": "moderator"}).status_code, 401)
            self.assertEqual(
                client.post("/api/v1/admin/roles",
                            json={"user_id": "11111111-1111-4111-8111-111111111111",
                                  "role": "god"}).status_code, 422)

    def test_no_fake_live_backend_or_unauthenticated_reviews(self):
        with patch.object(main,"IS_LIVE_CONFIGURED",True):
            payload={"fact_id":"legacy-v05-001","source_commit":"a"*40,"statement_sha256":"b"*64,
                     "decision":"verified","source_checked":True,"notes":""}
            self.assertEqual(client.post("/api/v1/reviews",json=payload).status_code,401)
            self.assertEqual(client.post("/api/v1/reviews",headers={"Authorization":"Bearer fake"},
                                         json=payload).status_code,401)
            self.assertEqual(client.post("/api/v1/reviews",headers={"Authorization":"Bearer "+"a"*80},
                      json={**payload,"reviewer_id":"fake"}).status_code,422)
        with patch.object(main,"IS_LIVE_CONFIGURED",False),patch.object(main,"PARTIAL_CONFIG",True):
            self.assertEqual(client.get("/medidenta-preview/catalog_snapshot.json").status_code,503)


    def test_pms_endpoints_fail_closed_without_live_database(self):
        with patch.object(main,"IS_LIVE_CONFIGURED",False):
            self.assertEqual(client.get("/api/v1/pms/products").status_code,503)
            self.assertEqual(client.get("/api/v1/pms/products/600000000000").status_code,503)
            payload={"field_id":"pms_"+"a"*40,"statement_sha256":"b"*64,
                     "decision":"verified","source_checked":True,"notes":""}
            self.assertEqual(client.post("/api/v1/pms/reviews",json=payload).status_code,503)

    def test_pms_public_data_kept_separate_and_source_bound(self):
        async def fake_pms(table,params):
            if table=="medidenta_pms_products":
                return [{"pms_id":"600000000000","display_name":"Synthetic PMS sample",
                         "source_url":"https://api.pms.ema.europa.eu/public/v1/MedicinalProductDefinition/600000000000/$everything",
                         "bundle_sha256":"a"*64,"imported_at":"2026-11-10T01:00:00Z"}]
            if table=="medidenta_pms_fields":
                return [{"id":"pms_"+"a"*40,"pms_id":"600000000000",
                         "attribute_key":"strength_raw_no_dose_conversion",
                         "value_json":{"numerator":{"value":5,"unit":"mg"}},
                         "resource_type":"Ingredient","resource_id":"i1",
                         "relation_status":"BUNDLE_RELATED_REVIEW_REQUIRED",
                         "statement_sha256":"b"*64,"editorial_status":"draft_unreviewed",
                         "reviewed_at":None}]
            raise AssertionError(table)
        with patch.object(main,"IS_LIVE_CONFIGURED",True),patch.object(main,"_pms_read",side_effect=fake_pms):
            lst=client.get("/api/v1/pms/products").json()
            self.assertEqual(lst["results"][0]["product_identity_verified"],False)
            self.assertIn("NOT_CLINICALLY_VALIDATED",lst["status"])
            detail=client.get("/api/v1/pms/products/600000000000").json()
            self.assertEqual(len(detail["fields"]),1)
            self.assertEqual(detail["fields"][0]["editorial_status"],"draft_unreviewed")
            self.assertEqual(detail["fields"][0]["value_json"]["numerator"]["unit"],"mg")
            self.assertFalse(detail["clinical_release_ready"])
            self.assertEqual(client.get("/api/v1/pms/products?q=*").status_code,400)

    def test_pms_review_requires_admin_rpc_and_exact_current_hash(self):
        payload={"field_id":"pms_"+"a"*40,"statement_sha256":"b"*64,
                 "decision":"verified","source_checked":True,"notes":""}
        with patch.object(main,"IS_LIVE_CONFIGURED",True):
            self.assertEqual(client.post("/api/v1/pms/reviews",json=payload).status_code,401)
            async def rpc(name,args,bearer):
                self.assertEqual(name,"medidenta_submit_pms_review")
                self.assertEqual(args["p_statement_sha256"],"b"*64)
                self.assertTrue(bearer.startswith("Bearer "))
                return {"id":"pms_"+"a"*40,"statement_sha256":"b"*64,
                        "editorial_status":"clinically_reviewed"}
            with patch.object(main,"_supabase_rpc",side_effect=rpc):
                approved=client.post("/api/v1/pms/reviews",json=payload,
                    headers={"Authorization":"Bearer "+"c"*80})
                self.assertEqual(approved.status_code,200)
                self.assertEqual(approved.json()[0]["editorial_status"],"clinically_reviewed")

    def test_postgres_catalog_loading_is_paged_not_cut_at_1000(self):
        import asyncio
        async def fake_read(table,*,columns,limit=1000,offset=0):
            self.assertEqual(limit,900)
            if offset==0:
                return [{"id":str(i)} for i in range(900)]
            if offset==900:
                return [{"id":"900"}]
            raise AssertionError("unexpected pagination")
        with patch.object(main,"_read_table",side_effect=fake_read):
            result=asyncio.run(main._read_all_table("medidenta_catalog_products",columns="id"))
            self.assertEqual(len(result),901)


    def test_live_search_and_product_do_not_fetch_whole_catalog(self):
        async def fake_search(q,limit,offset):
            self.assertEqual((q,limit,offset),("Toujeo",20,20))
            return [{"id":"p1","name":"Toujeo test","substances":"insulin glargin"}]
        async def fake_product(pid):
            self.assertEqual(pid,"p1")
            return {"id":"p1","name":"Toujeo test","substances":"insulin glargin"}
        with patch.object(main,"IS_LIVE_CONFIGURED",True),\
             patch.object(main,"_bundle",side_effect=AssertionError("full catalog fetch forbidden")),\
             patch.object(main,"_live_search_rpc",side_effect=fake_search),\
             patch.object(main,"_live_product",side_effect=fake_product),patch.object(main,"_live_verified_pms_links",return_value=[]):
            search_result=client.get("/api/v1/search?q=Toujeo&offset=20").json()
            self.assertEqual(search_result["results"][0]["id"],"p1")
            self.assertEqual(search_result["offset"],20)
            self.assertEqual(client.get("/api/v1/products/p1").json()["name"],"Toujeo test")

    def test_live_catalog_search_failure_does_not_fallback_to_static_snapshot(self):
        async def fail(*args):
            raise main.HTTPException(503,"Search index unavailable")
        with patch.object(main,"IS_LIVE_CONFIGURED",True),\
             patch.object(main,"_bundle",side_effect=AssertionError("stale fallback forbidden")),\
             patch.object(main,"_live_search_rpc",side_effect=fail):
            self.assertEqual(client.get("/api/v1/search?q=apixaban").status_code,503)


    def test_only_confirmed_pms_sources_share_a_medication_detail(self):
        async def product(pid):
            return {"id":pid,"name":"Test medicine","substances":"Sample",
                    "catalog_source_commit":"a"*40}
        async def read(table,params):
            if table=="medidenta_pms_identity_links":
                self.assertEqual(params["catalog_product_id"],"eq.p1")
                return [{"pms_id":"600000000000","verified_at":"2026-11-10T06:00:00Z","confirmed":True}]
            if table=="medidenta_pms_products":
                return [{"pms_id":"600000000000","display_name":"Source product",
                         "source_url":"https://api.pms.ema.europa.eu/public/v1/MedicinalProductDefinition/600000000000/$everything",
                         "bundle_sha256":"b"*64,"imported_at":"2026-11-10T06:00:00Z"}]
            if table=="medidenta_pms_fields":
                return [{"id":"pms_"+"a"*40,"pms_id":"600000000000",
                         "attribute_key":"strength_raw_no_dose_conversion",
                         "value_json":{"presentationRatio":{"numerator":{"value":5,"unit":"mg"},
                         "denominator":{"value":1,"unit":"tablet"}}},
                         "editorial_status":"draft_unreviewed"}]
            raise AssertionError(table)
        with patch.object(main,"IS_LIVE_CONFIGURED",True),\
             patch.object(main,"_live_product",side_effect=product),\
             patch.object(main,"_pms_read",side_effect=read):
            record=client.get("/api/v1/products/p1").json()
            self.assertEqual(len(record["pms_sources"]),1)
            self.assertEqual(record["pms_sources"][0]["product"]["pms_id"],"600000000000")
            self.assertEqual(record["pms_sources"][0]["fields"][0]["editorial_status"],"draft_unreviewed")
            self.assertFalse(record["pms_sources"][0]["clinical_release_ready"])
            self.assertFalse(record["clinical_content_complete"])

    def test_unverified_source_is_never_auto_matched_by_name(self):
        async def product(pid):
            return {"id":pid,"name":"Same common name","substances":"Test",
                    "catalog_source_commit":"a"*40}
        async def no_links(table,params):
            self.assertEqual(table,"medidenta_pms_identity_links")
            return []
        with patch.object(main,"IS_LIVE_CONFIGURED",True),\
             patch.object(main,"_live_product",side_effect=product),\
             patch.object(main,"_pms_read",side_effect=no_links):
            self.assertEqual(client.get("/api/v1/products/p1").json()["pms_sources"],[])

    def test_pms_identity_link_admin_rpc_requires_current_sources_and_jwt(self):
        body={
            "catalog_product_id":"p1","pms_id":"600000000000",
            "catalog_source_commit":"a"*40,"pms_bundle_sha256":"b"*64,
            "decision":"confirm","identifiers_checked":True,
            "form_strength_checked":True,"region_checked":True,
            "evidence_note":"Both official source identifiers, strength and region checked on record."
        }
        with patch.object(main,"IS_LIVE_CONFIGURED",True):
            self.assertEqual(client.post("/api/v1/pms/identity-links",json=body).status_code,401)
            async def rpc(name,args,bearer):
                self.assertEqual(name,"medidenta_review_pms_identity_link")
                self.assertEqual(args["p_catalog_source_commit"],"a"*40)
                self.assertEqual(args["p_pms_bundle_sha256"],"b"*64)
                self.assertTrue(args["p_region_checked"])
                return {"catalog_product_id":"p1","pms_id":"600000000000","confirmed":True}
            with patch.object(main,"_supabase_rpc",side_effect=rpc):
                result=client.post("/api/v1/pms/identity-links",
                    headers={"Authorization":"Bearer "+"c"*80},json=body)
                self.assertEqual(result.status_code,200)
                self.assertTrue(result.json()[0]["confirmed"])
                self.assertEqual(client.post("/api/v1/pms/identity-links",
                    headers={"Authorization":"Bearer "+"c"*80},
                    json={**body,"region_checked":False}).status_code,422)



if __name__=="__main__":unittest.main()
