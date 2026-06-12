import { NextResponse } from "next/server";
import { loadGraphData } from "@/lib/knowledge-graph";

export async function GET() {
  const data = loadGraphData();
  return NextResponse.json(data);
}
