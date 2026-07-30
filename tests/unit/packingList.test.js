import { describe, expect, it } from 'vitest';
import {
  normalizeTripPackingList,
  selectAllPackingCatalogItems,
} from '@/utils/packingList';

const catalog = [
  {
    id: 'documents',
    category: '重要證件',
    items: [
      { id: 'passport', name: '護照' },
      { id: 'ticket', name: '機票' },
    ],
  },
];

describe('trip packing selection', () => {
  it('selects the full catalog without replacing edited or custom items', () => {
    const selected = [
      {
        id: 'documents',
        category: '重要證件',
        items: [
          { id: 'passport', name: '全家護照' },
          { id: 'trip-custom', name: '紙本行程' },
        ],
      },
    ];

    expect(selectAllPackingCatalogItems({ selected, catalog })).toEqual([
      {
        id: 'documents',
        category: '重要證件',
        items: [
          { id: 'passport', name: '全家護照' },
          { id: 'ticket', name: '機票' },
          { id: 'trip-custom', name: '紙本行程' },
        ],
      },
    ]);
  });

  it('normalizes an empty selection for persistence', () => {
    expect(normalizeTripPackingList([])).toEqual([]);
  });
});
