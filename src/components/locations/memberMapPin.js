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
      <div class="member-map-marker__shape">
      </div>
    </div>
  `;
};
