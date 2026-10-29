# Image Encryption using Matrix Transformations

A full-stack educational web app that demonstrates a real-world application of
**linear algebra**: encrypting and decrypting digital images using matrix
multiplication, determinants, and modular inverse matrices.

An image is just a grid of pixel intensities — i.e. a matrix. If we split that
matrix into small blocks and multiply each block by an invertible **key matrix**
`K` (working modulo 256), the image scrambles into noise. Multiplying by the
inverse key `K⁻¹` reverses the operation and recovers the original **exactly**.

> This is the classic **Hill cipher**, generalised from text to image pixels.

---

## The mathematics

Pixels are integers in `0..255`, so all arithmetic is done in the ring of
integers **modulo 256**.

| Step | Operation |
|------|-----------|
| Encrypt (forward) | `C = (K · P) mod 256` |
| Decrypt (inverse) | `P = (K⁻¹ · C) mod 256` |

**Invertibility condition.** For decryption to work, `K` must be invertible
*modulo 256*. A matrix is invertible mod `m` iff `gcd(det(K), m) = 1`. Since
`256 = 2⁸`, this simply means **the determinant must be odd**. The backend
rejects any key whose determinant is `0` (singular) or even (shares a factor
with 256).

The modular inverse is computed exactly with integer arithmetic:

```
K⁻¹ = det⁻¹ · adj(K)   (mod 256)
```

where `det⁻¹` is the modular multiplicative inverse of the determinant and
`adj(K)` is the adjugate (transpose of the cofactor matrix). Using exact
integers — rather than floating-point `numpy.linalg.inv` — avoids rounding
errors and keeps the round-trip lossless for 2×2 and 3×3 keys.

**Colour images** are handled by encrypting the R, G and B channels
independently with the same key.

---

## Tech stack

- **Frontend:** React + Vite
- **Backend:** Python + FastAPI
- **Math / imaging:** NumPy + Pillow

---

## Project structure

```
image-encryption/
├── backend/
│   ├── main.py          # FastAPI app: /encrypt, /decrypt, /matrix-info
│   ├── math_engine.py   # linear-algebra core (exact modular arithmetic)
│   ├── requirements.txt
│   └── venv/            # (Windows virtualenv — already present)
└── frontend/
    ├── src/
    │   ├── App.jsx      # dashboard: controls, visualization, math explainer
    │   ├── api.js       # fetch client for the backend
    │   ├── main.jsx
    │   └── styles.css
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Running it

You need **two terminals** — one for the backend, one for the frontend.

### 1. Backend (FastAPI)  →  http://localhost:8000

From the `backend/` folder:

```powershell
# activate the existing virtualenv (Windows PowerShell)
venv\Scripts\Activate.ps1

# install dependencies (first time only)
pip install -r requirements.txt

# run the API server
uvicorn main:app --reload --port 8000
```

Interactive API docs are available at http://localhost:8000/docs.

### 2. Frontend (Vite React)  →  http://localhost:5173

From the `frontend/` folder:

```powershell
npm install      # first time only
npm run dev
```

Open http://localhost:5173 in your browser. The frontend calls the backend on
port 8000 (CORS is already configured for the Vite dev server).

> If your backend runs on a different URL, set `VITE_API_URL` in a
> `frontend/.env` file, e.g. `VITE_API_URL=http://localhost:8000`.

---

## How to use

1. **Upload** an image (drag & drop or browse).
2. Choose a **key size** (2×2 or 3×3) and edit the **key matrix**. The explainer
   panel shows the determinant and the modular inverse live, and warns you if the
   key isn't invertible mod 256.
3. Tick **Colour mode** to encrypt RGB channels independently (otherwise the
   image is converted to grayscale).
4. Press **Encrypt** — the middle panel shows the scrambled image.
5. Press **Decrypt** — the right panel recovers the original.

Try entering a key with an even determinant (e.g. `[[2,0],[0,2]]`) to see the
validation reject it.

---

## API reference

| Method | Endpoint | Body (multipart form) | Returns |
|--------|----------|-----------------------|---------|
| POST | `/encrypt` | `file`, `matrix` (JSON), `color` (bool) | PNG image |
| POST | `/decrypt` | `file`, `matrix` (JSON), `color` (bool) | PNG image |
| POST | `/matrix-info` | `matrix` (JSON) | `{ determinant, determinant_mod_256, inverse }` |

`matrix` is a JSON 2-D array, e.g. `[[3,3],[2,5]]`.

---

## Extending it

The math engine and API are modular, so you could add:

- Larger keys (4×4) — the exact-integer determinant/adjugate already supports any size.
- A separate key per colour channel.
- A text Hill-cipher mode reusing the same `math_engine`.
