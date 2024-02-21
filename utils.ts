import { Entry } from "./types.ts"

export function removeHTMLTags(text: string): string {
  return text.replace(/(<(head|script|style|header|footer|nav|iframe|aside)[^>]*>([\s\S]*?)<\/(head|script|style|header|footer|nav|iframe|aside)>)/g, "")
    .replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/anond:[0-9]{14}/g, "。") // hatena masuda
    .replace(/≪前の記事[\s\S]*/, "").replace(/≫次の記事[\s\S]*/, "") // publickey
}

export function shouldSkipUrl(url: string): boolean {
  const skipPatterns = [
    "www\.itmedia\.co\.jp",
    "togetter\.com",
    "speakerdeck\.com",
  ]
  return skipPatterns.some((pattern) => url.match(new RegExp(pattern)))
}

export function checkResponseCode(response: Response): boolean {
  let flag
  if (response.status === 200) {
    flag = true
  } else {
    flag = false
  }

  return flag
}

export function combineAudio(audioArray: Uint8Array[]): Uint8Array {
  const combinedLength = audioArray.reduce((p, c) => p + c.length, 0)
  const combined = new Uint8Array(combinedLength)
  let position = 0
  for (const a of audioArray) {
    combined.set(a, position)
    position += a.length
  }
  return combined
}

export function generateItemForRSS(entries: Entry[]): string {
  const itemHeader = `    <item>
      <title>_TITLE</title>
      <description><![CDATA[ 
      <ul>
  `

  let itemBase = ""
  for (const e of entries) {
    const title = e.title
    const url = e.url

    itemBase += `      <li><a href="${url}">${title}</a></li>
    `
  }

  const itemFooter = `    </ul>
      ]]></description>
      <pubDate>_DATE</pubDate>
      <link>https://sh.ryoo.cc/_AUDIOFILENAME</link>
        <guid isPermaLink="true">https://sh.ryoo.cc/_AUDIOFILENAME</guid>
        <itunes:author>ryoo14</itunes:author>
      <dc:creator>ryoo14</dc:creator>
      
      <itunes:explicit>no</itunes:explicit>
      <itunes:subtitle>_TITLE</itunes:subtitle>
      <itunes:duration>_DURATION</itunes:duration>
      <enclosure url="https://sh.ryoo.cc/_AUDIOFILENAME" type="audio/mpeg" length="_AUDIOFILELENGTH" />
    </item>
  `

  return itemHeader + itemBase + itemFooter
}
