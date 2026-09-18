// Response shape for POST /access/connect/:serverId — the SUPPORT/ADMIN
// "get credentials" endpoint. Previously returned the raw AccessLog entity
// (id, reason/reasonCode/reasonDetails, retentionHold, timestamps,
// activityLog, notes, a nested accessedBy User, ...) even though the only
// two real consumers (AccessStatusPanel.tsx, dashboard/support/page.tsx)
// read exactly one field: `data?.supportPassword`. supportPassword itself
// is intentionally still here — this endpoint's entire purpose is handing
// it over to the connecting SUPPORT/ADMIN user, not a leak to trim.
export class AccessConnectResponseDto {
  supportPassword: string | null;
}
