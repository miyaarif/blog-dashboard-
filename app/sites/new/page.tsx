import { getSites } from "@/lib/sites";
import CreateSiteForm from "@/components/CreateSiteForm";

export const dynamic = "force-dynamic";

export default async function NewSitePage() {
  const sites = await getSites();
  const usedColours = sites.map((s) => s.primary_colour.toLowerCase());

  return <CreateSiteForm usedColours={usedColours} />;
}
