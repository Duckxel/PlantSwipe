// Ambient declarations to satisfy Vite config TS references without pulling full Node types into the app build.
declare module 'path' {
  const anything: any
  export = anything
}
declare module 'url' {
  export const fileURLToPath: any
  export const pathToFileURL: any
}

declare module 'dompurify'
// No longer exposing db.js