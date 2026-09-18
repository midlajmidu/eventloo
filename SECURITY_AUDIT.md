# Eventloo Post-Remediation Production Security Audit

Audit date: 2026-09-05

## Verdict

- Code security score: **94/100**
- Deployment status: **CONDITIONAL — do not process real student data until the external actions below are complete**
- Open code findings: **0 Critical, 0 High, 3 Medium, 2 Low**
- Open external finding: **1 Critical secret-rotation/history task**
- Verification: **53 Django tests passed, production Django checks passed, frontend build passed, and npm/Python dependency audits found 0 known vulnerabilities**

The app now has strong application-layer tenant isolation, least-privilege role checks, revocable cookie sessions, privileged-user MFA, shared production throttling, private production media requirements, and structured security events. Source changes cannot rotate secrets already copied to a host or erase other copies of Git history, so production approval remains conditional.

## Resolved findings

### Authentication and sessions

- Access and refresh tokens use HttpOnly cookies and are absent from API bodies/browser storage.
- Access is short-lived; refresh tokens rotate and are blacklisted.
- Refresh validates current credentials, account state, role, tenant, and session version.
- Password changes, school suspension, team credential regeneration, and MFA recovery revoke sessions.
- Production requires TOTP MFA for super admins, school admins, and event managers.
- MFA includes enrollment, verification, same-code replay prevention, and super-admin recovery.
- Students and team managers cannot use the school-staff login.
- Redis-backed throttling is mandatory in production.

### Authorization and tenant isolation

- Central authentication validates active school, role, token type, password state, and tenant claim.
- Team tokens create scoped principals and are invalidated when credentials change.
- Raw marks, draft results, assignments, students, settings, points, and credentials use explicit role checks.
- Nested event/program/team routes, querysets, services, and model relations enforce school ownership.
- A database constraint prevents super admins belonging to schools and normal users existing without one.
- The unsafe “first active school” settings fallback was removed.

### Credentials, files, and operations

- Migration `0019` disables the known `admin@eventloo.com` / `admin123` account when it still matches.
- Privileged management commands take passwords from environment variables, validate them, and do not print them.
- Team credential exports are one-time, permission-restricted, mode `0600`, and refuse overwrite.
- Production fails closed without independent signing keys, PostgreSQL, Redis, and private object storage.
- Future school logos use unguessable tenant-prefixed keys.
- Structured JSON security events cover login/MFA, school lifecycle, credential recovery, marks, and publishing.
- CI runs tests, builds, dependency audits, production checks, and a full-history secret scan.

## Remaining findings

### EXT-001 — Historic secret exposure (Critical, external)

Git history contains a formerly committed `backend/env.local` with signing/database configuration, and older commits contain the known default login. The live tree is cleaned and the known local account is disabled. Operators must:

1. Rotate the deployed database credential/connection string.
2. Rotate `SECRET_KEY` and `JWT_SIGNING_KEY` to separate random values.
3. Restart all instances and revoke outstanding sessions.
4. Rewrite all shared branches/tags, force-push sanitized history, and require collaborators to re-clone.
5. Run a full-history secret scan and verify old credentials fail.

History rewriting is intentionally not automated in this dirty worktree because it is destructive and requires repository-owner coordination.

### SEC-002 — No PostgreSQL row-level security (Medium)

Isolation is enforced by authentication, permissions, querysets, services, model validation, and constraints. A future endpoint could omit these controls. Require tenant tests for every route and consider RLS after the schema stabilizes.

### SEC-003 — Central audit retention is deployment-owned (Medium)

The app emits structured events, but immutable retention, alerts, and SIEM transport must be configured on the host. Alert on login/MFA failures, deletion, credential rotation, MFA reset, and republishing.

### SEC-004 — Staging security/recovery testing remains (Medium)

Local tests cannot reproduce the final proxy, domains, Redis/PostgreSQL concurrency, S3 policy, backup system, or production load. Run authenticated DAST with three tenants, concurrent assignment/import/publication tests, and a restore drill.

### SEC-005 — Frontend bundle size (Low)

The minified bundle is about 1.2 MB before gzip. Split large event screens by route.

### SEC-006 — Large legacy modules (Low)

Large view/serializer modules retain legacy branches. Continue extracting domain services so reviews stay tractable.

## Role matrix

| Capability | Super admin | School admin | Event manager | Team manager |
| --- | --- | --- | --- | --- |
| Manage schools/admins | Yes | No | No | No |
| Reset school-staff MFA | Yes, confirmed target | No | No | No |
| Manage setup/students/teams/credentials | No tenant access | Own school | No | Own team workflow |
| Manage events/programs/marks/results | No tenant access | Own school | Own school | Assignment workflow |
| Read raw marks/drafts | No tenant access | Own school | Own school | No |
| Change role/school through serializers | No | No | No | No |
| Access another school by changing IDs | Blocked | Blocked | Blocked | Blocked |

## Verified attack cases

| Test | Result |
| --- | --- |
| Anonymous protected access | Blocked |
| School A accesses School B IDs | Blocked |
| Team token accesses another team/school | Blocked |
| Student reads assignments/raw marks | Blocked |
| Event manager modifies students/settings/credentials | Blocked |
| Student uses staff login | Blocked |
| Wrong-school login/MFA enrollment | Blocked |
| Suspended school refreshes session | Blocked |
| Changed password refreshes session | Blocked |
| Rotated team credential refreshes session | Blocked |
| Reused authenticator code | Blocked |
| Unauthorized/unconfirmed MFA reset | Blocked |
| Cross-school model relation | Blocked |
| Invalid XLSX, unpublished result, production media traversal | Blocked |
| Group size, leader, deadline, limits, marks, rank, points idempotency | Passed |

## Required production checklist

- [ ] Complete EXT-001 rotation and Git-history purge.
- [ ] Deploy migrations through `accounts.0023_user_session_version` and current event migrations.
- [ ] Set exact hosts/origins and `DEBUG=False`.
- [ ] Configure TLS-only least-privileged PostgreSQL and shared Redis.
- [ ] Configure encrypted private S3-compatible storage with blocked public access.
- [ ] Keep both privileged MFA requirements enabled.
- [ ] Export `security.audit` logs to immutable storage and alerts.
- [ ] Verify cookie flags and proxy behavior on the final domains.
- [ ] Test encrypted backups and restore.
- [ ] Run staging DAST, tenant-ID tampering, upload abuse, and concurrency tests.
- [ ] Make the full-history secret scan pass before release.

## Security boundary

```text
HTTPS
  -> cookie/JWT or team-principal authentication
  -> credential, session-version, MFA and active-school checks
  -> role/action permission
  -> route/object tenant validation
  -> school-scoped queryset/service
  -> model/database invariants
  -> structured security event
```

Never look up a client-provided object ID without constraining it by `request.user.school_id` or a previously validated tenant-owned parent.
