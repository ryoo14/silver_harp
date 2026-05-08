import { assertEquals, assertRejects } from "@std/assert"
import { stub } from "@std/testing/mock"
import { getTextAndDeleteBookmarks } from "./instapaper.ts"
import type { Bookmark } from "./types.ts"

const INSTAPAPER_ENV: Record<string, string> = {
  INSTAPAPER_CONSUMER_KEY: "testkey",
  INSTAPAPER_CONSUMER_SECRET: "testsecret",
  INSTAPAPER_USER_NAME: "testuser",
  INSTAPAPER_USER_PASSWORD: "testpass",
}

const MOCK_BOOKMARKS: Bookmark[] = [
  {
    hash: "abc",
    description: "",
    bookmark_id: 111,
    private_source: "",
    title: "Test Article",
    url: "https://example.com/article",
    progress_timestamp: 0,
    time: 0,
    progress: 0,
    starred: "0",
    type: "bookmark",
  },
]

function makeTokenResponse() {
  return new Response("oauth_token=testtoken&oauth_token_secret=testsecret", { status: 200 })
}

function makeBookmarkListResponse(bookmarks: Bookmark[]) {
  return new Response(JSON.stringify({ bookmarks }), { status: 200 })
}

function makeFetch(overrides: Partial<Record<string, () => Response>> = {}) {
  return async (input: Request | URL | string): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input)
    if (url.includes("access_token")) return overrides["access_token"]?.() ?? makeTokenResponse()
    if (url.includes("bookmarks/list")) return overrides["bookmarks/list"]?.() ?? makeBookmarkListResponse(MOCK_BOOKMARKS)
    if (url.includes("get_text")) return overrides["get_text"]?.() ?? new Response("<p>Article text</p>", { status: 200 })
    if (url.includes("bookmarks/delete")) return overrides["bookmarks/delete"]?.() ?? new Response("", { status: 200 })
    // article URL fallback
    return overrides["fallback"]?.() ?? new Response("Fetched from URL", { status: 200 })
  }
}

Deno.test("getTextAndDeleteBookmarks: returns entries with text on happy path", async () => {
  const fetchStub = stub(globalThis, "fetch", makeFetch())
  const envStub = stub(Deno.env, "get", (key: string) => INSTAPAPER_ENV[key])
  try {
    const entries = await getTextAndDeleteBookmarks()
    assertEquals(entries.length, 1)
    assertEquals(entries[0].title, "Test Article")
    assertEquals(entries[0].audio, null)
    assertEquals(typeof entries[0].text, "string")
    assertEquals(entries[0].text.length > 0, true)
  } finally {
    fetchStub.restore()
    envStub.restore()
  }
})

Deno.test("getTextAndDeleteBookmarks: HTML tags are stripped from bookmark text", async () => {
  const fetchStub = stub(globalThis, "fetch", makeFetch({ "get_text": () => new Response("<p>Article text</p>", { status: 200 }) }))
  const envStub = stub(Deno.env, "get", (key: string) => INSTAPAPER_ENV[key])
  try {
    const entries = await getTextAndDeleteBookmarks()
    assertEquals(entries[0].text.includes("<p>"), false)
    assertEquals(entries[0].text.includes("</p>"), false)
  } finally {
    fetchStub.restore()
    envStub.restore()
  }
})

Deno.test("getTextAndDeleteBookmarks: fetches from article URL when bookmark text is empty", async () => {
  let fallbackFetched = false
  const fetchStub = stub(
    globalThis,
    "fetch",
    makeFetch({
      "get_text": () => new Response("", { status: 200 }),
      "fallback": () => {
        fallbackFetched = true
        return new Response("Fetched content", { status: 200 })
      },
    }),
  )
  const envStub = stub(Deno.env, "get", (key: string) => INSTAPAPER_ENV[key])
  try {
    await getTextAndDeleteBookmarks()
    assertEquals(fallbackFetched, true)
  } finally {
    fetchStub.restore()
    envStub.restore()
  }
})

Deno.test("getTextAndDeleteBookmarks: does not fetch fallback URL when bookmark text is non-empty", async () => {
  let fallbackFetched = false
  const fetchStub = stub(
    globalThis,
    "fetch",
    makeFetch({
      "get_text": () => new Response("<p>Real content here</p>", { status: 200 }),
      "fallback": () => {
        fallbackFetched = true
        return new Response("Should not be called", { status: 200 })
      },
    }),
  )
  const envStub = stub(Deno.env, "get", (key: string) => INSTAPAPER_ENV[key])
  try {
    await getTextAndDeleteBookmarks()
    assertEquals(fallbackFetched, false)
  } finally {
    fetchStub.restore()
    envStub.restore()
  }
})

Deno.test("getTextAndDeleteBookmarks: delete is called when text is found", async () => {
  let deleteWasCalled = false
  const fetchStub = stub(
    globalThis,
    "fetch",
    makeFetch({
      "bookmarks/delete": () => {
        deleteWasCalled = true
        return new Response("", { status: 200 })
      },
    }),
  )
  const envStub = stub(Deno.env, "get", (key: string) => INSTAPAPER_ENV[key])
  try {
    await getTextAndDeleteBookmarks()
    assertEquals(deleteWasCalled, true)
  } finally {
    fetchStub.restore()
    envStub.restore()
  }
})

Deno.test("getTextAndDeleteBookmarks: delete is NOT called when text and fallback are both empty", async () => {
  let deleteWasCalled = false
  const fetchStub = stub(
    globalThis,
    "fetch",
    makeFetch({
      "get_text": () => new Response("", { status: 200 }),
      "fallback": () => new Response("", { status: 200 }),
      "bookmarks/delete": () => {
        deleteWasCalled = true
        return new Response("", { status: 200 })
      },
    }),
  )
  const envStub = stub(Deno.env, "get", (key: string) => INSTAPAPER_ENV[key])
  try {
    await getTextAndDeleteBookmarks()
    assertEquals(deleteWasCalled, false)
  } finally {
    fetchStub.restore()
    envStub.restore()
  }
})

Deno.test("getTextAndDeleteBookmarks: throws when token fetch fails", async () => {
  const fetchStub = stub(globalThis, "fetch", makeFetch({ "access_token": () => new Response("", { status: 401 }) }))
  const envStub = stub(Deno.env, "get", (key: string) => INSTAPAPER_ENV[key])
  try {
    await assertRejects(
      () => getTextAndDeleteBookmarks(),
      Error,
      "Failed to get Instapaper token",
    )
  } finally {
    fetchStub.restore()
    envStub.restore()
  }
})

Deno.test("getTextAndDeleteBookmarks: throws when bookmarks list fetch fails", async () => {
  const fetchStub = stub(globalThis, "fetch", makeFetch({ "bookmarks/list": () => new Response("", { status: 500 }) }))
  const envStub = stub(Deno.env, "get", (key: string) => INSTAPAPER_ENV[key])
  try {
    await assertRejects(
      () => getTextAndDeleteBookmarks(),
      Error,
      "Failed to get bookmark list",
    )
  } finally {
    fetchStub.restore()
    envStub.restore()
  }
})

Deno.test("getTextAndDeleteBookmarks: returns empty array when no bookmarks", async () => {
  const fetchStub = stub(globalThis, "fetch", makeFetch({ "bookmarks/list": () => makeBookmarkListResponse([]) }))
  const envStub = stub(Deno.env, "get", (key: string) => INSTAPAPER_ENV[key])
  try {
    const entries = await getTextAndDeleteBookmarks()
    assertEquals(entries, [])
  } finally {
    fetchStub.restore()
    envStub.restore()
  }
})
