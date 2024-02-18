export type Entry = {
  id: string
  title: string
  url: string
  text: string
  audio: Uint8Array | null
}

type RequestData = {
  [key: string]: string
}

export type RequestConfig = {
  method: "POST"
  url: string
  data?: RequestData
}

export type Token = {
  key: string
  secret: string
}

export type Bookmark = {
  hash: string
  description: string
  bookmark_id: number
  private_source: string
  title: string
  url: string
  progress_timestamp: number
  time: number
  progress: number
  starred: string
  type: string
}
