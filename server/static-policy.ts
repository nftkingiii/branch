import { extname } from "node:path";

export function shouldUseSpaFallback(pathname: string): boolean {
  return !pathname.startsWith("/assets/") && extname(pathname) === "";
}

export function staticCacheControl(pathname: string): string {
  if (pathname === "/" || pathname.endsWith("/index.html")) return "no-store";
  if (pathname.startsWith("/assets/")) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
}
