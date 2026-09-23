"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = { role: "user" | "assistant"; content: string };

type PublicLeadChatProps = {
  publicKey: string;
  firmName: string;
  welcome: string;
  branding?: {
    primaryColor?: string;
    logoUrl?: string;
    displayName?: string;
    hideCaseyMark?: boolean;
  };
  turnstileSiteKey?: string;
};

async function turnstileToken(siteKey?: string) {
  if (!siteKey || typeof window === "undefined") return "dev-turnstile";
  const existing = document.querySelector<HTMLScriptElement>(
    "script[data-turnstile]",
  );
  if (!existing) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.dataset.turnstile = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Turnstile failed to load"));
      document.head.appendChild(script);
    });
  }
  const turnstile = (
    window as Window & {
      turnstile?: {
        render: (
          element: HTMLElement,
          options: { sitekey: string; callback: (token: string) => void },
        ) => void;
      };
    }
  ).turnstile;
  if (!turnstile) return "dev-turnstile";
  const holder = document.createElement("div");
  document.body.appendChild(holder);
  return new Promise<string>((resolve) => {
    turnstile.render(holder, { sitekey: siteKey, callback: resolve });
  });
}

export function PublicLeadChat({
  publicKey,
  firmName,
  welcome,
  branding,
  turnstileSiteKey,
}: PublicLeadChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: welcome },
  ]);
  const [draft, setDraft] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [summary, setSummary] = useState("");
  const accent = branding?.primaryColor || "#1f3a2e";

  async function ensureSession() {
    if (token) return token;
    const human = await turnstileToken(turnstileSiteKey);
    const response = await fetch("/api/public/qualify/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey, turnstileToken: human }),
    });
    const payload = (await response.json()) as {
      token?: string;
      messages?: ChatMessage[];
      error?: string;
      fallback?: boolean;
    };
    if (!response.ok || !payload.token) {
      if (payload.fallback) setFallback(true);
      throw new Error(payload.error || "The chat could not start");
    }
    setToken(payload.token);
    if (payload.messages?.length) setMessages(payload.messages);
    return payload.token;
  }

  async function sendMessage() {
    const message = draft.trim();
    if (!message || busy || done) return;
    setBusy(true);
    setDraft("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    try {
      const sessionToken = await ensureSession();
      const response = await fetch(
        `/api/public/qualify/session/${sessionToken}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        },
      );
      const payload = (await response.json()) as {
        reply?: string;
        error?: string;
        fallback?: boolean;
        promoted?: boolean;
      };
      if (payload.fallback) setFallback(true);
      if (payload.promoted) setDone(true);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: payload.reply || payload.error || "Something went wrong.",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error ? error.message : "Something went wrong.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function sendFallback() {
    setBusy(true);
    try {
      const human = await turnstileToken(turnstileSiteKey);
      const response = await fetch("/api/public/qualify/fallback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey,
          turnstileToken: human,
          name,
          email,
          phone,
          summary,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save");
      setDone(true);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error ? error.message : "Could not save that.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[32rem] flex-col rounded-2xl border bg-background shadow-sm">
      <div
        className="flex items-center gap-3 rounded-t-2xl px-4 py-3 text-white"
        style={{ backgroundColor: accent }}
      >
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branding.logoUrl} alt="" className="h-8 w-8 rounded bg-white object-contain" />
        ) : null}
        <div>
          <p className="text-sm font-medium">
            {branding?.displayName || firmName}
          </p>
          {branding?.hideCaseyMark ? null : (
            <p className="text-xs text-white/80">Casey</p>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message, index) => (
          <p
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-8 rounded-2xl bg-muted px-3 py-2 text-sm"
                : "mr-8 rounded-2xl px-3 py-2 text-sm text-white"
            }
            style={
              message.role === "assistant" ? { backgroundColor: accent } : undefined
            }
          >
            {message.content}
          </p>
        ))}
        {done ? (
          <p className="text-sm text-muted-foreground">
            You can close this chat.
          </p>
        ) : null}
      </div>
      {fallback && !done ? (
        <form
          className="space-y-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendFallback();
          }}
        >
          <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required />
          <Input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <Textarea placeholder="What happened" value={summary} onChange={(event) => setSummary(event.target.value)} />
          <Button type="submit" disabled={busy}>
            Send details
          </Button>
        </form>
      ) : (
        <form
          className="flex gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type your reply"
            disabled={busy || done}
          />
          <Button type="submit" disabled={busy || done}>
            Send
          </Button>
        </form>
      )}
    </div>
  );
}
