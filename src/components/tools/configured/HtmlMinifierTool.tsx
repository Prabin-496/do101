"use client";

import { TextTool } from "@/components/tools/TextTool";
import { htmlMinifierConfig } from "@/lib/tools/configs/data";

export function HtmlMinifierTool() {
  return <TextTool config={htmlMinifierConfig} />;
}
