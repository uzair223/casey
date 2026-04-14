import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type SidebarWrapperProps = {
  children: ReactNode;
  className?: string;
};

export function SidebarWrapper({ children, className }: SidebarWrapperProps) {
  return (
    <div
      className={cn("grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]", className)}
    >
      {children}
    </div>
  );
}

type SidebarProps<T> = {
  title?: ReactNode;
  count?: number;
  actionLabel?: ReactNode;
  onAction?: () => void;
  children?: ReactNode;
  items?: T[];
  activeItemId?: string | null;
  getItemId?: (item: T) => string;
  onSelectItem?: (item: T) => void;
  renderItem?: (item: T, state: { isActive: boolean }) => ReactNode;
  emptyMessage?: ReactNode;
  scrollAreaHeightClassName?: string;
  className?: string;
};

export function Sidebar<T>({
  title,
  count,
  actionLabel,
  onAction,
  children,
  items,
  activeItemId,
  getItemId,
  onSelectItem,
  renderItem,
  emptyMessage = "No items available.",
  scrollAreaHeightClassName = "h-[20vh] lg:h-[calc(100vh-10rem)]",
  className,
}: SidebarProps<T>) {
  const hasStructuredItems =
    Array.isArray(items) &&
    typeof getItemId === "function" &&
    typeof onSelectItem === "function" &&
    typeof renderItem === "function";

  const resolvedCount =
    count ?? (Array.isArray(items) ? items.length : undefined);

  return (
    <aside className={cn("min-w-0", className)}>
      <Card className="lg:sticky top-4 h-fit">
        {title || actionLabel ? (
          <CardHeader className="pb-2">
            {title ? (
              <CardTitle className="flex text-base">
                {title}
                {typeof resolvedCount === "number" ? (
                  <span className="ml-auto text-xs text-muted-foreground">
                    ({resolvedCount})
                  </span>
                ) : null}
              </CardTitle>
            ) : null}
            {actionLabel ? (
              <Button variant="outline" onClick={onAction}>
                {actionLabel}
              </Button>
            ) : null}
          </CardHeader>
        ) : null}

        <CardContent className="pr-2 overflow-hidden">
          {hasStructuredItems ? (
            <ScrollArea
              className={cn("pr-4 rounded-md", scrollAreaHeightClassName)}
            >
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const id = getItemId(item);
                    const isActive = id === activeItemId;

                    return (
                      <Button
                        key={id}
                        type="button"
                        variant={isActive ? "secondary" : "outline"}
                        className={cn(
                          "h-auto w-full justify-start px-3 py-3 text-left",
                        )}
                        onClick={() => onSelectItem(item)}
                      >
                        {renderItem(item, { isActive })}
                      </Button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

type SidebarContentProps = {
  children: ReactNode;
  className?: string;
};

export function SidebarContent({ children, className }: SidebarContentProps) {
  return <section className={cn("min-w-0", className)}>{children}</section>;
}
