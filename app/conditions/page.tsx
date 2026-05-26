import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Epargn+",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-navy text-sm mb-8 transition-colors">
          <ArrowLeft size={16} /> Retour à l&apos;accueil
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-navy rounded-xl flex items-center justify-center">
            <span className="text-lime font-black text-sm">E+</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-navy">Conditions d&apos;utilisation</h1>
            <p className="text-gray-400 text-sm">Dernière mise à jour : mai 2025</p>
          </div>
        </div>

        <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-6 text-gray-600">
          <section>
            <h2 className="text-navy font-bold text-lg mb-2">1. Acceptation des conditions</h2>
            <p>En utilisant l&apos;application Epargn+, vous acceptez les présentes conditions d&apos;utilisation. Si vous n&apos;acceptez pas ces conditions, veuillez ne pas utiliser l&apos;application.</p>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">2. Description du service</h2>
            <p>Epargn+ est une application mobile d&apos;épargne permettant aux résidents de Guinée de :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Déposer et retirer des fonds via Mobile Money (Orange Money, MTN)</li>
              <li>Créer et gérer des objectifs d&apos;épargne personnalisés</li>
              <li>Suivre l&apos;historique de leurs transactions</li>
              <li>Bénéficier d&apos;un programme de parrainage</li>
            </ul>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">3. Éligibilité</h2>
            <p>Pour utiliser Epargn+, vous devez :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Avoir au moins 18 ans ou l&apos;âge légal de la majorité en Guinée</li>
              <li>Disposer d&apos;un numéro de téléphone guinéen valide</li>
              <li>Fournir des informations exactes lors de l&apos;inscription</li>
            </ul>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">4. Compte utilisateur</h2>
            <p>Vous êtes responsable de la confidentialité de votre code PIN. Toute activité effectuée depuis votre compte est de votre responsabilité. Signalez immédiatement tout accès non autorisé à <a href="mailto:security@epargnplus.com" className="text-navy underline">security@epargnplus.com</a>.</p>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">5. Transactions</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Les transactions sont traitées sous réserve de disponibilité des services des opérateurs Mobile Money</li>
              <li>Epargn+ n&apos;est pas responsable des délais ou échecs liés aux opérateurs tiers</li>
              <li>Tout dépôt est crédité après confirmation de l&apos;opérateur</li>
              <li>Les retraits sont soumis à des délais de traitement pouvant aller jusqu&apos;à 2 minutes en conditions normales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">6. Utilisation interdite</h2>
            <p>Il est interdit d&apos;utiliser Epargn+ pour :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Toute activité illégale ou frauduleuse</li>
              <li>Le blanchiment d&apos;argent ou le financement du terrorisme</li>
              <li>L&apos;usurpation d&apos;identité</li>
              <li>Tenter de contourner les mesures de sécurité</li>
            </ul>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">7. Limitation de responsabilité</h2>
            <p>Epargn+ ne saurait être tenu responsable des pertes indirectes, accessoires ou consécutives résultant de l&apos;utilisation de l&apos;application, notamment en cas de défaillance technique, de force majeure ou de faute de tiers.</p>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">8. Modification des conditions</h2>
            <p>Nous nous réservons le droit de modifier ces conditions à tout moment. Les modifications seront notifiées via l&apos;application. L&apos;utilisation continue de l&apos;application après notification vaut acceptation des nouvelles conditions.</p>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">9. Droit applicable</h2>
            <p>Les présentes conditions sont régies par le droit guinéen. Tout litige sera soumis aux tribunaux compétents de Conakry, Guinée.</p>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">10. Contact</h2>
            <p><a href="mailto:contact@epargnplus.com" className="text-navy underline">contact@epargnplus.com</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
