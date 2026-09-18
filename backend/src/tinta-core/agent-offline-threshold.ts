// How long an AgentSession may go without a heartbeat before it's
// considered offline. Shared between AgentMonitorScheduler (marks the
// session DISCONNECTED and raises an [AUTO] alert ticket) and
// DiagnosticsService's `agent` check (PHASE1_3_DIAGNOSTICS_SPEC.md §0
// item 5) — a single source so the two can never independently drift apart
// and tell an operator contradictory stories about the same agent.
export const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
