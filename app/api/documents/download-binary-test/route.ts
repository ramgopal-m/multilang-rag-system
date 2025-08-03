import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  console.log("🔍 Test binary download route called!");
  return NextResponse.json({ message: "Test route working" }, { status: 200 });
}
