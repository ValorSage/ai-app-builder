import { NextRequest, NextResponse } from "next/server";
// import { headers } from "next/headers";
// import { auth } from "@/lib/auth";
 
export async function middleware(_request: NextRequest) {
  // Temporarily disable auth enforcement to allow full app access without login
  return NextResponse.next();
}
 
export const config = {
  runtime: "nodejs",
  matcher: ["/dashboard"], // Keep matcher for later re-enable
};