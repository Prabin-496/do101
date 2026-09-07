"use client";

import { TextTool } from "@/components/tools/TextTool";
import { xmlFormatterConfig } from "@/lib/tools/configs/data";

export function XmlFormatterTool() {
  return <TextTool config={xmlFormatterConfig} />;
}
