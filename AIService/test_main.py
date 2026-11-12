import io
import os
import unittest

from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from main import health_check, read_resume, require_service_key


class AIServiceSecurityTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.previous_key = os.environ.get("AI_SERVICE_API_KEY")
        os.environ["AI_SERVICE_API_KEY"] = "test-shared-key"

    def tearDown(self):
        if self.previous_key is None:
            os.environ.pop("AI_SERVICE_API_KEY", None)
        else:
            os.environ["AI_SERVICE_API_KEY"] = self.previous_key

    async def test_health_check_reports_ok(self):
        self.assertEqual(await health_check(), {"status": "ok"})

    async def test_service_key_rejects_wrong_value(self):
        with self.assertRaises(HTTPException) as error:
            await require_service_key("wrong-key")
        self.assertEqual(error.exception.status_code, 403)

    async def test_service_key_accepts_matching_value(self):
        await require_service_key("test-shared-key")

    async def test_resume_limit_rejects_oversized_upload(self):
        upload = UploadFile(
            filename="resume.pdf",
            file=io.BytesIO(b"x" * (10 * 1024 * 1024 + 1)),
            headers=Headers({"content-type": "application/pdf"}),
        )
        with self.assertRaises(HTTPException) as error:
            await read_resume(upload)
        self.assertEqual(error.exception.status_code, 413)
