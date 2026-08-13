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
