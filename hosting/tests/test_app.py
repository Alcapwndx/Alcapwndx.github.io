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
        with patch.object(main,"IS_LIVE_CONFIGURED",True),patch.object(main,"_read_table",side_effect=fake_read):
            meta=client.get("/medidenta-preview/sync_status.json").json()
            self.assertEqual(meta["mode"],"LIVE_SUPABASE")
            self.assertEqual((meta["identity_count"],meta["draft_count"],meta["reviewed_count"]),(1,1,1))
            reviewed=client.get("/medidenta-preview/clinical_review_drafts.json").json()
            self.assertEqual(reviewed["reviewed_facts_list"][0]["editorial_status"],"clinically_reviewed")
            self.assertEqual(reviewed["facts"][0]["editorial_status"],"draft_unreviewed")
            self.assertFalse(reviewed["clinical_release_ready"])
            self.assertEqual(client.get("/api/v1/search?q=approved").json()["results"][0]["id"],"p1")
            self.assertEqual(client.get("/api/v1/products/p1").json()["id"],"p1")
            self.assertEqual(client.get("/api/v1/readiness").json()["ready"],True)

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


if __name__=="__main__":unittest.main()
