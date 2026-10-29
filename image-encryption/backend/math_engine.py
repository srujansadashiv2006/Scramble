"""
math_engine.py
------------------------------------------------------------------
Linear-algebra core for the Image Encryption mini-project.

This is a Hill-cipher-style block encryption that works on the pixel
matrix of an image. Everything is done in the ring of integers modulo
256 (because a pixel intensity is a value 0..255).

Key mathematical ideas used here
---------------------------------
1. Matrix multiplication      C = (K . P) mod 256          (encryption)
2. Determinant                det(K)                       (invertibility test)
3. Modular matrix inverse     K^-1 = det^-1 . adj(K) mod 256   (decryption)

To decrypt we need K to be invertible *modulo 256*. A matrix is
invertible mod m if and only if gcd(det(K), m) = 1. Since 256 = 2^8,
this simply means det(K) must be ODD.

All determinant / adjugate arithmetic below is done with exact Python
integers (no floating point) so that 2x2, 3x3 and 4x4 keys are handled
without rounding error.
"""

from math import gcd
import numpy as np

MOD = 256  # pixel values live in 0..255


# ----------------------------------------------------------------------
# Exact integer linear algebra helpers (no floats -> no rounding bugs)
# ----------------------------------------------------------------------
def _int_matrix(matrix):
    """Convert an incoming list/array into a clean 2-D list of Python ints."""
    arr = np.array(matrix)
    if arr.ndim != 2 or arr.shape[0] != arr.shape[1]:
        raise ValueError("Key matrix must be square (2x2, 3x3, ...).")
    # round then cast so "3.0" from JSON becomes int 3 cleanly
    return [[int(round(float(v))) for v in row] for row in arr.tolist()]


def _minor(m, i, j):
    """Return the matrix with row i and column j removed."""
    return [row[:j] + row[j + 1:] for k, row in enumerate(m) if k != i]


def integer_determinant(m):
    """Exact integer determinant via cofactor (Laplace) expansion.

    Fine for the small key sizes used here (2x2 .. 4x4)."""
    n = len(m)
    if n == 1:
        return m[0][0]
    if n == 2:
        return m[0][0] * m[1][1] - m[0][1] * m[1][0]
    det = 0
    for j in range(n):
        sign = -1 if (j % 2) else 1
        det += sign * m[0][j] * integer_determinant(_minor(m, 0, j))
    return det


def integer_adjugate(m):
    """Exact integer adjugate (transpose of the cofactor matrix)."""
    n = len(m)
    if n == 1:
        return [[1]]
    cof = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            sign = -1 if ((i + j) % 2) else 1
            cof[i][j] = sign * integer_determinant(_minor(m, i, j))
    # adjugate = transpose of cofactor matrix
    return [[cof[j][i] for j in range(n)] for i in range(n)]


def mod_inverse_matrix(m, mod=MOD):
    """Compute K^-1 mod `mod` as an integer matrix.

    Raises ValueError if K is not invertible modulo `mod`."""
    det = integer_determinant(m) % mod
    if gcd(det, mod) != 1:
        raise ValueError(
            f"Matrix is not invertible modulo {mod} "
            f"(determinant {det} shares a factor with {mod}; it must be odd)."
        )
    det_inv = pow(det, -1, mod)                # modular inverse of the scalar det
    adj = integer_adjugate(m)
    n = len(m)
    inv = [[(det_inv * adj[i][j]) % mod for j in range(n)] for i in range(n)]
    return np.array(inv, dtype=np.int64)


# ----------------------------------------------------------------------
# Validation used by the API
# ----------------------------------------------------------------------
def validate_key_matrix(matrix):
    """Validate a user-supplied key.

    Returns (True, numpy_int_matrix) on success, or
            (False, error_message_string) on failure."""
    try:
        m = _int_matrix(matrix)
    except ValueError as e:
        return False, str(e)

    real_det = integer_determinant(m)
    if real_det == 0:
        return False, "Matrix is singular (determinant = 0), so it has no inverse."

    det_mod = real_det % MOD
    if gcd(det_mod, MOD) != 1:
        return False, (
            f"Determinant is {real_det}. For decryption mod 256 to work the "
            f"determinant must be ODD (coprime to 256). Please adjust the key."
        )

    return True, np.array(m, dtype=np.int64)


def matrix_details(K):
    """Return a dict describing the key: determinant + modular inverse.

    Assumes K has already passed validate_key_matrix."""
    m = K.tolist()
    det = integer_determinant(m)
    K_inv = mod_inverse_matrix(m)
    return {
        "determinant": det,
        "determinant_mod_256": det % MOD,
        "inverse": K_inv.tolist(),
    }


# ----------------------------------------------------------------------
# Core image transformations
# ----------------------------------------------------------------------
def _transform_channel(channel, M):
    """Apply block-wise (M . block) mod 256 to a single 2-D channel.

    `channel` is padded with zeros so its dimensions are divisible by k."""
    k = M.shape[0]
    h, w = channel.shape

    new_h = (h + k - 1) // k * k
    new_w = (w + k - 1) // k * k

    padded = np.zeros((new_h, new_w), dtype=np.int64)
    padded[:h, :w] = channel

    out = np.zeros_like(padded)
    M = M.astype(np.int64)

    for i in range(0, new_h, k):
        for j in range(0, new_w, k):
            block = padded[i:i + k, j:j + k]
            out[i:i + k, j:j + k] = (M @ block) % MOD

    return out.astype(np.uint8)


def _apply(image_array, M):
    """Apply transform to a grayscale (2-D) or RGB (3-D) image array."""
    if image_array.ndim == 2:                      # grayscale
        return _transform_channel(image_array, M)
    # RGB / RGBA: encrypt each colour channel independently
    channels = [
        _transform_channel(image_array[:, :, c], M)
        for c in range(image_array.shape[2])
    ]
    return np.stack(channels, axis=2)


def encrypt_image(image_array, K):
    """Forward transformation:  C = (K . P) mod 256."""
    return _apply(image_array, K)


def decrypt_image(encrypted_array, K):
    """Inverse transformation:  P = (K^-1 . C) mod 256."""
    K_inv = mod_inverse_matrix(K.tolist())
    return _apply(encrypted_array, K_inv)
