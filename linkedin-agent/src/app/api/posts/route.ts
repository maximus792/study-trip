import { NextRequest, NextResponse } from "next/server";
import { writePost, rewritePost } from "@/agents";
import type { PostDraft, PostProposal } from "@/types";

const posts: Map<string, PostDraft> = new Map();

export async function GET() {
  const allPosts = Array.from(posts.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return NextResponse.json(allPosts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  try {
    switch (action) {
      case "create": {
        const { proposal } = body as { proposal: PostProposal; action: string };
        const result = await writePost(proposal);
        posts.set(result.data.id, result.data);
        return NextResponse.json(result.data);
      }

      case "rewrite": {
        const { postId, feedback } = body;
        const existing = posts.get(postId);
        if (!existing) {
          return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }
        const result = await rewritePost(existing, feedback);
        posts.set(result.data.id, result.data);
        return NextResponse.json(result.data);
      }

      case "update-status": {
        const { postId, status } = body;
        const existing = posts.get(postId);
        if (!existing) {
          return NextResponse.json({ error: "Post not found" }, { status: 404 });
        }
        existing.status = status;
        existing.updatedAt = new Date().toISOString();
        posts.set(postId, existing);
        return NextResponse.json(existing);
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("Posts error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
