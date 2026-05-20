export default function Placeholder({
  title,
  step,
}: {
  title: string;
  step: number;
}) {
  return (
    <div>
      <p className="cc-eyebrow">Section</p>
      <h1 className="cc-display mt-2 text-3xl md:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-[var(--text-muted)]">
        Coming in Step {step}.
      </p>
    </div>
  );
}
