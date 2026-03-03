"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useMemo,
} from "react";
import { Message } from "@/lib/types";
import { generateDoc } from "@/lib/docGenerator";
import {
  getFullStatementFromToken,
  StatementDataResponse,
} from "@/lib/supabase/queries";
import {
  generateGreeting,
  parseAndValidateResponse,
  cleanResponse,
} from "@/lib/statementUtils";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";
import { uploadFile } from "@/lib/supabase/queries/upload";
import { useAsync } from "@/hooks/useAsync";
import { DEMO_STATEMENT_DATA } from "@/lib/demoData";

interface WitnessStatementContextValue {
  token: string;
  tab: string;
  setTab: React.Dispatch<React.SetStateAction<string>>;
  // Data
  input: string;
  statementData: StatementDataResponse<true> | null;
  messages: Message[];
  suggestedEvidence: { name: string; type: string }[] | null;
  evidenceFiles: Record<string, File[]>;
  statementSections: Record<string, string>;
  signatureData: { canvas: HTMLCanvasElement | null; name: string } | null;
  preparationError: string | null;
  // Handlers
  setInput: (value: string) => void;
  handleSubmitMessage: (e: React.SyntheticEvent) => void;
  handlePrepareStatement: () => Promise<void>;
  setEvidence: (files: Iterable<File> | null, group?: string) => void;
  setStatementSections: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setIsEditingStatement: (value: boolean) => void;
  handleCaptureSignature: (canvas: HTMLCanvasElement, name: string) => void;
  handleSubmitStatement: () => Promise<void>;
  // State
  loadError: Error | null;
  isLoadingData: boolean;
  isGenerating: boolean;
  isReadyToPrepare: boolean;
  isPreparing: boolean;
  isPrepared: boolean;
  isSubmitted: boolean;
  isSubmitting: boolean;
  isEditingStatement: boolean;
  isSigned: boolean;
  // Demo
  isDemo: boolean;
}

const WitnessStatementContext =
  createContext<WitnessStatementContextValue | null>(null);

