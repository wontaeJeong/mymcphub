import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardSummary, FirstRunOnboarding, NeedsAttention } from "../components/dashboard-summary";

describe("DashboardSummary", () => {
  it("renders live operations metrics with product-oriented copy", () => {
    const html = renderToStaticMarkup(
      <DashboardSummary
        registeredServers={3}
        enabledServers={2}
        disabledServers={1}
        highCriticalTools={4}
        recentDeniedCalls={5}
        recentFailedCalls={6}
        activeSessionStatus="Unavailable"
        activeSessionDetail="Session metrics unavailable from the current backend"
      />
    );

    expect(html).toContain("Registered servers");
    expect(html).toContain("Enabled servers");
    expect(html).toContain("Disabled servers");
    expect(html).toContain("High or critical tools");
    expect(html).toContain("Recent denied calls");
    expect(html).toContain("Active sessions");
    expect(html).toContain("Unavailable");
    expect(html).toContain("Session metrics unavailable from the current backend");
  });

  it("renders first-run and attention guidance", () => {
    const attentionHtml = renderToStaticMarkup(
      <NeedsAttention items={[{ title: "1 approval request pending", detail: "Review access before it becomes stale.", href: "/admin/approvals", action: "Open approvals", tone: "warning" }]} />
    );
    const onboardingHtml = renderToStaticMarkup(<FirstRunOnboarding admin />);

    expect(attentionHtml).toContain("Needs attention");
    expect(attentionHtml).toContain("1 approval request pending");
    expect(onboardingHtml).toContain("Bring the first server online");
    expect(onboardingHtml).toContain("Register a server");
    expect(onboardingHtml).toContain("Generate client setup");
  });
});
