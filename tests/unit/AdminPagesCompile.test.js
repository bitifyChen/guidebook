import fs from 'node:fs';
import path from 'node:path';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import { describe, expect, it } from 'vitest';

const adminPages = [
  'config.vue',
  'index.vue',
  'itinerary.vue',
  'login.vue',
  'notifications.vue',
  'packing.vue',
  'participants.vue',
  'trips.vue',
  'item/add.vue',
  'item/[id].vue',
];

describe('admin page compile baseline', () => {
  it.each(adminPages)('%s compiles as a Vue SFC', (relativePath) => {
    const filename = path.resolve('src/pages/admin', relativePath);
    const source = fs.readFileSync(filename, 'utf8');
    const { descriptor, errors } = parse(source, { filename });
    expect(errors).toEqual([]);
    expect(() =>
      compileScript(descriptor, {
        id: `admin-${relativePath.replace(/\W/g, '-')}`,
      })
    ).not.toThrow();
    const result = compileTemplate({
      id: `admin-${relativePath.replace(/\W/g, '-')}`,
      filename,
      source: descriptor.template?.content || '',
    });
    expect(result.errors).toEqual([]);
  });
});
