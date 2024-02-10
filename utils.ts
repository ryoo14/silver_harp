export function removeHTMLTags(text: string): string {
  return text.replace(/(<(head|script|style|header|footer|nav|iframe|aside)[^>]*>([\s\S]*?)<\/(head|script|style|header|footer|nav|iframe|aside)>)/g, "")
    .replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/anond:[0-9]{14}/g, "。") // hatena masuda
    .replace(/≪前の記事[\s\S]*/, "").replace(/≫次の記事[\s\S]*/, "") // publickey
}

export function shouldSkipUrl(url: string): boolean {
  const skipPatterns = [
    'www\.itmedia\.co\.jp',
    'togetter\.com',
  ];
  return skipPatterns.some(pattern => url.match(new RegExp(pattern)));
}
