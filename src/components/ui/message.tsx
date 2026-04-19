"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardHeader } from "./card";

type MarkdownMessageProps = {
  content: string;
};

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

export function MessageCard({
  message,
  children,
}: {
  message: {
    role: string;
    content: string;
    status?: "pending" | "complete" | "error";
  };
  children?: React.ReactNode;
}) {
  const isUser = message.role === "user";
  const showPendingIndicator = message.status === "pending" && !isUser;
  const hasContent = message.content.trim().length > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start",
      )}
    >
      {hasContent ? (
        <Card
          size="sm"
          className={cn(
            "max-w-sm text-sm rounded-3xl [--card-opacity:90%]",
            isUser ? "rounded-tr-sm" : "rounded-tl-sm",
          )}
          variant={isUser ? "primary" : "default"}
        >
          <CardHeader className="relative">
            <span className="absolute text-transparent select-text whitespace-nowrap text-[0px]">
              {message.role.toUpperCase()}:
            </span>
            {isUser ? (
              <p>{message.content}</p>
            ) : (
              <div className="prose prose-invert">
                <MarkdownMessage content={message.content} />
              </div>
            )}
          </CardHeader>
        </Card>
      ) : null}

      {showPendingIndicator ? (
        <Card size="sm" className="w-min rounded-md!">
          <CardHeader className="flex flex-row justify-center gap-1">
            <div
              className="m-0 w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></div>
            <div
              className="m-0 w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: "150ms" }}
            ></div>
            <div
              className="m-0 w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: "300ms" }}
            ></div>
          </CardHeader>
        </Card>
      ) : null}

      {children}
    </div>
  );
}
