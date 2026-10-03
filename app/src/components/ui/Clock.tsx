// A countdown such as "00:41" or "1h 02m": tabular digits so it does not jitter, but the colon keeps
// its proportional width (this face's tabular colon is figure-wide, which reads as "00 : 41").
export function Clock({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(":");
  return (
    <span className={`tnum whitespace-nowrap ${className}`}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="[font-variant-numeric:normal]">:</span>}
          {p}
        </span>
      ))}
    </span>
  );
}
