# Fix Test Dependencies

## Overview

During the fiber command modularization, we moved and reorganized several files, including removing `shared.ts`. This has broken some test dependencies that need to be fixed.

## Current Issues

1. Test file `deps-command.test.ts` imports from non-existent `shared` module:
```typescript
import * as shared from '../../../src/commands/fibers/shared';
```

2. Test uses mock implementation of `loadConfigAndModules` from `shared`:
```typescript
spyOn(shared, 'loadConfigAndModules').mockResolvedValue(env);
```

## Required Changes

1. Update Import Path
   - Replace import from `shared` with import from `utils/config-loader`
   - Update any other imports that might reference old paths

2. Fix Mock Implementation
   - Update test setup to mock `config-loader` instead of `shared`
   - Ensure mock implementation matches new module structure
   - Verify all test data matches new type definitions

3. Update Test Utilities
   - Review and update any shared test utilities
   - Ensure test environment creation matches new module organization
   - Update any snapshots that might be affected by the changes

## Implementation Steps

1. First update the imports:
```typescript
import { loadConfigAndModules } from '../../../src/commands/fibers/utils/config-loader';
```

2. Update the mock:
```typescript
// Import the module with a namespace to make mocking easier
import * as configLoader from '../../../src/commands/fibers/utils/config-loader';

// In test setup
spyOn(configLoader, 'loadConfigAndModules').mockResolvedValue(env);
```

3. Run tests and update any failing snapshots that reflect intentional changes

4. Document any changes needed in test environment creation helpers

## Verification

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Snapshots are updated
- [ ] Test coverage is maintained
- [ ] No console errors during test execution

## Notes

- Be careful with snapshot updates - only update those that reflect intentional changes
- Consider adding more type safety to test utilities while making these changes
- Document any patterns discovered that could help with future test maintenance 
