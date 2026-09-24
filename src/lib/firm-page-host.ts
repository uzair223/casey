const FIRM_PAGE_HOST_SUFFIX = "go.caseyhq.co.uk";

export function firmPageSlug(hostname: string) {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  const suffix = `.${FIRM_PAGE_HOST_SUFFIX}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes(".") || !/^[a-z0-9-]+$/.test(slug)) return null;
  return slug;
}

export function firmPageUrl(slug: string) {
  return `https://${slug}.${FIRM_PAGE_HOST_SUFFIX}`;
}
