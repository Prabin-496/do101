"use client";

import { TextTool } from "@/components/tools/TextTool";
import { htmlDecodeConfig } from "@/lib/tools/configs/text";

export function HtmlDecoderTool() {
  return <TextTool config={htmlDecodeConfig} />;
}
