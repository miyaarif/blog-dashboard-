export default function CharCounter({
  value,
  min,
  max,
}: {
  value: string;
  min: number;
  max: number;
}) {
  const len = value.length;
  const inRange = len >= min && len <= max;

  return (
    <span
      className={`text-xs font-medium ${inRange ? "text-emerald-600" : "text-red-600"}`}
    >
      {len} / {min}-{max} ideal
    </span>
  );
}
