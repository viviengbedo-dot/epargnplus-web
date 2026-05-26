'use client'
import { useState } from 'react'
import { ChevronDown, MessageCircle, Phone, Mail, HelpCircle } from 'lucide-react'

const FAQ = [
  {
    q: 'Comment deposer de l\'argent sur mon compte ?',
    a: 'Depuis l\'accueil, appuyez sur "Deposer". Choisissez votre operateur (Orange Money, MTN MoMo), entrez le montant, puis effectuez le virement vers notre numero marchand en indiquant votre reference de transaction. Votre compte est credite sous 15-30 minutes.',
  },
  {
    q: 'Comment retirer mon argent ?',
    a: 'Depuis l\'accueil, appuyez sur "Retirer". Choisissez l\'operateur et le montant. Des frais de 1% s\'appliquent. Votre retrait est traite sous 15-30 minutes. Le montant est reserve immediatement sur votre solde.',
  },
  {
    q: 'Quels sont les delais de traitement des transactions ?',
    a: 'Tous les depots et retraits sont traites manuellement par notre equipe dans un delai de 15 a 30 minutes en heures ouvrables (8h-18h). En dehors de ces horaires, le traitement a lieu le lendemain matin.',
  },
  {
    q: 'Comment fonctionne la verification KYC ?',
    a: 'La verification d\'identite (KYC) necessite une photo de votre CNI ou passeport, et un selfie avec votre piece. Une fois soumis, notre equipe verifie vos documents sous 24-48h. La verification KYC permet d\'augmenter vos limites de transaction.',
  },
  {
    q: 'Quelles sont mes limites de transaction ?',
    a: 'Sans KYC (Niveau 1) : depot max 500 000 GNF/mois, retrait max 200 000 GNF/mois. Avec KYC verifie (Niveau 2) : depot max 5 000 000 GNF/mois, retrait max 2 000 000 GNF/mois.',
  },
  {
    q: 'Qu\'est-ce qu\'un projet d\'epargne ?',
    a: 'Un projet d\'epargne vous permet de definir un objectif (achat, voyage, education...) et de suivre votre progression. Vous pouvez allouer vos depots vers un projet specifique pour atteindre votre objectif plus facilement.',
  },
  {
    q: 'Comment fonctionne le parrainage ?',
    a: 'Partagez votre code unique a un ami. Quand il s\'inscrit avec votre code et effectue son premier depot, vous recevez tous les deux 5 000 GNF de bonus directement sur votre solde.',
  },
  {
    q: 'Mon argent est-il en securite ?',
    a: 'Oui. Votre solde est gere sur une plateforme securisee. Chaque transaction necessite une confirmation OTP par SMS. Vos donnees sont chiffrees et notre equipe verifie manuellement chaque transaction avant traitement.',
  },
  {
    q: 'Que faire si mon paiement n\'est pas credite ?',
    a: 'Si votre solde n\'est pas credite apres 1 heure, contactez-nous via WhatsApp avec votre reference de transaction. Notre equipe verifie et credite votre compte en priorite.',
  },
  {
    q: 'Comment changer mon code PIN ?',
    a: 'Allez dans Profil > onglet "Securite" > "Changer le PIN". Entrez et confirmez votre nouveau code a 6 chiffres. Le PIN est utilise dans l\'application mobile.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-3 py-4 text-left">
        <p className={`text-sm font-semibold transition-colors ${open ? 'text-navy' : 'text-gray-700'}`}>{q}</p>
        <ChevronDown size={16} className={`flex-shrink-0 text-gray-400 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <p className="text-sm text-gray-500 pb-4 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export default function SupportPage() {
  return (
    <>
      <div className="mb-4">
        <h1 className="text-xl font-black text-navy">Aide & Support</h1>
        <p className="text-gray-400 text-xs mt-0.5">Trouvez des reponses a vos questions</p>
      </div>

      {/* Contact rapide */}
      <div className="bg-navy rounded-2xl p-5 mb-4 shadow-lg">
        <p className="text-white font-bold mb-3">Contactez-nous directement</p>
        <div className="space-y-2">
          <a href="https://wa.me/224620000000" target="_blank" rel="noreferrer"
            className="flex items-center gap-3 bg-green-500 text-white rounded-xl px-4 py-3 font-semibold text-sm hover:bg-green-600 transition-colors">
            <MessageCircle size={18} />
            WhatsApp — Reponse en moins d&apos;1h
          </a>
          <div className="grid grid-cols-2 gap-2">
            <a href="tel:+224620000000"
              className="flex items-center justify-center gap-2 bg-white/10 text-white rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-white/20 transition-colors">
              <Phone size={15} />
              Appeler
            </a>
            <a href="mailto:support@epargnplus.com"
              className="flex items-center justify-center gap-2 bg-white/10 text-white rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-white/20 transition-colors">
              <Mail size={15} />
              Email
            </a>
          </div>
        </div>
        <p className="text-white/40 text-xs mt-3">Disponible lun-sam 8h-18h (heure de Conakry)</p>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <HelpCircle size={16} className="text-navy" />
          <p className="font-bold text-navy text-sm">Questions frequentes</p>
        </div>
        <div className="px-5">
          {FAQ.map((item) => (
            <FAQItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mt-4 px-4">
        Version 2.0 — Epargn+ Guinea &copy; {new Date().getFullYear()}
      </p>
    </>
  )
}
