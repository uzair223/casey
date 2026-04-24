import { Extension } from "@codemirror/state";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";
import CodeMirrorMerge from "react-codemirror-merge";
import { json } from "@codemirror/lang-json";

import { ScrollArea } from "./scroll-area";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

type CodeEditorProps = Omit<
  React.ComponentProps<typeof CodeMirror>,
  "extensions"
> & {
  mode?: "json";
};
export function CodeEditor({
  value,
  className,
  theme = "dark",
  mode,
  ...props
}: CodeEditorProps) {
  const extensions = useMemo(() => {
    const exts: Extension[] = [EditorView.lineWrapping];
    if (mode === "json") {
      exts.push(json());
    }
    return exts;
  }, [mode]);

  return (
    <ScrollArea className={cn("rounded-md", className)}>
      <CodeMirror
        value={value}
        theme={theme}
        extensions={extensions}
        {...props}
      />
    </ScrollArea>
  );
}

type CodeDiffEditorProps = Omit<
  React.ComponentProps<typeof CodeMirrorMerge>,
  "a" | "b" | "extensions"
> & {
  original?: string;
  modified?: string;
  mode?: "json";
};
export function CodeDiffEditor({
  original,
  modified,
  theme = "dark",
  orientation = "a-b",
  revertControls = "a-to-b",
  className,
  mode,
  ...props
}: CodeDiffEditorProps) {
  const extensions = useMemo(() => {
    const exts: Extension[] = [EditorView.lineWrapping];
    if (mode === "json") {
      exts.push(json());
    }
    return exts;
  }, [mode]);

  return (
    <ScrollArea className={cn("rounded-md", className)}>
      <CodeMirrorMerge
        orientation={orientation}
        revertControls={revertControls}
        theme={theme}
        {...props}
      >
        <CodeMirrorMerge.Original extensions={extensions} value={original} />
        <CodeMirrorMerge.Modified extensions={extensions} value={modified} />
      </CodeMirrorMerge>
    </ScrollArea>
  );
}
