"use client";

import { TextTool } from "@/components/tools/TextTool";
import { jsonToCsvConfig } from "@/lib/tools/configs/data";

export function JsonToCsvTool() {
  return <TextTool config={jsonToCsvConfig} />;
}
