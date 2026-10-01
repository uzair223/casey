"use client";

import Link from "next/link";

import { useAcquisitionBoard } from "@/components/leads/acquisition-settings";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MarketingHome() {
  const board = useAcquisitionBoard();
  const data = board.data;

  return (
    <MarketingFrame
      title="Marketing"
      description="Brand, the enquiry widget, and the ads that bring people in."
    >
      {!data?.growth ? (
        <p className="text-sm text-muted-foreground">Marketing is part of Growth.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Firm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Brand, images, lead types, and the website Casey reads. Nothing is applied until you approve it.</p>
              <Button asChild variant="outline">
                <Link href="/dashboard/marketing/firm">Open the firm studio</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Widget</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>The public address, the colours, the welcome, and the embed for the firm website.</p>
              <Button asChild variant="outline">
                <Link href="/dashboard/marketing/widget">Open the widget studio</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Creative</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Write one ad for each lead type, see what it costs in enquiries, and run it.</p>
              <Button asChild variant="outline">
                <Link href="/dashboard/marketing/creative">Open the creative studio</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                {data.photoAllowance.used} of {data.photoAllowance.limit} photographs used this period.
              </p>
              {data.campaigns.length ? (
                <ul className="space-y-1">
                  {data.campaigns.map((campaign) => (
                    <li key={campaign.provider}>
                      {campaign.provider === "google" ? "Google search" : "Meta"}: {campaign.status}
                      {campaign.spend ? ` · ${campaign.spend} spent` : ""}
                      {campaign.error ? ` · ${campaign.error}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No campaign is running yet.</p>
              )}
              {data.trackingUrl ? (
                <p className="text-muted-foreground">Tracking link: {data.trackingUrl}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </MarketingFrame>
  );
}
