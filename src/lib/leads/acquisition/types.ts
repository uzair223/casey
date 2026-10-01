export type AcquisitionSource = {
  label: string;
  spend: string | null;
};

export type StartedEnquiry = {
  id: string;
  createdAt: string;
  label: string;
  status: "started";
};

export type AcquisitionCampaign = {
  provider: "google" | "meta";
  status: "live" | "paused";
  monthlyBudgetGbp: number | null;
  externalCampaignId: string | null;
  spend: string | null;
  error: string | null;
};

export type AcquisitionPreviewAd = {
  claim: string;
  headlines: string[];
  descriptions: string[];
  image: string;
};

export type AcquisitionPreview = {
  places: string[];
  ads: AcquisitionPreviewAd[];
};

export type AdAssetSummary = {
  id: string;
  name: string;
};

export type WebsiteNote = {
  url: string;
  summary: string | null;
  places: string[];
  claims: string[];
};

export type AcquisitionBoard = {
  growth: boolean;
  trackingUrl: string | null;
  places: string[];
  assets: AdAssetSummary[];
  website: WebsiteNote | null;
  googleConfigured: boolean;
  metaConfigured: boolean;
  clioConfigured: boolean;
  googleConnected: boolean;
  metaConnected: boolean;
  clioConnected: boolean;
  clioRegion: string | null;
  webhookUrl: string | null;
  campaigns: AcquisitionCampaign[];
  sources: Record<string, AcquisitionSource>;
  started: StartedEnquiry[];
  handoffs: Record<string, "sent" | "failed">;
};
