"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-utils";
import { useAsync } from "@/hooks/useAsync";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  FileInput,
  FileInputTrigger,
  FileInputList,
} from "@/components/ui/file-input";

type FollowUpData = {
  caseTitle: string;
  witnessName: string;
  followUpRequest: {
    id: string;
    message: string;
    createdAt: string;
  } | null;
  responses: Array<{
    id: string;
    message: string;
    createdAt: string;
  }>;
};

export default function FollowUpPage({
  params,
}: {
  params: React.Usable<{ token: string }>;
}) {
  const { token } = React.use(params);
  const [response, setResponse] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const followUpData = useAsync<FollowUpData>(
    async () =>
      apiFetch<FollowUpData>(`/api/intake/${token}/follow-up`, {
        method: "GET",
        requireAuth: false,
      }),
    [token],
    {
      withUseEffect: true,
      initialLoading: true,
    },
  );

  const submitResponse = useAsync(
    async () => {
      const trimmed = response.trim();
      if (!trimmed && uploadedFiles.length === 0) {
        return false;
      }

      const formData = new FormData();
      if (trimmed) {
        formData.append("response", trimmed);
      }
      uploadedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      await apiFetch(`/api/intake/${token}/follow-up`, {
        method: "POST",
        requireAuth: false,
        body: formData,
      });

      setResponse("");
      setUploadedFiles([]);
      await followUpData.handler();
      return true;
    },
    [token, response, uploadedFiles],
    {
      withUseEffect: false,
      initialLoading: false,
      onlyFirstLoad: false,
    },
  );

  const hasActiveFollowUp = !!followUpData.data?.followUpRequest;

  const sortedResponses = useMemo(() => {
    const responses = followUpData.data?.responses ?? [];
    return [...responses].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [followUpData.data?.responses]);

  if (followUpData.isLoading) {
    return (
      <section className="container py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Loading follow-up</CardTitle>
            <CardDescription>
              Please wait while we load your secure follow-up request.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  if (followUpData.error || !followUpData.data) {
    return (
      <section className="container py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Link Not Available</CardTitle>
            <CardDescription>
              This follow-up link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href={`/intake/${token}/interview`}>
                Open interview page
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </section>
    );
  }

  return (
    <section className="container py-8 space-y-4">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Follow-up Request</CardTitle>
          <CardDescription>
            {followUpData.data.witnessName}, please reply to the legal team for
            case {followUpData.data.caseTitle}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasActiveFollowUp ? (
            <div className="rounded-md border p-3 bg-muted/20">
              <p className="text-xs text-muted-foreground mb-2">
                Requested on{" "}
                {new Date(
                  followUpData.data.followUpRequest?.createdAt ?? "",
                ).toLocaleString()}
              </p>
              <p className="whitespace-pre-wrap text-sm">
                {followUpData.data.followUpRequest?.message}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              There is currently no active follow-up request.
            </p>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Upload supporting files (optional)
            </label>
            <FileInput
              multiple
              accept="application/pdf,image/*,video/*,.doc,.docx"
              disabled={!hasActiveFollowUp || submitResponse.isLoading}
              value={uploadedFiles}
              onChange={(files) => setUploadedFiles(files)}
            >
              <FileInputTrigger>
                {uploadedFiles.length > 0 ? "Change files" : "Upload files"}
              </FileInputTrigger>
              <div className="mt-2 space-y-1.5">
                <FileInputList />
              </div>
            </FileInput>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your response</label>
            <Textarea
              value={response}
              onChange={(event) => setResponse(event.target.value)}
              rows={6}
              placeholder="Type your response to the legal team's follow-up request"
              disabled={!hasActiveFollowUp || submitResponse.isLoading}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => void submitResponse.handler()}
                disabled={
                  !hasActiveFollowUp ||
                  (!response.trim() && uploadedFiles.length === 0) ||
                  submitResponse.isLoading
                }
              >
                {submitResponse.isLoading ? "Sending..." : "Send response"}
              </Button>
              <Button asChild variant="outline">
                <Link href={`/intake/${token}/interview`}>
                  Open interview page
                </Link>
              </Button>
            </div>
          </div>

          {sortedResponses.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Previous responses</p>
              {sortedResponses.map((entry) => (
                <div key={entry.id} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{entry.message}</p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
