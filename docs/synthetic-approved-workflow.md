# Same-package local workflow proof

`scripts/synthetic-approved-workflow.mjs` runs the actual Research Desk Hono subapplication with local Miniflare D1, migrations 005–012 and synthetic author/reviewer memberships. It does not use production bindings, live generation or provider calls. Upstream user context is injected for this test; signed-session verification remains covered separately by the real-Worker authentication tests.

Run from this repository:

```bash
node scripts/synthetic-approved-workflow.mjs --fixtures /absolute/path/to/implementation/fixtures --output /absolute/path/to/implementation/out/synthetic-approved-workflow
```

Inputs are `synthetic-model-package.json` and `synthetic-model-request.json`. The original source fixture bytes are checksum-checked; the harness fails instead of changing source evidence to fit. It registers the same company/security, creates and edits a draft through HTTP routes, remaps only revision links/owner/version/body checksum, attaches the same facts/assumptions/judgment/model ID, obtains a server arithmetic receipt, submits, approves under a different reviewer identity, obtains the delivery export, and imports that exact snapshot into the persistent tracker.

Negative checks prove that delivery before approval is rejected, submission before a model receipt is rejected, author approval is rejected, and anonymous delivery is rejected. The focused test additionally edits after export and confirms that subsequent delivery is blocked because approval was revoked.

Output files:

- `approved-export.json`: exact delivery-endpoint envelope.
- `package.json`: byte-for-byte `package_json` string from that envelope, without a formatting rewrite; its SHA-256 matches `package_checksum`.
- `model-receipt.json`: server-issued arithmetic evidence.
- `tracker-history.json`: persistent tracker endpoint output for the same revision.
- `workflow-context.json`: input hashes, ID remapping, migrations, endpoint checks and scope limitations.

These are synthetic local reviewer identities, not real analyst sign-off. The export proves workflow integration and arithmetic consistency, not financial truth or permission to distribute a real investment recommendation.

`tests/synthetic-approved-workflow.test.mjs` uses byte-identical snapshots of the shared model package/request under `tests/fixtures/approved-workflow` so the regression is portable. The actual proof run uses the shared root fixtures directly and records their file hashes. If the canonical synthetic model fixture changes, update the portable snapshots deliberately and rerun both tests and the proof.
