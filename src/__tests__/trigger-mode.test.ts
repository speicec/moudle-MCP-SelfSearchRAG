/**
 * Unit test for trigger mode CLAUDE.md verification
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const CLAUDE_MD_PATH = join(process.cwd(), 'CLAUDE.md');

describe('Trigger Mode Configuration', () => {
  it('CLAUDE.md should be minimal (trigger mode)', async () => {
    const content = readFileSync(CLAUDE_MD_PATH, 'utf-8');

    // Token estimation: ~4 chars per token
    const estimatedTokens = content.length / 4;

    expect(estimatedTokens).toBeLessThan(20);
  });

  it('CLAUDE.md should contain trigger line', async () => {
    const content = readFileSync(CLAUDE_MD_PATH, 'utf-8');

    expect(content).toContain('type_fix');
    expect(content).toContain('error_code');
  });

  it('CLAUDE.md should NOT contain detailed rules', async () => {
    const content = readFileSync(CLAUDE_MD_PATH, 'utf-8');

    // Should not contain rule details
    expect(content).not.toContain('null-assignment');
    expect(content).not.toContain('2322');
    expect(content).not.toContain('default-value');
  });
});