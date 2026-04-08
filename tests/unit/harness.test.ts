/**
 * @spec evaluation.md#单元测试
 * @description Harness 约束引擎单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConstraintEngine, defaultRules } from '../../src/harness/constraints/engine';

describe('ConstraintEngine', () => {
  let engine: ConstraintEngine;

  beforeEach(() => {
    engine = new ConstraintEngine();
  });

  it('should allow when no rules match', () => {
    const result = engine.check({
      operation: 'test',
      input: {}
    });
    expect(result.allowed).toBe(true);
  });

  it('should block sensitive paths', () => {
    engine.registerRule(defaultRules[1]); // sensitive-path rule

    const result = engine.check({
      operation: 'index',
      input: { path: '/home/user/.env' }
    });

    expect(result.allowed).toBe(false);
    expect(result.message).toContain('敏感文件');
  });

  it('should warn on large files', () => {
    engine.registerRule(defaultRules[0]); // max-file-size rule

    const result = engine.check({
      operation: 'index',
      input: { fileSize: 20 * 1024 * 1024 } // 20MB
    });

    expect(result.allowed).toBe(true); // warn doesn't block
  });

  it('should allow non-sensitive paths', () => {
    engine.registerRule(defaultRules[1]); // sensitive-path rule

    const result = engine.check({
      operation: 'index',
      input: { path: '/home/user/document.md' }
    });

    expect(result.allowed).toBe(true);
  });

  it('should disable all rules when disabled', () => {
    engine.registerRule(defaultRules[1]);
    engine.setEnabled(false);

    const result = engine.check({
      operation: 'index',
      input: { path: '/home/user/.env' }
    });

    expect(result.allowed).toBe(true);
  });
});