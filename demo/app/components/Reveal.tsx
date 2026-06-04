// Entrance animation as pure CSS, applied via the Tailwind `animate-fade-up`
// keyframe (defined with `both` fill mode so the delay holds the start state).
// No JS/IntersectionObserver: content is visible even before hydration or with
// scripting disabled, and honors prefers-reduced-motion via globals.css.
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`animate-fade-up ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
