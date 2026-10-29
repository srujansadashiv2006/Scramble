// Thin API client for the FastAPI backend.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function readError(res) {
  // FastAPI returns { detail: "..." } for HTTPExceptions.
  try {
    const data = await res.json();
    return data.detail || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function fetchMatrixInfo(matrix) {
  const form = new FormData();
  form.append("matrix", JSON.stringify(matrix));
  const res = await fetch(`${BASE}/matrix-info`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

// mode: "encrypt" | "decrypt"; returns an object URL for the resulting PNG.
export async function transformImage(mode, file, matrix, color) {
  const form = new FormData();
  form.append("file", file);
  form.append("matrix", JSON.stringify(matrix));
  form.append("color", color ? "true" : "false");
  const res = await fetch(`${BASE}/${mode}`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await readError(res));
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
