import {
  CaseTemplateSettingsProvider,
  CaseTemplateSettingsScreen,
} from "@/components/template-settings";

export default function CaseTemplateSettingsPage() {
  return (
    <CaseTemplateSettingsProvider>
      <CaseTemplateSettingsScreen />
    </CaseTemplateSettingsProvider>
  );
}
