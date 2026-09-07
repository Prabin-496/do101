"use client";

import { TextTool } from "@/components/tools/TextTool";
import { removeEmptyLinesConfig } from "@/lib/tools/configs/text";

export function RemoveEmptyLinesTool() {
  return <TextTool config={removeEmptyLinesConfig} />;
}
