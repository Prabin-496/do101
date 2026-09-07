"use client";

import { TextTool } from "@/components/tools/TextTool";
import { csvToJsonConfig } from "@/lib/tools/configs/data";

export function CsvToJsonTool() {
  return <TextTool config={csvToJsonConfig} />;
}
