"use client";

import { useActionState } from "react";
import { EmptyState, StatusPill } from "@mcp-hub/ui";

import { testPolicyCallAction } from "../app/actions";
import { initialFormActionState } from "../app/action-state";
import type { ToolTestOption } from "../app/tools/page-helpers";
import type { PolicyEffect } from "../lib/api";
import { policyTone } from "./format";
import { CopyButton } from "./copy-button";
import { ActivityIcon } from "./icons";

const sampleArguments = JSON.stringify({ query: "release runbook", token: "redacted-secret-placeholder" }, null, 2);

export function ToolTestLab({ options }: Readonly<{ options: ToolTestOption[] }>) {
  const [state, formAction, pending] = useActionState(testPolicyCallAction, initialFormActionState);
  const selectedToolRef = state.selectedToolRef ?? options[0]?.value ?? "";
  const policyEffect = readPolicyEffect(state.policyEffect);

  return (
    <form className="form-card test-lab" action={formAction}>
      <div className="form-card__heading">
        <div className="heading-icon"><ActivityIcon /></div>
        <div>
          <h2>호출 가능 여부 확인</h2>
          <p>실제 호출 전에 정책 결과와 마스킹된 입력을 확인합니다.</p>
        </div>
      </div>
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
              심각 위험 확인에 추가 인증 신호를 포함합니다.
            </label>
          </div>
          <div className="field">
            <label htmlFor="argumentsJson">페이로드 편집기</label>
            <textarea id="argumentsJson" name="argumentsJson" required defaultValue={sampleArguments} />
          </div>
          <div className="form-actions">
            <button className="button" type="submit" disabled={pending}><ActivityIcon />{pending ? "확인 중..." : "호출 가능 여부 확인"}</button>
            {policyEffect ? <StatusPill tone={policyTone(policyEffect)}>{policyEffect}</StatusPill> : null}
            {state.message ? <span className="muted" role="status">{state.message}</span> : null}
          </div>
          {state.payload ? (
            <div className="grid">
               <CopyButton value={state.payload} label="결과 복사" />
              <pre className="code-block">{state.payload}</pre>
            </div>
          ) : null}
        </>
      ) : <EmptyState title="사용 가능한 도구가 없습니다" description="등록된 도구가 있으면 호출 가능 여부를 확인할 수 있습니다." />}
    </form>
  );
}

function readPolicyEffect(value: string | undefined): PolicyEffect | undefined {
  if (value === "allow" || value === "deny" || value === "needs_approval") {
    return value;
  }

  return undefined;
}
