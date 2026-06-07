"use client";

import { useActionState } from "react";
import { EmptyState, StatusPill } from "@mcp-hub/ui";

import { testPolicyCallAction } from "../app/actions";
import { initialFormActionState } from "../app/action-state";
import type { ToolTestOption } from "../app/tools/page-helpers";
import type { PolicyEffect } from "../lib/api";
import { policyTone } from "./format";
import { CopyButton } from "./copy-button";

const sampleArguments = JSON.stringify({ query: "release runbook", token: "redacted-secret-placeholder" }, null, 2);

export function ToolTestLab({ options }: Readonly<{ options: ToolTestOption[] }>) {
  const [state, formAction, pending] = useActionState(testPolicyCallAction, initialFormActionState);
  const selectedToolRef = state.selectedToolRef ?? options[0]?.value ?? "";
  const policyEffect = readPolicyEffect(state.policyEffect);

  return (
    <form className="form-card test-lab" action={formAction}>
      <h2>도구 드라이런 테스트 랩</h2>
      <p>정책 보호 `tools/call` 페이로드를 만들어 `/api/policy/test-call`로 전송합니다. 드라이런 모드는 업스트림 MCP 서버를 호출하지 않고 정책 결과와 로컬 마스킹 인자만 검토용으로 반환합니다.</p>
      {options.length > 0 ? (
        <>
          <input type="hidden" name="dryRun" value="true" />
          <div className="form-grid">
            <div className="field">
              <label htmlFor="toolTestRef">도구</label>
              <select id="toolTestRef" name="toolTestRef" defaultValue={selectedToolRef} required>
                {options.map((option) => (
                  <option value={option.value} key={option.value} disabled={!option.enabled}>{option.label}{option.enabled ? "" : " (비활성)"}</option>
                ))}
              </select>
            </div>
            <label className="danger-confirm test-lab__step-up">
              <input type="checkbox" name="stepUp" />
              심각 위험 드라이런에 스텝업 확인 신호를 포함합니다.
            </label>
          </div>
          <div className="field">
            <label htmlFor="argumentsJson">페이로드 편집기</label>
            <textarea id="argumentsJson" name="argumentsJson" required defaultValue={sampleArguments} />
          </div>
          <div className="form-actions">
            <button className="button" type="submit" disabled={pending}>{pending ? "드라이런 실행 중..." : "정책 드라이런 실행"}</button>
            {policyEffect ? <StatusPill tone={policyTone(policyEffect)}>{policyEffect}</StatusPill> : null}
            {state.message ? <span className="muted" role="status">{state.message}</span> : null}
          </div>
          {state.payload ? (
            <div className="grid">
              <CopyButton value={state.payload} label="드라이런 결과 복사" />
              <pre className="code-block">{state.payload}</pre>
            </div>
          ) : null}
        </>
      ) : <EmptyState title="사용 가능한 도구 없음" description="드라이런 페이로드를 만들려면 제어 플레인 도구가 하나 이상 필요합니다." />}
    </form>
  );
}

function readPolicyEffect(value: string | undefined): PolicyEffect | undefined {
  if (value === "allow" || value === "deny" || value === "needs_approval") {
    return value;
  }

  return undefined;
}
