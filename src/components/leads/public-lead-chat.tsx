"use client";

import { useEffect, useRef, useState } from "react";

import {
  ChatAreaContent,
  ChatAreaFooter,
  type ChatAreaBubbleColors,
  type ChatAreaMessage,
} from "@/components/chat/chat-area";
import { ExpandIcon, MinimizeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_LEAD_BACKGROUND_COLOR,
  DEFAULT_LEAD_HEADER_COLOR,
  DEFAULT_LEAD_TEXT_COLOR,
  DEFAULT_LEAD_USER_BUBBLE_COLOR,
  leadHexColor,
  type LeadBranding,
} from "@/lib/leads/schema";

type PublicLeadChatProps = {
  publicKey: string;
  firmName: string;
  enquiryName?: string;
  welcome: string;
  branding?: LeadBranding;
  turnstileSiteKey?: string;
  resumeToken?: string;
  fill?: boolean;
  hideFullscreen?: boolean;
};

type ResumedEnquiry = {
  token?: string;
  status?: string;
  publicKey?: string;
  leadTypeName?: string;
  messages?: ChatAreaMessage[];
  error?: string;
};

function enquiryStorageKey(publicKey: string) {
  return `casey-enquiry:${publicKey}`;
}

type TurnstileApi = {
  ready: (callback: () => void) => void;
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      appearance?: "always" | "execute" | "interaction-only";
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      "timeout-callback"?: () => void;
      "before-interactive-callback"?: () => void;
      "unsupported-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

type HumanWaiter = {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
};

function turnstileApi() {
  return (
    window as Window & {
      turnstile?: TurnstileApi;
    }
  ).turnstile;
}

let turnstileLoader: Promise<TurnstileApi> | null = null;

function loadTurnstile() {
  const existing = turnstileApi();
  if (existing?.render) return Promise.resolve(existing);
  if (!turnstileLoader) {
    turnstileLoader = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.dataset.turnstile = "true";
      script.onload = () => {
        const api = turnstileApi();
        if (!api?.render) {
          reject(new Error("Turnstile failed to load"));
          return;
        }
        resolve(api);
      };
      script.onerror = () => reject(new Error("Turnstile failed to load"));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      turnstileLoader = null;
      throw error;
    });
  }
  return turnstileLoader;
}

function turnstileIsShown(holder: HTMLElement) {
  const nodes = [holder, ...holder.querySelectorAll<HTMLElement>("div, iframe")];
  return nodes.some((node) => {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    const box = node.getBoundingClientRect();
    return box.height > 20 && box.width > 40;
  });
}

function PersonCheck({
  siteKey,
  resetRef,
  onToken,
  onVisible,
  onError,
}: {
  siteKey: string;
  resetRef: { current: (() => void) | null };
  onToken: (token: string | null) => void;
  onVisible: () => void;
  onError: () => void;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  const onVisibleRef = useRef(onVisible);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTokenRef.current = onToken;
    onVisibleRef.current = onVisible;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    let cancelled = false;
    let widgetId: string | undefined;
    const observer = new ResizeObserver(() => {
      if (turnstileIsShown(holder)) onVisibleRef.current();
    });
    observer.observe(holder);

    void loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        widgetId = api.render(holder, {
          sitekey: siteKey,
          theme: "auto",
          appearance: "interaction-only",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "before-interactive-callback": () => onVisibleRef.current(),
          "error-callback": () => onErrorRef.current(),
          "timeout-callback": () => onErrorRef.current(),
          "unsupported-callback": () => onErrorRef.current(),
        });
        resetRef.current = () => {
          if (widgetId) api.reset(widgetId);
        };
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current();
      });

    return () => {
      cancelled = true;
      observer.disconnect();
      resetRef.current = null;
      if (!widgetId) return;
      const id = widgetId;
      void loadTurnstile()
        .then((api) => api.remove(id))
        .catch(() => undefined);
    };
  }, [resetRef, siteKey]);

  return <div ref={holderRef} className="flex justify-center" />;
}

