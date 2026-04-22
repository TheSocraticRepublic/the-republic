# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in The Republic, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.** This gives attackers time to exploit the issue before it is fixed.

**Instead:** Email the maintainer directly. The email address is in the GitHub profile associated with this repository. Use the subject line "Security: The Republic" so it is not filtered.

Include:
- A description of the vulnerability
- Steps to reproduce it
- Your assessment of the potential impact
- If you have a fix in mind, describe it (but do not submit a PR until coordinated)

You will receive a response within 72 hours acknowledging receipt. We will work with you to understand the issue, develop a fix, and coordinate disclosure timing.

We do not have a bug bounty program. We do credit researchers in the changelog if they wish to be credited.

## Supported Versions

This project is pre-1.0. Security fixes are applied to the main branch only.

## Known Limitations

The following are documented design constraints, not vulnerabilities. They are described here so operators can make informed deployment decisions.

### Unverified AB and ON FOI Citations

The Alberta and Ontario jurisdiction modules contain FOI statutory citations that have not been verified by a practitioner with direct knowledge of those provincial frameworks. The modules are labeled `verified: false` in their index files, and the UI displays a warning when these jurisdictions are selected.

**Implication:** A FOI request letter generated using the Alberta or Ontario module may cite incorrect section numbers. An incorrect citation does not invalidate the request under either FOIP (AB) or MFIPPA/FIPPA (ON), but it weakens the legal framing and gives the FOI coordinator grounds to push back. Citizens using these modules should cross-reference the cited sections against the current consolidated statute before filing.

**Resolution path:** Contributor with practitioner knowledge of the relevant jurisdiction submits a verified module. See `src/lib/jurisdictions/CONTRIBUTING.md`.

### ActivityPub Delivery is Fire-and-Forget

The current AP delivery implementation (`src/lib/activitypub/delivery.ts`) sends signed activities to remote inboxes and does not retry on failure. If a remote instance is temporarily unavailable, the activity is lost.

**Implication:** Federation is best-effort. Remote followers on temporarily unavailable instances will not receive activities delivered during the outage. There is no mechanism to replay missed activities.

**Resolution path:** A persistent delivery queue (e.g., using Upstash QStash or a similar mechanism) would make delivery reliable. This is a known improvement for a future iteration.

### AP_DOMAIN is Immutable After Federation is Live

The `AP_DOMAIN` environment variable must be set before any user federates (i.e., before any user's actor URI is shared with a remote instance). Once federation is live, `AP_DOMAIN` cannot be changed.

**Why:** All ActivityPub actor URIs are keyed on `AP_DOMAIN`. Changing the domain produces new actor URIs that are unrelated to existing ones. Remote instances have no mechanism to follow a redirect from an old actor URI to a new one. All existing remote followers are severed. There is no migration path.

**Implication for operators:** Choose your domain before enabling federation. If you are running a test instance, do not federate until the domain is final. If you must change domains after federation, affected users will need to manually re-follow from the new domain.

**Note:** The `ap_handle` field in `user_profiles` is also immutable after initial creation. It is set to `display_name` at profile creation and is never changed, even if the display name is later updated.

### Actor Private Keys in the Database

RSA private keys for HTTP Signature signing are stored in the `actor_keys` table. This table must not be exposed via any public API. In Supabase deployments, Row Level Security (RLS) must be enabled with a policy that prevents any public or client-side read of private key material.

The schema comment on `actor_keys` documents this requirement. It is not enforced automatically — it is the responsibility of the operator to configure RLS correctly.

### Magic Code Expiry

Magic codes expire after 10 minutes (stored in Redis with a TTL). An attacker with access to an email inbox has a 10-minute window to use an intercepted code. This is a short window but not zero.

Codes are rate-limited per email address. Brute-force against a specific code is not feasible (six digits, rate-limited, single-use, short TTL).

### No Email Verification for Federation

The auth system verifies that a user controls an email address. It does not verify that the email domain corresponds to any particular organization or identity. A citizen can create an account with any email address they control.

**Implication for federation:** A user's AP actor identity is tied to their `ap_handle`, not their email. Two actors on the same instance will not have the same handle (unique index), but there is no mechanism to verify that `@handle@republic.example.com` represents a specific real-world person.

This is intentional. The Republic supports pseudonymous participation. If your deployment requires verified real-world identity, that is a configuration decision left to the operator.
