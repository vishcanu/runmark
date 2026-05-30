interface ClaimXLogoProps {
  size?: number;
  color?: string;
}

/**
 * Claim'X' brand mark — a bold typographic X formed by
 * two filled diagonal bars, like a premium wordmark glyph.
 * Works at every size from 14 px (header) to 80 px (splash).
 */
export function ClaimXLogo({ size = 24, color = '#ffffff' }: ClaimXLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Bar: top-left → bottom-right */}
      <path d="M3.5 2H9L20.5 22H15Z" fill={color} />
      {/* Bar: top-right → bottom-left */}
      <path d="M20.5 2H15L3.5 22H9Z" fill={color} />
    </svg>
  );
}
