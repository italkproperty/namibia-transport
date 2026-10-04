"use client";

import * as React from "react";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  Share2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type ShareBookingLinkProps = {
  url: string;
  label?: string;
  customerName?: string | null;
  whatsappHref?: string | null;
};

export function ShareBookingLink({
  url,
  label = "Share",
  customerName,
  whatsappHref,
}: ShareBookingLinkProps) {
  const [copied, setCopied] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this booking link:", url);
    }
  };

  const share = async () => {
    if (!navigator.share) {
      await copy();
      return;
    }

    setSharing(true);
    try {
      await navigator.share({
        title: "Namibia Transport booking",
        text: customerName
          ? `Namibia Transport booking for ${customerName}`
          : "Namibia Transport booking",
        url,
      });
    } catch {
      // Closing the native share sheet is a normal outcome.
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copy}
        className="press h-8 gap-1.5 text-xs"
        title={copied ? "Link copied" : "Copy booking link"}
      >
        {copied ? (
          <CheckIcon className="text-success size-3.5" aria-hidden />
        ) : (
          <CopyIcon className="size-3.5" aria-hidden />
        )}
        {copied ? "Copied" : "Copy link"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={share}
        disabled={sharing}
        className="press h-8 gap-1.5 text-xs"
        title="Share booking link"
      >
        <Share2Icon className="size-3.5" aria-hidden />
        {sharing ? "Sharing…" : label}
      </Button>

      {whatsappHref && (
        <Button
          asChild
          type="button"
          variant="ghost"
          size="sm"
          className="press h-8 px-2 text-success"
          title="Open WhatsApp with the quote ready to send"
        >
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Send booking link on WhatsApp"
          >
            WhatsApp
          </a>
        </Button>
      )}

      <Button
        asChild
        type="button"
        variant="ghost"
        size="sm"
        className="press h-8 px-2"
        title="Open booking link"
      >
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open booking link"
        >
          <ExternalLinkIcon className="size-3.5" aria-hidden />
        </a>
      </Button>
    </div>
  );
}
