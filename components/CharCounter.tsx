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
    <span style={{ fontSize: 12, color: inRange ? "#16a34a" : "#dc2626" }}>
      {len} / {min}-{max} ideal
    </span>
  );
}
