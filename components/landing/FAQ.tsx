'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    q: 'Epargn+ est-il gratuit ?',
    a: 'Oui, l\'ouverture de compte et l\'utilisation de l\'application sont entièrement gratuites. Des frais peuvent s\'appliquer sur les opérations Mobile Money selon votre opérateur.',
  },
  {
    q: 'Quels opérateurs sont acceptés ?',
    a: 'Nous acceptons Orange Money et MTN Mobile Money disponibles en Guinée. D\'autres opérateurs seront ajoutés prochainement.',
  },
  {
    q: 'Mon argent est-il en sécurité ?',
    a: 'Absolument. Votre compte est protégé par un code PIN chiffré et une authentification à deux facteurs via SMS. Toutes les données sont chiffrées.',
  },
  {
    q: 'Comment retirer mon argent ?',
    a: 'Rendez-vous dans l\'onglet "Retrait", entrez le montant et votre numéro Mobile Money. L\'argent est transféré en moins de 2 minutes.',
  },
  {
    q: 'Comment fonctionne le parrainage ?',
    a: 'Partagez votre code unique à vos proches. Pour chaque filleul qui effectue son premier dépôt, vous recevez un bonus directement sur votre compte.',
  },
  {
    q: 'Puis-je avoir plusieurs objectifs d\'épargne ?',
    a: 'Oui, vous pouvez créer autant d\'objectifs que vous souhaitez : maison, voiture, études, vacances... Chaque objectif suit sa progression indépendamment.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="py-24 bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <span className="text-lime font-bold text-sm uppercase tracking-widest">FAQ</span>
          <h2 className="text-4xl font-black text-navy mt-2">Questions fréquentes</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-navy text-sm pr-4">{faq.q}</span>
                <ChevronDown
                  size={18}
                  className={`text-gray-400 shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-gray-500 text-sm leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
