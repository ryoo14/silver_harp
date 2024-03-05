import OAuth from "npm:oauth-1.0a"
import CryptoJS from "npm:crypto-js"
import { Bookmark, Entry, RequestConfig, Token } from "./types.ts"
import { checkResponseCode } from "./utils.ts"

function generateRequest(oauth: OAuth, requestConfig: RequestConfig, token?: Token): Request {
  const oauthData = token ? oauth.authorize(requestConfig, token) : oauth.authorize(requestConfig)

  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
  })
  headers.append("authorization", oauth.toHeader(oauthData).Authorization)

  const bodies = requestConfig.data ? new URLSearchParams(Object.entries(requestConfig.data)) : undefined

  const request = new Request(requestConfig.url, {
    method: requestConfig.method,
    headers: headers,
    body: bodies,
  })

  return request
}

async function getToken(oauth: OAuth): Promise<Token> {
  const username = Deno.env.get("INSTAPAPER_USER_NAME")
  const password = Deno.env.get("INSTAPAPER_USER_PASSWORD")
  if (!username || !password) {
    throw new Error("Error: Required environment variable 'INSTAPAPER_USER_XXX' is not defined. Please set it before running the application.")
  }

  const requestConfig: RequestConfig = {
    method: "POST",
    url: "https://www.instapaper.com/api/1.1/oauth/access_token",
    data: {
      x_auth_username: username,
      x_auth_password: password,
      x_auth_mode: "client_auth",
    },
  }
  const request = generateRequest(oauth, requestConfig)

  const response = await fetch(request)
  if (!checkResponseCode(response)) {
    throw new Error(`Error: Failed to get Instapaper token. Response code is ${response.status}`)
  }

  // tokenString is "oauth_token=xxxxxxx&oauth_token_secret=yyyyyyyy"
  const tokenString = await response.text()
  const params = new URLSearchParams(tokenString)
  const token: Token = {
    key: params.get("oauth_token") || "",
    secret: params.get("oauth_token_secret") || "",
  }

  return token
}

async function getBookmarks(oauth: OAuth, token: Token): Promise<Bookmark[]> {
  const requestConfig: RequestConfig = {
    method: "POST",
    url: "https://www.instapaper.com/api/1.1/bookmarks/list",
  }
  const request = generateRequest(oauth, requestConfig, token)

  const response = await fetch(request)
  if (!checkResponseCode(response)) {
    throw new Error(`Error: Failed to get bookmark list. Response code is ${response.status}`)
  }

  const bookmarks: Bookmark[] = JSON.parse(await response.text()).bookmarks
  return bookmarks
}

async function getBookmarkText(oauth: OAuth, bookmarkID: string, token: Token): Promise<string> {
  const requestConfig: RequestConfig = {
    method: "POST",
    url: "https://www.instapaper.com/api/1.1/bookmarks/get_text",
    data: {
      bookmark_id: bookmarkID,
    },
  }
  const request = generateRequest(oauth, requestConfig, token)

  const response = await fetch(request)
  if (!checkResponseCode(response)) {
    throw new Error(`Error: Failed to get bookmark text(${bookmarkID}). Response code is ${response.status}`)
  }

  return await response.text()
}

async function deleteBookmark(oauth: OAuth, bookmarkID: string, token: Token): Promise<void> {
  const requestConfig: RequestConfig = {
    method: "POST",
    url: "https://www.instapaper.com/api/1.1/bookmarks/delete",
    data: {
      bookmark_id: bookmarkID,
    },
  }
  const request = generateRequest(oauth, requestConfig, token)

  const response = await fetch(request)
  if (!checkResponseCode(response)) {
    throw new Error(`Error: Failed to delete bookmark(${bookmarkID}). Response code is ${response.status}`)
  }
}

function generateEntryFromBookmarks(bookmarks: Bookmark[]): Entry[] {
  const entries: Entry[] = []
  for (const b of bookmarks) {
    entries.push({
      id: b.bookmark_id.toString(),
      title: b.title,
      url: b.url,
      text: "",
      audio: null,
    })
  }

  return entries
}

export async function getTextAndDeleteBookmarks(): Promise<Entry[]> {
  try {
    const consumerKey = Deno.env.get("INSTAPAPER_CONSUMER_KEY")
    const consumerSecret = Deno.env.get("INSTAPAPER_CONSUMER_SECRET")
    if (!consumerKey || !consumerSecret) {
      throw new Error("Error: Required environment variable 'INSTAPAPER_CONSUMER_XXX' is not defined. Please set it before running the application.")
    }

    // Get oatuh_token and oauth_token_secret
    const oauth = new OAuth({
      consumer: { key: consumerKey, secret: consumerSecret },
      signature_method: "HMAC-SHA1",
      hash_function(base, key) {
        return CryptoJS.HmacSHA1(base, key).toString(CryptoJS.enc.Base64)
      },
    })

    const token: Token = await getToken(oauth)

    const bookmarks: Bookmark[] = await getBookmarks(oauth, token)
    const entries: Entry[] = generateEntryFromBookmarks(bookmarks)

    const entriesWithText: Entry[] = []
    for (const e of entries) {
      const text = await getBookmarkText(oauth, e.id, token)
      if (text != null) {
        await deleteBookmark(oauth, e.id, token)
      }
      entriesWithText.push({
        id: e.id,
        title: e.title,
        url: e.url,
        text: text,
        audio: null,
      })
    }

    return entriesWithText
  } catch (e) {
    console.error(e)
    Deno.exit(1)
  }
}
