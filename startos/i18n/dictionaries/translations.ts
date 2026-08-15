import { LangDict } from './default'

// English only for now. Each locale listed here must translate *every* key in
// default.ts (LangDict requires the full set), so a partial contribution will
// not compile. Translations are welcome as complete locale blocks.
export default {} satisfies Record<string, LangDict>
