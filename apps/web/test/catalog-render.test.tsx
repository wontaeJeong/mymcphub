import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "../components/status";
describe("MVP catalog UI", () => { it("renders clear health badges", () => { expect(renderToStaticMarkup(<Badge value="healthy" />)).toContain("healthy"); }); });
