interface ClaimXLogoProps {
  size?: number;
  color?: string;
}

/**
 * Claim'X' brand logo mark — bold X with a centre target circle.
 * Represents "X marks the spot" territory claiming.
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
      {/* Top-left arm */}
      <path d="M5.5 5.5L10.1 10.1" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
      {/* Bottom-right arm */}
      <path d="M13.9 13.9L18.5 18.5" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
      {/* Top-right arm */}
      <path d="M18.5 5.5L13.9 10.1" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
      {/* Bottom-left arm */}
      <path d="M10.1 13.9L5.5 18.5" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
      {/* Centre pin dot */}
      <circle cx="12" cy="12" r="2.6" fill={color} />
    </svg>
  );
}
