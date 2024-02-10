import { parseFeed } from "rss"
import { TextToSpeechClient } from "tts"

function debug(entries: Entry[]) {
  const minLength = entries.sort((a, b) => a.text.length - b.text.length)[0].title.length
  for (const e of entries) {
    console.log(`${e.title.slice(0, minLength)}: ${e.text.length}`)
  }
  console.log(entries.reduce((s, e) => s + e.text.length, 0))
}

async function silverHarp(title: string, url: string): Promise<Entry> {
  const entry = await fetchEntry(title, url)
  const entryWithAudio = await textToSpeech(entry)
  return entryWithAudio
}

async function fetchEntry(title: string, url: string): Promise<Entry> {
  try {
    const res = await fetch(url)
    const text = await res.text()
    return {
      title: title,
      url: url,
      text: removeHTMLTags(text),
      audio: null,
    }
  } catch {
    console.error(`Faied to fetch data from ${title}.`)
    return {
      title: title,
      url: url,
      text: "",
      audio: null,
    }
  }
}

function removeHTMLTags(text: string): string {
  return text.replace(/(<(head|script|style|header|footer|nav|iframe|aside)[^>]*>([\s\S]*?)<\/(head|script|style|header|footer|nav|iframe|aside)>)/g, "")
    .replace(/<("[^"]*"|'[^']*'|[^'">])*>/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/anond:[0-9]{14}/g, "。") // hatena masuda
    .replace(/≪前の記事[\s\S]*/, "").replace(/≫次の記事[\s\S]*/, "") // publickey
}

async function textToSpeech(entry: Entry): Promise<Entry> {
  try {
    if (entry.text.length === 0 || entry.text.length > 5000) {
      throw new Error(`${entry.title} has 0 or larger than 5000 text.`)
    }
    const client = new TextToSpeechClient()
    const audioArray = []
    for (let i = 0; i < entry.text.length; i += 1500) {
      const request = {
        input: { text: entry.text.slice(i, i + 1500) },
        voice: {
          languageCode: "ja-JP",
          ssmlGender: "FEMALE",
          name: "ja-JP-Wavenet-A", // "ja-JP-Wavenet-A", "ja-JP-Standard-A", "ja-JP-Neural2-B"
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 1.5,
        },
      }
      const [response] = await client.synthesizeSpeech(request)
      audioArray.push(response.audioContent)
    }
    const combinedLength = audioArray.reduce((p, c) => p + c.length, 0)
    const combined = new Uint8Array(combinedLength)
    let position = 0
    for (const a of audioArray) {
      combined.set(a, position)
      position += a.length
    }
    entry.audio = combined
    return entry
  } catch (e) {
    console.error(e.message)
    entry.audio = null
    return entry
  }
}

type Entry = {
  title: string
  url: string
  text: string
  audio: Uint8Array | null
}

// Fetch RSS Feed and parse
const res = await fetch("https://b.hatena.ne.jp/hotentry/it.rss")
const xml = await res.text()
const feeds = await parseFeed(xml)

// Fetch contents per entry
const promiseEntries: Promise<Entry>[] = []
for (const f of feeds.entries) {
  if (f.id.match(/www\.itmedia\.co\.jp/)) {
    continue
  }
  promiseEntries.push(silverHarp(f.title.value, f.id))
}

const entries: Entry[] = await Promise.all(promiseEntries)
const es = entries.sort((a, b) => a.text.length - b.text.length)

for (const e of es) {
  if (e.audio == null) {
    continue
  }
  Deno.writeFileSync(`${Deno.cwd()}/mp3/${e.title.replace(/\//g, "-")}.mp3`, e.audio)
}

//debug(entries)
