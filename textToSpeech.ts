import { TextToSpeechClient } from "tts"
import { Entry } from "./types.ts"
import { combineAudio, separateSentenceWithPeriods } from "./utils.ts"

export async function textToSpeech(entry: Entry): Promise<Entry> {
  try {
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
  const textArray = separateSentenceWithPeriods(text)
  const json = JSON.parse(Deno.readTextFileSync("silverharp.json"))
  const client = new TextToSpeechClient({
    credentials: json,
  })
  const audioArray = []
  for (const t of textArray) {
  //for (let i = 0; i < text.length; i += 1500) {
    const request = {
  //    input: { text: text.slice(i, i + 1500) },
      input: { text: t },
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
