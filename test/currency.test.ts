import { describe, it, expect } from "vitest";
import { formatUSD, formatUSDCompact, formatMXNCompact } from "@/lib/currency";

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

describe("formatUSDCompact", () => {
  it("null → guion", () => {
    expect(formatUSDCompact(null)).toBe("—");
  });
  it("millones con una decimal", () => {
    expect(formatUSDCompact(48_600_000)).toBe("$2.7M"); // 48.6M/18 = 2.7M
  });
  it("un millón exacto sin decimal sobrante", () => {
    expect(formatUSDCompact(18_000_000)).toBe("$1M"); // 18M/18 = 1M
  });
  it("miles", () => {
    expect(formatUSDCompact(1_800_000)).toBe("$100K"); // 1.8M/18 = 100K
  });
  it("respeta una tasa provista", () => {
    expect(formatUSDCompact(2_000_000, 20)).toBe("$100K"); // 2M/20 = 100K
  });
});

describe("formatMXNCompact", () => {
  it("null → guion", () => {
    expect(formatMXNCompact(null)).toBe("—");
  });
  it("millones con una decimal y prefijo MX$", () => {
    expect(formatMXNCompact(3_240_000)).toBe("MX$3.2M");
  });
  it("millón exacto sin decimal sobrante", () => {
    expect(formatMXNCompact(18_000_000)).toBe("MX$18M");
  });
  it("miles", () => {
    expect(formatMXNCompact(980_000)).toBe("MX$980K");
  });
});
