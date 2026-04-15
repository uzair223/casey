"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Message, StatementDataResponse } from "@/types";
import { generateDoc } from "@/lib/doc-gen";
import { CHAT_METADATA_MARKER, generateGreeting } from "@/lib/statement-utils";
import { uploadFile } from "@/lib/supabase/mutations";
import { useAsync, UseAsyncReturn } from "@/hooks/useAsync";
import Loading from "@/components/loading";
import { apiFetch } from "@/lib/api-utils";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Button } from "../ui/button";
import { Link } from "lucide-react";

type IntakeContextData = Omit<
  StatementDataResponse<true>,
  "messages" | "statement"
> & {
  statement: Omit<StatementDataResponse<true>["statement"], "sections">;
};

export type IntakeTabs = "chat" | "evidence" | "statement";

type Exhibit = {
  exhibit: string;
  description: string; // same as category
  files: File[];
};

function createExhibits(data: Record<string, File[]>, name: string): Exhibit[] {
  let counter = 1;

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("");

  return Object.entries(data).map(([category, files]) => ({
    exhibit: `${initials}${counter++}`,
    description: category,
    files,
  }));
}

export type IntakeContextValue = {
  token: string;
  tab: IntakeTabs;
  setTab: (tab: IntakeTabs) => void;

  data: IntakeContextData;
  messages: Message[];
  suggestedEvidence: { name: string; type: string }[] | null;
  evidenceFiles: Record<string, File[]>;
  statementSections: Record<string, string>;
  templateDocument: Blob | null;
  hasAcknowledgedPrivacyNotice: boolean;

  acknowledgePrivacyNotice: UseAsyncReturn<boolean, boolean, boolean>;
  sendMessage: UseAsyncReturn<void, null, void, [string]>;
  statementFormalization: UseAsyncReturn<boolean>;
  statementSubmission: UseAsyncReturn<boolean>;

  setEvidence: (files: Iterable<File> | null, group?: string) => void;
  setStatementSection: (key: string, value: string) => void;

  isBusy: boolean;
  hasIntakeStopped: boolean;
  isReadyToPrepare: boolean;
  hasConvoEnded: boolean;
  intakeStopReason: string;
  isDemo: boolean;
  isDemoPlaybackActive: boolean;
  skipDemoPlayback: () => void;
  isDemoTabsUnlocked: boolean;
  unlockDemoTabs: () => void;
};

const IntakeContext = createContext<IntakeContextValue | null>(null);

