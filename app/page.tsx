import { getSites } from "@/lib/sites";

export default function Home() {
  const sites = getSites();

  return <pre>{JSON.stringify(sites, null, 2)}</pre>;
}
