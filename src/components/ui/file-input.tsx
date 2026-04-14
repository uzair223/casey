"use client";

import React, { useCallback, useRef, useState } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Button, ButtonProps } from "./button";
import { TrashIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileInputContextValue {
  files: File[];
  addFiles: (files: Iterable<File>) => void;
  removeFile: (index: number) => void;
  disabled: boolean;
  multiple: boolean;
  accept?: string;
}

const FileInputContext = React.createContext<FileInputContextValue | null>(
  null,
);

interface FileInputProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "value" | "onChange"
> {
  multiple?: boolean;
  accept?: string;
  value?: File[]; // controlled
  onChange?: (newFiles: File[]) => void;
  asChild?: boolean;
  disabled?: boolean;
}

export const FileInput = React.forwardRef<HTMLDivElement, FileInputProps>(
  (
    {
      multiple = false,
      accept,
      value,
      onChange,
      children,
      asChild,
      disabled = false,
      ...props
    },
    ref,
  ) => {
    // Controlled vs uncontrolled
    const isControlled = value !== undefined;
    const [internalFiles, setInternalFiles] = useState<File[]>(value ?? []);
    const files = isControlled ? value! : internalFiles;
    const Comp = asChild ? Slot : "div";

    const addFiles = useCallback(
      (newFiles: Iterable<File>) => {
        const fileArray = Array.from(newFiles);

        if (!multiple) {
          // If not multiple, only keep the first new file
          const nextFiles = fileArray.length > 0 ? [fileArray[0]] : [];
          if (isControlled) {
            onChange?.(nextFiles);
          } else {
            setInternalFiles(nextFiles);
            onChange?.(nextFiles);
          }
        } else {
          // If multiple, add files without duplicates
          const nextFiles = [...files];
          fileArray.forEach((file) => {
            const exists = nextFiles.some(
              (f) =>
                f.name === file.name &&
                f.size === file.size &&
                f.lastModified === file.lastModified,
            );
            if (!exists) nextFiles.push(file);
          });

          if (isControlled) {
            onChange?.(nextFiles);
          } else {
            setInternalFiles(nextFiles);
            onChange?.(nextFiles);
          }
        }
      },
      [files, isControlled, onChange, multiple],
    );

    return (
      <FileInputContext.Provider
        value={{
          files,
          addFiles,
          removeFile: (index) => {
            const nextFiles = files.filter((_, i) => i !== index);
            if (isControlled) {
              onChange?.(nextFiles);
            } else {
              setInternalFiles(nextFiles);
              onChange?.(nextFiles);
            }
          },
          disabled,
          multiple,
          accept,
        }}
      >
        <Comp ref={ref} {...props}>
          {children}
        </Comp>
      </FileInputContext.Provider>
    );
  },
);

FileInput.displayName = "FileInput";

export const FileInputTrigger = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(
  (
    {
      className,
      variant = "accent",
      children = "Choose Files",
      disabled = false,
      ...props
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const context = React.useContext(FileInputContext);
    if (!context)
      throw new Error("FileInputTrigger must be used within a FileInput");

    const { multiple, accept, files, addFiles } = context;

    const handleClick = () => inputRef.current?.click();

    return (
      <>
        {/* Hidden native file input */}
        <input
          type="file"
          ref={inputRef}
          multiple={multiple}
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            addFiles(e.target.files ?? []);
            e.target.value = ""; // reset to allow re-uploading same file
          }}
          disabled={disabled || context.disabled}
        />
        <div>
          <Button
            type="button"
            variant={variant}
            onClick={handleClick}
            className={cn("w-min file-input-trigger", className)}
            ref={ref}
            disabled={disabled || context.disabled}
            {...props}
          >
            {children}
          </Button>
          <span className="ml-2 text-sm text-muted-foreground">
            {files.length > 0
              ? multiple
                ? `${files.length} file(s) selected`
                : files[0].name
              : "No files selected"}
          </span>
        </div>
      </>
    );
  },
);

FileInputTrigger.displayName = "FileInputTrigger";

type FileInputListProps = Record<string, never>;

export const FileInputList: React.FC<FileInputListProps> = React.memo(() => {
  const context = React.useContext(FileInputContext);
  if (!context)
    throw new Error("FileInputList must be used within a FileInput");

  const { files, removeFile } = context;

  if (files.length === 0) return null;

  return files.map((file, idx) => (
    <Button
      key={idx}
      variant="outline-destructive"
      className="group/btn w-full items-center justify-between"
      onClick={() => removeFile(idx)}
      size="sm"
    >
      <span className="truncate">{file.name}</span>
      <TrashIcon className="opacity-0 group-hover/btn:opacity-100 transition-opacity" />
    </Button>
  ));
});

FileInputList.displayName = "FileInputList";
