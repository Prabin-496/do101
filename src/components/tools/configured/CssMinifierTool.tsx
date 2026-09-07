"use client";

import { TextTool } from "@/components/tools/TextTool";
import { cssMinifierConfig } from "@/lib/tools/configs/data";

export function CssMinifierTool() {
  return <TextTool config={cssMinifierConfig} />;
}
