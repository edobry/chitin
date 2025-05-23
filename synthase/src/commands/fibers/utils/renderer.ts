/**
 * @file renderer.ts
 * @description Rendering functions for the fiber command refactoring
 */

import { ProcessedFiberData, FiberDisplayModel, ChainDisplayModel } from '../types';
import { EMOJI } from '../../../constants';
import { serializeToYaml } from '../../../utils/yaml';

/**
 * Rendering options for the fiber command
 */
export interface RenderOptions {
  format?: 'console' | 'json' | 'yaml';
  detailed?: boolean;
}

/**
 * Renders processed fiber data according to the specified format
 */
export function renderFibers(
  data: ProcessedFiberData,
  options: RenderOptions = {}
): string | void {
  const { format = 'console' } = options;

  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'yaml':
      return serializeToYaml(data as unknown as Record<string, unknown>);
    case 'console':
    default:
      renderToConsole(data, options);
      return;
  }
}

/**
 * Renders fiber data to console output
 */
function renderToConsole(data: ProcessedFiberData, options: RenderOptions): void {
  // Display legend with status explanations
  console.log(`Legend:`);
  console.log(`  ${EMOJI.FIBER} = fiber`);
  console.log(`  ${EMOJI.CHAIN} = chain`);
  console.log(`  ${EMOJI.ACTIVE} = active`);
  console.log(`  ${EMOJI.DISABLED} = disabled (explicitly disabled in config)`);
  console.log(`  ${EMOJI.UNAVAILABLE} = unavailable (dependencies not satisfied)`);
  console.log(`  ${EMOJI.DEPENDS_ON} = depends on`);
  console.log(`  ${EMOJI.TOOL} = tool`);
  console.log(`  ${EMOJI.PATH} = path\n`);

  // Render each fiber
  for (const fiber of data.fibers) {
    // Add separator between fibers
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    renderFiberToConsole(fiber, options);
  }

  // Add final separator
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Render summary if needed
  if (data.fibers.length > 1) {
    renderSummaryToConsole(data.summary);
  }
}

/**
 * Renders a single fiber to console
 */
function renderFiberToConsole(fiber: FiberDisplayModel, options: RenderOptions): void {
  // Get status indicator
  const statusIndicator = getFiberStatusIndicator(fiber);
  const validationIndicator = fiber.validation.isValid ? '' : '✗';
  
  // Display fiber header with proper alignment and emoji
  console.log(`  ${statusIndicator} ${EMOJI.FIBER} ${fiber.id}${validationIndicator}`);
  console.log('');
  
  // Display path
  console.log(`  ${EMOJI.PATH} ${fiber.path}`);
  
  // Display validation results
  if (fiber.validation.errors.length > 0) {
    console.log('  Validation Errors:');
    for (const error of fiber.validation.errors) {
      console.log(`    ${EMOJI.ERROR} ${error}`);
    }
  }
  
  // Only show dependency information if fiber is disabled due to missing deps
  if (!fiber.isEnabled) {
    const unsatisfiedDeps = fiber.dependencies.filter(dep => !dep.isSatisfied);
    if (unsatisfiedDeps.length > 0) {
      const missingDeps = unsatisfiedDeps.map(dep => dep.id).join(', ');
      console.log(`  ${EMOJI.WARNING} Missing dependencies: ${missingDeps}`);
    }
  }
  
  // Display dependencies
  if (fiber.dependencies.length > 0) {
    const dependencyText = fiber.dependencies.map(d => d.id).join(', ');
    console.log(`  ${EMOJI.DEPENDS_ON} Depends on: ${dependencyText}`);
    
    // Add detailed dependency info if requested
    if (options.detailed) {
      for (const dep of fiber.dependencies) {
        const status = dep.isSatisfied ? EMOJI.ACTIVE : EMOJI.DISABLED;
        console.log(`    ${status} ${dep.id} (${dep.source})`);
      }
    }
  }
  
  // Add separator
  console.log(`  ───────────────────────────────────────────`);
  
  // Display chains
  if (fiber.chains.length > 0) {
    const pluralS = fiber.chains.length === 1 ? '' : 's';
    console.log(`  ${fiber.chains.length} ${EMOJI.CHAIN}${pluralS}:`);
    
    for (const chain of fiber.chains) {
      renderChainToConsole(chain, options);
    }
  } else {
    console.log(`  0 ${EMOJI.CHAIN}s`);
  }
}

/**
 * Renders a single chain to console
 */
function renderChainToConsole(chain: ChainDisplayModel, options: RenderOptions): void {
  // Get status indicator based on enabled and available status
  const statusIndicator = chain.isEnabled && chain.isAvailable 
    ? EMOJI.ACTIVE 
    : chain.isEnabled && !chain.isAvailable 
      ? EMOJI.DISABLED 
      : EMOJI.DISABLED;
  
  const validationIndicator = chain.validation.isValid ? '' : '✗';
  
  // Display chain header with proper indentation
  console.log(`    ${statusIndicator} ${chain.id}${validationIndicator}`);
  
  // Display validation results
  if (chain.validation.errors.length > 0) {
    console.log('      Validation Errors:');
    for (const error of chain.validation.errors) {
      console.log(`        ${EMOJI.ERROR} ${error}`);
    }
  }
  
  // Show availability status if chain is enabled but not available
  if (chain.isEnabled && !chain.isAvailable) {
    const unsatisfiedDeps = chain.dependencies.filter(dep => !dep.isSatisfied);
    if (unsatisfiedDeps.length > 0) {
      const missingDeps = unsatisfiedDeps.map(dep => dep.id).join(', ');
      console.log(`      ${EMOJI.DISABLED} Missing dependencies: ${missingDeps}`);
    }
  }
  
  // Display dependencies if any
  if (chain.dependencies.length > 0) {
    console.log(`      ${EMOJI.DEPENDS_ON} Depends on: ${chain.dependencies.map(d => d.id).join(', ')}`);
    
    // Add detailed dependency info if requested
    if (options.detailed) {
      for (const dep of chain.dependencies) {
        const status = dep.isSatisfied ? EMOJI.ACTIVE : EMOJI.DISABLED;
        console.log(`        ${status} ${dep.id}`);
      }
    }
  }
  
  // Display tool dependencies if any
  if (chain.toolDependencies?.length) {
    console.log(`      ${EMOJI.TOOL} Tools: ${chain.toolDependencies.join(', ')}`);
  }
}

/**
 * Renders the summary to console
 */
function renderSummaryToConsole(summary: ProcessedFiberData['summary']): void {
  console.log('\nSummary:');
  console.log(`  Fibers: ${summary.displayedFibers}/${summary.totalFibers} displayed (${summary.configuredFibers} configured)`);
  console.log(`  Chains: ${summary.displayedChains}/${summary.totalChains} displayed (${summary.configuredChains} configured)`);
  console.log(`  Validation: ${summary.validModules}/${summary.totalModules} modules valid`);
}

/**
 * Gets the status indicator for a fiber
 */
function getFiberStatusIndicator(fiber: FiberDisplayModel): string {
  if (fiber.isCore) {
    return ''; // Don't add status indicator for core fibers
  }
  return fiber.isEnabled ? EMOJI.ACTIVE : EMOJI.DISABLED;
} 
