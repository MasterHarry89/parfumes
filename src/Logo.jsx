// Brand wordmark "čuchni": the letters follow the surrounding text colour, the
// háček is drawn separately so it can carry the accent colour (--logo-accent).
export const BRAND = "Čuchni";

export default function Logo({ className = "" }) {
  return (
    <span className={`logo ${className}`} role="img" aria-label={BRAND}>
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
