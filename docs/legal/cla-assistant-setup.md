# CLA Assistant Setup

This note is for maintainers configuring CLA enforcement on GitHub.

## Target shape

- use the GitHub `CLA Assistant` app for pull request enforcement
- require the CLA Assistant status check before merge
- use the repo's Individual CLA text at [`individual-cla.md`](./individual-cla.md)
- start with individual-signature flow only
- add corporate-signature handling later only if needed

## Manual GitHub-side steps

1. Install the `CLA Assistant` GitHub app for the repository.
2. Point it at the Individual CLA text in [`individual-cla.md`](./individual-cla.md).
3. Enable the PR status check for CLA signing.
4. Mark the CLA Assistant check as required in branch protection before accepting outside contributions at scale.
5. Confirm the contributor-facing wording in [`CONTRIBUTING.md`](../../CONTRIBUTING.md) matches the live signing flow.

## Contributor-facing expectation

Contributors should be told:

- a signed CLA is required before merge
- the signing prompt appears on pull requests
- the CLA grants HoodleFinance broad relicensing rights while contributors keep copyright
