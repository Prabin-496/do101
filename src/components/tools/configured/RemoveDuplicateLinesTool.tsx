"use client";

import { TextTool } from "@/components/tools/TextTool";
import { removeDuplicateLinesConfig } from "@/lib/tools/configs/text";

export function RemoveDuplicateLinesTool() {
  return <TextTool config={removeDuplicateLinesConfig} />;
}
