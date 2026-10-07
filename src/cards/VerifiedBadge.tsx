/**
 * Verified/premium seal — a PLATFORM signal (this user pays for Cobuntu
 * Premium), so it is the same gold seal in every community, never the community
 * brand colour. Renders nothing unless the caller decides to show it (gate on
 * `user.isPremium`). next-intl removed: the aria-label is a prop with an
 * English default.
 */
export function VerifiedBadge({
  size = 15,
  className,
  label = "Verified premium member",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={label}
      style={{ display: "inline-block", flexShrink: 0, verticalAlign: "middle" }}
    >
      <path d="M12 1.6l2.3 1.4 2.7-.3 1.2 2.4 2.4 1.2-.3 2.7 1.4 2.3-1.4 2.3.3 2.7-2.4 1.2-1.2 2.4-2.7-.3L12 22.4l-2.3-1.4-2.7.3-1.2-2.4-2.4-1.2.3-2.7L2.3 12l1.4-2.3-.3-2.7 2.4-1.2 1.2-2.4 2.7.3z" fill="#d8b25a" />
      <path d="M7.6 12.3l3 3 5.8-6.2" fill="none" stroke="#20180a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
