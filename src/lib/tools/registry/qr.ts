import type { Tool } from "../types";

/**
 * QR code tools.
 */
export const QR_TOOLS: Tool[] = [
  {
    id: "qr-generator",
    name: "QR Code Generator",
    short: "Make a QR code for a link, text, email, phone or Wi-Fi.",
    long:
      "Generate a crisp QR code and download it as a PNG or SVG. Choose the size and the error-correction level, and switch between link, plain text, email, phone and Wi-Fi payloads. The code is rendered locally in your browser.",
    category: "qr",
    route: "/tools/qr-generator",
    keywords: ["qr code generator", "generate qr code", "make qr code", "wifi qr code", "free qr code", "qr png"],
    aliases: ["make qr", "create qr code", "qr maker"],
    icon: "📱",
    accent: "sun",
    browserOnly: true,
    aiInvocable: true,
    input: "text",
    output: "file",
    related: ["url-encoder", "image-compressor", "base64", "text-cleaner"],
    seoTitle: "Free QR Code Generator — URL, Wi-Fi & Text QR | DO101",
    seoDescription:
      "Create free QR codes for links, text, email, phone numbers and Wi-Fi. Adjustable size and error correction, PNG or SVG download, no sign-up.",
    steps: [
      "Pick what the code should contain: link, text, email, phone or Wi-Fi.",
      "Fill in the fields and adjust size or error correction if you need to.",
      "Download the PNG or SVG and test it with your phone camera.",
    ],
    features: [
      "Link, text, email, phone and Wi-Fi payloads",
      "Adjustable size and error-correction level",
      "PNG and SVG download",
      "No tracking redirect — the code points straight at your data",
      "Never expires, because there is no server involved",
    ],
    faqs: [
      { q: "Do these QR codes expire?", a: "No. The code encodes your data directly, so there is no DO101 redirect that could ever be switched off." },
      { q: "What error-correction level should I pick?", a: "Medium is a good default. Use High (H) if the code will be printed small, placed on a curved surface, or covered by a logo." },
      { q: "Is a Wi-Fi QR code safe to print?", a: "It contains your network password in plain text, so anyone who scans the printed code can join. Only display it where you are happy for guests to connect." },
    ],
    featured: true,
  },
];
