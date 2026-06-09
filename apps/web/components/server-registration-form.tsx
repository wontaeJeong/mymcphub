"use client";

import { useActionState } from "react";

import { createServerAction } from "../app/actions";
import { initialFormActionState } from "../app/action-state";
import {
  installMethodOptions,
  marketCategoryOptions,
  marketTrustLevelOptions,
  marketVisibilityOptions,
} from "../lib/market";

export function ServerRegistrationForm() {
  const [state, formAction, pending] = useActionState(createServerAction, initialFormActionState);

  return (
    <form className="form-card" action={formAction}>
      <h2>서버 등록</h2>
      <p>제어 플레인 McpServerManifestSchema 계약에 맞춘 간단한 매니페스트를 /api/servers로 전송합니다.</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="registerSlug">슬러그</label>
          <input id="registerSlug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="internal-tools" />
        </div>
        <div className="field">
          <label htmlFor="registerDisplayName">표시 이름</label>
          <input id="registerDisplayName" name="displayName" required placeholder="내부 도구 MCP 서버" />
        </div>
        <div className="field">
          <label htmlFor="registerOwnerTeamId">소유 팀 ID</label>
          <input id="registerOwnerTeamId" name="ownerTeamId" required placeholder="소유 팀 UUID" />
        </div>
        <div className="field">
          <label htmlFor="registerEnvironment">환경</label>
          <select id="registerEnvironment" name="environment" required>
            <option value="dev">개발</option>
            <option value="stg">스테이징</option>
            <option value="prod">운영</option>
            <option value="shared">공용</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="registerTransport">전송 방식</label>
          <select id="registerTransport" name="transport" required>
            <option value="streamable_http">스트리밍 HTTP</option>
            <option value="sse_legacy">레거시 SSE</option>
            <option value="stdio_adapter">stdio 어댑터</option>
            <option value="external">외부</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="registerRiskLevel">서버 위험도</label>
          <select id="registerRiskLevel" name="riskLevel" required>
            <option value="low">낮음</option>
            <option value="medium">중간</option>
            <option value="high">높음</option>
            <option value="critical">심각</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="registerDescription">설명</label>
        <textarea id="registerDescription" name="description" placeholder="운영 목적과 소유권 메모" />
      </div>
      <div className="field">
        <label htmlFor="registerUpstreamUrl">업스트림 URL</label>
        <input id="registerUpstreamUrl" name="upstreamUrl" type="url" placeholder="stdio 어댑터는 선택 사항" />
      </div>
      <fieldset className="form-card registration-market-section">
        <legend>마켓 메타데이터</legend>
        <p>내부 MCP Market에서 검색, 검토, 게시 상태 판단에 사용할 카탈로그 정보를 함께 등록합니다.</p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="registerCategory">카테고리</label>
            <select id="registerCategory" name="category" required defaultValue="other">
              {marketCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="registerTrustLevel">신뢰 수준</label>
            <select id="registerTrustLevel" name="trustLevel" required defaultValue="community">
              {marketTrustLevelOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="registerVisibility">노출 상태</label>
            <select id="registerVisibility" name="visibility" required defaultValue="internal">
              {marketVisibilityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="registerDocsUrl">문서 URL</label>
            <input id="registerDocsUrl" name="docsUrl" type="url" placeholder="https://docs.example.test/server" />
          </div>
          <div className="field">
            <label htmlFor="registerSourceUrl">소스 URL</label>
            <input id="registerSourceUrl" name="sourceUrl" type="url" placeholder="https://github.example.test/team/server" />
          </div>
          <div className="field">
            <label htmlFor="registerTags">태그</label>
            <textarea id="registerTags" name="tags" placeholder="kubernetes, runbook 또는 줄바꿈으로 입력" />
          </div>
          <div className="field">
            <label htmlFor="registerSummary">마켓 요약</label>
            <textarea id="registerSummary" name="summary" placeholder="카탈로그 카드와 상세에 표시할 짧은 요약" />
          </div>
          <div className="field">
            <label htmlFor="registerUseCases">사용 사례</label>
            <textarea id="registerUseCases" name="useCases" placeholder="incident triage&#10;deployment review" />
          </div>
          <div className="field">
            <label htmlFor="registerPrerequisites">사전 조건</label>
            <textarea id="registerPrerequisites" name="prerequisites" placeholder="VPN, 팀 권한, 읽기 전용 토큰" />
          </div>
          <div className="field">
            <label htmlFor="registerSecurityNotes">보안 메모</label>
            <textarea id="registerSecurityNotes" name="securityNotes" placeholder="민감 데이터 범위, 토큰/시크릿 취급 메모" />
          </div>
        </div>
        <div className="field registration-checkbox-group">
          <span className="field-label">설치 방법</span>
          <div className="actions">
            {installMethodOptions.map((option) => (
              <label className="danger-confirm registration-toggle" key={option.value}>
                <input type="checkbox" name="installMethods" value={option.value} defaultChecked={option.value === "gateway"} />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </fieldset>
      <label className="danger-confirm registration-toggle">
        <input type="checkbox" name="enabled" defaultChecked />
        서버를 활성 상태로 등록합니다.
      </label>
      <div className="form-grid registration-tool-grid">
        <div className="field">
          <label htmlFor="registerToolName">초기 도구 이름</label>
          <input id="registerToolName" name="toolName" required placeholder="search_docs" />
        </div>
        <div className="field">
          <label htmlFor="registerToolRiskLevel">도구 위험도</label>
          <select id="registerToolRiskLevel" name="toolRiskLevel" required>
            <option value="low">낮음</option>
            <option value="medium">중간</option>
            <option value="high">높음</option>
            <option value="critical">심각</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="registerToolDescription">초기 도구 설명</label>
        <input id="registerToolDescription" name="toolDescription" placeholder="도구가 수행하는 작업" />
      </div>
      <div className="field">
        <label htmlFor="registerToolInputSchema">입력 스키마 JSON</label>
        <textarea id="registerToolInputSchema" name="toolInputSchema" required defaultValue={'{"type":"object","properties":{}}'} />
      </div>
      <label className="danger-confirm registration-toggle">
        <input type="checkbox" name="toolEnabled" defaultChecked />
        초기 도구를 활성 상태로 등록합니다.
      </label>
      <div className="form-actions">
        <button className="button" type="submit" disabled={pending}>{pending ? "등록 중..." : "서버 등록"}</button>
        {state.message ? <span className="muted" role="status">{state.message}</span> : null}
      </div>
    </form>
  );
}
