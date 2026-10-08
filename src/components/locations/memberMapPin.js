const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const createMemberMapPinHtml = ({
  name,
  avatar,
  isOnline,
  isSelected,
  isTracked,
}) => {
  const displayName = name || '';
  const avatarHtml = avatar
    ? `<img src="${escapeHtml(avatar)}" alt="" />`
    : `<span>${escapeHtml(displayName.slice(0, 1))}</span>`;

  return `
    <div class="member-map-marker ${isOnline ? 'is-online' : 'is-offline'} ${isSelected ? 'is-selected' : ''} ${isTracked ? 'is-tracked' : ''}">
      <span class="member-map-marker__name">${escapeHtml(displayName)}</span>
      <div class="member-map-marker__avatar-ring">
        <div class="member-map-marker__avatar">${avatarHtml}</div>
      </div>
      <svg class="member-map-marker__shape" viewBox="0 0 56 68" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">
        <path d="M28 0C42.5 0 52.6 12.6 52.6 26C52.6 41 42 53 28 68C14 53 3.4 41 3.4 26C3.4 12.6 13.5 0 28 0Z" />
      </svg>
    </div>
  `;
};

export const createGatheringMapPinHtml = ({
  label = '集合',
  isActive = false,
}) => `
  <div class="gathering-map-marker ${isActive ? 'is-active' : ''}">
    <div class="gathering-map-marker__label">${escapeHtml(label || '集合')}</div>
    <div class="gathering-map-marker__shape">
      <span>集合</span>
    </div>
  </div>
`;
