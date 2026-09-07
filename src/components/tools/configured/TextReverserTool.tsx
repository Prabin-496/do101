"use client";

import { TextTool } from "@/components/tools/TextTool";
import { textReverserConfig } from "@/lib/tools/configs/text";

export function TextReverserTool() {
  return <TextTool config={textReverserConfig} />;
}
