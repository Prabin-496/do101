"use client";

import { FormTool } from "@/components/tools/FormTool";
import { colorConverterConfig } from "@/lib/tools/configs/color";

export function ColorConverterTool() {
  return <FormTool config={colorConverterConfig} />;
}
