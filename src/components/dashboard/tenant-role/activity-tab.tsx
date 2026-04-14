import { OutstandingWorkCard } from "./outstanding-work-card";
import { UnifiedActivityTimelineCard } from "./unified-activity-timeline-card";

export const TenantRoleActivityTab = () => {
  return (
    <div className="flex flex-col gap-4">
      <OutstandingWorkCard size="md" className="col-span-full" />
      <UnifiedActivityTimelineCard size="md" className="col-span-full" />
    </div>
  );
};
