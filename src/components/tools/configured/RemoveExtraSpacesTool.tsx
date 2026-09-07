"use client";

import { TextTool } from "@/components/tools/TextTool";
import { removeExtraSpacesConfig } from "@/lib/tools/configs/text";

export function RemoveExtraSpacesTool() {
  return <TextTool config={removeExtraSpacesConfig} />;
}
