import { getSites } from "@/lib/sites";
import CreationBoxForm from "@/components/CreationBoxForm";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const sites = await getSites();
  const isLocal = !process.env.VERCEL;

  return <CreationBoxForm sites={sites} isLocal={isLocal} />;
}
