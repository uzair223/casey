"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import { Message } from "@/lib/types";
import { generateDoc } from "@/lib/docGenerator";
import {
  getFullStatementData,
  StatementDataResponse,
} from "@/lib/supabase/queries";
import {
  generateGreeting,
  parseProgress,
  parseMeta,
  cleanResponse,
} from "@/lib/intakeUtils";
import {
  DEMO_STATEMENT_DATA,
  DEMO_MESSAGES,
  DEMO_FORMAL,
} from "@/lib/demoData";
import { PERSONAL_INJURY_CONFIG } from "@/lib/statementConfigs";
import { uploadFile } from "@/lib/supabase/queries/upload";

interface StatementContextValue {
  token: string;
  tab: string;
  setTab: React.Dispatch<React.SetStateAction<string>>;
  // Data
  input: string;
  statementData: StatementDataResponse | null;
  messages: Message[];
  evidenceFiles: File[];
  statementSections: Record<string, string>;
  signatureData: { canvas: HTMLCanvasElement | null; name: string } | null;
  loadError: string | null;
  preparationError: string | null;
  // Handlers
  setInput: (value: string) => void;
  handleSubmitMessage: (e: React.FormEvent) => Promise<void>;
  handlePrepareStatement: () => Promise<void>;
  addEvidenceFiles: (files: FileList | null) => void;
  removeEvidenceFile: (index: number) => void;
  setStatementSections: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setIsEditingStatement: (value: boolean) => void;
  handleCaptureSignature: (canvas: HTMLCanvasElement, name: string) => void;
  handleSubmitStatement: () => Promise<void>;
  // State
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
  demoProgress: number;
}

const StatementContext = createContext<StatementContextValue | null>(null);

export function StatementProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const isDemo = token === "demo";
  const [tab, setTab] = useState("chat");

  // Data state
  const [statementData, setStatementData] =
    useState<StatementDataResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Chat state
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<(Message & { raw?: string })[]>([]);

  // Loading and submission state
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReadyToPrepare, setIsReadyToPrepare] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPrepared, setIsPrepared] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Statement state - Initialize sections dynamically from config
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
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const addEvidenceFiles = (files: FileList | null) => {
    if (!files) return;
    setEvidenceFiles((prev) => {
      const next = [...prev];
      Array.from(files).forEach((file) => {
        const duplicate = next.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified,
        );
        if (!duplicate) {
          next.push(file);
        }
      });
      return next;
    });
  };
  const removeEvidenceFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Fetch magic link and case data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        setLoadError(null);
        if (isDemo) {
          setStatementData(DEMO_STATEMENT_DATA);
          setIsLoadingData(false);
          return;
        }
        const data = await getFullStatementData(token);
        if (!data) {
          setLoadError("invalid");
          setIsLoadingData(false);
          return;
        }
        setStatementData(data);
        if (data.has_history) {
          setMessages([generateGreeting(data), ...(data.messages || [])]);
          setIsReadyToPrepare(
            data.messages?.[data.messages.length - 1].progress
              ?.readyToPrepare || false,
          );
        }
        setIsLoadingData(false);
      } catch (error) {
        console.error("Error fetching intake data:", error);
        setStatementData(null);
        // Detect rate limit errors
        if (error instanceof Error) {
          if (
            error.message.includes("Rate limit") ||
            error.message.includes("Too many attempts")
          ) {
            setLoadError("rate_limit");
          } else {
            setLoadError("unknown");
          }
        } else {
          setLoadError("unknown");
        }
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [token, isDemo]);

  // Demo message playback
  const [demoProgress, setDemoProgress] = useState(0);
  useEffect(() => {
    if (!isDemo) return;
    if (demoProgress >= DEMO_MESSAGES.length) {
      setIsReadyToPrepare(true);
      return;
    }
    const delay = 800;
    const timer = setTimeout(() => {
      const nextMessage = DEMO_MESSAGES[demoProgress];
      if (!nextMessage) return;

      setMessages((prev) => [...prev, nextMessage]);
      setDemoProgress((prev) => prev + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [isDemo, demoProgress]);

  // Initial greeting
  useEffect(() => {
    if (statementData && messages.length === 0) {
      setMessages([generateGreeting(statementData)]);
    }
  }, [statementData, messages.length]);

  // Handle message submission
  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const lastProgress = messages
      .slice()
      .reverse()
      .find((m) => m.role === "assistant" && m.progress)?.progress;

    const userMessage: Message = {
      role: "user",
      content: input,
      id: `user-${Date.now()}`,
      progress: lastProgress,
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageCache = input;
    setInput("");
    setIsGenerating(true);

    try {
      const response = await fetch(`/api/statement/${token}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: messageCache,
          conversationHistory: [...messages, userMessage],
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
        console.log({ done, value });
        if (done) break;

        const chunk = decoder.decode(value);
        const raw = assistantMessage.raw + chunk;
        const content = cleanResponse(raw);
        const progress = parseProgress(raw);
        const meta = parseMeta(raw);

        assistantMessage = {
          ...assistantMessage,
          content,
          raw,
          progress,
          meta,
        };
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? assistantMessage : msg,
          ),
        );
      }

      setIsReadyToPrepare(!!assistantMessage.progress?.readyToPrepare);
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
  };

  // Handle preparing statement
  const handlePrepareStatement = async () => {
    setTab("statement");
    setIsPreparing(true);
    setPreparationError(null);
    try {
      if (isDemo) {
        setStatementSections(DEMO_FORMAL);
        setIsPrepared(true);
        setIsPreparing(false);
        return;
      }

      if (statementData?.statement_status === "locked") {
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

      const response = await fetch(`/api/statement/${token}/formalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
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

      if (!statementData) {
        return;
      }

      if (statementData.statement_status === "locked") {
        alert(
          "This intake has been stopped and cannot be submitted. Please contact the law firm.",
        );
        return;
      }

      // Convert canvas to base64 image
      let signatureImage: string | undefined;
      if (signatureData?.canvas) {
        signatureImage = signatureData.canvas.toDataURL("image/png");
      }

      const blob = await generateDoc({
        caseReference: statementData.reference,
        caseTitle: statementData.title,
        witnessName: statementData.witness_name,
        sections: statementSections,
        signatureImage,
        signatureName: signatureData?.name || statementData.witness_name,
      });

      // Upload to Supabase storage
      const signedDocument = await uploadFile(
        statementData.tenant_id,
        `${statementData.tenant_id}/${statementData.statement_id}/${statementData.reference}_${statementData.witness_name}_statement.docx`,
        blob,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );

      const supportingDocuments = await Promise.all(
        evidenceFiles.map(async (file) =>
          uploadFile(
            statementData.tenant_id,
            `${statementData.statement_id}/evidence/${file.name}`,
            file,
            file.type,
          ),
        ),
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

  const value: StatementContextValue = {
    token,
    tab,
    setTab,
    // Data
    statementData,
    input,
    messages,
    evidenceFiles,
    statementSections,
    signatureData,
    loadError,
    preparationError,
    // Handlers
    setInput,
    handleSubmitMessage,
    handlePrepareStatement,
    addEvidenceFiles,
    removeEvidenceFile,
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
    demoProgress,
  };

  return (
    <StatementContext.Provider value={value}>
      {children}
    </StatementContext.Provider>
  );
}

export function useStatement() {
  const context = useContext(StatementContext);
  if (!context) {
    throw new Error("useStatement must be used within a StatementProvider");
  }
  return context;
}
