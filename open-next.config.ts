import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  // A segment prefetch was answered with the full prerendered flight, and
  // the browser then requested that same URL about 200 times per visit.
  enableCacheInterception: false,
  routePreloadingBehavior: "none",
});
