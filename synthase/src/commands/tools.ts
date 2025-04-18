import { Command } from 'commander';
import { serializeToYaml } from '../utils';
import { loadAndValidateConfig } from './utils';
import { UserConfig, ToolConfig, FiberConfig, ChainConfig } from '../types';

/**
 * Creates a tools command
 * @returns Configured Command object
 */
export function createToolsCommand(): Command {
  const command = new Command('tools')
    .description('List all configured tools and their settings')
    .option('-j, --json', 'Output as JSON instead of YAML')
    .option('-y, --yaml', 'Output as YAML')
    .option('-p, --path <path>', 'Custom path to user config file')
    .option('-d, --detailed', 'Show detailed information for each tool')
    .option('-c, --check', 'Check if tools are installed')
    .action(async (options) => {
      try {
        // Load and validate configuration
        const { config, validation } = await loadAndValidateConfig({
          userConfigPath: options.path,
          exitOnError: false
        });
        
        if (!validation.valid) {
          console.error('Configuration validation failed:');
          validation.errors.forEach(error => console.error(`- ${error}`));
          console.warn('Continuing despite validation errors...');
        }

        // Extract all tools from the configuration
        const tools = extractAllTools(config);
        
        // Handle JSON or YAML output
        if (options.json) {
          console.log(JSON.stringify(tools, null, 2));
          return;
        } else if (options.yaml) {
          console.log(serializeToYaml({ tools }));
          return;
        }

        // Display the tools
        displayTools(tools, options);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Extracts all tools from the configuration
 * @param config User configuration
 * @returns Map of tool IDs to their configurations and source
 */
function extractAllTools(config: UserConfig): Map<string, { config: ToolConfig, source: string }> {
  const tools = new Map<string, { config: ToolConfig, source: string }>();
  
  // Extract top-level tools
  if ('tools' in config && typeof config.tools === 'object') {
    for (const [toolId, toolConfig] of Object.entries(config.tools)) {
      tools.set(toolId, { config: toolConfig as ToolConfig, source: 'global' });
    }
  }
  
  // Extract tools from fibers
  for (const [fiberId, fiberConfig] of Object.entries(config)) {
    if (fiberId === 'tools' || typeof fiberConfig !== 'object') continue;
    
    // Cast to FiberConfig to use its properties safely
    const fiber = fiberConfig as FiberConfig;
    
    // Extract tools from the fiber
    if (fiber.tools && typeof fiber.tools === 'object') {
      for (const [toolId, toolConfig] of Object.entries(fiber.tools)) {
        tools.set(toolId, { 
          config: toolConfig as ToolConfig, 
          source: `fiber:${fiberId}`
        });
      }
    }
    
    // Extract tools from chains in the fiber
    if (fiber.moduleConfig && typeof fiber.moduleConfig === 'object') {
      for (const [chainId, chainConfig] of Object.entries(fiber.moduleConfig)) {
        const chain = chainConfig as ChainConfig;
        if (chain.tools && typeof chain.tools === 'object') {
          for (const [toolId, toolConfig] of Object.entries(chain.tools)) {
            tools.set(toolId, { 
              config: toolConfig as ToolConfig, 
              source: `chain:${fiberId}.${chainId}`
            });
          }
        }
      }
    }
  }
  
  return tools;
}

/**
 * Displays the tools in a formatted way
 * @param tools Map of tools to display
 * @param options Display options
 */
function displayTools(
  tools: Map<string, { config: ToolConfig, source: string }>,
  options: { detailed?: boolean, check?: boolean }
): void {
  console.log('Legend: 🔧 = tool   🔍 = check method   🚀 = install method\n');
  
  if (tools.size === 0) {
    console.log('No tools configured.');
    return;
  }

  console.log(`Found ${tools.size} configured tools:\n`);
  
  // Display each tool sorted by name
  const toolNames = Array.from(tools.keys()).sort();
  
  for (const toolId of toolNames) {
    const toolData = tools.get(toolId)!;
    
    // Display tool header
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log('');
    console.log(`  🔧 ${toolId}`);
    console.log('');
    
    // Display source
    console.log(`  Source: ${toolData.source}`);
    
    // Display check method
    displayCheckMethod(toolId, toolData.config);
    
    // Display install method
    displayInstallMethod(toolData.config);
    
    // Display additional properties in detailed mode
    if (options.detailed) {
      displayAdditionalInfo(toolData.config);
    }
    
    // Check if tool is installed if requested
    if (options.check) {
      console.log(`  Status: Checking not implemented yet`);
    }
  }
  
  // Display summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\nTotal: ${tools.size} tools configured`);
}

/**
 * Displays the check method for a tool
 * @param toolId Tool ID
 * @param config Tool configuration
 */
function displayCheckMethod(toolId: string, config: ToolConfig): void {
  console.log('  🔍 Check method:');
  
  if (config.checkCommand) {
    if (typeof config.checkCommand === 'string') {
      console.log(`    Command: ${config.checkCommand}`);
    } else {
      console.log(`    Command: ${toolId} --version (default)`);
    }
  } else if (config.checkBrew) {
    console.log('    Homebrew: brew list --formula | grep -q ${toolId}');
  } else if (config.checkPath) {
    console.log(`    Path: ${config.checkPath}`);
  } else if (config.checkEval) {
    console.log(`    Eval: ${config.checkEval}`);
  } else if (config.optional) {
    console.log('    Optional tool (no check)');
  } else {
    console.log(`    Default: command -v ${toolId}`);
  }
}

/**
 * Displays the install method for a tool
 * @param config Tool configuration
 */
function displayInstallMethod(config: ToolConfig): void {
  console.log('  🚀 Install method:');
  
  if (config.brew) {
    if (typeof config.brew === 'boolean') {
      console.log('    Homebrew: brew install');
    } else {
      const brew = config.brew;
      const cask = brew.cask ? ' --cask' : '';
      const tap = brew.tap ? ` from tap ${brew.tap}` : '';
      console.log(`    Homebrew: brew${cask} install ${brew.name || ''}${tap}`);
    }
  } else if (config.git) {
    console.log(`    Git: clone from ${config.git.url} to ${config.git.target}`);
  } else if (config.script) {
    console.log(`    Script: ${config.script}`);
  } else if (config.artifact) {
    console.log(`    Artifact: download from ${config.artifact.url}`);
  } else if (config.command) {
    console.log(`    Command: ${config.command}`);
  } else {
    console.log('    None specified');
  }
}

/**
 * Displays additional information for a tool
 * @param config Tool configuration
 */
function displayAdditionalInfo(config: ToolConfig): void {
  console.log('  📋 Additional info:');
  
  if (config.version) {
    console.log(`    Version: ${config.version}`);
  }
  
  if (config.versionCommand) {
    console.log(`    Version command: ${config.versionCommand}`);
  }
  
  if (config.postInstall) {
    console.log(`    Post-install: ${config.postInstall}`);
  }
  
  if (config.optional) {
    console.log('    Optional: yes');
  }
} 
