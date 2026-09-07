"use client";

import { TextTool } from "@/components/tools/TextTool";
import { htmlEncodeConfig } from "@/lib/tools/configs/text";

export function HtmlEncoderTool() {
  return <TextTool config={htmlEncodeConfig} />;
}
