/** The app icon (same artwork as public/icon.svg), drawn inline so it stays crisp in the header. */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={`shrink-0 drop-shadow-sm ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id="bm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8E7DFF" />
          <stop offset="0.55" stopColor="#6750F2" />
          <stop offset="1" stopColor="#3F2BC4" />
        </linearGradient>
        <linearGradient id="bm-coin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD66B" />
          <stop offset="1" stopColor="#F5A524" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill="url(#bm-bg)" />
      <path d="M178 378 V 140 H 262 a 70 70 0 0 1 0 140 H 178" fill="none" stroke="#fff" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M258 284 L 334 378" fill="none" stroke="#fff" strokeWidth="52" strokeLinecap="round" />
      <circle cx="398" cy="122" r="44" fill="url(#bm-coin)" />
    </svg>
  );
}
