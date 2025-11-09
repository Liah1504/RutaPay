// Helper para obtener la URL del avatar con cache-buster y fallback.
// Usa esto en todos los lugares donde muestres un avatar.
export function getAvatarSrc(user) {
  if (!user) return '/images/default-avatar.png';
  // soporta varias formas de respuesta del backend
  const url = user.avatar_url || user.avatar || (user.user && (user.user.avatar_url || user.user.avatar)) || null;
  // preferir timestamp/updated_at/avatarHash si el backend lo devuelve
  const version = user.avatar_updated_at || user.avatarHash || user.updated_at || user.user?.avatar_updated_at || Date.now();
  if (!url) return '/images/default-avatar.png';
  const sep = url.includes('?') ? '&' : '?';
  const t = typeof version === 'number' ? version : (new Date(version).getTime ? new Date(version).getTime() : Date.now());
  return `${url}${sep}t=${t}`;
}