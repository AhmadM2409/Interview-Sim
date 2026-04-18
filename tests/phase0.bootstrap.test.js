import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 0 bootstrap readiness', () => {
  it('has CI workflow file prepared for future execution', () => {
    const workflowPath = path.join(process.cwd(), '.github', 'workflows', 'test.yml');
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  it('has phase-specific test scripts', () => {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    expect(pkg.scripts['test:phase0']).toBeTypeOf('string');
    expect(pkg.scripts['test:phase1']).toBeTypeOf('string');
    expect(pkg.scripts['test:phase2']).toBeTypeOf('string');
    expect(pkg.scripts['test:phase3']).toBeTypeOf('string');
    expect(pkg.scripts['test:phase4']).toBeTypeOf('string');
    expect(pkg.scripts['test:phase5']).toBeTypeOf('string');
    expect(pkg.scripts['test:phase6']).toBeTypeOf('string');
  });
});
