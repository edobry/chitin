/**
 * @file renderer.ts
 * @description Rendering functions for the fiber command refactoring
 */

import { ProcessedFiberData, FiberDisplayModel, ChainDisplayModel } from './models';
import { DISPLAY } from '../../constants';
import { serializeToYaml } from '../../utils';

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
  // Display legend
  console.log(`Legend: ${DISPLAY.EMOJIS.FIBER} = fiber   ${DISPLAY.EMOJIS.CHAIN} = chain   ${DISPLAY.EMOJIS.ENABLED} = enabled   ${DISPLAY.EMOJIS.DISABLED} = disabled   ${DISPLAY.EMOJIS.DEPENDS_ON} = depends on\n`);

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
  console.log(`  ${statusIndicator} ${DISPLAY.EMOJIS.FIBER} ${fiber.id}${validationIndicator}`);
  console.log('');
  
  // Display path
  console.log(`  📂 ${fiber.path}`);
  
  // Display validation results
  if (fiber.validation.errors.length > 0) {
    console.log('  Validation Errors:');
    for (const error of fiber.validation.errors) {
      console.log(`    ✗ ${error}`);
    }
  }
  if (fiber.validation.warnings.length > 0) {
    console.log('  Validation Warnings:');
    for (const warning of fiber.validation.warnings) {
      console.log(`    ⚠️ ${warning}`);
    }
  }
  
  // Display dependencies
  if (fiber.dependencies.length > 0) {
    const dependencyText = fiber.dependencies.map(d => d.id).join(', ');
    console.log(`  ${DISPLAY.EMOJIS.DEPENDS_ON} Depends on: ${dependencyText}`);
    
    // Add detailed dependency info if requested
    if (options.detailed) {
      for (const dep of fiber.dependencies) {
        console.log(`    📌 Source: ${dep.source}`);
      }
    }
  }
  
  // Add separator
  console.log(`  ───────────────────────────────────────────`);
  
  // Display chains
  if (fiber.chains.length > 0) {
    const pluralS = fiber.chains.length === 1 ? '' : 's';
    console.log(`  ${fiber.chains.length} ${DISPLAY.EMOJIS.CHAIN}${pluralS}:`);
    
    for (const chain of fiber.chains) {
      renderChainToConsole(chain, options);
    }
  } else {
    console.log(`  0 ${DISPLAY.EMOJIS.CHAIN}s`);
  }
}

/**
 * Renders a single chain to console
 */
function renderChainToConsole(chain: ChainDisplayModel, options: RenderOptions): void {
  // Get status indicator
  const statusIndicator = chain.isEnabled ? DISPLAY.EMOJIS.ENABLED : DISPLAY.EMOJIS.DISABLED;
  const validationIndicator = chain.validation.isValid ? '' : '✗';
  
  // Display chain header with proper indentation
  console.log(`    ${statusIndicator} ${chain.id}${validationIndicator}`);
  
  // Display validation results
  if (chain.validation.errors.length > 0) {
    console.log('      Validation Errors:');
    for (const error of chain.validation.errors) {
      console.log(`        ✗ ${error}`);
    }
  }
  if (chain.validation.warnings.length > 0) {
    console.log('      Validation Warnings:');
    for (const warning of chain.validation.warnings) {
      console.log(`        ⚠️ ${warning}`);
    }
  }
  
  // Display dependencies if any
  if (chain.dependencies.length > 0) {
    console.log(`      ${DISPLAY.EMOJIS.DEPENDS_ON} Depends on: ${chain.dependencies.join(', ')}`);
  }
  
  // Display tool dependencies if any
  if (chain.toolDependencies?.length) {
    console.log(`      🛠️ Tools: ${chain.toolDependencies.join(', ')}`);
  }
  
  // Display provides if any
  if (chain.provides?.length) {
    console.log(`      📦 Provides: ${chain.provides.join(', ')}`);
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
  return fiber.isEnabled ? DISPLAY.EMOJIS.ENABLED : DISPLAY.EMOJIS.DISABLED;
} 
