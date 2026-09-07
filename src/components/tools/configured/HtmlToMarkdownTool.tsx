"use client";

import { TextTool } from "@/components/tools/TextTool";
import { htmlToMarkdownConfig } from "@/lib/tools/configs/markdown";

export function HtmlToMarkdownTool() {
  return <TextTool config={htmlToMarkdownConfig} />;
}
