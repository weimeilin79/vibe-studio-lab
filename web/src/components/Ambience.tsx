/** Decorative animated backdrop. Fixed behind everything; no pointer events. */
export function Ambience() {
  return (
    <div className="ambience" aria-hidden="true">
      <div className="ambience__blob ambience__blob--blue" />
      <div className="ambience__blob ambience__blob--purple" />
      <div className="ambience__blob ambience__blob--cyan" />
      <div className="ambience__grid" />
      <div className="ambience__grain" />
    </div>
  );
}
