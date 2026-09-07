"use client";

import { TextTool } from "@/components/tools/TextTool";
import { yamlToJsonConfig } from "@/lib/tools/configs/data";

export function YamlToJsonTool() {
  return <TextTool config={yamlToJsonConfig} />;
}
