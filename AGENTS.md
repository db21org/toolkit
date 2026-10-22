# Toolkit agent instructions

## Test value assessment

Before adding or changing tests, read [test policy](docs/test-policy.md).

- Protect concrete business, security, integrity, concurrency, compatibility, or infrastructure risks through observable contracts.
- Tests must survive behavior-preserving refactors. Investigate failures rather than mechanically changing expectations.
- Assess whether to retain, consolidate, remove, or defer. Avoid duplicate coverage, trivial wrappers, and upstream-library retests.
- Defer all new React rendering tests, including library/provider contracts, until browser tooling is available. Pure non-rendering logic remains testable; do not install Playwright for this task.
- Retained tests require local `Risk: <failure impact>; Contract: <observable guarantee>` justifications. Never bulk-justify or automatically delete existing tests.
