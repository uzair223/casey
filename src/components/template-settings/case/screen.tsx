"use client";

import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "@/components/page-title";
import Loading from "@/components/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sidebar,
  SidebarContent,
  SidebarWrapper,
} from "@/components/ui/sidebar";
import type { CaseTemplate } from "@/types";
import { useCaseTemplateSettings } from "./context";
import { CaseTemplateSimpleView } from "./simple-view";
import { CaseTemplateJsonView } from "./json-view";
import { AsyncButton } from "@/components/ui/async-button";
import {
  templateStatusLabel,
  templateStatusVariant,
} from "@/lib/status-styles";
import { Input } from "@/components/ui/input";
import { useUser } from "@/contexts/user-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectScrollDownButton,
  SelectScrollUpButton,
} from "@/components/ui/select";
import { SelectTrigger, SelectValue } from "@radix-ui/react-select";
import { Button } from "@/components/ui/button";
import {
  ArrowDownAZ,
  ArrowDownZA,
  CalendarArrowDown,
  CalendarArrowUp,
} from "lucide-react";

export function CaseTemplateSettingsScreen() {
  const [templateSearch, setTemplateSearch] = useState("");
  const [sortOption, setSortOption] = useState<
    "newest" | "oldest" | "az" | "za"
  >("newest");
  const { user } = useUser();
  const {
    canForkGlobalTemplate,
    canEditActiveTemplate,
    isTenantAdmin,
    isLoading,
    caseTemplates,
    activeTemplate,
    defaultTemplateId,
    favouriteTemplateIds,
    editorTab,
    currentStatus,
    selectTemplate,
    createNewTemplate,
    deleteTemplate,
    duplicateTemplate,
    saveTemplateWithStatus,
    saveTemplate,
    forkTemplate,
    toggleFavourite,
    toggleDefault,
    setEditorTab,
  } = useCaseTemplateSettings();

  const filteredCaseTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    const scopeOrder = { tenant: 0, global: 1 } as const;

    return [...caseTemplates]
      .sort((a, b) => {
        const scopeDiff =
          scopeOrder[a.template_scope] - scopeOrder[b.template_scope];
        if (scopeDiff !== 0) {
          return scopeDiff;
        }

        switch (sortOption) {
          case "az":
            return a.name.localeCompare(b.name, undefined, {
              sensitivity: "base",
            });
          case "za":
            return b.name.localeCompare(a.name, undefined, {
              sensitivity: "base",
            });
          case "oldest":
            return Date.parse(a.updated_at) - Date.parse(b.updated_at);
          case "newest":
          default:
            return Date.parse(b.updated_at) - Date.parse(a.updated_at);
        }
      })
      .filter((template) =>
        query.length === 0 ? true : template.name.toLowerCase().includes(query),
      );
  }, [caseTemplates, templateSearch, sortOption]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (!isSaveShortcut) {
        return;
      }

      event.preventDefault();

      if (!canEditActiveTemplate) {
        return;
      }

      void saveTemplate();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canEditActiveTemplate, saveTemplate]);

  if (isLoading) {
    return <Loading />;
  }

  const badges = (template: CaseTemplate) => (
    <>
      {user &&
        (user.role === "tenant_admin"
          ? template.template_scope === "tenant"
          : template.template_scope === "global") && (
          <Badge variant={templateStatusVariant[template.status]}>
            {templateStatusLabel[template.status]}
          </Badge>
        )}
      <Badge className="capitalize">{template.template_scope}</Badge>
      {template.id === defaultTemplateId ? <Badge>Default</Badge> : null}
      {template.id !== defaultTemplateId &&
      favouriteTemplateIds.includes(template.id) ? (
        <Badge>Favourite</Badge>
      ) : null}
    </>
  );

  return (
    <section className="space-y-4">
      <PageTitle
        subtitle={user?.tenant_name ?? "Global"}
        title="Case Templates"
        description="Manage case templates, mapping to statement templates, and JSON configuration."
        actions={[
          {
            label: "Statement Templates",
            href: "/settings/statements",
            variant: "outline",
          },
        ]}
      />

      <SidebarWrapper>
        <Sidebar<CaseTemplate>
          title="Case Templates"
          actions={[
            <div key="case-template-filters" className="w-full flex gap-1.5">
              <Input
                key="case-template-search"
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                placeholder="Search templates..."
                className="h-8 flex-1"
              />
              <Select
                key="template-sort"
                value={sortOption}
                onValueChange={(value) =>
                  setSortOption(value as typeof sortOption)
                }
              >
                <SelectTrigger asChild>
                  <Button variant="outline" size="icon-sm">
                    {
                      {
                        az: <ArrowDownAZ />,
                        za: <ArrowDownZA />,
                        newest: <CalendarArrowDown />,
                        oldest: <CalendarArrowUp />,
                      }[sortOption]
                    }
                    <span className="sr-only">
                      <SelectValue />
                    </span>
                  </Button>
                </SelectTrigger>

                <SelectContent>
                  <SelectScrollUpButton />
                  <SelectItem value="az">Alphabetic (asc)</SelectItem>
                  <SelectItem value="za">Alphabetic (desc)</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectScrollDownButton />
                </SelectContent>
              </Select>
            </div>,
            {
              label: "New",
              onClick: () => void createNewTemplate(),
            },
          ]}
          items={filteredCaseTemplates}
          activeItemId={activeTemplate?.id}
          getItemId={(template) => template.id}
          onSelectItem={(template) => {
            void selectTemplate(template);
          }}
          renderItem={(template) => (
            <div className="flex w-full flex-col gap-2">
              <span className="font-medium text-sm">{template.name}</span>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                {badges(template)}
              </div>
            </div>
          )}
          emptyMessage="No case templates yet."
        />

        <SidebarContent>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Editor</CardTitle>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {activeTemplate && badges(activeTemplate)}
                    {canForkGlobalTemplate ? (
                      <AsyncButton
                        size="sm"
                        variant="outline"
                        onClick={forkTemplate}
                        pendingText="Forking..."
                      >
                        Fork to firm
                      </AsyncButton>
                    ) : null}
                    {isTenantAdmin && activeTemplate ? (
                      <>
                        <AsyncButton
                          variant="outline"
                          size="sm"
                          onClick={toggleFavourite}
                          pendingText="Saving..."
                        >
                          {favouriteTemplateIds.includes(activeTemplate.id)
                            ? "Unfavourite"
                            : "Favourite"}
                        </AsyncButton>

                        <AsyncButton
                          variant="outline"
                          size="sm"
                          onClick={toggleDefault}
                          pendingText="Pinning..."
                        >
                          {activeTemplate.id === defaultTemplateId
                            ? "Unpin"
                            : "Pin as default"}
                        </AsyncButton>
                      </>
                    ) : null}
                    {canEditActiveTemplate && activeTemplate && (
                      <>
                        {currentStatus !== "draft" && (
                          <AsyncButton
                            size="sm"
                            variant="outline"
                            onClick={() => saveTemplateWithStatus("draft")}
                            pendingText="Saving..."
                          >
                            Move to draft
                          </AsyncButton>
                        )}
                        {currentStatus !== "published" && (
                          <AsyncButton
                            size="sm"
                            variant="outline"
                            onClick={() => saveTemplateWithStatus("published")}
                            pendingText="Saving..."
                          >
                            Publish
                          </AsyncButton>
                        )}
                        {currentStatus !== "archived" && (
                          <AsyncButton
                            size="sm"
                            variant="outline"
                            onClick={() => saveTemplateWithStatus("archived")}
                            pendingText="Saving..."
                          >
                            Archive
                          </AsyncButton>
                        )}
                        {activeTemplate?.id ? (
                          <AsyncButton
                            variant="outline"
                            size="sm"
                            onClick={duplicateTemplate}
                            pendingText="Duplicating..."
                          >
                            Duplicate
                          </AsyncButton>
                        ) : null}
                        {activeTemplate?.id ? (
                          <AsyncButton
                            variant="outline"
                            size="sm"
                            onClick={deleteTemplate}
                            pendingText="Deleting..."
                          >
                            Delete
                          </AsyncButton>
                        ) : null}
                        <AsyncButton
                          size="sm"
                          onClick={saveTemplate}
                          pendingText="Saving..."
                        >
                          Save
                        </AsyncButton>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={editorTab}
                onValueChange={(value) =>
                  setEditorTab(value as typeof editorTab)
                }
              >
                <TabsList>
                  <TabsTrigger value="simple">Simple</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                </TabsList>
                <TabsContent value="simple" className="pt-4">
                  <CaseTemplateSimpleView />
                </TabsContent>
                <TabsContent value="json" className="pt-4">
                  <CaseTemplateJsonView />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </SidebarContent>
      </SidebarWrapper>
    </section>
  );
}
