import { TextToSpeechClient } from "tts"
import { Entry } from "./types.ts"
import { combineAudio, separateSentenceWithPeriods } from "./utils.ts"

export async function textToSpeech(entry: Entry): Promise<Entry> {
  try {
    const audioArray = await generateAudio(entry.text)
    entry.audio = combineAudio(audioArray)

    return entry
  } catch (e) {
    if (e instanceof Error) console.error(e.message)
    entry.audio = null
    return entry
  }
}

async function generateAudio(text: string) {
  const textArray = separateSentenceWithPeriods(text)
  let credentialJson
  try {
    credentialJson = JSON.parse(Deno.readTextFileSync("silverharp.json"))
  } catch {
    throw new Error("Failed to load credential file: silverharp.json")
  }
  const client = new TextToSpeechClient({
    credentials: credentialJson,
  })
  const audioArray: Uint8Array[] = []
  for (const t of textArray) {
    const request = {
      input: { text: t },
      voice: {
        languageCode: "ja-JP",
        ssmlGender: "FEMALE" as const,
        name: "ja-JP-Neural2-B", // "ja-JP-Wavenet-A", "ja-JP-Standard-A", "ja-JP-Neural2-B"
      },
      audioConfig: {
        audioEncoding: "MP3" as const,
        speakingRate: 1.3,
      },
    }
    // deno-lint-ignore no-explicit-any
    const [response] = await (client.synthesizeSpeech(request) as unknown as Promise<any[]>)
    audioArray.push(response.audioContent)
  }
  return audioArray
}
