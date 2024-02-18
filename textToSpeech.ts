import { TextToSpeechClient } from "tts"
import { Entry } from "./types.ts"
import { removeHTMLTags } from "./utils.ts"

export async function silverHarp(entry: Entry): Promise<Entry> {
  const entryWithAudio = await textToSpeech(entry)
  return entryWithAudio
}

async function textToSpeech(entry: Entry): Promise<Entry> {
  try {
    entry.text = removeHTMLTags(entry.text)

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
