import { check } from "./policy.mjs";
// The workflow supplies the first-step clock; preparation consumes the same budget.
export function jobWindow(env) {
  const start = Number(env.C1_JOB_STARTED_AT),
    deadline = Number(env.C1_JOB_DEADLINE_MS);
  check(Number.isInteger(start) && start > 0 && Number.isInteger(deadline));
  check(
    deadline > start &&
      deadline <= start + 19 * 60 * 1000 &&
      start <= Date.now(),
  );
  check(Date.now() < deadline - 2 * 60 * 1000);
  return { start, deadline };
}
export function cancellation(target = process) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  target.on("SIGINT", stop);
  target.on("SIGTERM", stop);
  return {
    signal: controller.signal,
    dispose() {
      target.off("SIGINT", stop);
      target.off("SIGTERM", stop);
    },
  };
}
export async function abortable(fn, signal) {
  check(!signal.aborted);
  let stop;
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        stop = () => reject(new Error("C1_CANCEL_BLOCK"));
        signal.addEventListener("abort", stop, { once: true });
        if (signal.aborted) stop();
      }),
    ]);
  } finally {
    signal.removeEventListener("abort", stop);
  }
}
