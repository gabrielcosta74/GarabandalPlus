import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  finance: vi.fn(),
  operations: vi.fn(),
}));
vi.mock("../lib/admin-auth", () => ({ verifyAdmin: mocks.auth }));
vi.mock("../lib/supabase", () => ({ supabaseServer: {} }));
vi.mock("../lib/admin-dashboard/finance", () => ({
  loadFinance: mocks.finance,
}));
vi.mock("../lib/admin-dashboard/operations", () => ({
  loadOperations: mocks.operations,
}));
import { GET as finance } from "../app/api/admin/dashboard/route";
import { GET as operations } from "../app/api/admin/dashboard/operations/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ authorized: true });
});
describe("dashboard protected read endpoints", () => {
  it("rejects unauthenticated requests before accessing data", async () => {
    mocks.auth.mockResolvedValue({
      authorized: false,
      error: "Missing Authorization Header",
    });
    expect(
      (await finance(new Request("https://example.test/api/admin/dashboard")))
        .status,
    ).toBe(401);
    expect(
      (
        await operations(
          new Request("https://example.test/api/admin/dashboard/operations"),
        )
      ).status,
    ).toBe(401);
    expect(mocks.finance).not.toHaveBeenCalled();
    expect(mocks.operations).not.toHaveBeenCalled();
  });
  it("rejects users without administrator access", async () => {
    mocks.auth.mockResolvedValue({
      authorized: false,
      error: "Forbidden: Not an Admin",
    });
    expect(
      (await finance(new Request("https://example.test/api/admin/dashboard")))
        .status,
    ).toBe(403);
    expect(
      (
        await operations(
          new Request("https://example.test/api/admin/dashboard/operations"),
        )
      ).status,
    ).toBe(403);
  });
  it("validates date input before querying", async () => {
    expect(
      (
        await finance(
          new Request(
            "https://example.test/api/admin/dashboard?range=custom&from=no&to=no",
          ),
        )
      ).status,
    ).toBe(400);
    expect(mocks.finance).not.toHaveBeenCalled();
  });
  it("returns an error rather than successful zero totals after a source failure", async () => {
    mocks.finance.mockRejectedValue(new Error("source unavailable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await finance(
      new Request("https://example.test/api/admin/dashboard?range=30"),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toHaveProperty("error");
    log.mockRestore();
  });
  it("keeps operational data independent of financial date filters and private", async () => {
    mocks.operations.mockResolvedValue({ counts: { shipping: 2 } });
    const response = await operations(
      new Request(
        "https://example.test/api/admin/dashboard/operations?range=7",
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.operations).toHaveBeenCalledWith({});
  });
});
