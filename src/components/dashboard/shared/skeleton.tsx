import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Bar({ className = "" }: { className?: string }) {
  return (
    <div className={`h-4 rounded bg-muted/70 animate-pulse ${className}`} />
  );
}

export function OverviewTabSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 9 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <Bar className="h-3 w-24" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Bar className="h-8 w-20" />
            <Bar className="mt-3 h-3 w-40" />
            <Bar className="mt-2 h-3 w-36" />
          </CardContent>
        </Card>
      ))}

      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>
            <Bar className="h-4 w-36" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Bar className="h-3 w-20" />
                <Bar className="h-7 w-10" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CardSkeleton({
  title,
  ...props
}: React.ComponentProps<typeof Card> & { title: string }) {
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Bar key={index} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
