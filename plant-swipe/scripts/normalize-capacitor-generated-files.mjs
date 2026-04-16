#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

const androidGeneratedGradle = join(root, 'android', 'app', 'capacitor.build.gradle')
const iosSpmPackage = join(root, 'ios', 'App', 'CapApp-SPM', 'Package.swift')

function patchAndroidGeneratedGradle(content) {
  return content.replace(/JavaVersion\.VERSION_21/g, 'JavaVersion.VERSION_17')
}

function patchIosSpmPackage(content) {
  return content
    .replace(/^\s*\.package\(name: "CapacitorStatusBar", path: "\.\.\/\.\.\/\.\.\/node_modules\/@capacitor\/status-bar"\),?\n/m, '')
    .replace(/^\s*\.product\(name: "CapacitorStatusBar", package: "CapacitorStatusBar"\),?\n/m, '')
}

let androidPatched = false
let iosPatched = false

if (existsSync(androidGeneratedGradle)) {
  const before = readFileSync(androidGeneratedGradle, 'utf8')
  const after = patchAndroidGeneratedGradle(before)
  if (after !== before) {
    writeFileSync(androidGeneratedGradle, after, 'utf8')
  }
  androidPatched = true
}

if (existsSync(iosSpmPackage)) {
  const before = readFileSync(iosSpmPackage, 'utf8')
  const after = patchIosSpmPackage(before)
  if (after !== before) {
    writeFileSync(iosSpmPackage, after, 'utf8')
  }
  iosPatched = true
}

console.log(
  `[normalize-capacitor-generated-files]` +
    (androidPatched ? ' android=patched' : ' android=skip') +
    (iosPatched ? ' ios=patched' : ' ios=skip'),
)
