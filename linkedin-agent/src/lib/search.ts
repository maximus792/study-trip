import { tavily } from "@tavily/core";

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface SearchOptions {
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
}

let _client: ReturnType<typeof tavily> | null = null;

function getClient() {
  if (!_client) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("TAVILY_API_KEY environment variable is not set");
    _client = tavily({ apiKey });
  }
  return _client;
}

export async function searchWeb(
  query: string,
  opts: SearchOptions = {}
): Promise<SearchResult[]> {
  const response = await getClient().search(query, {
    maxResults: opts.maxResults ?? 5,
    searchDepth: opts.searchDepth ?? "basic",
  });
  return response.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
  }));
}

export async function searchLinkedIn(
  query: string,
  opts: SearchOptions = {}
): Promise<SearchResult[]> {
  const response = await getClient().search(query, {
    maxResults: opts.maxResults ?? 10,
    searchDepth: opts.searchDepth ?? "advanced",
    includeDomains: ["linkedin.com"],
  });
  return response.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
  }));
}

type Platform = "linkedin" | "twitter" | "reddit";

const DOMAIN_MAP: Record<Platform, string[]> = {
  linkedin: ["linkedin.com"],
  twitter: ["twitter.com", "x.com"],
  reddit: ["reddit.com"],
};

export async function searchSocial(
  query: string,
  platforms: Platform[] = ["linkedin", "twitter"],
  opts: SearchOptions = {}
): Promise<SearchResult[]> {
  const domains = platforms.flatMap((p) => DOMAIN_MAP[p] ?? []);
  const response = await getClient().search(query, {
    maxResults: opts.maxResults ?? 10,
    searchDepth: opts.searchDepth ?? "advanced",
    includeDomains: domains,
  });
  return response.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
  }));
}
