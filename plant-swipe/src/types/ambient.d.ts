// Ambient declarations to satisfy Vite config TS references without pulling full Node types into the app build.
declare module 'path' {
  const anything: unknown
  export = anything
}
declare module 'url' {
  export const fileURLToPath: (url: string | URL) => string
  export const pathToFileURL: (path: string) => URL
}

declare module 'dompurify'
// No longer exposing db.js