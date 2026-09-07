import { getArticlesByStatus, getSites } from "@/lib/sites";
import ReviewQueueTable from "@/components/ReviewQueueTable";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const [articles, sites] = await Promise.all([
    getArticlesByStatus("needs_review"),
    getSites(),
  ]);

  return <ReviewQueueTable sites={sites} articles={articles} />;
}
