import { parseFeed } from "rss"

async function fetchEntryData(title: string, url: string):Promise<Entry> {
  const res = await fetch(url)
  const text = await res.text()
  return {
    title: title,
    url: url,
    text: removeHTMLTags(text)
  }
}

function removeHTMLTags(text: string):string {
  return text.replace(/(<(head|script|style|header|footer|nav|iframe|aside)[^>]*>([\s\S]*?)<\/(head|script|style|header|footer|nav|iframe|aside)>)/g, '')
             .replace(/<("[^"]*"|'[^']*'|[^'">])*>/g,'')
             .replace(/\s{2,}/g, ' ');
}

type Entry = {
  title: string
  url: string
  text: string
}

const res = await fetch("https://b.hatena.ne.jp/hotentry/it.rss")
const xml = await res.text()
const feeds = await parseFeed(xml)

const promiseList: Promise<Entry>[] = []
for (const f of feeds.entries) {
  promiseList.push(fetchEntryData(f.title.value, f.id))
}

const entries: Entry[] = await Promise.all(promiseList)
console.log(entries)