export function PublicLeadChat({
  publicKey,
  firmName,
  enquiryName,
  welcome,
  branding,
  turnstileSiteKey,
  resumeToken,
  fill = false,
  hideFullscreen = false,
}: PublicLeadChatProps) {
  const [enquiryLabel, setEnquiryLabel] = useState(enquiryName);
  const [messages, setMessages] = useState<ChatAreaMessage[]>([
    { role: "assistant", content: welcome },
  ]);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [humanShown, setHumanShown] = useState(false);
  const [humanOk, setHumanOk] = useState(false);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [summary, setSummary] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const humanTokenRef = useRef<string | null>(null);
  const humanWaitersRef = useRef<HumanWaiter[]>([]);
  const humanFailedRef = useRef(false);
  const resetHumanCheckRef = useRef<(() => void) | null>(null);

  function rememberToken(next: string) {
    setToken(next);
    window.localStorage.setItem(enquiryStorageKey(publicKey), next);
  }

  function forgetToken() {
    window.localStorage.removeItem(enquiryStorageKey(publicKey));
  }

  useEffect(() => {
    let cancelled = false;
    const stored = window.localStorage.getItem(enquiryStorageKey(publicKey));
    const candidates = [resumeToken, stored].filter(
      (value, index, all): value is string => Boolean(value) && all.indexOf(value) === index,
    );
    if (candidates.length === 0) {
      setRestoring(false);
      return;
    }
    void (async () => {
      let restored: ResumedEnquiry | null = null;
      for (const candidate of candidates) {
        const response = await fetch(`/api/public/qualify/session/${candidate}`);
        if (!response.ok) {
          if (candidate === stored) forgetToken();
          continue;
        }
        const payload = (await response.json()) as ResumedEnquiry;
        if (payload.token && payload.publicKey === publicKey) {
          restored = payload;
          break;
        }
        if (candidate === stored) forgetToken();
      }
      if (cancelled || !restored?.token) return;
      if (restored.leadTypeName) setEnquiryLabel(restored.leadTypeName);
      if (restored.messages?.length) setMessages(restored.messages);
      if (restored.status === "verify") setAwaitingCode(true);
      if (restored.status === "promoted" || restored.status === "closed") {
        setDone(true);
        forgetToken();
        setToken(restored.token);
        return;
      }
      rememberToken(restored.token);
    })()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [publicKey, resumeToken]);

  useEffect(() => {
    if (hideFullscreen) return;
    function onFullscreenChange() {
      setFullscreen(document.fullscreenElement != null);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [hideFullscreen]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const target = window.parent !== window ? document.documentElement : panelRef.current;
    void target?.requestFullscreen();
  }

  function noteHumanToken(next: string | null) {
    if (!next) {
      humanTokenRef.current = null;
      setHumanOk(false);
      return;
    }
    setHumanOk(true);
    humanFailedRef.current = false;
    const pending = humanWaitersRef.current.splice(0);
    if (pending.length === 0) {
      humanTokenRef.current = next;
      return;
    }
    for (const waiter of pending) waiter.resolve(next);
    resetHumanCheckRef.current?.();
  }

  function failHumanCheck() {
    humanFailedRef.current = true;
    humanTokenRef.current = null;
    const pending = humanWaitersRef.current.splice(0);
    for (const waiter of pending) {
      waiter.reject(new Error("Confirm you are a person."));
    }
  }

  function takeHumanToken() {
    if (!turnstileSiteKey) return Promise.resolve("dev-turnstile");
    if (humanFailedRef.current) {
      humanFailedRef.current = false;
      resetHumanCheckRef.current?.();
    }
    const ready = humanTokenRef.current;
    if (ready) {
      humanTokenRef.current = null;
      resetHumanCheckRef.current?.();
      return Promise.resolve(ready);
    }
    return new Promise<string>((resolve, reject) => {
      const waiter: HumanWaiter = {
        resolve: (token) => {
          window.clearTimeout(timeout);
          resolve(token);
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        },
      };
      const timeout = window.setTimeout(() => {
        humanWaitersRef.current = humanWaitersRef.current.filter(
          (item) => item !== waiter,
        );
        reject(new Error("Confirm you are a person."));
      }, 90_000);
      humanWaitersRef.current.push(waiter);
    });
  }

  const mustConfirmHuman =
    Boolean(turnstileSiteKey) && humanShown && !humanOk && (!token || fallback);

  const accent = leadHexColor(branding?.primaryColor, DEFAULT_LEAD_HEADER_COLOR);
  const textColor = leadHexColor(branding?.textColor, DEFAULT_LEAD_TEXT_COLOR);
  const backgroundColor = leadHexColor(
    branding?.backgroundColor,
    DEFAULT_LEAD_BACKGROUND_COLOR,
  );
  const userBubbleColor = leadHexColor(
    branding?.userBubbleColor,
    DEFAULT_LEAD_USER_BUBBLE_COLOR,
  );
  const bubbleColors: ChatAreaBubbleColors = {
    assistant: { backgroundColor: accent, color: textColor },
    user: { backgroundColor: userBubbleColor, color: textColor },
  };

  async function ensureSession() {
    if (token) return token;
    const stored = window.localStorage.getItem(enquiryStorageKey(publicKey));
    if (stored) return stored;
    const human = await takeHumanToken();
    const response = await fetch("/api/public/qualify/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicKey, turnstileToken: human }),
    });
    const payload = (await response.json()) as {
      token?: string;
      messages?: ChatAreaMessage[];
      error?: string;
      fallback?: boolean;
    };
    if (!response.ok || !payload.token) {
      if (payload.fallback) setFallback(true);
      throw new Error(payload.error || "The chat could not start");
    }
    rememberToken(payload.token);
    if (payload.messages?.length) {
      setMessages((current) =>
        current.some((message) => message.role === "user")
          ? current
          : payload.messages!,
      );
    }
    return payload.token;
  }

  async function sendMessage(text: string, files?: File[]) {
    const message = text.trim();
    if ((!message && !files?.length) || busy || done || restoring || mustConfirmHuman) return;
    setBusy(true);
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
        discarded?: boolean;
        leadTypeName?: string;
        status?: string;
        needsVerification?: boolean;
      };
      if (payload.discarded) {
        setDone(true);
        setFallback(false);
        forgetToken();
      } else if (payload.fallback) {
        setFallback(true);
      }
      if (payload.promoted) {
        setDone(true);
        setAwaitingCode(false);
        forgetToken();
      }
      if (payload.status === "verify" || payload.needsVerification) {
        setAwaitingCode(true);
      } else if (!payload.error) {
        setAwaitingCode(false);
      }
      if (payload.leadTypeName) setEnquiryLabel(payload.leadTypeName);
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
    if (mustConfirmHuman) return;
    setBusy(true);
    try {
      const human = await takeHumanToken();
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
    <div
      ref={panelRef}
      className={
        fullscreen
          ? "flex h-dvh min-h-0 w-full flex-col"
          : fill
            ? "flex h-full min-h-0 flex-col"
            : "flex h-[32rem] flex-col rounded-2xl border shadow-sm"
      }
      style={{ backgroundColor }}
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 text-white ${
          fill || fullscreen ? "" : "rounded-t-2xl"
        }`}
        style={{ backgroundColor: accent }}
      >
        {branding?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt=""
            className="h-8 w-8 rounded bg-white object-contain"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {branding?.displayName || firmName}
          </p>
          {enquiryLabel || !branding?.hideCaseyMark ? (
            <p className="truncate text-xs text-white/80">
              {[enquiryLabel, branding?.hideCaseyMark ? null : "Casey"]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        {hideFullscreen ? null : (
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white hover:bg-white/15"
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            onClick={toggleFullscreen}
          >
            {fullscreen ? (
              <MinimizeIcon className="h-4 w-4" />
            ) : (
              <ExpandIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ChatAreaContent
          messages={messages}
          pending={busy}
          userAvatar={{ name: publicKey, title: "You" }}
          bubbleColors={bubbleColors}
          hideAvatars={Boolean(branding?.hideAvatars)}
          variant="lead"
        >
          {done ? (
            <p className="pt-2 text-sm" style={{ color: textColor }}>
              You can close this chat.
            </p>
          ) : null}
        </ChatAreaContent>
      </div>
      {turnstileSiteKey && (!token || fallback) && !done ? (
        <div className="px-3 pt-3">
          <PersonCheck
            siteKey={turnstileSiteKey}
            resetRef={resetHumanCheckRef}
            onToken={noteHumanToken}
            onVisible={() => setHumanShown(true)}
            onError={failHumanCheck}
          />
        </div>
      ) : null}
      {fallback && !done ? (
        <form
          className="space-y-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendFallback();
          }}
        >
          <Input
            placeholder="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Input
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Input
            placeholder="Phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
          <Textarea
            placeholder="What happened"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
          <Button type="submit" disabled={busy || mustConfirmHuman}>
            Send details
          </Button>
        </form>
      ) : (
        <div className="px-3 pb-3">
          <ChatAreaFooter
            onSend={(text, files) => sendMessage(text, files)}
            disabled={busy || done || restoring || mustConfirmHuman}
            allowAttachments={false}
            placeholder={
              done
                ? "Conversation ended"
                : restoring
                  ? "Opening your chat"
                  : mustConfirmHuman
                    ? "Confirm you are a person"
                    : awaitingCode
                      ? "Enter the code"
                      : "Type your reply"
            }
          />
        </div>
      )}
    </div>
  );
}
