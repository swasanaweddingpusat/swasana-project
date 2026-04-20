const AVATAR_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500', 'bg-lime-500', 'bg-emerald-500',
  'bg-violet-500', 'bg-fuchsia-500', 'bg-rose-500', 'bg-sky-500',
  'bg-amber-500', 'bg-slate-500',
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
