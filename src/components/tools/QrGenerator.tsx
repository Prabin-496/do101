"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Card } from "@/components/ui/Card";
import { Input, Label, Select, Slider, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState } from "@/components/ui/Feedback";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

type QrType = "url" | "text" | "email" | "phone" | "wifi";

const TYPES: Array<{ id: QrType; label: string }> = [
  { id: "url", label: "🔗 Link" },
  { id: "text", label: "✍️ Text" },
  { id: "email", label: "✉️ Email" },
  { id: "phone", label: "📞 Phone" },
  { id: "wifi", label: "📶 Wi-Fi" },
];

/** Wi-Fi payloads escape \ ; , : and " with a backslash. */
function escapeWifi(value: string): string {
  return value.replace(/([\;,:"])/g, "\\$1");
}

export function QrGenerator() {
  const [type, setType] = React.useState<QrType>("url");
  const [url, setUrl] = React.useState("https://do101.online");
  const [text, setText] = React.useState("");
  const [email, setEmail] = React.useState({ to: "", subject: "", body: "" });
  const [phone, setPhone] = React.useState("");
  const [wifi, setWifi] = React.useState({ ssid: "", password: "", encryption: "WPA", hidden: false });

  const [size, setSize] = React.useState(512);
  const [level, setLevel] = React.useState<"L" | "M" | "Q" | "H">("M");
  const [dark, setDark] = React.useState("#22303c");
  const [light, setLight] = React.useState("#ffffff");

  const [pngUrl, setPngUrl] = React.useState("");
  const [svg, setSvg] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const payload = React.useMemo(() => {
    switch (type) {
      case "url":
        return url.trim();
      case "text":
        return text;
      case "email": {
        if (!email.to.trim()) return "";
        const params = new URLSearchParams();
        if (email.subject) params.set("subject", email.subject);
        if (email.body) params.set("body", email.body);
        const q = params.toString();
        return `mailto:${email.to.trim()}${q ? `?${q}` : ""}`;
      }
      case "phone":
        return phone.trim() ? `tel:${phone.trim()}` : "";
      case "wifi":
        return wifi.ssid.trim()
          ? `WIFI:T:${wifi.encryption};S:${escapeWifi(wifi.ssid)};${
              wifi.encryption === "nopass" ? "" : `P:${escapeWifi(wifi.password)};`
            }${wifi.hidden ? "H:true;" : ""};`
          : "";
    }
  }, [type, url, text, email, phone, wifi]);

  React.useEffect(() => {
    let cancelled = false;
    if (!payload) return;
    const options = {
      errorCorrectionLevel: level,
      width: size,
      margin: 2,
      color: { dark, light },
    } as const;

    Promise.all([QRCode.toDataURL(payload, options), QRCode.toString(payload, { ...options, type: "svg" })])
      .then(([png, svgString]) => {
        if (cancelled) return;
        setPngUrl(png);
        setSvg(svgString);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPngUrl("");
        setSvg("");
        setError(
          err instanceof Error && /too big|code length/i.test(err.message)
            ? "That is too much data for one QR code. Shorten the text, or lower the error-correction level."
            : "This content could not be encoded as a QR code.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [payload, level, size, dark, light]);

  const download = (kind: "png" | "svg") => {
    const href =
      kind === "png" ? pngUrl : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = `do101-qr.${kind}`;
    a.click();
    track("tool_complete", { tool: "qr-generator", type, format: kind });
    recordCompletion(10);
  };

  return (
    <div className="space-y-4">
      <Tabs
        ariaLabel="QR code type"
        value={type}
        onChange={(v) => setType(v as QrType)}
        items={TYPES}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          {type === "url" ? (
            <div>
              <Label htmlFor="qr-url">Link</Label>
              <Input
                id="qr-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          ) : null}

          {type === "text" ? (
            <div>
              <Label htmlFor="qr-text">Text</Label>
              <Textarea
                id="qr-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Any text you want the code to contain…"
                className="min-h-[120px]"
              />
            </div>
          ) : null}

          {type === "email" ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="qr-email">Send to</Label>
                <Input
                  id="qr-email"
                  type="email"
                  value={email.to}
                  onChange={(e) => setEmail({ ...email, to: e.target.value })}
                  placeholder="hello@example.com"
                />
              </div>
              <div>
                <Label htmlFor="qr-subject">Subject (optional)</Label>
                <Input
                  id="qr-subject"
                  value={email.subject}
                  onChange={(e) => setEmail({ ...email, subject: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="qr-body">Message (optional)</Label>
                <Textarea
                  id="qr-body"
                  value={email.body}
                  onChange={(e) => setEmail({ ...email, body: e.target.value })}
                  className="min-h-[90px]"
                />
              </div>
            </div>
          ) : null}

          {type === "phone" ? (
            <div>
              <Label htmlFor="qr-phone">Phone number</Label>
              <Input
                id="qr-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 0100"
              />
            </div>
          ) : null}

          {type === "wifi" ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="qr-ssid">Network name (SSID)</Label>
                <Input
                  id="qr-ssid"
                  value={wifi.ssid}
                  onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="qr-enc">Security</Label>
                <Select
                  id="qr-enc"
                  value={wifi.encryption}
                  onChange={(e) => setWifi({ ...wifi, encryption: e.target.value })}
                >
                  <option value="WPA">WPA / WPA2 / WPA3</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">Open (no password)</option>
                </Select>
              </div>
              {wifi.encryption !== "nopass" ? (
                <div>
                  <Label htmlFor="qr-pass">Password</Label>
                  <Input
                    id="qr-pass"
                    value={wifi.password}
                    onChange={(e) => setWifi({ ...wifi, password: e.target.value })}
                  />
                </div>
              ) : null}
              <p className="rounded-xl bg-[var(--sun-soft)] px-3 py-2 text-xs font-bold">
                ⚠️ A Wi-Fi QR code stores the password in plain text. Anyone who scans a printed code
                can join your network.
              </p>
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 border-t-2 border-[var(--border)] pt-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="qr-size" hint={`${size}px`}>
                Size
              </Label>
              <Slider
                id="qr-size"
                min={128}
                max={1024}
                step={32}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="qr-level">Error correction</Label>
              <Select
                id="qr-level"
                value={level}
                onChange={(e) => setLevel(e.target.value as "L" | "M" | "Q" | "H")}
              >
                <option value="L">Low (7%) — smallest code</option>
                <option value="M">Medium (15%) — recommended</option>
                <option value="Q">Quartile (25%)</option>
                <option value="H">High (30%) — best for print</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="qr-dark">Foreground</Label>
              <input
                id="qr-dark"
                type="color"
                value={dark}
                onChange={(e) => setDark(e.target.value)}
                className="h-12 w-full cursor-pointer rounded-xl border-2 border-[var(--border)] bg-transparent"
              />
            </div>
            <div>
              <Label htmlFor="qr-light">Background</Label>
              <input
                id="qr-light"
                type="color"
                value={light}
                onChange={(e) => setLight(e.target.value)}
                className="h-12 w-full cursor-pointer rounded-xl border-2 border-[var(--border)] bg-transparent"
              />
            </div>
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center gap-4 p-5">
          {payload && pngUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pngUrl}
                alt={`QR code for the ${type} you entered`}
                className="do-pop h-auto w-full max-w-[240px] rounded-2xl border-2 border-[var(--border)]"
              />
              <div className="flex w-full flex-col gap-2">
                <Button tone="grass" onClick={() => download("png")}>
                  Download PNG
                </Button>
                <Button tone="sky" onClick={() => download("svg")}>
                  Download SVG
                </Button>
              </div>
              <p className="text-center text-xs font-semibold text-[var(--muted)]">
                Test it with your phone camera before printing.
              </p>
            </>
          ) : (
            <div className="py-10 text-center">
              <span className="do-bob block text-5xl" aria-hidden>
                📱
              </span>
              <p className="mt-3 text-sm font-extrabold">Your QR code appears here</p>
              <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                Fill in the fields on the left.
              </p>
            </div>
          )}
        </Card>
      </div>

      {payload && error ? <ErrorState message={error} /> : null}
    </div>
  );
}
