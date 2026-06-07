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
        activeSessionStatus="사용 불가"
        activeSessionDetail="제어 플레인 세션 엔드포인트가 없습니다"
      />
    );

    expect(html).toContain("등록된 서버");
    expect(html).toContain("활성 서버");
    expect(html).toContain("비활성 서버");
    expect(html).toContain("높음 또는 심각 도구");
    expect(html).toContain("최근 거부된 호출");
    expect(html).toContain("활성 세션");
    expect(html).toContain("사용 불가");
  });
});
