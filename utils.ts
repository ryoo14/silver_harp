import { Entry } from "./types.ts"

export function removeHTMLTags(text: string): string {
  return text.replace(/(<(head|script|style|header|footer|nav|iframe|aside)[^>]*>([\s\S]*?)<\/(head|script|style|header|footer|nav|iframe|aside)>)/g, "")
    .replace("</li>", "。")
    .replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/anond:[0-9]{14}/g, "。") // hatena masuda
    .replace(/≪前の記事[\s\S]*/, "").replace(/≫次の記事[\s\S]*/, "") // publickey
}

export function checkResponseCode(response: Response): boolean {
  return response.status === 200
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
  const serverName = Deno.env.get("SILVERHARP_SERVER") as string
  const userName = Deno.env.get("SILVERHARP_USER") as string

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
      <link>https://${serverName}/_AUDIOFILENAME</link>
        <guid isPermaLink="true">https://${serverName}/_AUDIOFILENAME</guid>
        <itunes:author>${userName}</itunes:author>
      <dc:creator>${userName}</dc:creator>
      
      <itunes:explicit>no</itunes:explicit>
      <itunes:subtitle>_TITLE</itunes:subtitle>
      <itunes:duration>_DURATION</itunes:duration>
      <enclosure url="https://${serverName}/_AUDIOFILENAME" type="audio/mpeg" length="_AUDIOFILELENGTH" />
    </item>
  `

  return itemHeader + itemBase + itemFooter
}

export function separateSentenceWithPeriods(text: string): string[] {
  const delimiter = text.includes("。") ? "。" : "."
  const sentenceList = text.split(delimiter).map((t) => t += delimiter)

  const textArray = []
  let currentText = ""

  sentenceList.forEach((sentence) => {
    if (currentText.length + sentence.length < 1500) {
      currentText += sentence
    } else {
      textArray.push(currentText)
      currentText = sentence
    }
  })

  if (currentText) {
    textArray.push(currentText)
  }

  return textArray
}

export function checkEnvironmentVariables(varsArray: string[]): string[] {
  const undefinedEnvironmentVariables: string[] = []
  varsArray.forEach((varString) => {
    if (!Deno.env.get(varString)) {
      undefinedEnvironmentVariables.push(varString)
    }
  })

  return undefinedEnvironmentVariables
}
