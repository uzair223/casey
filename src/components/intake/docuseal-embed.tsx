"use client";

type DocusealEmbedProps = {
  src: string;
  email: string;
  onComplete: () => void;
};

export function DocusealEmbed({ src }: DocusealEmbedProps) {
  return (
    <iframe
      title="Certified signature"
      src={src}
      className="h-[70vh] min-h-[32rem] w-full rounded-md border bg-background"
      allow="clipboard-write"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
