import { describe, expect, it } from "vitest";
import { richTextToPlainText } from "@/lib/richText";

describe("richTextToPlainText", () => {
  it("retains readable paragraphs and list markers", () => {
    expect(
      richTextToPlainText("<p><strong>Terms</strong></p><ul><li>First</li><li>Second</li></ul>"),
    ).toBe("Terms\n• First\n• Second");
  });

  it("keeps malicious markup inert", () => {
    expect(
      richTextToPlainText('<img src=x onerror="alert(1)"><script>alert(2)</script>Safe &amp; sound'),
    ).toBe("Safe & sound");
  });
});
