import Link from "next/link";
import { Badge, DateText } from "../../components/status";
import { catalogSummary, listServers } from "../../lib/api";
import { catalogCopy } from "../../lib/copy";

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string,string|undefined>> }) {
  const params = await searchParams;
  const [summary, servers] = await Promise.all([catalogSummary(), listServers(params)]);
  const metrics = [
    [catalogCopy.summary.total, summary.total],
    [catalogCopy.summary.streamableHttp, summary.streamableHttp],
    [catalogCopy.summary.stdio, summary.stdio],
    [catalogCopy.summary.healthy, summary.healthy],
    [catalogCopy.summary.syncFailed, summary.syncFailed],
    [catalogCopy.summary.staleSnapshots, summary.staleSnapshots],
  ] as const;

  return <><section className="hero"><div><p className="eyebrow">{catalogCopy.eyebrow}</p><h1>{catalogCopy.title}</h1><p className="muted">{catalogCopy.description}</p></div></section><section className="grid">{metrics.map(([label,value])=><div className="card metric" key={label}><span className="muted">{label}</span><strong>{value}</strong></div>)}</section><form className="filters"><input name="q" placeholder={catalogCopy.filters.search} defaultValue={params.q}/><select name="transport" defaultValue={params.transport ?? ""}><option value="">{catalogCopy.filters.transport}</option><option value="streamable_http">원격 HTTP</option><option value="stdio">로컬 실행</option></select><select name="livenessStatus" defaultValue={params.livenessStatus ?? ""}><option value="">{catalogCopy.filters.liveness}</option><option value="healthy">정상</option><option value="degraded">주의</option><option value="offline">오프라인</option><option value="unknown">미확인</option></select><select name="environment" defaultValue={params.environment ?? ""}><option value="">{catalogCopy.filters.environment}</option><option value="dev">개발</option><option value="stg">스테이징</option><option value="prod">운영</option><option value="shared">공용</option></select><input name="ownerTeam" placeholder={catalogCopy.filters.ownerTeam} defaultValue={params.ownerTeam}/><input name="tag" placeholder={catalogCopy.filters.tag} defaultValue={params.tag}/></form><table className="table"><thead><tr><th>{catalogCopy.table.server}</th><th>{catalogCopy.table.transport}</th><th>{catalogCopy.table.status}</th><th>{catalogCopy.table.owner}</th><th>{catalogCopy.table.environment}</th><th>{catalogCopy.table.capabilities}</th><th>{catalogCopy.table.lastSync}</th><th>{catalogCopy.table.tags}</th></tr></thead><tbody>{servers.items.map(s=><tr key={s.id}><td><Link href={`/servers/${s.slug}`}>{s.name}</Link><div className="muted">{s.description}</div></td><td><Badge value={s.transport} label={formatTransport(s.transport)}/></td><td><Badge value={s.livenessStatus} label={formatLiveness(s.livenessStatus)}/></td><td>{s.ownerTeam}</td><td>{formatEnvironment(s.environment)}</td><td>{s.toolCount} 도구 · {s.resourceCount} 리소스 · {s.promptCount} 프롬프트</td><td><DateText value={s.lastSyncAt}/><div className="muted">{formatSyncStatus(s.lastSyncStatus)}</div></td><td>{s.tags?.join(", ")}</td></tr>)}</tbody></table>{servers.items.length===0?<div className="empty">{catalogCopy.table.empty}</div>:null}</>;
}

function formatTransport(value: string) { return value === "streamable_http" ? "원격 HTTP" : value === "stdio" ? "로컬 실행" : value; }
function formatLiveness(value: string) { return { healthy: "정상", degraded: "주의", offline: "오프라인", unknown: "미확인" }[value] ?? value; }
function formatEnvironment(value: string) { return { dev: "개발", stg: "스테이징", prod: "운영", shared: "공용" }[value] ?? value; }
function formatSyncStatus(value: string) { return { never: "동기화 전", success: "성공", failed: "실패" }[value] ?? value; }
