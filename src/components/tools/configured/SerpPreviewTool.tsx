"use client";

import { FormTool } from "@/components/tools/FormTool";
import { serpPreviewConfig } from "@/lib/tools/configs/seo";

export function SerpPreviewTool() {
  return <FormTool config={serpPreviewConfig} />;
}
