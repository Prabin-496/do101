"use client";

import { TextTool } from "@/components/tools/TextTool";
import { xmlToJsonConfig } from "@/lib/tools/configs/data-client";

export function XmlToJsonTool() {
  return <TextTool config={xmlToJsonConfig} />;
}
