import { load, dump } from 'js-yaml';
import { fileExists, readFile, writeFile } from './file';

/**
 * Parses a YAML string
 * @param yamlStr YAML string to parse
 * @returns Parsed object
 */
export function parseYaml<T = Record<string, unknown>>(yamlStr: string): T {
  try {
    return load(yamlStr) as T;
  } catch (e) {
    throw new Error(`Failed to parse YAML: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Serializes an object to YAML, removing empty objects and duplicated properties
 * @param obj Object to serialize
 * @returns YAML string
 */
export function serializeToYaml(obj: Record<string, unknown>): string {
  try {
    // Make a copy to modify
    const cleaned = {...obj};
    
    // Filter out empty top-level objects
    for (const key of Object.keys(cleaned)) {
      const value = cleaned[key];
      if (value && typeof value === 'object' && Object.keys(value).length === 0) {
        delete cleaned[key];
      }
    }
    
    // Remove duplicated core properties from top level
    if (cleaned.core && typeof cleaned.core === 'object') {
      const coreProps = [
        'projectDir', 
        'dotfilesDir', 
        'checkTools', 
        'installToolDeps', 
        'autoInitDisabled', 
        'loadParallel'
      ];
      
      for (const prop of coreProps) {
        if (prop in cleaned && prop in cleaned.core) {
          // Remove duplicated property from top level
          delete cleaned[prop];
        }
      }
    }
    
    return dump(cleaned, {
      indent: 2,
      lineWidth: 100,
      noRefs: true,
    });
  } catch (e) {
    throw new Error(`Failed to serialize to YAML: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Loads a YAML file
 * @param path File path
 * @returns Parsed object, or null if file doesn't exist
 */
export async function loadYamlFile<T = Record<string, unknown>>(path: string): Promise<T | null> {
  try {
    if (!await fileExists(path)) {
      return null;
    }
    
    const content = await readFile(path);
    return parseYaml<T>(content);
  } catch (e) {
    throw new Error(`Failed to load YAML file ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Saves an object to a YAML file
 * @param path File path
 * @param data Object to save
 */
export async function saveYamlFile(path: string, data: Record<string, unknown>): Promise<void> {
  try {
    const yamlStr = serializeToYaml(data);
    await writeFile(path, yamlStr);
  } catch (e) {
    throw new Error(`Failed to save YAML file ${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Updates a field in a YAML file
 * @param path File path
 * @param fieldPath Dot-notation path to the field
 * @param value New value
 */
export async function updateYamlField(
  path: string, 
  fieldPath: string, 
  value: unknown
): Promise<void> {
  // Load the YAML file
  const data = (await loadYamlFile(path)) || {} as Record<string, unknown>;
  
  // Update the field
  const fieldParts = fieldPath.split('.');
  let current = data;
  
  for (let i = 0; i < fieldParts.length - 1; i++) {
    const part = fieldParts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  
  current[fieldParts[fieldParts.length - 1]] = value;
  
  // Save the updated YAML
  await saveYamlFile(path, data);
} 
