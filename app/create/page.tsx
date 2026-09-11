import { getSites, getKeywords } from "@/lib/sites";
import CreationBoxForm from "@/components/CreationBoxForm";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const [sites, keywords] = await Promise.all([getSites(), getKeywords()]);
  const isLocal = !process.env.VERCEL;

  return <CreationBoxForm sites={sites} keywords={keywords} isLocal={isLocal} />;
}
