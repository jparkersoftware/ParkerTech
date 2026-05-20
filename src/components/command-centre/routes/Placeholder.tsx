export default function Placeholder({
  title,
  step,
}: {
  title: string;
  step: number;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Coming in Step {step}.</p>
    </div>
  );
}
