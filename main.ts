import { parseFeed } from "rss"
import { shouldSkipUrl } from "./utils.ts"
import { silverHarp } from "./textToSpeech.ts"
import { Entry } from "./types.ts"

// Fetch RSS Feed and parse
const res = await fetch("https://b.hatena.ne.jp/hotentry/it.rss")
const xml = await res.text()
const feeds = await parseFeed(xml)

// Fetch and Audionaize contents per feeds
const promiseEntries: Promise<Entry>[] = []
for (const f of feeds.entries) {
  if (shouldSkipUrl(f.id)) {
    continue
  }
  promiseEntries.push(silverHarp(f.title.value, f.id))
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
function debug(entries: Entry[]) {
  const minLength = entries.sort((a, b) => a.text.length - b.text.length)[0].title.length
  for (const e of entries) {
    console.log(`${e.title.slice(0, minLength)}: ${e.text.length}`)
  }
  console.log(entries.reduce((s, e) => s + e.text.length, 0))
}

//debug(entries)
