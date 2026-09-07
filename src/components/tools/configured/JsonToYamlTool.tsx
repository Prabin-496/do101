"use client";

import { TextTool } from "@/components/tools/TextTool";
import { jsonToYamlConfig } from "@/lib/tools/configs/data";

export function JsonToYamlTool() {
  return <TextTool config={jsonToYamlConfig} />;
}
