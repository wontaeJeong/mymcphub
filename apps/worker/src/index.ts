export type WorkerJobKind = "tool-scan" | "schema-diff" | "health-check";

export type WorkerJob = {
  kind: WorkerJobKind;
  targetServerId: string;
};

export const defaultWorkerJobs: WorkerJobKind[] = [
  "tool-scan",
  "schema-diff",
  "health-check"
];

export async function runWorkerOnce(jobs: WorkerJob[] = []) {
  return {
    processed: jobs.length,
    supportedJobs: defaultWorkerJobs
  };
}

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  void runWorkerOnce().then((result) => {
    console.log(JSON.stringify({ service: "worker", ...result }));
  });
}
