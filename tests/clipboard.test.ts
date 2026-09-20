import { describe, it, expect } from "vitest";
import { imageHtml } from "@/lib/images/clipboard";

describe("clipboard image markup", () => {
  const url = "data:image/png;base64,iVBORw0KGgo=";

  it("wraps the picture in an img tag", () => {
    expect(imageHtml(url)).toBe(`<img src="${url}" alt="Diagram" />`);
  });

  it("sets the size Word and Excel use to place the picture", () => {
    const html = imageHtml(url, 640.4, 480.6);
    expect(html).toContain('width="640"');
    expect(html).toContain('height="481"');
  });

  it("leaves the size out when it is not known", () => {
    expect(imageHtml(url)).not.toContain("width=");
    expect(imageHtml(url, 0, 0)).not.toContain("width=");
  });

  it("escapes anything that could break out of the attribute", () => {
    const html = imageHtml('data:image/png;base64,AA"><script>alert(1)</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;");
  });
});
