"use client";

import { TextTool } from "@/components/tools/TextTool";
import { jsonEscapeConfig } from "@/lib/tools/configs/data";

export function JsonEscapeTool() {
  return <TextTool config={jsonEscapeConfig} />;
}
