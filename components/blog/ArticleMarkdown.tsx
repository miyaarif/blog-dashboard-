import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { slugifyHeading } from "@/lib/blogContent";

// Renders a real article section as-is. Heading ids match slugifyHeading()
// so the real table-of-contents links land on the right section — no
// rehype-slug dependency needed for two heading levels.
function textContent(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textContent((node as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}

export default function ArticleMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: ({ children, ...props }) => (
          <h2 id={slugifyHeading(textContent(children))} {...props}>
            {children}
          </h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 id={slugifyHeading(textContent(children))} {...props}>
            {children}
          </h3>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
