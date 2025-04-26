# Add lint/CI checks for file size

## Overview
To prevent future monolithic files, this task will add lint or CI checks to warn when files exceed a set size (e.g., 400 lines).

## Current Issues
- Large files are hard to maintain and review
- No automated enforcement of file size limits

## Required Changes
- Add a lint rule or CI script to warn when files exceed 400 lines
- Document the policy in CONTRIBUTING.md
- Announce the policy to the team

## Implementation Steps
- [ ] Add lint/CI rule for file size
- [ ] Update CONTRIBUTING.md with policy
- [ ] Announce policy to team

## Verification
- [ ] Lint/CI warns on large files
- [ ] Policy is documented
- [ ] CHANGELOG updated

## Notes
- Coordinate with other refactor tasks to avoid conflicts 
