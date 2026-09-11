# Exact package review and registry integration

Private workspace review requires a selected immutable package snapshot matching the saved draft body checksum. Approval records that snapshot ID; public transition must use the same one. Edited text invalidates approval. Unsaved visible edits cannot be approved accidentally. Empty evidence packages cannot pass. Public rights use actual timestamp instants, including offsets.

UI shows the concrete package JSON before review. Publication remains disabled by configuration. This is structural/source-rights review, not a claim that supplied facts or generated prose were independently substantiated; further judgment/claim and deterministic-run checks are tracked separately.

Registry now federates Signal, legacy public catalog, and workspace publications. Partial source availability is explicit; unrelated documents sharing a ticker retain different source IDs. Requires deployment of the reconciled legacy catalog before enabling its service binding in production.

Validation: strict TypeScript, 17 local synthetic tests after timezone regression, Wrangler dry run. No deployment. Additive migrations007/008 need verified production history and approved staged application.
