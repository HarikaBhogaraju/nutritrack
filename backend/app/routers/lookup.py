"""Barcode + photo nutrition lookups."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from .. import schemas
from ..auth import CurrentUser
from ..barcode_service import lookup_barcode
from ..claude_service import estimate_from_photo

router = APIRouter()


@router.get("/barcode/{barcode}", response_model=schemas.BarcodeLookupResponse)
def get_by_barcode(barcode: str, _: CurrentUser):
    estimate = lookup_barcode(barcode)
    if estimate is None:
        return schemas.BarcodeLookupResponse(found=False)
    return schemas.BarcodeLookupResponse(found=True, estimate=estimate, raw_name=estimate.name)


@router.post("/photo", response_model=schemas.PhotoLookupResponse)
async def get_by_photo(_: CurrentUser, file: Annotated[UploadFile, File(...)]):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        raise HTTPException(status_code=400, detail="Unsupported image type")
    data = await file.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 8MB)")

    try:
        prose, estimate = estimate_from_photo(data, file.content_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Claude vision request failed: {exc}")

    return schemas.PhotoLookupResponse(estimate=estimate, description=prose)
