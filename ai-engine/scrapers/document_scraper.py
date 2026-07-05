import asyncio
import os
import tempfile

# Check if unstructured is available
UNSTRUCTURED_AVAILABLE = False
try:
    from unstructured.partition.auto import partition
    UNSTRUCTURED_AVAILABLE = True
except ImportError:
    pass


async def parse_document(file_bytes: bytes, filename: str) -> dict:
    # Check if document parsing is enabled via environment variable
    if os.getenv("ENABLE_UPLOADS", "true").lower() != "true":
        return {
            "status": "error",
            "type": "document",
            "message": "Document uploads are disabled. Set ENABLE_UPLOADS=true to enable.",
            "filename": filename,
            "error_code": "feature_disabled",
        }

    # Check if unstructured is available
    if not UNSTRUCTURED_AVAILABLE:
        return {
            "status": "error",
            "type": "document",
            "message": "Unstructured is not installed. Document parsing requires the unstructured library.",
            "filename": filename,
            "error_code": "unstructured_not_installed",
        }

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
