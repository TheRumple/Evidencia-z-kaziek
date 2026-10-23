'use client'

import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'

export type NoteTextColor = 'black' | 'red' | 'green' | 'blue'
export type NoteRun = { text: string; color: NoteTextColor }

export const NOTE_TEXT_COLORS: { value: NoteTextColor; label: string; color: string }[] = [
  { value: 'black', label: 'Čierna', color: '#0f172a' },
  { value: 'red', label: 'Červená', color: '#b91c1c' },
  { value: 'green', label: 'Zelená', color: '#15803d' },
  { value: 'blue', label: 'Modrá', color: '#1d4ed8' },
]

const COLOR_ALIASES: Record<string, NoteTextColor> = {
  '#0f172a': 'black', 'rgb(15, 23, 42)': 'black', black: 'black',
  '#b91c1c': 'red', 'rgb(185, 28, 28)': 'red', red: 'red',
  '#15803d': 'green', 'rgb(21, 128, 61)': 'green', green: 'green',
  '#1d4ed8': 'blue', 'rgb(29, 78, 216)': 'blue', blue: 'blue',
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function colorName(value: string | null | undefined, fallback: NoteTextColor = 'black'): NoteTextColor {
  return COLOR_ALIASES[String(value || '').trim().toLowerCase()] || fallback
}

export function normalizeNoteRuns(value: unknown, fallbackText = '', fallbackColor: NoteTextColor = 'black'): NoteRun[] {
  if (!Array.isArray(value)) return fallbackText ? [{ text: fallbackText, color: fallbackColor }] : []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const raw = entry as { text?: unknown; color?: unknown }
    const text = String(raw.text ?? '')
    return text ? [{ text, color: colorName(String(raw.color || ''), fallbackColor) }] : []
  })
}

export function noteRunsToText(runs: NoteRun[]) {
  return runs.map((run) => run.text).join('')
}

function runsToHtml(runs: NoteRun[]) {
  return runs.map((run) => {
    const color = NOTE_TEXT_COLORS.find((item) => item.value === run.color)?.color || NOTE_TEXT_COLORS[0].color
    return `<span style="color:${color}">${escapeHtml(run.text).replace(/\n/g, '<br>')}</span>`
  }).join('')
}

function readRuns(root: HTMLElement): NoteRun[] {
  const runs: NoteRun[] = []
  const append = (text: string, color: NoteTextColor) => {
    if (!text) return
    const previous = runs[runs.length - 1]
    if (previous?.color === color) previous.text += text
    else runs.push({ text, color })
  }
  const walk = (node: Node, inheritedColor: NoteTextColor) => {
    if (node.nodeType === Node.TEXT_NODE) { append(node.textContent || '', inheritedColor); return }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') { append('\n', inheritedColor); return }
    const ownColor = colorName(node.style.color || node.getAttribute('color'), inheritedColor)
    Array.from(node.childNodes).forEach((child) => walk(child, ownColor))
    if (['DIV', 'P'].includes(node.tagName) && runs.length && !runs[runs.length - 1].text.endsWith('\n')) append('\n', ownColor)
  }
  Array.from(root.childNodes).forEach((node) => walk(node, 'black'))
  if (runs.length && runs[runs.length - 1].text.endsWith('\n')) runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\n$/, '')
  return runs.filter((run) => run.text)
}

type RichNoteEditorProps = {
  runs: NoteRun[]
  onChange: (runs: NoteRun[]) => void
  onSubmit?: () => void
  placeholder?: string
  compact?: boolean
  autoFocus?: boolean
}

export function RichNoteEditor({ runs, onChange, onSubmit, placeholder = 'Čo si potrebuješ zapísať?', compact = false, autoFocus = false }: RichNoteEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const nextHtml = runsToHtml(runs)
    const editorText = noteRunsToText(readRuns(editor))
    if (document.activeElement === editor && editorText === noteRunsToText(runs)) return
    if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml
  }, [runs])

  useEffect(() => {
    if (autoFocus) editorRef.current?.focus()
  }, [autoFocus])

  function emitChange() {
    if (editorRef.current) onChange(readRuns(editorRef.current))
  }

  function applyColor(color: string) {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('foreColor', false, color)
    emitChange()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' || event.shiftKey || !onSubmit) return
    event.preventDefault()
    onSubmit()
  }

  return <div className="richNoteEditor">
    <div className="richNoteCanvas" ref={editorRef} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" data-placeholder={placeholder} onInput={emitChange} onKeyDown={handleKeyDown}/>
    <div className="richNoteColors" aria-label="Farba označeného textu">
      <span>Farba textu</span>
      {NOTE_TEXT_COLORS.map((item) => <button key={item.value} type="button" className="richColorSwatch" title={`${item.label} text`} aria-label={`${item.label} text`} style={{ background: item.color }} onMouseDown={(event) => event.preventDefault()} onClick={() => applyColor(item.color)}/>) }
    </div>
    <style jsx>{`
      .richNoteEditor{display:grid;gap:6px}.richNoteCanvas{width:100%;min-height:${compact ? '68px' : '78px'};resize:vertical;overflow:auto;border:1px solid #94a3b8;border-radius:7px;padding:10px 11px;font:700 ${compact ? '13px' : '15px'}/1.45 Arial;box-sizing:border-box;background:#fff;white-space:pre-wrap;overflow-wrap:anywhere}.richNoteCanvas:empty:before{content:attr(data-placeholder);color:#94a3b8;pointer-events:none}.richNoteCanvas:focus{outline:2px solid #bef264;border-color:#65a30d}.richNoteColors{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:#64748b;font-size:10px;font-weight:900}.richColorSwatch{width:25px;height:25px;border:2px solid #fff;border-radius:50%;cursor:pointer;box-shadow:0 0 0 1px #94a3b8}.richColorSwatch:hover,.richColorSwatch:focus-visible{box-shadow:0 0 0 3px #84cc16;outline:0}
    `}</style>
  </div>
}
