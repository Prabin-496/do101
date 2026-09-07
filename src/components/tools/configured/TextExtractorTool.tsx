"use client";

import { TextTool } from "@/components/tools/TextTool";
import { textExtractorConfig } from "@/lib/tools/configs/text";

export function TextExtractorTool() {
  return <TextTool config={textExtractorConfig} />;
}
