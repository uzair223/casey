import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardStatisticsProps {
  isLoading: boolean;
  stats: {
    cases: number;
    statements: number;
    teamMembers: number;
    pendingInvites: number;
    casesByStatus: Record<string, number>;
    recentActivity: {
      cases: number;
      statements: number;
    };
  } | null;
}

export function DashboardStatistics({
  isLoading,
  stats,
}: DashboardStatisticsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div className="text-2xl font-bold">{stats?.cases ?? 0}</div>
              <p className="text-xs text-muted-foreground">
                +{stats?.recentActivity.cases ?? 0} in last 7 days
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div className="text-2xl font-bold">
                {stats?.teamMembers ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.pendingInvites ?? 0} pending invite
                {stats?.pendingInvites !== 1 ? "s" : ""}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Statements</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div className="text-2xl font-bold">
                {stats?.statements ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                +{stats?.recentActivity.statements ?? 0} in last 7 days
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Cases by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(stats?.casesByStatus ?? {}).map(
                ([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="capitalize text-muted-foreground">
                      {status}
                    </span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ),
              )}
              {Object.keys(stats?.casesByStatus ?? {}).length === 0 && (
                <p className="text-xs text-muted-foreground">No cases yet</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
