// Type declarations for Bun's test module
declare module 'bun:test' {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect(actual: any): {
    toBe(expected: any): void;
    toEqual(expected: any): void;
    toContain(item: any): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeInstanceOf(constructor: any): void;
    toMatch(pattern: RegExp | string): void;
    toHaveLength(length: number): void;
    toHaveProperty(propertyName: string, value?: any): void;
    toThrow(error?: string | RegExp | Error | ErrorConstructor): void;
    toBeCloseTo(expected: number, precision?: number): void;
    not: {
      toBe(expected: any): void;
      toEqual(expected: any): void;
      toContain(item: any): void;
      toBeGreaterThan(expected: number): void;
      toBeGreaterThanOrEqual(expected: number): void;
      toBeLessThan(expected: number): void;
      toBeLessThanOrEqual(expected: number): void;
      toBeDefined(): void;
      toBeUndefined(): void;
      toBeNull(): void;
      toBeInstanceOf(constructor: any): void;
      toMatch(pattern: RegExp | string): void;
      toHaveLength(length: number): void;
      toHaveProperty(propertyName: string, value?: any): void;
      toThrow(error?: string | RegExp | Error | ErrorConstructor): void;
      toBeCloseTo(expected: number, precision?: number): void;
    }
  };
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
} 
