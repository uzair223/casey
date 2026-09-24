"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageTitle } from "@/components/page-title";
import Loading from "@/components/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarWrapper,
} from "@/components/ui/sidebar";
import type { CaseTemplate } from "@/types";
import { useCaseTemplateSettings } from "./context";
import {
  LEAD_TYPE_SECTIONS,
  useTemplateRoute,
} from "../shared/template-route";
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
  ChevronDown,
  ChevronLeft,
} from "@/components/icons";

type EditorAction = {
  key: string;
  label: string;
  pendingText: string;
  onClick: () => Promise<void>;
};

function EditorActionsMenu({ items }: { items: EditorAction[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        Actions
        <ChevronDown className="size-4" />
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 flex min-w-44 flex-col rounded-md border bg-card p-1 shadow"
        >
          {items.map((item) => (
            <AsyncButton
              key={item.key}
              role="menuitem"
              variant="ghost"
              size="sm"
              className="justify-start"
              pendingText={item.pendingText}
              onClick={async () => {
                try {
                  await item.onClick();
                } finally {
                  setOpen(false);
                }
              }}
            >
              {item.label}
            </AsyncButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CaseTemplateSettingsScreen() {
  const [templateSearch, setTemplateSearch] = useState("");
  const route = useTemplateRoute(LEAD_TYPE_SECTIONS, "basics");
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
    currentStatus,
    deleteTemplate,
    duplicateTemplate,
    saveTemplateWithStatus,
    saveTemplate,
    forkTemplate,
    toggleFavourite,
    toggleDefault,
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
        title="Lead types"
        description="Manage lead types, the account templates used after accept, and JSON configuration."
        actions={[
          {
            label: "Account templates",
            href: "/settings/statements",
            variant: "outline",
          },
        ]}
      />

      <SidebarWrapper>
        <Sidebar<CaseTemplate>
          className={route.isEditor ? "hidden lg:block" : undefined}
          scrollAreaHeightClassName="h-[calc(100dvh-16rem)] lg:h-[calc(100vh-10rem)]"
          title="Lead types"
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
              onClick: () => {
                route.openNew();
              },
            },
          ]}
          items={filteredCaseTemplates}
          activeItemId={activeTemplate?.id}
          getItemId={(template) => template.id}
          onSelectItem={(template) => {
            route.openTemplate(template.id);
          }}
          renderItem={(template) => (
            <div className="flex w-full flex-col gap-2">
              <span className="font-medium text-sm">{template.name}</span>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                {badges(template)}
              </div>
            </div>
          )}
          emptyMessage="No lead types yet."
        />

        <SidebarContent
          className={route.isEditor ? undefined : "hidden lg:block"}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-3 lg:hidden"
            onClick={() => route.closeEditor()}
          >
            <ChevronLeft className="size-4" />
            Lead types
          </Button>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Editor</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {activeTemplate ? badges(activeTemplate) : null}
                  <EditorActionsMenu
                    items={[
                      ...(canForkGlobalTemplate
                        ? [
                            {
                              key: "fork",
                              label: "Fork to firm",
                              pendingText: "Forking...",
                              onClick: forkTemplate,
                            },
                          ]
                        : []),
                      ...(isTenantAdmin && activeTemplate
                        ? [
                            {
                              key: "favourite",
                              label: favouriteTemplateIds.includes(
                                activeTemplate.id,
                              )
                                ? "Unfavourite"
                                : "Favourite",
                              pendingText: "Saving...",
                              onClick: toggleFavourite,
                            },
                            {
                              key: "default",
                              label:
                                activeTemplate.id === defaultTemplateId
                                  ? "Unpin"
                                  : "Pin as default",
                              pendingText: "Pinning...",
                              onClick: toggleDefault,
                            },
                          ]
                        : []),
                      ...(canEditActiveTemplate && activeTemplate
                        ? [
                            ...(currentStatus !== "draft"
                              ? [
                                  {
                                    key: "draft",
                                    label: "Move to draft",
                                    pendingText: "Saving...",
                                    onClick: () =>
                                      saveTemplateWithStatus("draft"),
                                  },
                                ]
                              : []),
                            ...(currentStatus !== "published"
                              ? [
                                  {
                                    key: "publish",
                                    label: "Publish",
                                    pendingText: "Saving...",
                                    onClick: () =>
                                      saveTemplateWithStatus("published"),
                                  },
                                ]
                              : []),
                            ...(currentStatus !== "archived"
                              ? [
                                  {
                                    key: "archive",
                                    label: "Archive",
                                    pendingText: "Saving...",
                                    onClick: () =>
                                      saveTemplateWithStatus("archived"),
                                  },
                                ]
                              : []),
                            ...(activeTemplate.id
                              ? [
                                  {
                                    key: "duplicate",
                                    label: "Duplicate",
                                    pendingText: "Duplicating...",
                                    onClick: duplicateTemplate,
                                  },
                                  {
                                    key: "delete",
                                    label: "Delete",
                                    pendingText: "Deleting...",
                                    onClick: deleteTemplate,
                                  },
                                ]
                              : []),
                          ]
                        : []),
                    ]}
                  />
                  {canEditActiveTemplate && activeTemplate ? (
                    <AsyncButton
                      size="sm"
                      onClick={saveTemplate}
                      pendingText="Saving..."
                    >
                      Save
                    </AsyncButton>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {route.view === "json" ? (
                <CaseTemplateJsonView />
              ) : (
                <CaseTemplateSimpleView />
              )}
            </CardContent>
          </Card>
        </SidebarContent>
      </SidebarWrapper>
    </section>
  );
}
