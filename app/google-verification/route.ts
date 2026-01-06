import { NextResponse } from "next/server";

/**
 * Google Domain Verification Route
 * 
 * When Google asks you to verify domain ownership, they'll provide:
 * 1. A filename like "google1234567890.html"
 * 2. HTML content to put in that file
 * 
 * To use this route:
 * 1. Get the verification code from Google Cloud Console (e.g., "1234567890")
 * 2. Set the GOOGLE_VERIFICATION_CODE environment variable to that code
 * 3. Set the GOOGLE_VERIFICATION_HTML environment variable to the exact HTML content Google provides
 * 4. Configure Next.js rewrite in next.config.mjs to map /google[code].html to this route
 * 
 * Alternatively, you can create a specific route file for your verification code:
 * - Create: app/google[your-code]/route.ts
 * - Copy this file's content and update it with your specific code
 */
export async function GET() {
  const verificationCode = process.env.GOOGLE_VERIFICATION_CODE;
  const htmlContent = process.env.GOOGLE_VERIFICATION_HTML;
  
  if (!verificationCode || !htmlContent) {
    return new NextResponse(
      "Google verification not configured. Set GOOGLE_VERIFICATION_CODE and GOOGLE_VERIFICATION_HTML environment variables.",
      { status: 404 }
    );
  }

  return new NextResponse(htmlContent, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}

