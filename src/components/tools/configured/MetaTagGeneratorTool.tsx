"use client";

import { FormTool } from "@/components/tools/FormTool";
import { metaTagGeneratorConfig } from "@/lib/tools/configs/seo";

export function MetaTagGeneratorTool() {
  return <FormTool config={metaTagGeneratorConfig} />;
}
