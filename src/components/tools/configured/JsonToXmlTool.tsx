"use client";

import { TextTool } from "@/components/tools/TextTool";
import { jsonToXmlConfig } from "@/lib/tools/configs/data";

export function JsonToXmlTool() {
  return <TextTool config={jsonToXmlConfig} />;
}
