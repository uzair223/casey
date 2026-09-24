import { Suspense } from "react";
import {
  CaseTemplateSettingsProvider,
  CaseTemplateSettingsScreen,
} from "@/components/template-settings";

export default function CaseTemplateSettingsPage() {
  return (
    <Suspense fallback={null}>
      <CaseTemplateSettingsProvider>
        <CaseTemplateSettingsScreen />
      </CaseTemplateSettingsProvider>
    </Suspense>
  );
}
