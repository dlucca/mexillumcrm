import { describe, it, expect } from "vitest";
import { formatUSD } from "@/lib/currency";

describe("formatUSD", () => {
  it("null → guion", () => {
    expect(formatUSD(null)).toBe("—");
  });
  it("convierte MXN→USD con la tasa por defecto y redondea a entero", () => {
    expect(formatUSD(18000)).toBe("$1,000"); // 18000 / 18
  });
  it("respeta una tasa provista", () => {
    expect(formatUSD(2000, 20)).toBe("$100"); // 2000 / 20
  });
});
