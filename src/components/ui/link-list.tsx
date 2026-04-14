"use client";

import Link from "next/link";
import { Button, ButtonProps } from "./button";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

interface LinkListItem {
  href: string;
  label: React.ReactNode;
}

interface LinkListProps extends Exclude<ButtonProps, "asChild"> {
  items: LinkListItem[];
}

const LinkList = ({
  items,
  className,
  size = null,
  variant = "link",
  disabled,
  ...props
}: LinkListProps) => {
  const pathname = usePathname();
  return items.map((item, i) => {
    const isActive = pathname === item.href;
    return (
      <Button
        key={i}
        size={size}
        variant={variant}
        className={cn("justify-start px-0", className)}
        disabled={isActive || disabled}
        asChild={!isActive}
        {...props}
      >
        {isActive ? item.label : <Link href={item.href}>{item.label}</Link>}
      </Button>
    );
  });
};
LinkList.displayName = "LinkList";

export { LinkList };
