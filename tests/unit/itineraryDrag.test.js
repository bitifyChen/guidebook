import { describe, expect, it } from 'vitest';
import {
  attachDescendantsToMovedParent,
  collectItineraryDescendants,
} from '@/utils/itineraryDrag';

describe('itinerary cross-day drag', () => {
  it('collects nested descendants in their original order', () => {
    const items = [
      { id: 'parent', parentId: '' },
      { id: 'child-a', parentId: 'parent' },
      { id: 'grandchild', parentId: 'child-a' },
      { id: 'other', parentId: '' },
      { id: 'child-b', parentId: 'parent' },
    ];

    expect(
      collectItineraryDescendants(items, 'parent').map((item) => item.id)
    ).toEqual(['child-a', 'grandchild', 'child-b']);
  });

  it('moves all descendants directly behind the parent in its new day', () => {
    const parent = { id: 'parent', parentId: '' };
    const child = { id: 'child', parentId: 'parent' };
    const groups = [
      { day: 1, items: [child, { id: 'day-one', parentId: '' }] },
      { day: 2, items: [{ id: 'before', parentId: '' }, parent] },
    ];

    const destination = attachDescendantsToMovedParent(groups, parent.id, [
      child,
    ]);

    expect(destination.day).toBe(2);
    expect(groups[0].items.map((item) => item.id)).toEqual(['day-one']);
    expect(groups[1].items.map((item) => item.id)).toEqual([
      'before',
      'parent',
      'child',
    ]);
  });
});
