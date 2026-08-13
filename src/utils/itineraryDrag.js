const toId = (value) => String(value || '');

export const collectItineraryDescendants = (items, parentId) => {
  const rows = Array.isArray(items) ? items : [];
  const descendantIds = new Set();
  const parentIds = new Set([toId(parentId)]);
  let changed = true;

  while (changed) {
    changed = false;
    rows.forEach((item) => {
      const itemId = toId(item?.id);
      if (
        !itemId ||
        descendantIds.has(itemId) ||
        !parentIds.has(toId(item?.parentId))
      ) {
        return;
      }
      descendantIds.add(itemId);
      parentIds.add(itemId);
      changed = true;
    });
  }

  return rows.filter((item) => descendantIds.has(toId(item?.id)));
};

export const attachDescendantsToMovedParent = (
  dayGroups,
  parentId,
  descendants
) => {
  const groups = Array.isArray(dayGroups) ? dayGroups : [];
  const childRows = Array.isArray(descendants) ? descendants : [];
  if (!childRows.length) return null;

  const childIds = new Set(childRows.map((item) => toId(item?.id)));
  groups.forEach((group) => {
    group.items = (group.items || []).filter(
      (item) => !childIds.has(toId(item?.id))
    );
  });

  const destination = groups.find((group) =>
    (group.items || []).some((item) => toId(item?.id) === toId(parentId))
  );
  if (!destination) return null;

  const parentIndex = destination.items.findIndex(
    (item) => toId(item?.id) === toId(parentId)
  );
  destination.items.splice(parentIndex + 1, 0, ...childRows);
  return destination;
};
