import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "../components/status";
import { catalogCopy, detailCopy, loginCopy } from "../lib/copy";

describe("catalog production copy", () => {
  it("uses operations-oriented wording without demo labels", () => {
    const rendered = [
      catalogCopy.eyebrow,
      catalogCopy.title,
      catalogCopy.description,
      catalogCopy.summary.syncFailed,
      catalogCopy.filters.transport,
      detailCopy.eyebrow,
      detailCopy.sections.snapshot,
      loginCopy.description,
    ].join(" ");

    expect(rendered).toContain("운영 카탈로그");
    expect(rendered).not.toMatch(/demo|mock|sample|MVP|stale|Internal catalog|Server detail|read-only bearer|session/i);
  });

  it("keeps status class when rendering localized badge labels", () => {
    const html = renderToStaticMarkup(<Badge value="healthy" label="정상" />);

    expect(html).toContain("healthy");
    expect(html).toContain("정상");
  });
});
