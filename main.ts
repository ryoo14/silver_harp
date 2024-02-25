import { generateItemForRSS, shouldSkipUrl } from "./utils.ts"
import { silverHarp } from "./textToSpeech.ts"
import { Entry } from "./types.ts"
import { getTextAndDeleteBookmarks } from "./instapaper.ts"

const entriesWithNullAudio: Entry[] = await getTextAndDeleteBookmarks()

// Fetch and Audionaize contents per feeds
const promiseEntries: Promise<Entry>[] = []
for (const e of entriesWithNullAudio) {
  if (shouldSkipUrl(e.url)) {
    continue
  }
  promiseEntries.push(silverHarp(e))
}

const entries: Entry[] = await Promise.all(promiseEntries)
const entriesExcludeNullAudio: Entry[] = entries.filter((e) => e.audio != null)

// Merge audio
//const audioArray: Uint8Array[] = entriesExcludeNullAudio.map((e) => e.audio as Uint8Array)
//const audio: Uint8Array = combineAudio(audioArray)
//const yyyymmddhh: string = getCurrentTimestamp()
//Deno.writeFileSync(`${Deno.cwd()}/mp3/${yyyymmddhh}.mp3`, audio as Uint8Array)

for (const e of entriesExcludeNullAudio) {
  // Create MP3
  const length = e.text.length
  const title = e.title
  let count = 0
  for (let i = 0; i < e.text.length; i++) {
    if (e.text[i] === "。") {
      count++
    }
  }
  console.log(`${title}: ${length}(${count})`)
  Deno.writeFileSync(`${Deno.cwd()}/mp3/${e.title.replace("/", "-")}.mp3`, e.audio as Uint8Array)
}

// Generate item for rss
const itemRSS = generateItemForRSS(entriesExcludeNullAudio)
Deno.writeTextFileSync(`${Deno.cwd()}/mp3/tmp.rss`, itemRSS)
