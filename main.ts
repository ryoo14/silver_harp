import { parseFeed } from "rss"
import { TextToSpeechClient } from "tts"

function debug(entries: Entry[]) {
  const minLength = entries.sort((a, b) => a.text.length - b.text.length)[0].title.length
  for (const e of entries) {
    console.log(`${e.title.slice(0, minLength)}: ${e.text.length}`)
  }
  console.log(entries.reduce((s, e) => s + e.text.length, 0))
}

async function fetchEntryData(title: string, url: string): Promise<Entry> {
  try {
    const res = await fetch(url)
    const text = await res.text()
    return {
      title: title,
      url: url,
      text: removeHTMLTags(text),
    }
  } catch {
    console.log(url)
    return {
      title: title,
      url: url,
      text: "",
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

async function textToSpeech(client: TextToSpeechClient, text: string) {
  try {
    const audioArray = []
    for (let i = 0; i < text.length; i += 1500) {
      const request = {
        input: { text: text.slice(i, i + 1500) },
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
    return combined
  } catch (e) {
    console.log(e.message)
    return null
  }
}

type Entry = {
  title: string
  url: string
  text: string
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
  promiseEntries.push(fetchEntryData(f.title.value, f.id))
}

const entries: Entry[] = await Promise.all(promiseEntries)
const es = entries.sort((a, b) => a.text.length - b.text.length)

//debug(entries)

const client = new TextToSpeechClient()
for (const [i, e] of es.entries()) {
  if (i === 9) {
    break
  }
  console.log(`${e.title}: ${e.text.length}`)
  const audio = await textToSpeech(client, e.text)
  Deno.writeTextFileSync(`${i}.txt`, e.text)
  if (audio != null) {
    Deno.writeFileSync(`${i}.mp3`, audio)
  }
}
