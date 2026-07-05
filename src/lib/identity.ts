const EMOJIS = [
  '🦊', '🐢', '🦉', '🦁', '🐯', '🐨', '🐼', '🐸', '🐙', '🦋', 
  '🦄', '🐙', '🐬', '🐳', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', 
  '🦒', '🦘', '🦡', '🦦', '🦫', '🐏', '🦙', '🐐', '🦌', '🐈'
];

const COLORS = [
  { name: 'Red', bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  { name: 'Amber', bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  { name: 'Emerald', bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  { name: 'Teal', bg: 'bg-teal-100 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
  { name: 'Cyan', bg: 'bg-cyan-100 dark:bg-cyan-950/40', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800' },
  { name: 'Sky', bg: 'bg-sky-100 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800' },
  { name: 'Blue', bg: 'bg-blue-100 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  { name: 'Indigo', bg: 'bg-indigo-100 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
  { name: 'Violet', bg: 'bg-violet-100 dark:bg-violet-950/40', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-200 dark:border-violet-800' },
  { name: 'Fuchsia', bg: 'bg-fuchsia-100 dark:bg-fuchsia-950/40', text: 'text-fuchsia-700 dark:text-fuchsia-300', border: 'border-fuchsia-200 dark:border-fuchsia-800' },
  { name: 'Pink', bg: 'bg-pink-100 dark:bg-pink-950/40', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
  { name: 'Rose', bg: 'bg-rose-100 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export interface AnonymousIdentity {
  emoji: string;
  colorName: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  fullName: string;
}

export function getAnonymousIdentity(sessionId: string, postId: string): AnonymousIdentity {
  if (!sessionId || !postId) {
    return {
      emoji: '❓',
      colorName: 'Gray',
      bgClass: 'bg-gray-100 dark:bg-gray-900',
      textClass: 'text-gray-700 dark:text-gray-300',
      borderClass: 'border-gray-200 dark:border-gray-800',
      fullName: '❓ Gray'
    };
  }

  // Combine post ID and session ID to compute a unique seed for this specific post context
  const key = `${sessionId}-${postId}`;
  const hash = hashString(key);

  const emoji = EMOJIS[hash % EMOJIS.length];
  const color = COLORS[hash % COLORS.length];

  return {
    emoji,
    colorName: color.name,
    bgClass: color.bg,
    textClass: color.text,
    borderClass: color.border,
    fullName: `${emoji} ${color.name}`
  };
}
