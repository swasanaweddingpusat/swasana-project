import { describe, expect, it } from "vitest";
import { richTextToPlainText } from "@/lib/richText";

describe("richTextToPlainText", () => {
  it("retains readable paragraphs and list markers", () => {
    expect(
      richTextToPlainText("<p><strong>Terms</strong></p><ul><li>First</li><li>Second</li></ul>"),
    ).toBe("Terms\n• First\n• Second");
  });

  it("does not add blank lines between TipTap list items", () => {
    expect(
      richTextToPlainText(
        "<ul><li><p>Holding Room</p></li><li><p>Full Carpet Ballroom</p></li><li><p>Air Conditioned</p></li></ul><p></p>",
      ),
    ).toBe("• Holding Room\n• Full Carpet Ballroom\n• Air Conditioned");
  });

  it("keeps malicious markup inert", () => {
    expect(
      richTextToPlainText('<img src=x onerror="alert(1)"><script>alert(2)</script>Safe &amp; sound'),
    ).toBe("Safe & sound");
  });
});
