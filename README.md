# Alexandrpedia

A reading room for encyclopedia articles. AI sits at the centre, with History, Science, American Popular Culture and Philosophy & Ideas on the four walls. Every article is a book from a committed Wikipedia or Grokipedia snapshot, shelved in its collection and laid out in the room with its reading furniture.

![The AI collection, wide](docs/screenshots/ai-collection-wide.png)

## The room

- **AI at the centre.** Two back-to-back bookcases hold the Wikipedia and Grokipedia collections, flanked by two long tables on which a book is read.
- **Four walls.** Each subject has a pair of bookcases, a plaque and a rug.
- **Corner nooks.** Each corner has a table and four armchairs, and readers sit there and come and go.

![Books in the AI collection, close up](docs/screenshots/ai-collection-closeup.png)

## Reading

Click a book to take it down and open it. Click a page's side to turn it, or use the arrow keys. Press Escape, or click the room, to put the book back.

![An open book](docs/screenshots/open-book.png)

## Controls

| Action | Control |
|---|---|
| Open a book | Click it |
| Turn a page | Click the side of the open page, or the arrow keys |
| Put a book back | Escape, or click the room |
| Orbit | Drag |
| Pan | Right-drag, Shift-drag, or two fingers; or W/A/S/D and the arrow keys when no book is open |
| Zoom | Scroll, or pinch |
| Reset the view | Double-click, or press R |

## Running it

The engine is an npm dependency (`madness-engine`, pinned to a commit in `package.json`), and Vite runs the site:

```bash
npm install
npm run dev
```

Then open the local address Vite prints (http://localhost:5173/ by default). `npm run build` writes the site to `dist/`, and `npm run preview` serves that build. Node 22.12 or later is required.

## Tests

```bash
npm test
```

The tests cover room layout, the rug, book shelving and snapshot pacing, and check the committed snapshots offline. `npm run check-titles` confirms that every curated title has a readable snapshot for both encyclopedias.

## Articles

The articles are committed snapshots in `data/wikipedia` and `data/grokipedia`. To refresh them:

```bash
npm run snapshot-all
npm run update-articles
```

## Layout

- `src/app.js`: the room, the views and the controls.
- `src/room-layout.js`: where the bookcases, tables, chairs and books stand.
- `src/catalog.js`, `src/sections.js`, `src/library.js`: the curated titles and their snapshots.
- `src/rug.js`: the Persian rugs.
- `madness-engine` (npm dependency, in `node_modules/`): the engine that draws the room and its props.
