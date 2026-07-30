// No profile-photo upload exists yet (CONTEXT.md doesn't scope one) —
// falls back to a deterministic initials circle keyed off the user's
// id, so the same person always gets the same color across sessions.
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 45%)`;
}

export function Avatar({
  userId,
  name,
  image,
  size = 8,
}: {
  userId: string;
  name: string;
  image?: string | null;
  size?: number;
}) {
  const dimension = `${size * 0.25}rem`;
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: dimension, height: dimension }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
      style={{ width: dimension, height: dimension, backgroundColor: colorFor(userId) }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
