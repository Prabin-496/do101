"use client";

import { TextTool } from "@/components/tools/TextTool";
import { textSorterConfig } from "@/lib/tools/configs/text";

export function TextSorterTool() {
  return <TextTool config={textSorterConfig} />;
}
