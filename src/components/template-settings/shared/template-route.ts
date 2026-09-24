"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const TEMPLATE_PARAM = "templateId";
const SECTION_PARAM = "section";
const VIEW_PARAM = "view";

export const LEAD_TYPE_SECTIONS = ["basics", "fields", "accounts"] as const;
export const ACCOUNT_TEMPLATE_SECTIONS = [
  "basics",
  "person",
  "interview",
  "document",
  "docx",
] as const;

type TemplateView = "simple" | "json";

export function useTemplateRoute<Section extends string>(
  sections: readonly Section[],
  defaultSection: Section,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const templateId = searchParams.get(TEMPLATE_PARAM);
  const sectionParam = searchParams.get(SECTION_PARAM);
  const viewParam = searchParams.get(VIEW_PARAM);
  const section = sections.includes(sectionParam as Section)
    ? (sectionParam as Section)
    : defaultSection;
  const view: TemplateView = viewParam === "json" ? "json" : "simple";

  const write = (
    next: {
      templateId?: string | null;
      section?: Section;
      view?: TemplateView;
    },
    mode: "push" | "replace",
  ) => {
    const params = new URLSearchParams(searchParams.toString());

    if ("templateId" in next) {
      if (next.templateId) {
        params.set(TEMPLATE_PARAM, next.templateId);
      } else {
        params.delete(TEMPLATE_PARAM);
        params.delete(SECTION_PARAM);
        params.delete(VIEW_PARAM);
      }
    }

    if (next.section) {
      if (next.section === defaultSection) params.delete(SECTION_PARAM);
      else params.set(SECTION_PARAM, next.section);
    }

    if (next.view) {
      if (next.view === "simple") params.delete(VIEW_PARAM);
      else params.set(VIEW_PARAM, next.view);
    }

    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    const current = searchParams.toString();
    const currentUrl = current ? `${pathname}?${current}` : pathname;
    if (url === currentUrl) return;

    const navigate = mode === "push" ? router.push : router.replace;
    navigate(url, { scroll: false });
  };

  return {
    templateId,
    isEditor: Boolean(templateId),
    section,
    view,
    openTemplate: (id: string) => {
      write(
        { templateId: id, section: defaultSection, view: "simple" },
        "push",
      );
    },
    openNew: () => {
      write(
        { templateId: "new", section: defaultSection, view: "simple" },
        "push",
      );
    },
    closeEditor: () => {
      write({ templateId: null }, "push");
    },
    replaceTemplate: (id: string | null) => {
      write({ templateId: id }, "replace");
    },
    setSection: (next: Section, mode: "push" | "replace" = "push") => {
      write({ section: next }, mode);
    },
    setView: (next: TemplateView, mode: "push" | "replace" = "push") => {
      write({ view: next }, mode);
    },
  };
}

export function useTemplateSelectionRoute<
  Section extends string,
  Template extends { id: string },
>(options: {
  sections: readonly Section[];
  defaultSection: Section;
  isLoading: boolean;
  activeTemplateId: string | null;
  templates: Template[];
  onSelect: (template: Template) => void;
  onCreate: () => void;
}) {
  const route = useTemplateRoute(options.sections, options.defaultSection);
  const appliedRouteId = useRef<string | null | undefined>(undefined);
  const onSelectRef = useRef(options.onSelect);
  const onCreateRef = useRef(options.onCreate);
  onSelectRef.current = options.onSelect;
  onCreateRef.current = options.onCreate;

  useEffect(() => {
    if (options.isLoading) return;

    const routeId = route.templateId;

    if (routeId && routeId !== "new" && routeId === options.activeTemplateId) {
      appliedRouteId.current = routeId;
      return;
    }

    if (routeId === appliedRouteId.current) return;

    if (routeId === "new") {
      appliedRouteId.current = routeId;
      onCreateRef.current();
      return;
    }

    if (routeId) {
      const template = options.templates.find((item) => item.id === routeId);
      if (!template) return;
      appliedRouteId.current = routeId;
      onSelectRef.current(template);
      return;
    }

    if (appliedRouteId.current === undefined && options.templates[0]) {
      appliedRouteId.current = null;
      onSelectRef.current(options.templates[0]);
    }
  }, [
    options.activeTemplateId,
    options.isLoading,
    options.templates,
    route.templateId,
  ]);

  return route;
}
