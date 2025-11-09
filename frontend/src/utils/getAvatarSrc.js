// Helper: devuelve la URL de avatar con cache-buster y fallback.
// Úsalo en todos los lugares donde muestres avatares.
export function getAvatarSrc(user) {
  if (!user) return '/images/default-avatar.png';
  // distintas APIs devuelven avatar_url, avatar o user.avatar
  const url = user.avatar_url || user.avatar || (user.user && (user.user.avatar_url || user.user.avatar)) || null;
  // si el backend provee un timestamp/updated_at/hash para avatar, uselo, si no use Date.now()
  const version = user.avatar_updated_at || user.avatarHash || user.updated_at || user.user?.avatar_updated_at || Date.now();
  if (!url) return '/images/default-avatar.png';
  // si ya contiene query params, anexar con &
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${new Date(version).getTime ? new Date(version).getTime() : version}`;
}