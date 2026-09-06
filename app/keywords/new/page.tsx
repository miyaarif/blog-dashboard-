import { getSites } from "@/lib/sites";
import AddKeywordForm from "@/components/AddKeywordForm";

export const dynamic = "force-dynamic";

export default async function NewKeywordPage() {
  const sites = await getSites();

  return <AddKeywordForm sites={sites} />;
}
