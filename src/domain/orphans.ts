/**
 * Polska typografia: jednoliterowy wyraz (a, i, o, u, w, z) nie zostaje na końcu linii —
 * spacja po nim staje się twardą. Działa na dowolnym tekście, bez zmiany treści.
 */
const NBSP = ' '
const ORPHAN = /(^|[\s („"])([aiouwzAIOUWZ]) /g
/** liczba z jednostką albo liczebnik z „piętrem” w jednej linii: „5. piętro”, „42,0 m²”, „5 h 20 min” */
const UNIT = /(\d)\.? (?=piętr|m²|zł|tys\.|mln|pok|h\b|min\b|wolny|wolne|mieszka)/g

export function glueOrphans(text: string): string {
  // dwa przebiegi: „i w domu” — drugi wyraz zaczyna się tuż po twardej spacji pierwszego
  return text
    .replace(ORPHAN, `$1$2${NBSP}`)
    .replace(ORPHAN, `$1$2${NBSP}`)
    .replace(UNIT, (m) => m.replace(' ', NBSP))
}

/** Skleja sieroty w tekstach pod `root` i pilnuje ich przy każdej zmianie (React podmienia teksty). */
export function watchOrphans(root: HTMLElement): () => void {
  const fix = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue ?? ''
      const glued = glueOrphans(value)
      if (glued !== value) node.nodeValue = glued
      return
    }
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    for (let t = walker.nextNode(); t; t = walker.nextNode()) fix(t)
  }
  fix(root)
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') fix(r.target)
      else r.addedNodes.forEach(fix)
    }
  })
  observer.observe(root, { subtree: true, childList: true, characterData: true })
  return () => observer.disconnect()
}
