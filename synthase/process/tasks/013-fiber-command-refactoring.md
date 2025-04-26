# Refactor Fiber Command for Separation of Concerns

## Overview
The current implementation of the `fibers get` command mixed data loading/processing with rendering logic, making it difficult to reuse components across different interfaces or output formats. This task refactors the command to achieve better separation of concerns and future extensibility.

## Current Issues
1. **Mixed Concerns**: 
   - The command's action function handles data loading, processing, and rendering
   - Display functions contain business logic for computing dependencies and statuses
   - Direct console output is embedded throughout the codebase
2. **Limited Reusability**:
   - Difficult to reuse logic for new interfaces (API, GUI)
   - Console output is hardcoded, making alternative output formats challenging
   - Processing logic is tightly coupled with Commander and CLI concepts
3. **Testing Challenges**:
   - Difficult to unit test rendering logic separately from data processing
   - Console output prevents easy verification of command results

## Refactoring Goals
1. Create a clear separation between:
   - Data loading layer (environment preparation)
   - Data processing layer (business logic, filtering, ordering)
   - Rendering layer (formatting and output)
2. Improve reusability across different interfaces
3. Make the code more testable with clear boundaries

## Implementation Plan

### Step 1: Create Data Model Interfaces
Create interfaces for data structures that will be passed between layers:

```typescript
// src/commands/fibers/models.ts
export interface FiberDisplayModel {
  id: string;
  isCore: boolean;
  isEnabled: boolean;
  path: string;
  dependencies: Array<{id: string, source: string}>;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  chains: ChainDisplayModel[];
}
export interface ChainDisplayModel {
  id: string;
  isEnabled: boolean;
  isConfigured: boolean;
  dependencies: string[];
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  order: number;
  toolDependencies?: string[];
  provides?: string[];
}
export interface FiberSummaryModel {
  displayedFibers: number;
  totalFibers: number;
  configuredFibers: number;
  displayedChains: number;
  totalChains: number;
  configuredChains: number;
  validModules: number;
  totalModules: number;
}
export interface ProcessedFiberData {
  fibers: FiberDisplayModel[];
  summary: FiberSummaryModel;
}
```

### Step 2: Create Data Processing Layer
Implement pure functions that process the environment data into display models:

```typescript
// src/commands/fibers/processor.ts
/**
 * Processes environment data into display models based on command options
 */
export function processFibers(
  environment: FiberEnvironment, 
  options: FiberCommandOptions
): ProcessedFiberData {
  // Extract data from environment
  const { 
    config,
    validationResults,
    orderedFibers,
    dependencyGraph,
    // other fields...
  } = environment;

  // Apply filtering based on options (name, hideDisabled, etc.)
  const fibersToProcess = filterFibersBasedOnOptions(orderedFibers, options);

  // Create display models for each fiber
  const fiberModels = fibersToProcess.map(fiberId => 
    createFiberDisplayModel(fiberId, environment, options)
  );

  // Generate summary statistics
  const summary = createFiberSummaryModel(environment, options);

  return {
    fibers: fiberModels,
    summary
  };
}
/**
 * Creates a display model for a single fiber with all its metadata
 */
function createFiberDisplayModel(
  fiberId: string, 
  environment: FiberEnvironment,
  options: FiberCommandOptions
): FiberDisplayModel {
  // Implementation that extracts all needed data about a fiber
  // No console output here, just pure data transformation
}
// Other processing functions for different aspects of the data
```

### Step 3: Create Rendering Layer
Implement functions that render the processed data in different formats:

