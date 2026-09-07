"use client";

import { TextTool } from "@/components/tools/TextTool";
import { sqlFormatterConfig } from "@/lib/tools/configs/data";

export function SqlFormatterTool() {
  return <TextTool config={sqlFormatterConfig} />;
}
