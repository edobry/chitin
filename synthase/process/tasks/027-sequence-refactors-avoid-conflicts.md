# Sequence refactors to avoid merge conflicts

## Overview
To minimize disruption, refactor tasks must be sequenced and coordinated to avoid merge conflicts and ensure smooth progress.

## Current Issues
- Large refactors can cause merge conflicts
- Uncoordinated changes may block each other

## Required Changes
- Start with the most egregious file (`tools.ts`)
- Refactor one domain/module at a time, merging each before starting the next
- Communicate upcoming changes to the team
- After each refactor, update imports and run tests before proceeding

## Implementation Steps
- [ ] Prioritize and sequence refactor tasks
- [ ] Announce sequence to the team
- [ ] Merge each refactor before starting the next
- [ ] Update imports and run tests after each refactor

## Verification
- [ ] No major merge conflicts during refactor
- [ ] Team is aware of sequence
- [ ] CHANGELOG updated

## Notes
- Coordinate with all refactor task owners 
