"""
main.py
------------------------------------------------------------------
FastAPI backend for the Linear Algebra Image Encryption project.

Endpoints
    POST /encrypt      image + key  -> encrypted PNG
    POST /decrypt      image + key  -> decrypted PNG
    POST /matrix-info  key          -> determinant + modular inverse

The heavy linear algebra lives in math_engine.py.
"""

import io
import json

import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image

from math_engine import (
    validate_key_matrix,
    matrix_details,
    encrypt_image,
    decrypt_image,
)

app = FastAPI(title="Linear Algebra Image Encryption")

# Allow the Vite dev server to call us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def _load_image(contents: bytes, color: bool) -> np.ndarray:
    """Decode uploaded bytes into a numpy array.

    color=True  -> RGB (3 channels, each encrypted independently)
    color=False -> grayscale (single channel)
    """
    img = Image.open(io.BytesIO(contents))
    img = img.convert("RGB" if color else "L")
    return np.array(img)


def _image_to_response(image_array: np.ndarray) -> StreamingResponse:
    img = Image.fromarray(image_array)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="image/png")


def _parse_key(matrix: str):
    try:
        matrix_data = json.loads(matrix)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Key matrix is not valid JSON.")

    is_valid, result = validate_key_matrix(matrix_data)
    if not is_valid:
        raise HTTPException(status_code=400, detail=result)
    return result


# ----------------------------------------------------------------------
# Endpoints
# ----------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "service": "image-encryption"}


@app.post("/encrypt")
async def encrypt(
    file: UploadFile = File(...),
    matrix: str = Form(...),
    color: bool = Form(False),
):
    K = _parse_key(matrix)
    contents = await file.read()
    image_array = _load_image(contents, color)
    encrypted = encrypt_image(image_array, K)
    return _image_to_response(encrypted)


@app.post("/decrypt")
async def decrypt(
    file: UploadFile = File(...),
    matrix: str = Form(...),
    color: bool = Form(False),
):
    K = _parse_key(matrix)
    contents = await file.read()
    image_array = _load_image(contents, color)
    decrypted = decrypt_image(image_array, K)
    return _image_to_response(decrypted)


@app.post("/matrix-info")
async def matrix_info(matrix: str = Form(...)):
    K = _parse_key(matrix)
    return matrix_details(K)
