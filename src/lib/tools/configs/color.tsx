import type { FormToolConfig } from "../form-tool-config";
import {
  parseColor,
  rgbToHex,
  rgbToHsl,
  rgbToCmyk,
  contrastRatio,
} from "@/lib/color/convert";

export const colorConverterConfig: FormToolConfig = {
  id: "color-converter",
  outputLabel: "Every format",
  note: "Type a colour in any format — #4cc93f, rgb(76 201 63), hsl(114 52% 52%) or a CSS name like tomato.",
  fields: [
    {
      id: "value",
      label: "Colour",
      type: "text",
      default: "#4cc93f",
      placeholder: "#4cc93f, rgb(76,201,63), hsl(114,52%,52%), tomato",
      wide: true,
    },
    { id: "picker", label: "Or pick one", type: "color", default: "#4cc93f", wide: true },
  ],
  generate: (values) => {
    // The picker wins when it has been moved away from the typed value.
    const typed = String(values.value || "").trim();
    const picked = String(values.picker || "");
    const parsedTyped = parseColor(typed);
    const rgb = parsedTyped ?? parseColor(picked);

    if (!rgb) {
      return {
        output: "",
        error: `"${typed}" is not a colour DO101 recognises. Try a hex code, rgb(), hsl() or a CSS colour name.`,
      };
    }

    const hex = rgbToHex(rgb);
    const hsl = rgbToHsl(rgb);
    const cmyk = rgbToCmyk(rgb);
    const white = { r: 255, g: 255, b: 255, a: 1 };
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const onWhite = contrastRatio(rgb, white);
    const onBlack = contrastRatio(rgb, black);

    const output = [
      `HEX      ${hex}`,
      `HEX+A    ${rgbToHex(rgb, true)}`,
      `RGB      rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      `RGBA     rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Number(rgb.a.toFixed(2))})`,
      `HSL      hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
      `HSLA     hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${Number(rgb.a.toFixed(2))})`,
      `CMYK     cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`,
      `CSS var  --brand: ${hex};`,
    ].join("\n");

    return {
      output,
      extension: "txt",
      preview: (
        <div className="do-card overflow-hidden">
          <div className="h-28 w-full" style={{ background: hex }} />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <div
              className="rounded-xl px-4 py-3 text-center text-sm font-extrabold"
              style={{ background: "#ffffff", color: hex }}
            >
              On white — {onWhite.toFixed(2)}:1{" "}
              {onWhite >= 4.5 ? "✅ AA" : onWhite >= 3 ? "⚠️ large text only" : "❌ fails AA"}
            </div>
            <div
              className="rounded-xl px-4 py-3 text-center text-sm font-extrabold"
              style={{ background: "#000000", color: hex }}
            >
              On black — {onBlack.toFixed(2)}:1{" "}
              {onBlack >= 4.5 ? "✅ AA" : onBlack >= 3 ? "⚠️ large text only" : "❌ fails AA"}
            </div>
          </div>
        </div>
      ),
      facts: [
        { label: "Hex", value: hex },
        { label: "RGB", value: `${rgb.r}, ${rgb.g}, ${rgb.b}` },
        { label: "HSL", value: `${hsl.h}°, ${hsl.s}%, ${hsl.l}%` },
        { label: "Contrast on white", value: `${onWhite.toFixed(2)}:1` },
      ],
    };
  },
};
