import "server-only";

import { ProviderError } from "./http";
import { readWebsiteBrief, websiteUrlError, type WebsiteBrief } from "./site";

export async function readPublicWebsitePage(value: string) {
  const invalid = websiteUrlError(value);
  if (invalid) throw new ProviderError(invalid);
  let current = value.trim();
  for (let hop = 0; hop < 3; hop += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "text/html" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ProviderError("Casey could not read that website.");
      current = new URL(location, current).toString();
      if (websiteUrlError(current)) {
        throw new ProviderError("Casey only reads a public https page.");
      }
      continue;
    }
    if (!response.ok) throw new ProviderError("Casey could not read that website.");
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html") && !type.includes("text/plain")) {
      throw new ProviderError("Casey needs the website's public page, not a file download.");
    }
    return { url: current, html: (await response.text()).slice(0, 500_000) };
  }
  throw new ProviderError("Casey could not read that website.");
}

export async function readPublicWebsite(value: string): Promise<WebsiteBrief> {
  const page = await readPublicWebsitePage(value);
  return readWebsiteBrief(page.html);
}
