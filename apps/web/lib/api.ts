export type Server = { id:string; slug:string; name:string; description:string; transport:"streamable_http"|"stdio"; hostingType:string; ownerTeam:string; contact:string; repositoryUrl:string; runbookUrl:string; environment:string; status:string; livenessStatus:string; endpointUrl?:string; stdioCommand?:string; stdioArgs?:string[]; stdioEnvKeys?:string[]; tags:string[]; lastSyncAt?:string; lastSyncStatus:string; lastSyncError?:string; toolCount:number; resourceCount:number; promptCount:number; snapshotHash?:string };
export type Summary = { total:number; streamableHttp:number; stdio:number; healthy:number; syncFailed:number; staleSnapshots:number };
export type Snapshot = { protocolVersion:string; serverInfo:unknown; capabilities:unknown; tools:Record<string,unknown>[]; resources:Record<string,unknown>[]; prompts:Record<string,unknown>[]; rawInitialize:unknown; snapshotHash:string; capturedAt:string; warnings?:string[] };
export type HealthCheck = { status:string; latencyMs:number; checkedAt:string; errorMessage?:string };
type List<T> = { items:T[] };
const base = process.env.MCPHUB_API_URL ?? process.env.MCP_API_URL ?? process.env.NEXT_PUBLIC_MCP_API_URL ?? "http://localhost:4000";
async function get<T>(path:string): Promise<T>{ const res = await fetch(new URL(path, base), { cache:"no-store", headers: authHeaders() }); if(!res.ok){ throw new Error(`${path} ${res.status}`); } return res.json() as Promise<T>; }
function authHeaders(): Record<string, string> { const token = process.env.MCPHUB_READ_TOKEN ?? process.env.MCPHUB_ADMIN_TOKEN ?? (process.env.NODE_ENV === "production" ? "" : "dev-readonly-token"); return token ? { authorization:`Bearer ${token}` } : {}; }
export function listServers(params:Record<string,string|undefined>={}){ const qs = new URLSearchParams(); Object.entries(params).forEach(([k,v])=>{ if(v) qs.set(k,v); }); return get<List<Server>>(`/api/servers${qs.size?`?${qs}`:""}`); }
export function catalogSummary(){ return get<Summary>("/api/catalog/summary"); }
export function getServer(id:string){ return get<Server>(`/api/servers/${encodeURIComponent(id)}`); }
export function getSnapshot(id:string){ return get<Snapshot>(`/api/servers/${encodeURIComponent(id)}/capability-snapshot`); }
export function getHealth(id:string){ return get<List<HealthCheck>>(`/api/servers/${encodeURIComponent(id)}/health`); }
