# Dependency Security & Upgrade Policy

## Scope
This policy applies to cryptographic and networking dependencies, including:
- `tweetnacl`
- `bip39`
- `js-sha3`
- `react-use-websocket`

## Update cadence
- Dependabot runs weekly for npm dependencies.
- Security patches should be reviewed and merged within 7 days for high/critical advisories.

## Review checklist for sensitive updates
1. Verify upstream release notes and changelog.
2. Re-run unit tests and perform manual wallet/key flow verification.
3. Validate message signing and transaction ID behavior remains stable.
4. For websocket client changes, verify reconnect behavior and protocol compatibility.

## Exceptions
Any deferred high/critical security fix requires a documented issue explaining risk acceptance and mitigation.
