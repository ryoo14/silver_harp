import { assertEquals } from "jsr:@std/assert"
import { stub } from "jsr:@std/testing/mock"
import {
  checkEnvironmentVariables,
  checkResponseCode,
  combineAudio,
  generateItemForRSS,
  removeHTMLTags,
  separateSentenceWithPeriods,
} from "./utils.ts"
import type { Entry } from "./types.ts"

// --- removeHTMLTags ---

Deno.test("removeHTMLTags: strips basic HTML tags", () => {
  assertEquals(removeHTMLTags("<p>Hello</p>"), "Hello")
})

Deno.test("removeHTMLTags: removes nav block with its content", () => {
  assertEquals(removeHTMLTags("<nav>Menu</nav>text"), "text")
})

Deno.test("removeHTMLTags: removes script block with its content", () => {
  assertEquals(removeHTMLTags("<script>var x=1</script>after"), "after")
})

Deno.test("removeHTMLTags: all </li> are replaced with 。", () => {
  assertEquals(removeHTMLTags("item</li>next</li>"), "item。next。")
})

Deno.test("removeHTMLTags: collapses multiple whitespace to single space", () => {
  assertEquals(removeHTMLTags("a   b"), "a b")
})

Deno.test("removeHTMLTags: removes hatena anond ID", () => {
  assertEquals(removeHTMLTags("anond:20231015120000text"), "。text")
})

Deno.test("removeHTMLTags: removes text after ≪前の記事", () => {
  assertEquals(removeHTMLTags("article≪前の記事older"), "article")
})

Deno.test("removeHTMLTags: removes text after ≫次の記事", () => {
  assertEquals(removeHTMLTags("article≫次の記事newer"), "article")
})

Deno.test("removeHTMLTags: empty string returns empty string", () => {
  assertEquals(removeHTMLTags(""), "")
})

Deno.test("removeHTMLTags: plain text without tags is unchanged", () => {
  assertEquals(removeHTMLTags("plain text"), "plain text")
})

// --- checkResponseCode ---

Deno.test("checkResponseCode: returns true for status 200", () => {
  assertEquals(checkResponseCode(new Response("", { status: 200 })), true)
})

Deno.test("checkResponseCode: returns false for status 201", () => {
  assertEquals(checkResponseCode(new Response("", { status: 201 })), false)
})

Deno.test("checkResponseCode: returns false for status 400", () => {
  assertEquals(checkResponseCode(new Response("", { status: 400 })), false)
})

Deno.test("checkResponseCode: returns false for status 404", () => {
  assertEquals(checkResponseCode(new Response("", { status: 404 })), false)
})

Deno.test("checkResponseCode: returns false for status 500", () => {
  assertEquals(checkResponseCode(new Response("", { status: 500 })), false)
})

// --- combineAudio ---

Deno.test("combineAudio: combines two arrays correctly", () => {
  const result = combineAudio([new Uint8Array([1, 2]), new Uint8Array([3, 4])])
  assertEquals(result, new Uint8Array([1, 2, 3, 4]))
})

Deno.test("combineAudio: returns empty Uint8Array for empty input", () => {
  assertEquals(combineAudio([]).length, 0)
})

Deno.test("combineAudio: single array passes through unchanged", () => {
  assertEquals(combineAudio([new Uint8Array([10, 20])]), new Uint8Array([10, 20]))
})

Deno.test("combineAudio: total length equals sum of inputs", () => {
  const a = new Uint8Array(1000).fill(1)
  const b = new Uint8Array(1000).fill(2)
  assertEquals(combineAudio([a, b]).length, 2000)
})

Deno.test("combineAudio: preserves 0x00 and 0xFF boundary bytes", () => {
  const result = combineAudio([new Uint8Array([0x00]), new Uint8Array([0xFF])])
  assertEquals(result, new Uint8Array([0x00, 0xFF]))
})

// --- separateSentenceWithPeriods ---

Deno.test("separateSentenceWithPeriods: uses 。 as delimiter for Japanese text", () => {
  const result = separateSentenceWithPeriods("文A。文B。")
  assertEquals(result.every((s) => s.includes("。")), true)
})

Deno.test("separateSentenceWithPeriods: uses . as delimiter when no 。 present", () => {
  const result = separateSentenceWithPeriods("Hello. World.")
  assertEquals(result.every((s) => s.includes(".")), true)
})

Deno.test("separateSentenceWithPeriods: prefers 。 over . when both present", () => {
  const result = separateSentenceWithPeriods("文A。sentence.with.dots。")
  // should split on 。, so each chunk contains 。
  assertEquals(result.every((s) => s.includes("。")), true)
})

Deno.test("separateSentenceWithPeriods: short text fits in single chunk", () => {
  const result = separateSentenceWithPeriods("短い文章。")
  assertEquals(result.length, 1)
})

Deno.test("separateSentenceWithPeriods: long text is split into multiple chunks under 1500 chars each", () => {
  // 3 sentences of 600 chars each = 1800 chars total → forces a split
  const sentence = "あ".repeat(599) + "。"
  const longText = sentence + sentence + sentence
  const result = separateSentenceWithPeriods(longText)
  assertEquals(result.length > 1, true)
  result.forEach((chunk) => {
    assertEquals(chunk.length < 1500, true)
  })
})