```typescript
// src/commands/fibers/renderer.ts
/**
 * Renders processed fiber data according to the specified format
 */
export function renderFibers(
  data: ProcessedFiberData,
  options: {
    format?: 'console' | 'json' | 'yaml';
    detailed?: boolean;
  } = {}
): string | void {
  const { format = 'console' } = options;

  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      return serializeToYaml(data);
    case 'console':
    default:
      renderToConsole(data, options);
      return;
  }
}
/**
 * Renders fiber data to console output
 */
function renderToConsole(data: ProcessedFiberData, options: any): void {
  // Display legend
  console.log(`Legend: ${DISPLAY.EMOJIS.FIBER} = fiber   ${DISPLAY.EMOJIS.CHAIN} = chain   ${DISPLAY.EMOJIS.ENABLED} = enabled   ${DISPLAY.EMOJIS.DISABLED} = disabled   ${DISPLAY.EMOJIS.DEPENDS_ON} = depends on\n`);

  // Render each fiber
  for (const fiber of data.fibers) {
    renderFiberToConsole(fiber, options);
  }

  // Render summary if needed
  if (data.fibers.length > 1) {
    renderSummaryToConsole(data.summary);
  }
}
/**
 * Renders a single fiber to console
 */
function renderFiberToConsole(fiber: FiberDisplayModel, options: any): void {
  // Implementation that formats and outputs fiber data
  // This function only deals with presentation, not business logic
}
// Other rendering functions for different output formats
```

### Step 4: Update Command Implementation
Refactor the command to use the new processing and rendering layers:

```typescript
// src/commands/fibers/get-command.ts
export function createGetCommand(): Command {
  return new Command('get')
    .description('Display details for fibers and their modules')
    .argument('[name]', 'Fiber name to display (displays all if not specified)')
    // ... options ...
    .action(async (name, options) => {
      try {
        // 1. Load data (reuse existing function)
        const environment = await loadConfigAndModules(options);
        // 2. Process data using the new processor
        const processedData = processFibers(environment, { 
          name, 
          hideDisabled: options.hideDisabled,
          available: options.available,
          detailed: options.detailed,
          // other options...
        });
        // 3. Handle special output formats directly
        if (options.json) {
          console.log(renderFibers(processedData, { format: 'json' }));
          return;
        } else if (options.yaml) {
          console.log(renderFibers(processedData, { format: 'yaml' }));
          return;
        }
        // 4. Handle regular console output
        renderFibers(processedData, {
          detailed: options.detailed
        });
      } catch (error) {
        console.error('Error processing fibers:', error);
        process.exit(1);
      }
    });
}
```

### Step 5: Refactor Display Module
Update the existing display module to use the new display models:
1. Move business logic out of display functions
2. Make display functions focus only on formatting and output
3. Keep backward compatibility for other commands that might use these functions

### Step 6: Write Tests
Create unit tests for:
1. Data processing functions
2. Rendering functions
3. End-to-end command functionality

## Implementation Order
1. Create model interfaces
2. Implement processor functions with tests
3. Implement renderer functions with tests
4. Refactor the command to use the new layers
5. Refactor display module as needed
6. Update any dependent commands to use the new architecture

## Benefits
1. Make the code more modular and easier to maintain
2. Enable reuse of the same business logic for different interfaces
3. Allow easier addition of new output formats
4. Improve testability by separating concerns
5. Make it easier to extend with new features in the future

## Future Extensions
Once this architecture is in place, you could easily:
1. Add a web API using the same data processor
2. Create a GUI that uses the same models
3. Add more output formats (HTML, SVG, etc.)
4. Create interactive versions of the command

## Example Usage After Refactoring

```typescript
// CLI usage
const data = processFibers(environment, options);
renderFibers(data, { format: 'console' });
// API usage
const data = processFibers(environment, options);
return res.json(data);
// Testing
const data = processFibers(mockEnvironment, options);
expect(data.fibers).toHaveLength(5);
expect(data.fibers[0].id).toBe('core');
```

---

## Required Changes
- Create data model interfaces for display
- Implement pure data processing functions
- Implement rendering functions for different output formats
- Refactor command to use new layers
- Update display module to use new models
- Write unit tests for processing and rendering

## Implementation Steps
- [x] Create model interfaces
- [x] Implement processor functions with tests
- [x] Implement renderer functions with tests
- [x] Refactor command to use new layers
- [x] Refactor display module as needed
- [x] Update dependent commands

## Verification
- [x] All command outputs match expected results
- [x] Tests pass for processing and rendering
- [x] Code is modular and testable
- [x] Documentation updated

## Notes
This task was completed prior to the adoption of the todos-process. All context and requirements are now fully captured in this file. 
