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
 * Serializes an object to YAML
 * @param obj Object to serialize
 * @returns YAML string
 */
export function serializeToYaml(obj: Record<string, unknown>): string {
  try {
    return dump(obj, {
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
  const data = await loadYamlFile(path) || {};
  
  // Update the field
  const fieldParts = fieldPath.split('.');
  let current = data as Record<string, unknown>;
  
  for (let i = 0; i < fieldParts.length - 1; i++) {
    const part = fieldParts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  
  current[fieldParts[fieldParts.length - 1]] = value;
  
  // Save the updated YAML
  await saveYamlFile(path, data as Record<string, unknown>);
} 
