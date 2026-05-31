interface ClaimXLogoProps {
  size?: number;
}

/**
 * Claim'X' brand mark — uses the official brand icon from /brand/icon.svg.
 */
export function ClaimXLogo({ size = 24 }: ClaimXLogoProps) {
  return (
    <img
      src="/brand/icon.svg"
      width={size}
      height={size}
      alt="ClaimX"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}
