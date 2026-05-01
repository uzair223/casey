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
import {
  IntakeChatMessage,
  StatementDataResponse,
  StatementSupportingDocument,
} from "@/types";
import { generateDoc } from "@/lib/doc-gen";
import {
  getEvidenceDocuments,
  groupEvidenceDocuments,
  inferEvidenceGroupFromFiles,
  normalizeEvidenceGroup,
  TempUploadedDocument,
} from "@/lib/evidence";
import {
  CHAT_METADATA_MARKER,
  getMessageResponseMeta,
} from "@/lib/statement-utils";
import { useAsync, UseAsyncReturn } from "@/hooks/useAsync";
import Loading from "@/components/loading";
import { apiFetch } from "@/lib/api-utils";
import { Button } from "../ui/button";
import { Link } from "lucide-react";
import { toast } from "@/lib/toast";

type IntakeContextData = Omit<
  StatementDataResponse<true>,
  "messages" | "statement"
> & {
  statement: Omit<StatementDataResponse<true>["statement"], "sections">;
};

export type IntakeTabs = "chat" | "evidence" | "statement";

export type IntakeContextValue = {
  token: string;
  tab: IntakeTabs;
  setTab: (tab: IntakeTabs) => void;

  data: IntakeContextData;
  messages: IntakeChatMessage[];
  suggestedEvidence: { name: string; type: string }[] | null;
  evidenceFiles: Record<string, TempUploadedDocument[]>;
  statementSections: Record<string, string>;
  hasFormalizedStatement: boolean;
  templateDocument: Blob | null;
  hasAcknowledgedPrivacyNotice: boolean;

  acknowledgePrivacyNotice: UseAsyncReturn<boolean, boolean, boolean>;
  sendMessage: UseAsyncReturn<void, null, void, [string, File[], string?]>;
  statementFormalization: UseAsyncReturn<boolean>;
  statementSubmission: UseAsyncReturn<boolean>;

  setEvidence: (files: Iterable<File> | null, group?: string) => Promise<void>;
  removeEvidence: (path: string) => Promise<void>;
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
  const requiresDemoAuth = token.startsWith("demo-");

  const [tab, setTab] = useState<IntakeTabs>("chat");
  const [statementSections, setStatementSections] = useState<
    Record<string, string>
  >({});
  const setStatementSection = (key: string, value: string) => {
    setStatementSections((prev) => ({ ...prev, [key]: value }));
  };

  const hasBootstrappedGreetingRef = useRef(false);
  const demoPlaybackSourceRef = useRef<IntakeChatMessage[]>([]);
  const demoPlaybackTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [messages, setMessages] = useState<
    (IntakeChatMessage & { raw?: string })[]
  >([]);
  const [isDemoPlaybackActive, setIsDemoPlaybackActive] = useState(false);
  const [isDemoTabsUnlocked, setIsDemoTabsUnlocked] = useState(false);
  const reversed = useMemo(() => messages.slice().reverse(), [messages]);

  const withCompleteStatus = (
    message: IntakeChatMessage,
  ): IntakeChatMessage => ({
    ...message,
    status: "complete",
  });

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
        `/api/intake/${token}/shared`,
        { method: "GET", requireAuth: requiresDemoAuth },
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
        demoPlaybackSourceRef.current = initialMessages.map(withCompleteStatus);
        setMessages([]);
      } else {
        demoPlaybackSourceRef.current = [];
        setMessages(initialMessages.map(withCompleteStatus));
      }

      return { statement, case: caseData, ...rest };
    },
    [token, requiresDemoAuth],
    { initialLoading: true },
  );

  const isDemo = useMemo(() => {
    return data?.statement.status === "demo_published";
  }, [data?.statement.status]);
  const statementConfig = data?.statement.statement_config ?? null;

  const { data: templateDocument } = useAsync(async () => {
    const templateDocumentSnapshot = data?.statement.template_document_snapshot;
    if (!templateDocumentSnapshot) return null;

    try {
      const response = await apiFetch(
        `/api/intake/${token}/shared/template-document`,
        {
          method: "GET",
          requireAuth: requiresDemoAuth,
          returnType: "response",
        },
      );

      if (!response.ok) {
        return null;
      }

      return await response.blob();
    } catch (error) {
      console.warn("Template document unavailable for intake preview", error);
      return null;
    }
  }, [data?.statement.template_document_snapshot, token, requiresDemoAuth]);

  const acknowledgePrivacyNotice = useAsync(
    async () => {
      try {
        await apiFetch(`/api/intake/${token}/shared/consent`, {
          method: "POST",
          requireAuth: requiresDemoAuth,
        });
        return true;
      } catch {
        throw new Error("Failed to acknowledge privacy notice");
      }
    },
    [token, requiresDemoAuth],
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
    queueMicrotask(() => {
      setIsDemoPlaybackActive(true);
    });

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

  const suggestedEvidence = useMemo(() => {
    if (!statementConfig) {
      return [];
    }

    return (
      reversed
        .map((message) => getMessageResponseMeta(message, statementConfig))
        .find((metadata) => (metadata?.evidence.record.length ?? 0) > 0)
        ?.evidence.record || []
    );
  }, [reversed, statementConfig]);

  const persistedEvidenceDocuments = useMemo(
    () =>
      getEvidenceDocuments(
        data?.statement.supporting_documents?.map((row) => row.document),
      ).sort(
        (left, right) =>
          new Date(right.uploadedAt).getTime() -
          new Date(left.uploadedAt).getTime(),
      ),
    [data?.statement.supporting_documents],
  );

  const evidenceFiles = useMemo(() => {
    const grouped = groupEvidenceDocuments(persistedEvidenceDocuments);
    return Object.fromEntries(
      grouped.map(({ group, documents }) => [group, documents]),
    );
  }, [persistedEvidenceDocuments]);

  const appendEvidenceDocuments = (documents: TempUploadedDocument[]) => {
    if (!documents.length) {
      return;
    }

    setStatementData((prev) =>
      prev
        ? {
            ...prev,
            statement: {
              ...prev.statement,
              supporting_documents: [
                ...(prev.statement.supporting_documents ?? []),
                ...documents.map(
                  (document) =>
                    ({
                      id: document.path,
                      tenant_id: prev.tenant_id,
                      case_id: prev.case.id,
                      statement_id: prev.statement.id,
                      uploaded_by_type: "witness",
                      uploaded_by_user_id: null,
                      uploaded_by_witness_name: prev.statement.witness_name,
                      uploaded_by_witness_email: prev.statement.witness_email,
                      title: document.name,
                      group_name: document.group ?? null,
                      document,
                      descriptor_status: "pending",
                      descriptors: {},
                      descriptor_model: null,
                      descriptor_generated_at: null,
                      created_at: document.uploadedAt,
                      updated_at: document.uploadedAt,
                    }) satisfies StatementSupportingDocument,
                ),
              ],
            },
          }
        : prev,
    );
  };

  const removeEvidenceDocument = (path: string) => {
    setStatementData((prev) =>
      prev
        ? {
            ...prev,
            statement: {
              ...prev.statement,
              supporting_documents: (
                prev.statement.supporting_documents ?? []
              ).filter((row) => row.document.path !== path),
            },
          }
        : prev,
    );
  };

  const uploadEvidenceFiles = async (
    files: Iterable<File> | null,
    group?: string,
  ) => {
    const fileArray = files ? Array.from(files) : [];
    if (!fileArray.length) {
      return;
    }

    const normalizedGroup = normalizeEvidenceGroup(
      group || inferEvidenceGroupFromFiles(fileArray),
    );
    const formData = new FormData();
    formData.append("group", normalizedGroup);
    fileArray.forEach((file, index) => {
      formData.append(`file_${index}`, file);
    });

    const response = await apiFetch<{ documents: TempUploadedDocument[] }>(
      `/api/intake/${token}/shared/evidence`,
      {
        method: "POST",
        body: formData,
        requireAuth: requiresDemoAuth,
      },
    );

    appendEvidenceDocuments(response.documents);
    return response.documents;
  };

  const inferChatEvidenceGroup = (
    attachments: File[],
    suggestedGroup?: string,
  ) => {
    if (suggestedGroup?.trim()) {
      return suggestedGroup.trim();
    }

    if (!statementConfig) {
      return inferEvidenceGroupFromFiles(attachments);
    }

    const latestEvidenceRecord = reversed
      .map((message) => getMessageResponseMeta(message, statementConfig))
      .find((metadata) => (metadata?.evidence.record.length ?? 0) > 0)
      ?.evidence.record;

    if (latestEvidenceRecord?.length === 1) {
      return latestEvidenceRecord[0].name;
    }

    return inferEvidenceGroupFromFiles(attachments);
  };

  const removeEvidence = async (path: string) => {
    await apiFetch(`/api/intake/${token}/shared/evidence`, {
      method: "DELETE",
      body: JSON.stringify({ path }),
      requireAuth: requiresDemoAuth,
    });

    removeEvidenceDocument(path);
  };

  const sendMessage = useAsync(
    async (input: string, attachments: File[] = [], evidenceGroup?: string) => {
      if (!hasAcknowledgedPrivacyNotice) return;

      const trimmedInput = input.trim();
      const hasAttachments = attachments.length > 0;

      if (!trimmedInput && !hasAttachments) return;

      const uploadedDocuments =
        (hasAttachments
          ? await uploadEvidenceFiles(
              attachments,
              inferChatEvidenceGroup(attachments, evidenceGroup),
            )
          : []) ?? [];

      const userDisplayContent =
        trimmedInput || (hasAttachments ? "Uploaded supporting files." : "");

      const userMessage: IntakeChatMessage = {
        role: "user",
        content: userDisplayContent,
        id: `user-${Date.now()}`,
        status: "complete",
        meta:
          uploadedDocuments.length > 0
            ? {
                attachedFiles: uploadedDocuments,
                submittedAt: new Date().toISOString(),
              }
            : undefined,
      };
      setMessages((prev) => [...prev, userMessage]);

      const requestBody = hasAttachments
        ? (() => {
            const formData = new FormData();
            formData.append("conversationHistory", JSON.stringify(messages));
            formData.append("userMessage", trimmedInput);
            formData.append(
              "persistedAttachments",
              JSON.stringify(uploadedDocuments),
            );
            attachments.forEach((file, index) => {
              formData.append(`file_${index}`, file);
            });
            return formData;
          })()
        : JSON.stringify({
            conversationHistory: messages,
            userMessage: trimmedInput,
          });

      const response = await apiFetch(`/api/intake/${token}/interview/chat`, {
        method: "POST",
        body: requestBody,
        requireAuth: requiresDemoAuth,
        returnType: "response",
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

      let assistantMessage: IntakeChatMessage & { raw: string } = {
        role: "assistant",
        content: "",
        raw: "",
        id: `assistant-${Date.now()}`,
        status: "pending",
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
            status: "pending",
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
              status: "pending",
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
          status: "complete",
        };

        if (metadataJson) {
          try {
            const parsedMeta = JSON.parse(
              metadataJson,
            ) as IntakeChatMessage["meta"];
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
      } else {
        assistantMessage = {
          ...assistantMessage,
          status: "complete",
        };
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? assistantMessage : msg,
          ),
        );
      }
    },
    [
      token,
      messages,
      hasAcknowledgedPrivacyNotice,
      requiresDemoAuth,
      reversed,
      statementConfig,
    ],
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
            status: "error",
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
        data?.statement.status === "demo_published" ||
        data?.statement.status === "finalized" ||
        data?.statement.status === "completed"
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
      const messageWithPatchDetails = reversed.find((msg) => {
        const nextWitnessDetails = getMessageResponseMeta(
          msg,
          data.statement.statement_config,
        )?.witnessDetails;
        if (!nextWitnessDetails) {
          return false;
        }

        return Object.entries(nextWitnessDetails).some(([key, value]) => {
          const currentValue = currentWitnessMetadata[key] ?? null;
          return currentValue !== (value ?? null);
        });
      });
      const patchDetails = messageWithPatchDetails
        ? getMessageResponseMeta(
            messageWithPatchDetails,
            data.statement.statement_config,
          )?.witnessDetails
        : undefined;

      if (patchDetails && Object.keys(patchDetails).length > 0) {
        // yield "Updating witness details...";
        await apiFetch(`/api/intake/${token}/interview/submit`, {
          requireAuth: requiresDemoAuth,
          method: "PUT",
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

      await apiFetch(`/api/intake/${token}/interview/formalize`, {
        method: "POST",
        requireAuth: requiresDemoAuth,
      });

      type FormalizePollResponse = {
        job: {
          status: "queued" | "running" | "succeeded" | "failed";
          error_message: string | null;
        } | null;
        sections: Record<string, string>;
      };

      let payload: Record<string, string> | null = null;
      const startedAt = Date.now();
      const timeoutMs = 120_000;

      while (Date.now() - startedAt < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const poll = await apiFetch<FormalizePollResponse>(
          `/api/intake/${token}/interview/formalize`,
          {
            method: "GET",
            requireAuth: requiresDemoAuth,
          },
        );

        if (poll.job?.status === "succeeded") {
          payload = poll.sections;
          break;
        }

        if (poll.job?.status === "failed") {
          throw new Error(
            poll.job.error_message || "Failed to formalize statement.",
          );
        }
      }

      if (!payload) {
        throw new Error("Formalization timed out. Please try again.");
      }

      // Build sections dynamically from config
      const newSections: Record<string, string> = {};
      data?.statement.statement_config.sections.forEach((section) => {
        newSections[section.id] = payload[section.id] ?? "";
      });
      setStatementSections(newSections);

      return true;
    },
    [token, messages, requiresDemoAuth],
    {
      onlyFirstLoad: false,
      initialLoading: false,
      withUseEffect: false,
    },
  );

  const hasFormalizedStatement = useMemo(
    () =>
      Boolean(data?.statement.formalization_snapshot_id) ||
      Boolean(statementFormalization.data) ||
      Object.values(statementSections).some((section) => section.trim()),
    [
      data?.statement.formalization_snapshot_id,
      statementFormalization.data,
      statementSections,
    ],
  );

  const statementSubmission = useAsync(
    async () => {
      if (isDemo) return true;
      if (!data || !templateDocument) return false;

      if (
        persistedEvidenceDocuments.length === 0 &&
        suggestedEvidence?.length &&
        !(await toast.confirm("Submit without uploading evidence?", {
          description:
            "You have suggested evidence but have not uploaded any files.",
          confirmLabel: "Submit anyway",
        }))
      ) {
        setTab("evidence");
        return false;
      }

      if (
        data.statement.status === "locked" ||
        data.statement.status === "demo_published" ||
        data.statement.status === "finalized" ||
        data.statement.status === "completed"
      ) {
        toast.error(
          "This intake has been stopped and cannot be submitted. Please contact the law firm.",
        );
        return false;
      }

      const blob = await generateDoc(
        {
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

      const name = `${data.case.title || "case"} ${data.statement.witness_name} Witness Statement.docx`;
      const formData = new FormData();
      formData.append("sections", JSON.stringify(statementSections));
      formData.append("signedDocument", blob, name);

      await apiFetch(`/api/intake/${token}/interview/submit`, {
        method: "POST",
        body: formData,
        requireAuth: requiresDemoAuth,
      });
      return true;
    },
    [token, statementSections, persistedEvidenceDocuments, requiresDemoAuth],
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
    const hasSubmitted =
      data.statement.status === "submitted" ||
      data.statement.status === "finalized" ||
      data.statement.status === "completed";
    setStatementFormalizationData(hasSubmitted);
    setStatementSubmissionData(hasSubmitted);
  }, [
    data,
    setAcknowledgePrivacyNoticeData,
    setStatementFormalizationData,
    setStatementSubmissionData,
  ]);

  // States

  const isReadyToPrepare = useMemo(() => {
    if (!statementConfig) {
      return false;
    }

    return !!reversed.find(
      (message) =>
        getMessageResponseMeta(message, statementConfig)?.progress
          .readyToPrepare,
    );
  }, [reversed, statementConfig]);

  const [intakeStopReason, hasIntakeStopped] = useMemo(() => {
    if (!statementConfig) {
      return ["This conversation has been flagged as out of scope.", false];
    }

    const stopMessage = reversed.find(
      (message) =>
        getMessageResponseMeta(message, statementConfig)?.deviation?.stopIntake,
    );
    const stopMeta = stopMessage
      ? getMessageResponseMeta(stopMessage, statementConfig)
      : null;
    const stopReason =
      stopMeta?.deviation?.deviationReason ||
      "This conversation has been flagged as out of scope.";
    return [stopReason, !!stopMessage];
  }, [reversed, statementConfig]);

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
    let isCancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    void (async () => {
      const greetingMessages = await apiFetch<IntakeChatMessage[]>(
        `/api/intake/${token}/interview/greeting`,
        {
          method: "POST",
          requireAuth: requiresDemoAuth,
        },
      ).catch((error) => {
        console.error("Error generating greeting:", error);
        return [];
      });

      if (isCancelled || greetingMessages.length === 0) {
        setSendMessageLoading(false);
        return;
      }

      let cumulativeDelay = 0;

      greetingMessages.forEach((message, index) => {
        const timeout = setTimeout(async () => {
          if (isCancelled) {
            return;
          }

          setMessages((prev) => [...prev, message]);
          await apiFetch(`/api/intake/${token}/interview/chat/save`, {
            method: "POST",
            body: JSON.stringify({
              role: message.role,
              content: message.content,
              meta: message.meta,
              order: index,
            }),
            requireAuth: requiresDemoAuth,
          }).catch((error) => {
            console.error("Error saving greeting message:", error);
          });

          if (index === greetingMessages.length - 1) {
            setSendMessageLoading(false);
          }
        }, cumulativeDelay);

        cumulativeDelay += delay;
        timeouts.push(timeout);
      });
    })();

    return () => {
      isCancelled = true;
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [
    token,
    requiresDemoAuth,
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
    hasFormalizedStatement,
    suggestedEvidence,
    evidenceFiles,
    templateDocument,
    hasAcknowledgedPrivacyNotice,

    // Handlers
    acknowledgePrivacyNotice,
    sendMessage,
    statementFormalization,
    statementSubmission,
    setEvidence: async (files, group) => {
      await uploadEvidenceFiles(files, group);
    },
    removeEvidence,
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
