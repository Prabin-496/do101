import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "image",
  path: "/tools/image",
  title: "Free Image Tools — Compress, Resize, Convert & OCR | DO101",
  description: "12 free image tools that run in your browser: compress, resize, convert JPG, PNG, WebP and HEIC, and pull text out of pictures. Nothing is uploaded.",
  heading: "Image tools",
  lead: "Compress, resize, convert and read text from pictures — every one of them processed on your own device, so your camera roll never touches a server.",
  body: [
    {
      heading: "Why your photos should never be uploaded",
      text: (
        <>
          <p>Photos are personal in a way most files are not. A camera roll holds faces, homes, documents and locations, and every image carries EXIF metadata that can include the exact GPS coordinates where it was taken.</p>
          <p>That is why every tool on this page uses the canvas encoder built into your browser rather than a server. There is no upload endpoint behind any of them: your photo is decoded, processed and re-encoded on your device, and the result is handed straight back to you.</p>
          <p>HEIC is the one case worth naming. No browser decodes Apple&rsquo;s format natively, so DO101 loads a WebAssembly build of libheif — but even then the decoding runs locally. Only the decoder is downloaded, never your photo.</p>
        </>
      ),
    },
    {
      heading: "Choosing the right format",
      text: (
        <>
          <p><strong>JPG</strong> is the safe default for photographs: universally supported and small. It is lossy and has no transparency.</p>
          <p><strong>PNG</strong> is lossless and supports transparency, which makes it right for screenshots, logos and diagrams — and wrong for photographs, where it produces enormous files.</p>
          <p><strong>WebP</strong> beats both on size, typically 25–35% smaller than JPG at matched quality, with transparency support. Every current browser handles it; some desktop software still does not.</p>
          <p><strong>HEIC</strong> is what iPhones shoot by default. Efficient, but poorly supported outside Apple&rsquo;s ecosystem — which is why converting it is the most common job people bring here.</p>
        </>
      ),
    },
    {
      heading: "The jobs people actually arrive with",
      text: (
        <>
          <p><strong>&ldquo;Compress this under 200 KB&rdquo;</strong> — the <Link href="/tools/image-compressor">Image Compressor</Link> has a target-size mode that searches for the best quality still fitting your limit.</p>
          <p><strong>&ldquo;My iPhone photo will not open&rdquo;</strong> — <Link href="/tools/heic-to-jpg">HEIC to JPG</Link> fixes that in one step.</p>
          <p><strong>&ldquo;Make my site faster&rdquo;</strong> — <Link href="/tools/jpg-to-webp">JPG to WebP</Link> and <Link href="/tools/png-to-webp">PNG to WebP</Link> are usually the cheapest performance win available.</p>
          <p><strong>&ldquo;Copy the text out of this screenshot&rdquo;</strong> — <Link href="/tools/image-to-text">Image to Text</Link> runs OCR in seventeen languages, on your device.</p>
        </>
      ),
    },
  ],
  faqs: [
    {
      q: "Are my images uploaded to a server?",
      a: "No. Every image tool here uses your browser's own canvas encoder. DO101 runs no upload endpoint for images, so the file cannot leave your device even by accident.",
    },
    {
      q: "Is there a file size limit?",
      a: "25 MB per image, with a warning above 8 MB because very large files are slow on older phones. The real limit is your device's available memory.",
    },
    {
      q: "Do you remove EXIF metadata?",
      a: "Yes, as a side effect: re-encoding through a canvas drops EXIF, including GPS coordinates. That is usually welcome, but camera settings and orientation data go with it, so keep your original.",
    },
    {
      q: "Will compressing an image twice make it worse?",
      a: "Yes. Every lossy re-encode discards a little more detail. Always compress from the original rather than from an already-compressed copy.",
    },
    {
      q: "Can I process several images at once?",
      a: "Yes. Every image tool accepts a batch and applies the same settings to all of them.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