export function IntakeProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const getOptionalAuthHeaders = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      return accessToken
        ? ({ Authorization: `Bearer ${accessToken}` } as Record<string, string>)
        : ({} as Record<string, string>);
    } catch {
      return {} as Record<string, string>;
    }
  };
  const [tab, setTab] = useState<IntakeTabs>("chat");
  const [statementSections, setStatementSections] = useState<
    Record<string, string>
  >({});
  const setStatementSection = (key: string, value: string) => {
    setStatementSections((prev) => ({ ...prev, [key]: value }));
  };

  const hasBootstrappedGreetingRef = useRef(false);
  const demoPlaybackSourceRef = useRef<Message[]>([]);
  const demoPlaybackTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [messages, setMessages] = useState<(Message & { raw?: string })[]>([]);
  const [isDemoPlaybackActive, setIsDemoPlaybackActive] = useState(false);
  const [isDemoTabsUnlocked, setIsDemoTabsUnlocked] = useState(false);
  const reversed = useMemo(() => messages.slice().reverse(), [messages]);

  const clearDemoPlaybackTimeouts = () => {
    demoPlaybackTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    demoPlaybackTimeoutsRef.current = [];
  };

  const {
    data,
    setData: setStatementData,
    isLoading: isDataLoading,
    error: loadError,
  } = useAsync<IntakeContextData>(
    async () => {
      const data = await apiFetch<StatementDataResponse<true>>(
        `/api/intake/${token}`,
        {
          method: "GET",
          headers: await getOptionalAuthHeaders(),
        },
        false,
      );

      const {
        statement: { sections, ...statement },
        case: caseData,
        messages: initialMessages,
        ...rest
      } = data;

      const isDemoStatement = statement.status === "demo_published";

      if (isDemoStatement) {
        setIsDemoTabsUnlocked(false);
      }

      setStatementSections(sections || {});
      if (isDemoStatement && initialMessages.length > 0) {
        demoPlaybackSourceRef.current = initialMessages;
        setMessages([]);
      } else {
        demoPlaybackSourceRef.current = [];
        setMessages(initialMessages);
      }

      return { statement, case: caseData, ...rest };
    },
    [token],
    { initialLoading: true },
  );

  const isDemo = useMemo(() => {
    return data?.statement.status === "demo_published";
  }, [data?.statement.status]);

  const { data: templateDocument } = useAsync(async () => {
    const templateDocumentSnapshot = data?.statement.template_document_snapshot;
    if (!templateDocumentSnapshot) return null;

    try {
      const response = await fetch(`/api/intake/${token}/template-document`, {
        method: "GET",
        headers: {
          ...(await getOptionalAuthHeaders()),
        },
      });

      if (!response.ok) {
        return null;
      }

      return await response.blob();
    } catch (error) {
      console.warn("Template document unavailable for intake preview", error);
      return null;
    }
  }, [data?.statement.template_document_snapshot, token]);

  const acknowledgePrivacyNotice = useAsync(
    async () => {
      const response = await fetch(`/api/intake/${token}/consent`, {
        method: "POST",
        headers: {
          ...(await getOptionalAuthHeaders()),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to acknowledge privacy notice");
      }
      return true;
    },
    [token],
    {
      initialState: false,
      onlyFirstLoad: false,
      initialLoading: false,
      withUseEffect: false,
    },
  );

  const hasAcknowledgedPrivacyNotice =
    !!data?.statement.gdpr_notice_acknowledgement ||
    !!acknowledgePrivacyNotice.data;

  const skipDemoPlayback = () => {
    if (!isDemo || !isDemoPlaybackActive) {
      return;
    }

    clearDemoPlaybackTimeouts();
    setMessages(demoPlaybackSourceRef.current);
    setIsDemoPlaybackActive(false);
  };

  const unlockDemoTabs = () => {
    if (!isDemo) {
      return;
    }
    setIsDemoTabsUnlocked(true);
  };

  useEffect(() => {
    if (!isDemo || !data || !hasAcknowledgedPrivacyNotice) {
      return;
    }

    if (isDemoPlaybackActive || messages.length > 0) {
      return;
    }

    const source = demoPlaybackSourceRef.current;
    if (!source.length) {
      return;
    }

    clearDemoPlaybackTimeouts();
    setIsDemoPlaybackActive(true);

    let cumulativeDelay = 0;
    demoPlaybackTimeoutsRef.current = source.map((message, index) => {
      const words = message.content.trim().split(/\s+/).filter(Boolean).length;
      const minDelay = message.role === "assistant" ? 700 : 450;
      const stepDelay = Math.min(2200, Math.max(minDelay, words * 28));
      cumulativeDelay += stepDelay;

      return setTimeout(() => {
        setMessages((prev) => [...prev, message]);
        if (index === source.length - 1) {
          setIsDemoPlaybackActive(false);
          clearDemoPlaybackTimeouts();
        }
      }, cumulativeDelay);
    });
  }, [
    data,
    hasAcknowledgedPrivacyNotice,
    isDemo,
    isDemoPlaybackActive,
    messages.length,
  ]);

  useEffect(() => {
    if (isDemo) {
      return;
    }

    queueMicrotask(() => {
      clearDemoPlaybackTimeouts();
      setIsDemoPlaybackActive(false);
    });
  }, [isDemo]);

  useEffect(() => {
    return () => {
      clearDemoPlaybackTimeouts();
    };
  }, []);

  // Evidence file handlers

  const [evidenceFiles, setEvidenceRecord] = useState<Record<string, File[]>>(
    {},
  );
  const exhibits = useMemo(
    () =>
      createExhibits(evidenceFiles, data?.statement.witness_name || "Witness"),
    [evidenceFiles, data?.statement.witness_name],
  );

  const suggestedEvidence = useMemo(() => {
    return (
      reversed.find((msg) => msg.meta?.evidence.record.length)?.meta?.evidence
        .record || []
    );
  }, [reversed]);

  const setEvidence = (
    files: Iterable<File> | null,
    group: string = "default",
  ) => {
    const fileArray = files ? Array.from(files) : [];
    setEvidenceRecord((prev) => ({
      ...prev,
      [group]: fileArray,
    }));
  };

  const sendMessage = useAsync(
    async (input: string) => {
      if (!hasAcknowledgedPrivacyNotice) return;
      if (!input.trim()) return;

      const userMessage: Message = {
        role: "user",
        content: input,
        id: `user-${Date.now()}`,
      };
      setMessages((prev) => [...prev, userMessage]);

      const response = await fetch(`/api/intake/${token}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getOptionalAuthHeaders()),
        },
        body: JSON.stringify({
          conversationHistory: messages,
          userMessage: userMessage.content,
        }),
      });

      if (!response.ok) {
        throw new Error(
          (await response.text()) ||
            "An unknown error occurred. Please try again.",
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let assistantMessage: Message & { raw: string } = {
        role: "assistant",
        content: "",
        raw: "",
        id: `assistant-${Date.now()}`,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const raw = assistantMessage.raw + chunk;
          const metadataMarkerIndex = raw.indexOf(CHAT_METADATA_MARKER);
          assistantMessage = {
            ...assistantMessage,
            content:
              metadataMarkerIndex >= 0
                ? raw.slice(0, metadataMarkerIndex).trimEnd()
                : raw,
            raw,
          };
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id ? assistantMessage : msg,
            ),
          );
        }

        if (done) {
          const flushChunk = decoder.decode();
          if (flushChunk) {
            const raw = assistantMessage.raw + flushChunk;
            const metadataMarkerIndex = raw.indexOf(CHAT_METADATA_MARKER);
            assistantMessage = {
              ...assistantMessage,
              content:
                metadataMarkerIndex >= 0
                  ? raw.slice(0, metadataMarkerIndex).trimEnd()
                  : raw,
              raw,
            };
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id ? assistantMessage : msg,
              ),
            );
          }
          break;
        }
      }

      const metadataMarkerIndex =
        assistantMessage.raw.indexOf(CHAT_METADATA_MARKER);
      if (metadataMarkerIndex >= 0) {
        const metadataJson = assistantMessage.raw
          .slice(metadataMarkerIndex + CHAT_METADATA_MARKER.length)
          .trim();

        assistantMessage = {
          ...assistantMessage,
          content: assistantMessage.raw.slice(0, metadataMarkerIndex).trimEnd(),
        };

        if (metadataJson) {
          try {
            const parsedMeta = JSON.parse(metadataJson) as Message["meta"];
            assistantMessage = {
              ...assistantMessage,
              meta: parsedMeta,
            };
          } catch (error) {
            console.error("Failed to parse message metadata", error);
          }
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? assistantMessage : msg,
          ),
        );
      }
    },
    [token, messages, hasAcknowledgedPrivacyNotice],
    {
      onlyFirstLoad: false,
      initialLoading: false,
      withUseEffect: false,
      onError(error) {
        console.error("Error in chat submission:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, something went wrong.",
            id: `assistant-error-${Date.now()}`,
          },
        ]);
      },
    },
  );

  const statementFormalization = useAsync(
    async () => {
      // yield "Reviewing conversation...";
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 1400));
        return true;
      }
      if (!data) return false;

      if (
        data?.statement.status === "locked" ||
        data?.statement.status === "demo_published"
      ) {
        throw Error(
          "This intake has been stopped and cannot be formalized. Please contact the law firm.",
        );
      }

      const responses = messages
        .filter((message) => !!message.content)
        .map(({ role, content }) => ({ role, content }));

      if (responses.length === 0) return false;

      const currentWitnessMetadata = ((
        data as
          | ({
              witness_metadata?: Record<string, string | null>;
            } & typeof data)
          | null
      )?.witness_metadata ?? {}) as Record<string, string | null>;
      const patchDetails = reversed.find((msg) => {
        const nextWitnessDetails = msg.meta?.witnessDetails;
        if (!nextWitnessDetails) {
          return false;
        }

        return Object.entries(nextWitnessDetails).some(([key, value]) => {
          const currentValue = currentWitnessMetadata[key] ?? null;
          return currentValue !== (value ?? null);
        });
      })?.meta?.witnessDetails;

      if (patchDetails && Object.keys(patchDetails).length > 0) {
        // yield "Updating witness details...";
        await fetch(`/api/intake/${token}/submit`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(await getOptionalAuthHeaders()),
          },
          body: JSON.stringify({
            witnessDetails: patchDetails,
          }),
        });
        setStatementData((prev) =>
          prev
            ? ({
                ...prev,
                witness_metadata: {
                  ...(((
                    prev as {
                      witness_metadata?: Record<string, string | null>;
                    }
                  ).witness_metadata as
                    | Record<string, string | null>
                    | undefined) ?? {}),
                  ...patchDetails,
                },
              } as typeof prev)
            : prev,
        );
      }

      // yield "Generating statement draft...";

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 65000);

      const response = await fetch(`/api/intake/${token}/formalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getOptionalAuthHeaders()),
        },
        body: JSON.stringify({
          responses,
          evidence: exhibits.map((e) => ({
            exhibit: e.exhibit,
            description: e.description,
          })),
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        const errorPayload = await response
          .json()
          .catch(() => ({ error: "Failed to formalize statement" }));
        throw new Error(errorPayload?.error || "Failed to formalize statement");
      }

      // yield "Finalizing sections...";
      const payload = await response.json();

      // Build sections dynamically from config
      const newSections: Record<string, string> = {};
      data?.statement.statement_config.sections.forEach((section) => {
        newSections[section.id] = payload[section.id] ?? "";
      });
      setStatementSections(newSections);

      return true;
    },
    [token, messages, exhibits],
    {
      onlyFirstLoad: false,
      initialLoading: false,
      withUseEffect: false,
    },
  );

  const statementSubmission = useAsync(
    async () => {
      if (isDemo) return true;
      if (!data || !templateDocument) return false;

      if (
        !Object.values(evidenceFiles).some((files) => files.length > 0) &&
        suggestedEvidence?.length &&
        !confirm(
          "You have not uploaded any evidence. Are you sure you want to submit without uploading?",
        )
      ) {
        setTab("evidence");
        return false;
      }

      if (
        data.statement.status === "locked" ||
        data.statement.status === "demo_published"
      ) {
        alert(
          "This intake has been stopped and cannot be submitted. Please contact the law firm.",
        );
        return false;
      }

      const blob = await generateDoc(
        {
          caseTitle: data.case.title,
          caseMetadata:
            (data.case.case_metadata as Record<
              string,
              string | number | null | undefined
            >) ?? {},
          witnessName: data.statement.witness_name,
          witnessEmail: data.statement.witness_email,
          witnessMetadata:
            (data.statement.witness_metadata as Record<
              string,
              string | number | null | undefined
            >) ?? {},
          sections: statementSections,
          config: data.statement.statement_config,
        },
        templateDocument,
      );

      const basePath = `statements/${data.case.id}/${data.statement.id}`;
      const name = `${data.case.title || "case"} ${data.statement.witness_name} Witness Statement.docx`;
      const path = `${basePath}/${new Date().toISOString()} ${name}`;
      // Upload to Supabase storage
      const signedDocument = await uploadFile({
        bucketId: data.tenant_id,
        name,
        description: `${data.statement.witness_name}'s signed statement on ${new Date().toLocaleDateString()}`,
        path,
        file: blob,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const supportingDocuments = await Promise.all(
        exhibits.flatMap((e) => {
          return e.files.map((file, idx) => {
            const path = `${basePath}/${e.exhibit}/${new Date().toLocaleDateString()} ${file.name}`;
            return uploadFile({
              bucketId: data.tenant_id,
              name: `${e.exhibit}${e.files.length > 0 ? ` (${idx + 1})` : ""}`,
              description: `${e.exhibit}. ${e.description}`,
              path,
              file,
              contentType: file.type,
            });
          });
        }),
      );

      const submitResponse = await fetch(`/api/intake/${token}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getOptionalAuthHeaders()),
        },
        body: JSON.stringify({
          sections: statementSections,
          signedDocument,
          supportingDocuments,
        }),
      });

      if (!submitResponse.ok) {
        const errorPayload = await submitResponse
          .json()
          .catch(() => ({ error: "Failed to submit statement" }));
        throw new Error(errorPayload?.error || "Failed to submit statement");
      }
      return true;
    },
    [token, statementSections, evidenceFiles],
    {
      initialLoading: false,
      onlyFirstLoad: false,
      withUseEffect: false,
    },
  );

  const setAcknowledgePrivacyNoticeData = acknowledgePrivacyNotice.setData;
  const setStatementFormalizationData = statementFormalization.setData;
  const setStatementSubmissionData = statementSubmission.setData;
  const setSendMessageLoading = sendMessage.setIsLoading;

  useEffect(() => {
    if (!data) return;
    setAcknowledgePrivacyNoticeData(
      (p) => p || !!data.statement.gdpr_notice_acknowledgement,
    );
    const hasSubmitted = data.statement.status === "submitted";
    setStatementFormalizationData(hasSubmitted);
    setStatementSubmissionData(hasSubmitted);
  }, [
    data,
    setAcknowledgePrivacyNoticeData,
    setStatementFormalizationData,
    setStatementSubmissionData,
  ]);

  // States

  const isReadyToPrepare = useMemo(
    () => !!reversed.find((msg) => msg.meta?.progress.readyToPrepare),
    [reversed],
  );

  const [intakeStopReason, hasIntakeStopped] = useMemo(() => {
    const stopMessage = reversed.find(
      (message) =>
        message.role === "assistant" && message.meta?.deviation?.stopIntake,
    );
    const stopReason =
      stopMessage?.meta?.deviation?.deviationReason ||
      "This conversation has been flagged as out of scope.";
    return [stopReason, !!stopMessage];
  }, [reversed]);

  const hasConvoEnded = useMemo(() => {
    return !!statementSubmission.data;
  }, [statementSubmission.data]);

  const isBusy = useMemo(() => {
    return (
      sendMessage.isLoading ||
      statementFormalization.isLoading ||
      statementSubmission.isLoading
    );
  }, [
    sendMessage.isLoading,
    statementFormalization.isLoading,
    statementSubmission.isLoading,
  ]);

  // Initial greeting
  useEffect(() => {
    if (
      !data ||
      isDemo ||
      !hasAcknowledgedPrivacyNotice ||
      data?.has_history ||
      hasBootstrappedGreetingRef.current
    ) {
      return;
    }

    hasBootstrappedGreetingRef.current = true;
    setSendMessageLoading(true);
    const delay = 500;
    const greetingMessages = [...generateGreeting(data.case, data.statement)];
    let cumulativeDelay = 0;
    const timeouts = greetingMessages.map((message, index) => {
      const timeout = setTimeout(async () => {
        setMessages((prev) => [...prev, message]);
        await fetch(`/api/intake/${token}/chat/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await getOptionalAuthHeaders()),
          },
          body: JSON.stringify({ ...message, order: index }),
        }).catch((error) => {
          console.error("Error saving greeting message:", error);
        });
        if (index === greetingMessages.length - 1) {
          setSendMessageLoading(false);
        }
      }, cumulativeDelay);
      cumulativeDelay += delay;
      return timeout;
    });
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [
    token,
    isDemo,
    data,
    hasAcknowledgedPrivacyNotice,
    setSendMessageLoading,
  ]);

  if (isDataLoading) {
    return <Loading />;
  }

  if (loadError || !data) {
    return (
      <section className="flex flex-col justify-center items-center h-screen space-y-4 px-4">
        <div className="text-muted-foreground text-6xl mb-2">🔒</div>
        <h1 className="text-3xl font-semibold">Link Not Available</h1>
        <p className="text-muted-foreground text-center max-w-md">
          This magic link is invalid, or has expired.
        </p>
        <p className="text-sm text-muted-foreground">
          Please contact the law firm for a new link.
        </p>
        <Button asChild variant="link">
          <Link href="/">Return to home</Link>
        </Button>
      </section>
    );
  }

  const value: IntakeContextValue = {
    token,
    tab,
    setTab,
    // Data
    data,
    messages,
    statementSections,
    suggestedEvidence,
    evidenceFiles,
    templateDocument,
    hasAcknowledgedPrivacyNotice,

    // Handlers
    acknowledgePrivacyNotice,
    sendMessage,
    statementFormalization,
    statementSubmission,
    setEvidence,
    setStatementSection,

    // State
    isReadyToPrepare,
    hasIntakeStopped,
    intakeStopReason,
    hasConvoEnded,

    isDemo,
    isDemoPlaybackActive,
    skipDemoPlayback,
    isDemoTabsUnlocked,
    unlockDemoTabs,
    isBusy,
  };

  return (
    <IntakeContext.Provider value={value}>{children}</IntakeContext.Provider>
  );
}

export function useWitnessStatement() {
  const context = useContext(IntakeContext);
  if (!context) {
    throw new Error(
      "useWitnessStatement must be used within a WitnessStatementProvider",
    );
  }
  return context;
}
