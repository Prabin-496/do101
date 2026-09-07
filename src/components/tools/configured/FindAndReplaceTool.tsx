"use client";

import { TextTool } from "@/components/tools/TextTool";
import { findAndReplaceConfig } from "@/lib/tools/configs/text";

export function FindAndReplaceTool() {
  return <TextTool config={findAndReplaceConfig} />;
}
