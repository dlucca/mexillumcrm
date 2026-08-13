// TODO: mover a settings/tipo-de-cambio configurable por Admin (§15, §17/§18).
// Única fuente de verdad de la tasa hasta ese slice; el display MXN+USD ya queda hecho.
export const MXN_PER_USD = 18;

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatUSD(mxn: number | null, rate: number = MXN_PER_USD): string {
  if (mxn == null) return "—";
  return usdFormatter.format(mxn / rate);
}

const usdCompactFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

// USD abreviado para hero-KPIs y sumas de columna: "$2.7M", "$100K".
// Intl deja un ".0" sobrante en magnitudes exactas ("$100.0K") que quitamos.
export function formatUSDCompact(mxn: number | null, rate: number = MXN_PER_USD): string {
  if (mxn == null) return "—";
  return usdCompactFormatter.format(mxn / rate).replace(/\.0(?=[A-Za-z]|$)/, "");
}

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

// MXN abreviado con prefijo explícito para el monto secundario: "MX$3.2M".
export function formatMXNCompact(mxn: number | null): string {
  if (mxn == null) return "—";
  return "MX$" + compactNumber.format(mxn).replace(/\.0(?=[A-Za-z]|$)/, "");
}
