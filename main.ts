import { checkEnvironmentVariables, generateItemForRSS } from "./utils.ts"
import { textToSpeech } from "./textToSpeech.ts"
import { Entry } from "./types.ts"
import { getTextAndDeleteBookmarks } from "./instapaper.ts"

try {
  // Check environment variable
  const environmentVarialbes = [
    "INSTAPAPER_USER_NAME",
    "INSTAPAPER_USER_PASSWORD",
    "INSTAPAPER_CONSUMER_KEY",
    "INSTAPAPER_CONSUMER_SECRET",
    "SILVERHARP_SERVER",
    "SILVERHARP_USER",
  ]

  const undefinedEnvironmentVariables = checkEnvironmentVariables(environmentVarialbes)

  if (undefinedEnvironmentVariables.length !== 0) {
    throw new Error(`Error: Required to define the environment variable(${undefinedEnvironmentVariables}).`)
  }

  // Get articles and their texts from Instapaper bookmarks, then delete the bookmarks
  const entriesWithNullAudio: Entry[] = await getTextAndDeleteBookmarks()

  // Text to speech
  const promiseEntries: Promise<Entry>[] = []
  for (const e of entriesWithNullAudio) {
    promiseEntries.push(textToSpeech(e))
  }

  const entries: Entry[] = await Promise.all(promiseEntries)
  const entriesExcludeNullAudio: Entry[] = entries.filter((e) => e.audio != null)

  // Output the article's title and its length, and then save the audio file
  for (const e of entriesExcludeNullAudio) {
    const length = e.text.length
    const title = e.title
    console.log(`${title}: ${length}`)
    Deno.writeFileSync(`${Deno.cwd()}/mp3/${e.title.replace(/[\|\/]/g, "-")}.mp3`, e.audio as Uint8Array)
  }

  // Generate item for rss
  const itemRSS = generateItemForRSS(entriesExcludeNullAudio)
  Deno.writeTextFileSync(`${Deno.cwd()}/mp3/tmp.rss`, itemRSS)
} catch (e) {
  console.log(e.message)
  Deno.exit(1)
}
