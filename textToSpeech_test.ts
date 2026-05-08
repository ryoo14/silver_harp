import { assertEquals } from "jsr:@std/assert"
import { stub } from "jsr:@std/testing/mock"
import { TextToSpeechClient } from "tts"
import { textToSpeech } from "./textToSpeech.ts"
import type { Entry } from "./types.ts"

const FAKE_CREDENTIAL_JSON = '{"type":"service_account","project_id":"test-project"}'
const FAKE_AUDIO_CHUNK = new Uint8Array([1, 2, 3])

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "1",
    title: "Test",
    url: "https://example.com",
    text: "テスト文章。",
    audio: null,
    ...overrides,
  }
}

Deno.test("textToSpeech: returns entry with audio as Uint8Array on success", async () => {
  const readStub = stub(Deno, "readTextFileSync", () => FAKE_CREDENTIAL_JSON)
  const synthStub = stub(
    TextToSpeechClient.prototype,
    "synthesizeSpeech",
    async () => [{ audioContent: FAKE_AUDIO_CHUNK }],
  )
  try {
    const entry = makeEntry()
    const result = await textToSpeech(entry)
    assertEquals(result.audio instanceof Uint8Array, true)
  } finally {
    readStub.restore()
    synthStub.restore()
  }
})

Deno.test("textToSpeech: audio from multiple chunks is combined correctly", async () => {
  const readStub = stub(Deno, "readTextFileSync", () => FAKE_CREDENTIAL_JSON)
  // 600文字の文×6 → separateSentenceWithPeriods が3チャンクに分割する
  // (s1+s2=1200, s3+s4=1200 が2回フラッシュ → s5+s6+"。"=1201 で3チャンク目)
  const sentence = "あ".repeat(599) + "。"
  const longText = sentence.repeat(6)

  const synthStub = stub(
    TextToSpeechClient.prototype,
    "synthesizeSpeech",
    async () => [{ audioContent: new Uint8Array([1, 2, 3]) }],
  )
  try {
    const entry = makeEntry({ text: longText })
    const result = await textToSpeech(entry)
    // 3チャンク × 3バイト = 9バイト
    assertEquals((result.audio as Uint8Array).length, 9)
  } finally {
    readStub.restore()
    synthStub.restore()
  }
})

Deno.test("textToSpeech: sets audio to null when synthesizeSpeech throws", async () => {
  const readStub = stub(Deno, "readTextFileSync", () => FAKE_CREDENTIAL_JSON)
  const synthStub = stub(
    TextToSpeechClient.prototype,
    "synthesizeSpeech",
    async () => {
      throw new Error("TTS API error")
    },
  )
  try {
    const entry = makeEntry()
    const result = await textToSpeech(entry)
    assertEquals(result.audio, null)
  } finally {
    readStub.restore()
    synthStub.restore()
  }
})

Deno.test("textToSpeech: returned entry preserves id, title, url, text", async () => {
  const readStub = stub(Deno, "readTextFileSync", () => FAKE_CREDENTIAL_JSON)
  const synthStub = stub(
    TextToSpeechClient.prototype,
    "synthesizeSpeech",
    async () => [{ audioContent: FAKE_AUDIO_CHUNK }],
  )
  try {
    const entry = makeEntry({ id: "42", title: "My Title", url: "https://foo.com", text: "本文。" })
    const result = await textToSpeech(entry)
    assertEquals(result.id, "42")
    assertEquals(result.title, "My Title")
    assertEquals(result.url, "https://foo.com")
    assertEquals(result.text, "本文。")
  } finally {
    readStub.restore()
    synthStub.restore()
  }
})

Deno.test("textToSpeech: reads silverharp.json for credentials", async () => {
  let readPath: string | URL = ""
  const readStub = stub(Deno, "readTextFileSync", (path: string | URL) => {
    readPath = path
    return FAKE_CREDENTIAL_JSON
  })
  const synthStub = stub(
    TextToSpeechClient.prototype,
    "synthesizeSpeech",
    async () => [{ audioContent: FAKE_AUDIO_CHUNK }],
  )
  try {
    await textToSpeech(makeEntry())
    assertEquals(readPath, "silverharp.json")
  } finally {
    readStub.restore()
    synthStub.restore()
  }
})
