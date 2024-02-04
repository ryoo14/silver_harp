import { parseFeed } from "rss"
import { TextToSpeechClient } from "https://esm.sh/@google-cloud/text-to-speech"

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
}

async function textToSpeech(client: TextToSpeechClient, text: string) {
  const request = {
    input: { text: text },
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
  return response.audioContent
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
  promiseEntries.push(fetchEntryData(f.title.value, f.id))
}

const entries: Entry[] = await Promise.all(promiseEntries)
//console.log(entries.reduce((s, e) => s + e.text.length, 0))

const text = entries[2].text
const client = new TextToSpeechClient()
const audio = await textToSpeech(client, text)

Deno.writeFileSync("output.mp3", audio)
console.log("Audio content written to file: output.mp3")
