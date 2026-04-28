const AVATAR_COLORS = [
  'bg-zinc-800',
  'bg-zinc-600',
  'bg-zinc-500',
  'bg-zinc-400',
  'bg-neutral-700',
  'bg-neutral-500',
  'bg-stone-600',
  'bg-stone-500',
];

export function getAvatarColor(input: string): string {
  if (!input) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash = hash & hash;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getUserInitials(name: string): string {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) {
    return parts[0].length >= 2
      ? parts[0].substring(0, 2).toUpperCase()
      : parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}
