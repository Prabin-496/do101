"use client";

import { TextTool } from "@/components/tools/TextTool";
import { slugGeneratorConfig } from "@/lib/tools/configs/text";

export function SlugGeneratorTool() {
  return <TextTool config={slugGeneratorConfig} />;
}
