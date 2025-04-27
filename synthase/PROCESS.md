# Synthase Development Process

## Initial Contextualization

1. **Understand Command Structure** - `/src/commands/fibers/index.ts`
   - Review how commands are organized and processed
   - Identify key functions and their relationships

2. **Examine Utility Functions** - `/src/commands/fibers/utils.ts`
   - Core utility functions define how data is processed
   - Particular focus on dependency ordering logic (`orderFibersByDependencies`)

3. **Study Display Logic** - `/src/commands/fibers/display.ts`
   - Output formatting determines user experience
   - UI conventions and visual indicators

4. **Review Module Organization** - `/src/commands/fibers/organization.ts`
   - How modules are organized and associations established
   - Chain-fiber relationships

5. **Understand Configuration System** - `/src/config/loader.ts`
   - Configuration priorities: module metadata → fiber config files → global config
   - Special handling for `core` and `dotfiles` fibers

6. **Check Module Discovery** - `/src/modules/discovery.ts`
   - How modules are detected and loaded
   - Handling of config.yaml files

7. **Review CHANGELOG** - `CHANGELOG.md`
   - Understand documentation standards
   - Learn about recent changes and current work

## Making Changes

1. **Test Current Behavior**
   - Run existing commands to see current output
   - Use `--detailed` flag to get more information

2. **Identify Specific Issues**
   - Look for inconsistencies between implementation and expected behavior
   - Trace issues back to specific code sections

3. **Make Targeted Modifications**
   - Change one component at a time
   - Maintain consistent style and naming

4. **Test Incrementally**
   - Test after each meaningful change
   - Compare against expected behavior

5. **Update Documentation**
   - Add CHANGELOG entries in the proper format:
     ```
     ## Component Name
     
     ### Type (Added/Changed/Fixed)
     - **Feature Name**
       - Specific change details
       - Impact of changes
     
     ### Files Modified
     - List of files changed
     ```

## Project Conventions

1. **Configuration Priority**
   - Module metadata takes precedence
   - Then fiber-specific config files
   - Global config as fallback

2. **Special Cases**
   - `core` fiber is always first in listings
   - `dotfiles` follows special handling rules

3. **Code Style**
   - Strong typing with detailed interfaces
   - Descriptive function and variable names
   - Comments explaining non-obvious logic

4. **UX Principles**
   - Clean, concise output
   - Visual indicators (e.g., 🟢, 🔴 for status)
   - Optional detailed output for debugging 
