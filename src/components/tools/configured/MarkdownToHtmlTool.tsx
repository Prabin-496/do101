"use client";

import { TextTool } from "@/components/tools/TextTool";
import { markdownToHtmlConfig } from "@/lib/tools/configs/markdown";

export function MarkdownToHtmlTool() {
  return <TextTool config={markdownToHtmlConfig} />;
}
