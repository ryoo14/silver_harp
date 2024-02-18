import { shouldSkipUrl } from "./utils.ts"
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

// Fetch and update RSS Feed

// Merge audio

// Generate MP3 file
for (const e of entriesExcludeNullAudio) {
  if (e.audio == null) {
    continue
  }
  Deno.writeFileSync(`${Deno.cwd()}/mp3/${e.title.replace(/\//g, "-")}.mp3`, e.audio)
}

// Debug
// deno-lint-ignore no-unused-vars
function debug(entries: Entry[]) {
  const minLength = entries.sort((a, b) => a.text.length - b.text.length)[0].title.length
  for (const e of entries) {
    console.log(`${e.title.slice(0, minLength)}: ${e.text.length}`)
  }
  console.log(entries.reduce((s, e) => s + e.text.length, 0))
}

//debug(entries)
