// Brand wordmark. Two looks while the final logo is being decided:
//  - "card" (default, e-shop): "čuchni.cz" on a black card with a lime ".cz";
//    in the dark footer the card turns lime.
//  - "hacek" (admin): "čuchni" with a separately drawn háček in the accent colour.
export const BRAND = "Čuchni";

export default function Logo({ variant = "card", className = "" }) {
  if (variant === "card") {
    return (
      <span className={`logo logo-card ${className}`} role="img" aria-label="čuchni.cz">
        <span aria-hidden="true">
          čuchni<span className="logo-cz">.cz</span>
        </span>
      </span>
    );
  }
  return (
    <span className={`logo logo-hacek-variant ${className}`} role="img" aria-label={BRAND}>
      <span className="logo-c" aria-hidden="true">
        c
        <svg className="logo-hacek" viewBox="0 0 12 7" focusable="false">
          <path d="M1.5 1.2 6 5.4l4.5-4.2" />
        </svg>
      </span>
      <span aria-hidden="true">uchni</span>
    </span>
  );
}
