"use client";

import { TextTool } from "@/components/tools/TextTool";
import { jsonMinifierConfig } from "@/lib/tools/configs/data";

export function JsonMinifierTool() {
  return <TextTool config={jsonMinifierConfig} />;
}
