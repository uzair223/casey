import { Suspense } from "react";
import {
  StatementTemplateSettingsProvider,
  StatementTemplateSettingsScreen,
} from "@/components/template-settings";

export default function IntakeTemplateSettingsPage() {
  return (
    <Suspense fallback={null}>
      <StatementTemplateSettingsProvider>
        <StatementTemplateSettingsScreen />
      </StatementTemplateSettingsProvider>
    </Suspense>
  );
}
