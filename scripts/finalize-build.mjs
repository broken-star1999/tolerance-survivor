import { readFile, writeFile, access, copyFile } from 'node:fs/promises'

const source = new URL('../index.html', import.meta.url)
const dist = new URL('../dist/', import.meta.url)
const developmentEntry = '<script type="module" src="/src/main.ts"></script>'
const html = await readFile(source, 'utf8')

if (!html.includes(developmentEntry)) {
  throw new Error('The development entry in index.html has changed.')
}

await Promise.all([
  access(new URL('game.js', dist)),
  access(new URL('styles.css', dist)),
])
await writeFile(
  new URL('index.html', dist),
  html.replace(developmentEntry, '<script defer src="./game.js"></script>'),
)
await copyFile(new URL('../node_modules/three/LICENSE', import.meta.url), new URL('THREE-LICENSE.txt', dist))
console.log('dist/index.html can run over HTTP(S) and file://.')
