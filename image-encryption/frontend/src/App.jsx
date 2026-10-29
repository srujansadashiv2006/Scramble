import { useState, useEffect, useCallback, useRef } from "react";
import { fetchMatrixInfo, transformImage } from "./api.js";

/* ---------- helpers ---------- */
const DEFAULTS = {
  2: [
    [3, 3],
    [2, 5],
  ],
  3: [
    [2, 1, 1],
    [1, 2, 1],
    [1, 1, 3],
  ],
};

let toastId = 0;

export default function App() {
  const [size, setSize] = useState(2);
  const [matrix, setMatrix] = useState(DEFAULTS[2]);
  const [color, setColor] = useState(false);

  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [encryptedUrl, setEncryptedUrl] = useState(null);
  const [decryptedUrl, setDecryptedUrl] = useState(null);

  const [info, setInfo] = useState(null); // { determinant, determinant_mod_256, inverse }
  const [infoError, setInfoError] = useState(null);
  const [busy, setBusy] = useState(null); // "encrypt" | "decrypt" | null
  const [toasts, setToasts] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);

  const pushToast = useCallback((msg, kind = "info") => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  /* When size changes, load a sensible default key. */
  function changeSize(n) {
    setSize(n);
    setMatrix(DEFAULTS[n]);
  }

  function setCell(r, c, v) {
    const val = v === "" || v === "-" ? v : Number(v);
    setMatrix((m) => m.map((row, i) => row.map((x, j) => (i === r && j === c ? val : x))));
  }

  /* numeric matrix for sending (empty/"-" -> 0) */
  const numericMatrix = matrix.map((row) =>
    row.map((x) => (x === "" || x === "-" || Number.isNaN(x) ? 0 : Number(x)))
  );

  /* Live matrix info (determinant + inverse) — debounced. */
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const data = await fetchMatrixInfo(numericMatrix);
        setInfo(data);
        setInfoError(null);
      } catch (e) {
        setInfo(null);
        setInfoError(e.message);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(numericMatrix)]);

  /* ---------- file handling ---------- */
  function acceptFile(f) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      pushToast("That file isn't an image. Try a PNG or JPG.", "error");
      return;
    }
    setFile(f);
    setOriginalUrl(URL.createObjectURL(f));
    setEncryptedUrl(null);
    setDecryptedUrl(null);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  }

  /* ---------- actions ---------- */
  async function runEncrypt() {
    if (!file) return pushToast("Upload an image first.", "error");
    if (infoError) return pushToast(infoError, "error");
    setBusy("encrypt");
    try {
      const url = await transformImage("encrypt", file, numericMatrix, color);
      setEncryptedUrl(url);
      setDecryptedUrl(null);
      pushToast("Image encrypted with C = (K · P) mod 256.", "success");
    } catch (e) {
      pushToast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function runDecrypt() {
    if (!encryptedUrl) return pushToast("Encrypt an image first, then recover it.", "error");
    if (infoError) return pushToast(infoError, "error");
    setBusy("decrypt");
    try {
      // decrypt the encrypted PNG we just produced
      const blob = await (await fetch(encryptedUrl)).blob();
      const encFile = new File([blob], "encrypted.png", { type: "image/png" });
      const url = await transformImage("decrypt", encFile, numericMatrix, color);
      setDecryptedUrl(url);
      pushToast("Recovered with P = (K⁻¹ · C) mod 256.", "success");
    } catch (e) {
      pushToast(e.message, "error");
    } finally {
      setBusy(null);
    }
  }

  const detOdd = info && info.determinant_mod_256 % 2 === 1;

  return (
    <div className="wrap">
      <header className="masthead">
        <p className="eyebrow">Linear Algebra · Mini Project</p>
        <h1>
          Image Encryption with <em>Matrix Transformations</em>
        </h1>
        <p>
          A pixel grid is just a matrix. Multiply each block by an invertible key
          matrix (mod 256) to scramble it, then multiply by the inverse key to
          recover the original — exactly. Encryption and decryption are the same
          operation run forwards and backwards.
        </p>
      </header>

      <div className="grid-main">
        {/* ------------------ CONTROL PANEL ------------------ */}
        <div>
          <div className="panel">
            <h2>
              Control panel <span className="tag">// input</span>
            </h2>

            <label className="field">Image</label>
            <div
              className={`dropzone ${dragging ? "drag" : ""}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {file ? (
                <span>
                  <strong>{file.name}</strong>
                  <br />
                  click or drop to replace
                </span>
              ) : (
                <span>
                  Drop an image here, or <strong>browse</strong>
                  <br />
                  PNG / JPG · any size
                </span>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />
            </div>

            <div className="row">
              <div>
                <label className="field">Key size</label>
                <div className="seg">
                  <button
                    className={size === 2 ? "active" : ""}
                    onClick={() => changeSize(2)}
                  >
                    2 × 2
                  </button>
                  <button
                    className={size === 3 ? "active" : ""}
                    onClick={() => changeSize(3)}
                  >
                    3 × 3
                  </button>
                </div>
              </div>
            </div>

            <label className="check">
              <input
                type="checkbox"
                checked={color}
                onChange={(e) => setColor(e.target.checked)}
              />
              Colour mode (encrypt R, G, B channels independently)
            </label>

            <label className="field" style={{ marginTop: 18 }}>
              Key matrix K
            </label>
            <div
              className="matrix-input"
              style={{ gridTemplateColumns: `repeat(${size}, auto)` }}
            >
              {matrix.map((row, i) =>
                row.map((val, j) => (
                  <input
                    key={`${i}-${j}`}
                    value={val}
                    inputMode="numeric"
                    onChange={(e) => setCell(i, j, e.target.value)}
                    aria-label={`K row ${i + 1} column ${j + 1}`}
                  />
                ))
              )}
            </div>

            <div className="actions">
              <button
                className="btn btn-encrypt"
                onClick={runEncrypt}
                disabled={busy !== null || !!infoError}
              >
                {busy === "encrypt" && <span className="spinner" />}
                Encrypt
              </button>
              <button
                className="btn btn-decrypt"
                onClick={runDecrypt}
                disabled={busy !== null || !!infoError || !encryptedUrl}
              >
                {busy === "decrypt" && <span className="spinner" />}
                Decrypt
              </button>
            </div>

            <p className="hint">
              The key must be invertible mod 256, so its determinant has to be{" "}
              <code>odd</code>. Try changing a value to an even determinant and
              watch the validation react.
            </p>
          </div>
        </div>

        {/* ------------------ RIGHT COLUMN ------------------ */}
        <div>
          {/* visualization */}
          <div className="panel">
            <h2>
              Visualization <span className="tag">// P → C → P</span>
            </h2>
            <div className="canvas-grid">
              <Frame
                cls="o"
                label="Original P"
                url={originalUrl}
                placeholder="upload an image"
              />
              <Frame
                cls="e"
                label="Encrypted C"
                url={encryptedUrl}
                placeholder="press Encrypt"
                download="encrypted.png"
              />
              <Frame
                cls="d"
                label="Recovered P"
                url={decryptedUrl}
                placeholder="press Decrypt"
                download="recovered.png"
              />
            </div>
          </div>

          {/* math explainer */}
          <div className="panel">
            <h2>
              Mathematical explainer <span className="tag">// mod 256</span>
            </h2>

            <div className="math-strip">
              <div className="line">
                <span className="lbl">Encryption — forward transform</span>C ={" "}
                <span className="k">K</span> · P <span className="mod">(mod 256)</span>
              </div>
              <div className="line">
                <span className="lbl">Decryption — inverse transform</span>P ={" "}
                <span className="k">K⁻¹</span> · C <span className="mod">(mod 256)</span>
              </div>
            </div>

            {infoError ? (
              <div className="stat-row">
                <div className="stat bad" style={{ flexBasis: "100%" }}>
                  <div className="lbl">Key status</div>
                  <div className="val" style={{ fontSize: 15, lineHeight: 1.4 }}>
                    {infoError}
                  </div>
                </div>
              </div>
            ) : info ? (
              <>
                <div className="stat-row">
                  <div className={`stat ${detOdd ? "ok" : "bad"}`}>
                    <div className="lbl">det(K)</div>
                    <div className="val">{info.determinant}</div>
                  </div>
                  <div className={`stat ${detOdd ? "ok" : "bad"}`}>
                    <div className="lbl">det mod 256</div>
                    <div className="val">{info.determinant_mod_256}</div>
                  </div>
                  <div className="stat">
                    <div className="lbl">Invertible?</div>
                    <div className="val" style={{ color: detOdd ? undefined : "var(--red)" }}>
                      {detOdd ? "yes" : "no"}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 18 }}>
                  <div className="lbl" style={{ fontSize: 11, color: "var(--slate)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Inverse key K⁻¹ (mod 256)
                  </div>
                  <div
                    className="matrix-show"
                    style={{ gridTemplateColumns: `repeat(${size}, auto)`, marginTop: 8 }}
                  >
                    {info.inverse.flat().map((v, i) => (
                      <span key={i}>{v}</span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="hint">Computing…</p>
            )}
          </div>
        </div>
      </div>

      {/* toasts */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

function Frame({ cls, label, url, placeholder, download }) {
  return (
    <div className="frame">
      <div className="cap">
        <span>
          <span className={`dot ${cls}`} />
          {label}
        </span>
        {url && download && (
          <a className="dl" href={url} download={download}>
            ↓ save
          </a>
        )}
      </div>
      <div className="imgbox">
        {url ? (
          <img src={url} alt={label} />
        ) : (
          <span className="placeholder">{placeholder}</span>
        )}
      </div>
    </div>
  );
}