export function WitnessStatementProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const isDemo = useMemo(
    () => token === DEMO_STATEMENT_DATA.link!.token,
    [token],
  );
  const [tab, setTab] = useState("chat");

  // Data state
  const [statementData, setStatementData] =
    useState<StatementDataResponse<true> | null>(null);
  const initializeStatementSections = (): Record<string, string> => {
    const sections: Record<string, string> = {};
    PERSONAL_INJURY_CONFIG.sections.forEach((section) => {
      sections[section.field] = "";
    });
    return sections;
  };
  const [statementSections, setStatementSections] = useState<
    Record<string, string>
  >(initializeStatementSections());

  const { isLoading: isLoadingData, error: loadError } = useAsync(async () => {
    if (isDemo) {
      setStatementData(DEMO_STATEMENT_DATA);
      setStatementSections(
        DEMO_STATEMENT_DATA.sections as Record<string, string>,
      );
      return;
    }
    const data = await getFullStatementFromToken(token, true);
    if (!data) {
      throw new Error("Invalid token or statement not found");
    }
    setStatementData(data);
    if (data.has_history) {
      setMessages(data.messages || []);
      setIsReadyToPrepare(
        data.messages?.[data.messages.length - 1].meta?.progress
          ?.readyToPrepare || false,
      );
    }
    setStatementSections(
      (data.sections as Record<string, string>) ||
        initializeStatementSections(),
    );
    setIsPrepared(data.status === "submitted");
    setIsSubmitted(data.status === "submitted");
  }, [isDemo, token]);

  // Chat state
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<(Message & { raw?: string })[]>([]);

  // Loading and submission state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReadyToPrepare, setIsReadyToPrepare] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPrepared, setIsPrepared] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [isEditingStatement, setIsEditingStatement] = useState(false);

  // Signature state
  const [signatureData, setSignatureData] = useState<{
    canvas: HTMLCanvasElement | null;
    name: string;
  } | null>(null);

  const handleCaptureSignature = (canvas: HTMLCanvasElement, name: string) => {
    setSignatureData({ canvas, name });
  };

  // Evidence file handlers
  const reversed = useMemo(() => messages.slice().reverse(), [messages]);
  const suggestedEvidence = useMemo(
    () =>
      reversed.find((msg) => msg.meta?.evidence.record.length)?.meta?.evidence
        .record || [],
    [reversed],
  );

  const [evidenceFiles, setEvidenceFiles] = useState<Record<string, File[]>>(
    {},
  );
  const setEvidence = (files: Iterable<File> | null, group?: string) => {
    const key = group || "default";
    const fileArray = files ? Array.from(files) : [];

    setEvidenceFiles((prev) => ({
      ...prev,
      [key]: fileArray,
    }));
  };

  // // Demo message playback
  useEffect(() => {
    if (!isDemo) return;
    const messages = DEMO_STATEMENT_DATA.messages;
    let cumulativeDelay = 0;
    const timeouts = messages.map((message, index) => {
      const timeout = setTimeout(() => {
        setMessages((prev) => [...prev, message]);
        if (index === messages.length - 1) {
          setIsReadyToPrepare(true);
        }
      }, cumulativeDelay);
      cumulativeDelay += Math.random() * 400 + 800; // Random delay between 800ms and 1200ms
      return timeout;
    });
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [isDemo]);

  // Initial greeting
  useEffect(() => {
    if (isDemo || !statementData || statementData.has_history) return;
    setIsGenerating(true);
    const delay = 500;
    const greetingMessages = [...generateGreeting(statementData)];
    let cumulativeDelay = 0;
    const timeouts = greetingMessages.map((message, index) => {
      const timeout = setTimeout(async () => {
        setMessages((prev) => [...prev, message]);
        await fetch(`/api/statement/${token}/chat/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message),
        }).catch((error) => {
          console.error("Error saving greeting message:", error);
        });
        if (index === greetingMessages.length - 1) {
          setIsGenerating(false);
        }
      }, cumulativeDelay);
      cumulativeDelay += delay;
      return timeout;
    });
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [isDemo, statementData, token]);

  // Handle message submission
  const handleSubmitMessage = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      id: `user-${Date.now()}`,
    };

    void (async () => {
      try {
        const response = await fetch(`/api/statement/${token}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationHistory: messages,
            userMessage: userMessage.content,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get AI response");
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
          const chunk = decoder.decode(value);
          const raw = assistantMessage.raw + chunk;
          const content = cleanResponse(raw);
          const { meta } = parseAndValidateResponse(raw);
          assistantMessage = {
            ...assistantMessage,
            content,
            raw,
            meta,
          };
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id ? assistantMessage : msg,
            ),
          );
          if (done) break;
        }

        setIsReadyToPrepare(!!assistantMessage.meta?.progress.readyToPrepare);
        setIsGenerating(false);
      } catch (error) {
        console.error("Error getting AI response:", error);
        setIsGenerating(false);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I'm sorry, there was an error processing your message. Please try again.",
            id: `error-${Date.now()}`,
          },
        ]);
      }
    })();

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsGenerating(true);
  };

  // Handle preparing statement
  const handlePrepareStatement = async () => {
    setTab("statement");
    setIsPreparing(true);
    setPreparationError(null);
    try {
      if (isDemo) {
        setIsPrepared(true);
        setIsPreparing(false);
        return;
      }

      if (statementData?.status === "locked") {
        alert(
          "This intake has been stopped and cannot be formalized. Please contact the law firm.",
        );
        return;
      }

      const responses = messages
        .filter((message) => !!message.content)
        .map(({ role, content }) => ({ role, content }));

      if (responses.length === 0) {
        setIsPreparing(false);
        return;
      }

      const patchDetails = reversed.find(
        (msg) =>
          msg.meta?.witnessDetails?.address !==
            statementData?.witness_address ||
          msg.meta?.witnessDetails?.occupation !==
            statementData?.witness_occupation,
      )?.meta?.witnessDetails;
      const address = patchDetails?.address ?? undefined;
      const occupation = patchDetails?.occupation ?? undefined;

      if (address || occupation) {
        await fetch(`/api/statement/${token}/submit`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, occupation }),
        });
        setStatementData((prev) =>
          prev
            ? {
                ...prev,
                witness_address: address ?? prev.witness_address,
                witness_occupation: occupation ?? prev.witness_occupation,
              }
            : prev,
        );
      }

      const response = await fetch(`/api/statement/${token}/formalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses, evidence: suggestedEvidence }),
      });

      if (!response.ok) {
        const errorPayload = await response
          .json()
          .catch(() => ({ error: "Failed to formalize statement" }));
        throw new Error(errorPayload?.error || "Failed to formalize statement");
      }

      const payload = await response.json();

      // Build sections dynamically from config
      const newSections: Record<string, string> = {};
      PERSONAL_INJURY_CONFIG.sections.forEach((section) => {
        newSections[section.field] = payload[section.field] ?? "";
      });
      setStatementSections(newSections);

      setIsPrepared(true);
    } catch (error) {
      console.error("Error formalizing statement:", error);
      setPreparationError(
        error instanceof Error
          ? error.message
          : "Failed to formalize statement",
      );
    } finally {
      setIsPreparing(false);
    }
  };

  // Handle submitting statement to backend
  const handleSubmitStatement = async () => {
    setIsSubmitting(true);
    try {
      if (isDemo) {
        setIsSubmitted(true);
        return;
      }

      if (
        !Object.values(evidenceFiles).some((files) => files.length > 0) &&
        suggestedEvidence?.length &&
        !confirm(
          "You have not uploaded any evidence. Are you sure you want to submit without uploading?",
        )
      ) {
        setTab("documents");
        setIsSubmitting(false);
        return;
      }

      if (!statementData) {
        return;
      }

      if (statementData.status === "locked") {
        alert(
          "This intake has been stopped and cannot be submitted. Please contact the law firm.",
        );
        return;
      }

      const blob = await generateDoc({
        caseReference: statementData.reference,
        caseTitle: statementData.title,
        witnessName: statementData.witness_name,
        sections: statementSections,
      });

      // Upload to Supabase storage
      const signedDocument = await uploadFile(
        statementData.tenant_id,
        "Signed Statement",
        `${statementData.tenant_id}/${statementData.id}/${statementData.reference}_${statementData.witness_name}_statement.docx`,
        blob,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );

      const supportingDocuments = await Promise.all(
        Object.entries(evidenceFiles).flatMap(([group, files]) => {
          return files.map((file, idx) => {
            const path = `${statementData.tenant_id}/${statementData.id}/evidence/${group}/${Date.now()}_${file.name}`;
            return uploadFile(
              statementData.tenant_id,
              `${group}${files.length > 0 ? " " + (idx + 1) : ""}`,
              path,
              file,
              file.type,
            );
          });
        }),
      );

      const submitResponse = await fetch(`/api/statement/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      setIsSubmitted(true);
    } catch (error) {
      console.error("Error submitting statement:", error);
      alert("Failed to submit statement. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const value: WitnessStatementContextValue = {
    token,
    tab,
    setTab,
    // Data
    statementData,
    input,
    messages,
    suggestedEvidence,
    evidenceFiles,
    statementSections,
    signatureData,
    loadError,
    preparationError,
    // Handlers
    setInput,
    handleSubmitMessage,
    handlePrepareStatement,
    setEvidence,
    setStatementSections,
    setIsEditingStatement,
    handleCaptureSignature,
    handleSubmitStatement,
    // State
    isLoadingData,
    isGenerating,
    isReadyToPrepare,
    isPreparing,
    isPrepared,
    isSubmitting,
    isSubmitted,
    isEditingStatement,
    isSigned: !!signatureData,
    // Demo
    isDemo,
  };

  return (
    <WitnessStatementContext.Provider value={value}>
      {children}
    </WitnessStatementContext.Provider>
  );
}

export function useWitnessStatement() {
  const context = useContext(WitnessStatementContext);
  if (!context) {
    throw new Error(
      "useWitnessStatement must be used within a WitnessStatementProvider",
    );
  }
  return context;
}
