import defaultPackingList from '@/data/packingList.json';

const clone = (value) => JSON.parse(JSON.stringify(value));

const cleanText = (value) => String(value || '').trim();

const packingItemKey = (category, item) =>
  `${cleanText(category).toLowerCase()}::${cleanText(item).toLowerCase()}`;

export const normalizePackingCatalog = (value = defaultPackingList) => {
  const categoryIds = new Set();
  const itemIds = new Set();

  return (Array.isArray(value) ? value : [])
    .map((entry, categoryIndex) => {
      const category = cleanText(entry?.category || entry?.name);
      if (!category) return null;

      let categoryId = cleanText(entry?.id);
      if (!categoryId || categoryIds.has(categoryId)) {
        categoryId = `packing-category-${categoryIndex + 1}`;
      }
      categoryIds.add(categoryId);

      const items = (Array.isArray(entry?.items) ? entry.items : [])
        .map((item, itemIndex) => {
          const name = cleanText(item?.name || item);
          if (!name) return null;

          let id = cleanText(item?.id);
          if (!id || itemIds.has(id)) {
            id = `packing-item-${categoryIndex + 1}-${itemIndex + 1}`;
          }
          itemIds.add(id);
          return { id, name };
        })
        .filter(Boolean);

      return { id: categoryId, category, items };
    })
    .filter(Boolean);
};

export const DEFAULT_PACKING_CATALOG =
  normalizePackingCatalog(defaultPackingList);

const defaultManagedKeys = new Set(
  DEFAULT_PACKING_CATALOG.flatMap((category) =>
    category.items.map((item) => packingItemKey(category.category, item.name))
  )
);

export const normalizeTripPackingList = (value = []) =>
  normalizePackingCatalog(value).map((category) => ({
    ...category,
    items: category.items.map((item) => ({ ...item })),
  }));

export const selectAllPackingCatalogItems = ({
  selected = [],
  catalog = [],
}) => {
  const normalizedSelected = normalizeTripPackingList(selected);
  const normalizedCatalog = normalizePackingCatalog(catalog);
  const existingItems = new Map(
    normalizedSelected.flatMap((category) =>
      category.items.map((item) => [item.id, item])
    )
  );
  const catalogItemIds = new Set(
    normalizedCatalog.flatMap((category) =>
      category.items.map((item) => item.id)
    )
  );

  const merged = normalizedCatalog.map((category) => ({
    ...category,
    items: category.items.map((item) => ({
      ...item,
      name: existingItems.get(item.id)?.name || item.name,
    })),
  }));

  normalizedSelected.forEach((category) => {
    const customItems = category.items.filter(
      (item) => !catalogItemIds.has(item.id)
    );
    if (!customItems.length) return;

    let target = merged.find((entry) => entry.id === category.id);
    if (!target) {
      target = { id: category.id, category: category.category, items: [] };
      merged.push(target);
    }
    target.items.push(...customItems);
  });

  return normalizeTripPackingList(merged);
};

export const hasPackingItems = (value = []) =>
  normalizeTripPackingList(value).some((category) => category.items.length > 0);

export const getPackingTemplateSignature = (template = []) =>
  JSON.stringify(
    normalizeTripPackingList(template).map((category) => ({
      id: category.id,
      category: category.category,
      items: category.items.map((item) => ({ id: item.id, name: item.name })),
    }))
  );

export const getPackingStorageKey = (tripId, participantId = 'guest') =>
  `guidebook_packing_list_v3_${cleanText(tripId) || 'no-trip'}_${
    cleanText(participantId) || 'guest'
  }`;

const normalizeSavedPackingList = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((entry, categoryIndex) => {
      const category = cleanText(entry?.category || entry?.name);
      if (!category) return null;
      return {
        id: cleanText(entry?.id) || `saved-category-${categoryIndex + 1}`,
        category,
        source: entry?.source === 'custom' ? 'custom' : 'trip',
        items: (Array.isArray(entry?.items) ? entry.items : [])
          .map((item, itemIndex) => {
            const name = cleanText(item?.name || item);
            if (!name) return null;
            return {
              id:
                cleanText(item?.id) ||
                `saved-item-${categoryIndex + 1}-${itemIndex + 1}`,
              name,
              checked: Boolean(item?.checked),
              source:
                item?.source === 'custom'
                  ? 'custom'
                  : item?.source === 'trip'
                    ? 'trip'
                    : '',
            };
          })
          .filter(Boolean),
      };
    })
    .filter(Boolean);

export const mergePackingState = ({ saved = null, template = [] } = {}) => {
  const normalizedTemplate = normalizeTripPackingList(template);
  const templateSignature = getPackingTemplateSignature(normalizedTemplate);
  const savedState = Array.isArray(saved)
    ? { version: 2, templateSignature: '', list: saved }
    : saved && typeof saved === 'object'
      ? saved
      : { version: 3, templateSignature: '', list: [] };
  const savedList = normalizeSavedPackingList(savedState.list);
  const templateChanged = savedState.templateSignature !== templateSignature;
  const hasSavedState = Boolean(saved);

  const templateIds = new Set(
    normalizedTemplate.flatMap((category) =>
      category.items.map((item) => item.id)
    )
  );
  const templateKeys = new Set(
    normalizedTemplate.flatMap((category) =>
      category.items.map((item) => packingItemKey(category.category, item.name))
    )
  );
  const savedById = new Map();
  const savedByKey = new Map();
  savedList.forEach((category) => {
    category.items.forEach((item) => {
      savedById.set(item.id, item);
      savedByKey.set(packingItemKey(category.category, item.name), item);
    });
  });

  const list = normalizedTemplate.map((category) => ({
    id: category.id,
    category: category.category,
    source: 'trip',
    items: category.items
      .map((item) => {
        const existing =
          savedById.get(item.id) ||
          savedByKey.get(packingItemKey(category.category, item.name));
        if (hasSavedState && !templateChanged && !existing) return null;
        return {
          id: item.id,
          name: item.name,
          checked: Boolean(existing?.checked),
          source: 'trip',
        };
      })
      .filter(Boolean),
  }));

  savedList.forEach((savedCategory) => {
    const customItems = savedCategory.items.filter((item) => {
      const key = packingItemKey(savedCategory.category, item.name);
      const isManaged =
        item.source !== 'custom' &&
        (item.source === 'trip' ||
          templateIds.has(item.id) ||
          templateKeys.has(key) ||
          defaultManagedKeys.has(key));
      return !isManaged;
    });
    if (!customItems.length) return;

    let target = list.find(
      (category) =>
        category.id === savedCategory.id ||
        category.category === savedCategory.category
    );
    if (!target) {
      target = {
        id: savedCategory.id,
        category: savedCategory.category,
        source: 'custom',
        items: [],
      };
      list.push(target);
    }
    target.items.push(
      ...customItems.map((item) => ({ ...item, source: 'custom' }))
    );
  });

  return {
    version: 3,
    templateSignature,
    list: clone(list.filter((category) => category.items.length > 0)),
  };
};

export const createPackingStateFromTemplate = (template = []) =>
  mergePackingState({ template });

export const getPackingProgress = (value) => {
  const list = Array.isArray(value) ? value : value?.list || [];
  let total = 0;
  let checked = 0;
  list.forEach((category) => {
    (category.items || []).forEach((item) => {
      total += 1;
      if (item.checked) checked += 1;
    });
  });
  return total ? Math.round((checked / total) * 100) : 0;
};
