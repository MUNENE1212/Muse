import asyncio
import os
import tempfile

from unstructured.partition.auto import partition


async def parse_document(file_bytes: bytes, filename: str) -> dict:
    try:
        ext = os.path.splitext(filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            tmp_file.write(file_bytes)
            tmp_path = tmp_file.name

        try:
            elements = await asyncio.to_thread(partition, filename=tmp_path)
            clean_text = "\n\n".join(
                [str(el) for el in elements if str(el).strip()]
            )

            return {
                "status": "success",
                "type": "document",
                "title": filename,
                "author": "Extracted from Document",
                "content": clean_text[:50000],
                "filename": filename,
            }
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    except Exception as exc:
        return {
            "status": "error",
            "type": "document",
            "message": f"Document Parsing Failed: {exc}",
            "filename": filename,
        }
