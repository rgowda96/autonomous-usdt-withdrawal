# StablePay Runbook

Operational guide for on-call. Each section maps to an alert; each alert has a clear "what to do."

## Alerts

### `stablepay_settle_p99 > 15s` (5min)

**Symptom:** users see "Settling…" for too long.

**Steps:**
1. Check off-ramp provider status: `curl -s ${ONMETA_BASE_URL}/health` (Onmeta) or partner status page.
2. Check `/v1/users/:demo/transactions` — are recent rows stuck in `USDC_RECEIVED`? The recon sweeper will move them to `REFUND_PENDING` after 10min.
3. If primary off-ramp is down, FallbackOffRamp routes to mock — confirm `OFFRAMP_PROVIDER` env. Force fallback by setting `ONMETA_API_KEY=""`.
4. Push escalation to compliance lead if pending settle > 1000 ₹.

### `stablepay_agent_reject_rate > 5%`

**Symptom:** agents (Claude Desktop, Cursor, etc.) seeing too many `POLICY_DENIED` 403s.

**Steps:**
1. Query `session_key_usage` group by `outcome` for last 1h:
   ```sql
   SELECT outcome, COUNT(*) FROM session_key_usage
   WHERE created_at > unixepoch('now', '-1 hour') * 1000
   GROUP BY outcome;
   ```
2. If `REJECTED_CAP` dominates → user under-provisioned their limit; ping user in-app.
3. If `REJECTED_ALLOWLIST` dominates → agent is trying VPAs outside scope; verify the agent isn't compromised.
4. If `REJECTED_REVOKED` spikes → a session key was just revoked and the agent hasn't picked up new creds; this is expected briefly.

### `stablepay_freeze_rate > 0.1%`

**Symptom:** unusual number of users getting auto-frozen by KYT.

**Steps:**
1. Inspect recent `compliance_freezes`: `SELECT reason, COUNT(*) FROM compliance_freezes WHERE created_at > unixepoch('now', '-1 day') * 1000 GROUP BY reason;`
2. If `sanctions_match` rate jumped → either a real attack or a stale sanctions list. Diff against current OFAC SDN.
3. If `high_kyt_risk` rate jumped → check `kyt_screenings` for the addresses; might be a single bad actor reused.
4. False positives → release the freeze: `UPDATE compliance_freezes SET released_at = unixepoch() * 1000 WHERE id = ?;`

### `recon_sweeper_orphans > 5`

**Symptom:** off-ramp callbacks not arriving; treasury holds USDC without a payout claim.

**Steps:**
1. Check `webhook_events` count for last 10min — webhook deliveries flowing?
2. Test Onmeta webhook ingress: `curl -X POST -H 'x-signature: ...' http://prod-url/v1/webhooks/offramp -d '{"event_id":"test"}'`
3. If webhooks blocked at TLS / firewall → fix ingress.
4. If webhooks are flowing but events not matching transactions → log inspect for `client_ref` mismatches.

### `kyc_rejection_rate > 30%`

**Symptom:** users failing onboarding at unusual rate.

**Steps:**
1. Hit Sumsub status; if degraded, switch new signups to "pending" state and review manually.
2. Inspect rejected `kyc_records.raw_response` for clusters of identical errors.
3. If a specific document type is suddenly broken, hotfix the validation regex.

## Common operations

### Mint a session key for a new agent

```bash
curl -X POST https://api.stablepay.in/v1/users/$USER_ID/session-keys \
  -H "content-type: application/json" \
  -d '{"label":"Cursor","daily_cap_inr":2000,"per_txn_cap_inr":500,"vpa_allowlist":["swiggy@hdfc"],"ttl_days":30}'
```

The returned `token` is shown ONCE — store immediately in the user's settings.

### Revoke all of a user's session keys

```sql
UPDATE session_keys SET revoked_at = unixepoch() * 1000 WHERE user_id = ? AND revoked_at IS NULL;
```

### Unfreeze a user (after manual review cleared them)

```sql
UPDATE compliance_freezes SET released_at = unixepoch() * 1000 WHERE user_id = ? AND released_at IS NULL;
```

### Force-fail a stuck mandate

```sql
UPDATE mandates SET revoked_at = unixepoch() * 1000 WHERE id = ?;
```

### Take a manual DB backup right now

```bash
./scripts/backup-db.sh
```

### Restore from a specific backup

```bash
./scripts/restore-db.sh ./data/backups/stablepay-20260601-031500.db.gz
```

### Trigger the recon sweeper out-of-band

Hit any endpoint to wake the background interval, or restart the service. The sweeper runs every 5min and at boot.

### Generate FIU-IND CSV for a specific date

```bash
curl -s "https://api.stablepay.in/v1/compliance/fiu-ind-report?date=2026-06-01" > fiu-ind-2026-06-01.csv
```

## Service contacts

| Concern | Owner / channel |
|---|---|
| Off-ramp partner | Onmeta dashboard + partner Slack |
| KYC vendor | Sumsub support + partner Slack |
| Sanctions list | Chainalysis dashboard |
| Cloud infra | Render dashboard / Fly status |
| GitHub Actions | CI logs in repo `Actions` tab |
| User-facing incident | status.stablepay.in (TODO) |

## Post-incident

Every incident gets a postmortem committed to `docs/postmortems/YYYY-MM-DD-slug.md` with:
- Timeline
- Root cause
- Customer impact
- Detection gap (if any)
- Action items with owners and dates

Loop reads `docs/postmortems/` and prioritizes any "action item" tagged `[loop]` next tick.
