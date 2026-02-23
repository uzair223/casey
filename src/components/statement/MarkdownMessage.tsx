"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownMessageProps {
  content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: (props) => <p className="mb-2 last:mb-0" {...props} />,
        ul: (props) => <ul className="list-disc pl-5 mb-2" {...props} />,
        ol: (props) => <ol className="list-decimal pl-5 mb-2" {...props} />,
        li: (props) => <li className="mb-1" {...props} />,
        strong: (props) => <strong className="font-semibold" {...props} />,
        em: (props) => <em className="italic" {...props} />,
        code: (props) => (
          <code
            className="bg-slate-700 px-1 py-0.5 rounded text-xs font-mono"
            {...props}
          />
        ),
        blockquote: (props) => (
          <blockquote
            className="border-l-2 border-slate-600 pl-3 italic my-2"
            {...props}
          />
        ),
        a: (props) => (
          <a
            className="text-blue-300 underline hover:text-blue-200"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        ),
        h1: (props) => (
          <h1 className="text-lg font-bold mt-2 mb-1" {...props} />
        ),
        h2: (props) => (
          <h2 className="text-base font-bold mt-2 mb-1" {...props} />
        ),
        h3: (props) => <h3 className="font-semibold mt-1 mb-1" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
