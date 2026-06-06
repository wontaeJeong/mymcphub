import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardSummary } from "../components/dashboard-summary";

describe("DashboardSummary", () => {
  it("renders prompt-required live operations metrics", () => {
    const html = renderToStaticMarkup(
      <DashboardSummary
        registeredServers={3}
        enabledServers={2}
        disabledServers={1}
        highCriticalTools={4}
        recentDeniedCalls={5}
        recentFailedCalls={6}
        activeSessionStatus="Unavailable"
        activeSessionDetail="No prompt-05 Control Plane session endpoint"
      />
    );

    expect(html).toContain("Registered servers");
    expect(html).toContain("Enabled servers");
    expect(html).toContain("Disabled servers");
    expect(html).toContain("High or critical tools");
    expect(html).toContain("Recent denied calls");
    expect(html).toContain("Active sessions");
    expect(html).toContain("Unavailable");
  });
});
