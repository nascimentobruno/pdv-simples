import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/login", url.origin));
}
