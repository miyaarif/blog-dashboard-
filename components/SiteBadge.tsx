import { Site, isFinanceSite } from "@/types";

export default function SiteBadge({ site }: { site: Site }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: site.primary_colour,
          display: "inline-block",
        }}
      />
      {site.name}
      {isFinanceSite(site) && (
        <span
          style={{
            fontSize: 11,
            color: "#92400e",
            backgroundColor: "#fef3c7",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          finance
        </span>
      )}
    </span>
  );
}
