import {
  StatementTemplateSettingsProvider,
  StatementTemplateSettingsScreen,
} from "@/components/template-settings";

export default function IntakeTemplateSettingsPage() {
  return (
    <StatementTemplateSettingsProvider>
      <StatementTemplateSettingsScreen />
    </StatementTemplateSettingsProvider>
  );
}
