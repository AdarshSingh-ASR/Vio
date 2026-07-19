import { afterEach, describe, expect, it } from "vitest";
import { validateAndScan } from "@/lib/classroom-files";

describe("classroom file validation", () => {
  const originalUrl = process.env.MALWARE_SCAN_URL;
  const originalRequired = process.env.REQUIRE_MALWARE_SCAN;

  afterEach(() => {
    process.env.MALWARE_SCAN_URL = originalUrl;
    process.env.REQUIRE_MALWARE_SCAN = originalRequired;
  });

  it("rejects a file whose bytes do not match its declared MIME type", async () => {
    const gifBytes = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(64)]);
    await expect(validateAndScan({ name: "answer.txt", type: "text/plain" }, gifBytes)).rejects.toMatchObject({ code: "ATTACHMENT_TYPE_MISMATCH" });
  });

  it("fails closed when production policy requires an unavailable malware scanner", async () => {
    delete process.env.MALWARE_SCAN_URL;
    process.env.REQUIRE_MALWARE_SCAN = "true";
    await expect(validateAndScan({ name: "answer.txt", type: "text/plain" }, Buffer.from("safe text"))).rejects.toMatchObject({ code: "MALWARE_SCANNER_REQUIRED" });
  });
});