Deno.test("separateSentenceWithPeriods: no chunk exceeds 1499 chars", () => {
  // 5 sentences of 400 chars each
  const sentence = "a".repeat(399) + "."
  const text = sentence.repeat(5)
  const result = separateSentenceWithPeriods(text)
  result.forEach((chunk) => {
    assertEquals(chunk.length < 1500, true)
  })
})

// --- generateItemForRSS ---

Deno.test("generateItemForRSS: includes server URL in output", () => {
  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "SILVERHARP_SERVER") return "example.com"
    if (key === "SILVERHARP_USER") return "ryoo14"
  })
  try {
    const entry: Entry = { id: "1", title: "Test", url: "https://foo.com", text: "text", audio: null }
    const result = generateItemForRSS([entry])
    assertEquals(result.includes("example.com"), true)
  } finally {
    envStub.restore()
  }
})

Deno.test("generateItemForRSS: includes entry title and URL as list item", () => {
  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "SILVERHARP_SERVER") return "example.com"
    if (key === "SILVERHARP_USER") return "ryoo14"
  })
  try {
    const entry: Entry = { id: "1", title: "My Article", url: "https://foo.com/bar", text: "text", audio: null }
    const result = generateItemForRSS([entry])
    assertEquals(result.includes(">My Article</a>"), true)
    assertEquals(result.includes('href="https://foo.com/bar"'), true)
  } finally {
    envStub.restore()
  }
})

Deno.test("generateItemForRSS: contains all required placeholders", () => {
  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "SILVERHARP_SERVER") return "example.com"
    if (key === "SILVERHARP_USER") return "ryoo14"
  })
  try {
    const entry: Entry = { id: "1", title: "T", url: "https://foo.com", text: "", audio: null }
    const result = generateItemForRSS([entry])
    assertEquals(result.includes("_TITLE"), true)
    assertEquals(result.includes("_DATE"), true)
    assertEquals(result.includes("_AUDIOFILENAME"), true)
    assertEquals(result.includes("_DURATION"), true)
    assertEquals(result.includes("_AUDIOFILELENGTH"), true)
  } finally {
    envStub.restore()
  }
})

Deno.test("generateItemForRSS: multiple entries each appear as list items", () => {
  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "SILVERHARP_SERVER") return "example.com"
    if (key === "SILVERHARP_USER") return "ryoo14"
  })
  try {
    const entries: Entry[] = [
      { id: "1", title: "Article 1", url: "https://a.com", text: "", audio: null },
      { id: "2", title: "Article 2", url: "https://b.com", text: "", audio: null },
      { id: "3", title: "Article 3", url: "https://c.com", text: "", audio: null },
    ]
    const result = generateItemForRSS(entries)
    assertEquals(result.includes("Article 1"), true)
    assertEquals(result.includes("Article 2"), true)
    assertEquals(result.includes("Article 3"), true)
  } finally {
    envStub.restore()
  }
})

Deno.test("generateItemForRSS: itunes:author uses SILVERHARP_USER", () => {
  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "SILVERHARP_SERVER") return "example.com"
    if (key === "SILVERHARP_USER") return "ryoo14"
  })
  try {
    const result = generateItemForRSS([])
    assertEquals(result.includes("<itunes:author>ryoo14</itunes:author>"), true)
  } finally {
    envStub.restore()
  }
})

// --- checkEnvironmentVariables ---

Deno.test("checkEnvironmentVariables: returns empty array when all vars are defined", () => {
  const envStub = stub(Deno.env, "get", (_key: string) => "value")
  try {
    assertEquals(checkEnvironmentVariables(["VAR_A", "VAR_B"]), [])
  } finally {
    envStub.restore()
  }
})

Deno.test("checkEnvironmentVariables: returns name of undefined var", () => {
  const envStub = stub(Deno.env, "get", (key: string) => {
    if (key === "VAR_A") return undefined
    return "value"
  })
  try {
    assertEquals(checkEnvironmentVariables(["VAR_A", "VAR_B"]), ["VAR_A"])
  } finally {
    envStub.restore()
  }
})

Deno.test("checkEnvironmentVariables: returns all undefined vars", () => {
  const envStub = stub(Deno.env, "get", (_key: string) => undefined)
  try {
    assertEquals(checkEnvironmentVariables(["VAR_A", "VAR_B"]), ["VAR_A", "VAR_B"])
  } finally {
    envStub.restore()
  }
})

Deno.test("checkEnvironmentVariables: empty string value is treated as undefined", () => {
  const envStub = stub(Deno.env, "get", (_key: string) => "")
  try {
    assertEquals(checkEnvironmentVariables(["VAR_A"]), ["VAR_A"])
  } finally {
    envStub.restore()
  }
})

Deno.test("checkEnvironmentVariables: empty input array returns empty array", () => {
  const envStub = stub(Deno.env, "get", (_key: string) => "value")
  try {
    assertEquals(checkEnvironmentVariables([]), [])
  } finally {
    envStub.restore()
  }
})
