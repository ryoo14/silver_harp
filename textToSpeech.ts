import { TextToSpeechClient } from "tts"
import { Entry } from "./types.ts"
import { removeHTMLTags } from "./utils.ts"

export async function silverHarp(title: string, url: string): Promise<Entry> {
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

async function textToSpeech(entry: Entry): Promise<Entry> {
  try {
    if (entry.text.length === 0 || entry.text.length > 5000) {
      throw new Error(`${entry.title} has 0 or larger than 5000 text.`)
    }

    const audioArray = await generateAudio(entry.text)
    entry.audio = combineAudio(audioArray)

    return entry
  } catch (e) {
    console.error(e.message)
    entry.audio = null
    return entry
  }
}

async function generateAudio(text: string) {
  const client = new TextToSpeechClient()
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
        speakingRate: 1.3,
      },
    }
    const [response] = await client.synthesizeSpeech(request)
    audioArray.push(response.audioContent)
  }
  return audioArray
}

function combineAudio(audioArray) {
  const combinedLength = audioArray.reduce((p, c) => p + c.length, 0)
  const combined = new Uint8Array(combinedLength)
  let position = 0
  for (const a of audioArray) {
    combined.set(a, position)
    position += a.length
  }
  return combined
}
