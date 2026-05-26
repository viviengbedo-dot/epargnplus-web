'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-lime rounded-lg flex items-center justify-center">
              <span className="text-navy font-black text-sm">E+</span>
            </div>
            <span className="text-white font-bold text-lg">Epargn+</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#fonctionnalites" className="text-white/70 hover:text-white text-sm font-medium transition-colors">Fonctionnalités</a>
            <a href="#comment" className="text-white/70 hover:text-white text-sm font-medium transition-colors">Comment ça marche</a>
            <a href="#telecharger" className="text-white/70 hover:text-white text-sm font-medium transition-colors">Télécharger</a>
            <Link
              href="/admin/login"
              className="text-sm font-medium text-navy bg-lime hover:bg-lime-300 px-4 py-2 rounded-lg transition-colors"
            >
              Espace Admin
            </Link>
          </div>

          <button className="md:hidden text-white" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-navy border-t border-white/10 px-4 py-4 flex flex-col gap-4">
          <a href="#fonctionnalites" className="text-white/70 text-sm font-medium" onClick={() => setOpen(false)}>Fonctionnalités</a>
          <a href="#comment" className="text-white/70 text-sm font-medium" onClick={() => setOpen(false)}>Comment ça marche</a>
          <a href="#telecharger" className="text-white/70 text-sm font-medium" onClick={() => setOpen(false)}>Télécharger</a>
          <Link href="/admin/login" className="text-sm font-medium text-navy bg-lime px-4 py-2 rounded-lg text-center">
            Espace Admin
          </Link>
        </div>
      )}
    </nav>
  )
}
