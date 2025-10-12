import React, { useEffect, useRef, useState } from 'react'
import './DarkSelect.css'

type Option = { value: string | number, label: string }

type Props = {
  name?: string
  value: string
  options: Option[]
  placeholder?: string
  onChange: (e: { target: { name?: string, value: string } }) => void
}

const DarkSelect: React.FC<Props> = ({ name, value, options, placeholder, onChange }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selected = options.find(o => String(o.value) === String(value))

  function select(v: string | number) {
    onChange({ target: { name, value: String(v) } })
    setOpen(false)
  }

  return (
    <div className="dark-select" ref={ref}>
      <button type="button" className="ds-control" onClick={() => setOpen(s => !s)}>
        <span className="ds-value">{selected ? selected.label : (placeholder || '')}</span>
        <span className="ds-arrow" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="ds-menu" role="listbox">
          {options.map(o => (
            <div key={o.value} role="option" tabIndex={0} className="ds-option" onClick={() => select(o.value)} onKeyDown={(e) => { if (e.key === 'Enter') select(o.value) }}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DarkSelect
