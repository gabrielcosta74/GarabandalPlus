import { describe, expect, it } from "vitest";
import {
  buildFinance,
  isTestPilgrimage,
  lisbonMidnight,
  metric,
  resolvePeriod,
  type Transaction,
} from "../lib/admin-dashboard/model";
import { allRows } from "../lib/admin-dashboard/query";

const now = new Date("2026-09-08T15:00:00Z");
const period = resolvePeriod(new URLSearchParams({ range: "7" }), now);
const tx = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: "one",
  source: "store",
  amount: 30,
  date: "2026-09-07T12:00:00Z",
  name: "Cliente",
  detail: "",
  href: "/admin/encomendas",
  ...overrides,
});
describe("admin dashboard financial accuracy", () => {
  it("uses only store revenue for average order value", () => {
    const data = buildFinance(
      [
        tx(),
        tx({ id: "two", amount: 70 }),
        tx({ source: "pilgrimages", amount: 45000 }),
        tx({ source: "donations", amount: 200 }),
      ],
      period,
      now.toISOString(),
    );
    expect(data.revenue.value).toBe(45300);
    expect(data.averageOrder.value).toBe(50);
    expect(data.orders.value).toBe(2);
  });
  it("uses adjacent exclusive periods without losing or double counting the boundary", () => {
    expect(period.previousTo).toBe(period.from);
    expect(Date.parse(period.to) - Date.parse(period.from)).toBe(
      Date.parse(period.previousTo) - Date.parse(period.previousFrom),
    );
    const data = buildFinance(
      [
        tx({ date: period.from }),
        tx({
          date: new Date(Date.parse(period.from) - 1).toISOString(),
          amount: 20,
        }),
        tx({ date: period.to, amount: 900 }),
      ],
      period,
      now.toISOString(),
    );
    expect(data.revenue.value).toBe(30);
    expect(data.revenue.previous).toBe(20);
    expect(data.revenue.trend).toBe(50);
  });
  it("does not invent a 100 percent increase without previous revenue", () => {
    expect(metric(50, 0).trend).toBeNull();
    expect(metric(0, 0).trend).toBe(0);
  });
  it("groups midnight receipts in the Lisbon calendar day", () => {
    const data = buildFinance(
      [tx({ date: "2026-09-06T23:30:00Z" })],
      period,
      now.toISOString(),
    );
    expect(data.series.find((p) => p.date === "2026-09-07")?.store).toBe(30);
    expect(data.series).toHaveLength(7);
  });
  it("handles Lisbon summer time and transition dates", () => {
    expect(lisbonMidnight("2026-09-08").toISOString()).toBe(
      "2026-09-07T23:00:00.000Z",
    );
    expect(lisbonMidnight("2026-01-08").toISOString()).toBe(
      "2026-01-08T00:00:00.000Z",
    );
    expect(lisbonMidnight("2026-03-30").toISOString()).toBe(
      "2026-03-29T23:00:00.000Z",
    );
  });
  it("rejects invalid, reversed, future and unbounded date ranges", () => {
    for (const params of [
      { range: "all" },
      { range: "custom", from: "2026-02-30", to: "2026-03-02" },
      { range: "custom", from: "2027-01-01", to: "2027-01-02" },
      { range: "custom", from: "2026-09-07", to: "2026-09-01" },
      { range: "custom", from: "2024-01-01", to: "2026-09-01" },
    ])
      expect(() =>
        resolvePeriod(
          new URLSearchParams(params as Record<string, string>),
          now,
        ),
      ).toThrow();
  });
  it("only identifies the explicit private test marker, not ordinary private pilgrimages", () => {
    expect(isTestPilgrimage("[TESTE PRIVADO FACT.pt] Peregrinação 2026D")).toBe(
      true,
    );
    expect(isTestPilgrimage("Peregrinação privada a Garabandal")).toBe(false);
  });
});
describe("complete and reliable data reads", () => {
  it("reads beyond the first page", async () => {
    const source = Array.from({ length: 1001 }, (_, id) => ({ id }));
    expect(
      await allRows((a, b) =>
        Promise.resolve({ data: source.slice(a, b + 1), error: null }),
      ),
    ).toHaveLength(1001);
  });
  it("rejects a failed page instead of returning partial totals", async () => {
    await expect(
      allRows(() =>
        Promise.resolve({ data: null, error: { message: "unavailable" } }),
      ),
    ).rejects.toThrow("unavailable");
  });
});
