// Utilidades de texto compartilhadas pela lógica do app.
export function normalizar(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function vazio(v) {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  return typeof v === "object" && Object.keys(v).length === 0;
}

// número digitado no padrão brasileiro: "1.000" = mil, "2,5" = dois e meio; texto livre fica como texto
export function lerNumero(t) {
  const bruto = String(t ?? "").trim();
  if (!bruto) return null;
  let s = bruto;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "");
  s = s.replace(",", ".");
  return Number.isFinite(Number(s)) ? Number(s) : bruto;
}
