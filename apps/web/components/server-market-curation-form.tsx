"use client";

import { useActionState } from "react";
import { StatusPill, Surface } from "@mcp-hub/ui";

import { initialFormActionState } from "../app/action-state";
import {
  updateServerMarketLifecycleAction,
  updateServerMarketMetadataAction,
} from "../app/actions";
import type { ApiMcpServer } from "../lib/api";
import {
  formatInstallMethods,
  formatMarketVisibility,
  installMethodOptions,
  marketCategoryOptions,
  marketTrustLevelOptions,
  marketVisibilityForServer,
} from "../lib/market";
import { formatDate } from "./format";
import { AlertTriangleIcon, CheckCircleIcon, EditIcon, EyeIcon, XCircleIcon } from "./icons";

export function ServerMarketCurationForm({ server }: Readonly<{ server: ApiMcpServer }>) {
  const [metadataState, metadataAction, metadataPending] = useActionState(updateServerMarketMetadataAction, initialFormActionState);
  const [lifecycleState, lifecycleAction, lifecyclePending] = useActionState(updateServerMarketLifecycleAction, initialFormActionState);
  const visibility = marketVisibilityForServer(server);
  const selectedInstallMethods = new Set(server.installMethods && server.installMethods.length > 0 ? server.installMethods : ["gateway"]);

  return (
    <section className="detail-grid" id="market-metadata">
      <form className="form-card" action={metadataAction}>
        <input type="hidden" name="serverId" value={server.id} />
        <div className="form-card__heading">
          <div className="heading-icon"><EditIcon /></div>
          <div>
            <h2>마켓 메타데이터</h2>
            <p>검색, 문서, 설치 안내에 사용할 정보를 관리합니다.</p>
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="marketCategory">카테고리</label>
            <select id="marketCategory" name="category" required defaultValue={server.category ?? "other"}>
              {marketCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="marketTrustLevel">신뢰 수준</label>
            <select id="marketTrustLevel" name="trustLevel" required defaultValue={server.trustLevel ?? "community"}>
              {marketTrustLevelOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="marketDocsUrl">문서 URL</label>
            <input id="marketDocsUrl" name="docsUrl" type="url" defaultValue={server.docsUrl ?? ""} placeholder="https://docs.example.test/server" />
          </div>
          <div className="field">
            <label htmlFor="marketSourceUrl">소스 URL</label>
            <input id="marketSourceUrl" name="sourceUrl" type="url" defaultValue={server.sourceUrl ?? ""} placeholder="https://github.example.test/team/server" />
          </div>
          <div className="field">
            <label htmlFor="marketSummary">마켓 요약</label>
            <textarea id="marketSummary" name="summary" defaultValue={server.summary ?? server.description ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="marketTags">태그</label>
            <textarea id="marketTags" name="tags" defaultValue={(server.tags ?? []).join("\n")} placeholder="쉼표 또는 줄바꿈으로 입력" />
          </div>
          <div className="field">
            <label htmlFor="marketUseCases">사용 사례</label>
            <textarea id="marketUseCases" name="useCases" defaultValue={(server.useCases ?? []).join("\n")} />
          </div>
          <div className="field">
            <label htmlFor="marketPrerequisites">사전 조건</label>
            <textarea id="marketPrerequisites" name="prerequisites" defaultValue={(server.prerequisites ?? []).join("\n")} />
          </div>
          <div className="field">
            <label htmlFor="marketSecurityNotes">보안 메모</label>
            <textarea id="marketSecurityNotes" name="securityNotes" defaultValue={(server.securityNotes ?? []).join("\n")} />
          </div>
          <div className="field">
            <label htmlFor="marketReason">변경 사유</label>
            <textarea id="marketReason" name="reason" required placeholder="품질 검토, 문서 보강, 소유 팀 확인 등 감사에 남길 사유" />
          </div>
        </div>
        <div className="field registration-checkbox-group">
          <span className="field-label">설치 방법</span>
          <div className="actions">
            {installMethodOptions.map((option) => (
              <label className="danger-confirm registration-toggle" key={option.value}>
                <input type="checkbox" name="installMethods" value={option.value} defaultChecked={selectedInstallMethods.has(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
          <p className="muted">현재: {formatInstallMethods(server.installMethods)}</p>
        </div>
        <div className="form-actions">
          <button className="button" type="submit" disabled={metadataPending}><CheckCircleIcon />{metadataPending ? "저장 중..." : "메타데이터 저장"}</button>
          {metadataState.message ? <span className="muted" role="status">{metadataState.message}</span> : null}
        </div>
      </form>
      <Surface className="panel--accent danger-zone">
        <div className="form-card__heading">
          <div className="heading-icon heading-icon--danger"><AlertTriangleIcon /></div>
          <div>
            <h2>게시 상태</h2>
            <p>게시, 게시 해제, 격리, 격리 해제를 관리합니다.</p>
          </div>
        </div>
        <div className="grid market-lifecycle-summary">
          <div className="actions">
            <StatusPill tone={visibility === "published" ? "success" : visibility === "quarantined" ? "danger" : "warning"}>{formatMarketVisibility(visibility)}</StatusPill>
            <StatusPill tone={server.published ? "success" : "warning"}>{server.published ? "게시됨" : "게시 안 됨"}</StatusPill>
            <StatusPill tone={server.quarantined ? "danger" : "neutral"}>{server.quarantined ? "격리됨" : "격리 안 됨"}</StatusPill>
          </div>
          <p><strong>검토자:</strong> {server.reviewedBy ?? "기록 없음"}</p>
          <p><strong>검토 시각:</strong> {formatDate(server.reviewedAt)}</p>
          <p><strong>게시 시각:</strong> {formatDate(server.publishedAt)}</p>
        </div>
        <form action={lifecycleAction} className="market-lifecycle-form">
          <input type="hidden" name="serverId" value={server.id} />
          <div className="field">
            <label htmlFor="marketLifecycleReason">변경 사유</label>
            <textarea id="marketLifecycleReason" name="reason" required placeholder="게시, 비게시, 격리 또는 격리 해제 사유" />
          </div>
          <label className="danger-confirm">
            <input type="checkbox" name="confirmMarketLifecycle" required />
            카탈로그 노출과 접근 상태가 변경될 수 있습니다.
          </label>
          <div className="actions">
            <button className="button" type="submit" name="marketAction" value="publish" disabled={lifecyclePending || visibility === "published" || visibility === "quarantined"}><EyeIcon />게시하기</button>
            <button className="button button--ghost" type="submit" name="marketAction" value="unpublish" disabled={lifecyclePending || visibility !== "published"}><XCircleIcon />게시 해제</button>
            <button className="button button--danger" type="submit" name="marketAction" value="quarantine" disabled={lifecyclePending || visibility === "quarantined"}><AlertTriangleIcon />격리하기</button>
            <button className="button button--ghost" type="submit" name="marketAction" value="unquarantine" disabled={lifecyclePending || visibility !== "quarantined"}><CheckCircleIcon />격리 해제</button>
          </div>
          {lifecycleState.message ? <p className="muted" role="status">{lifecycleState.message}</p> : null}
        </form>
      </Surface>
    </section>
  );
}
