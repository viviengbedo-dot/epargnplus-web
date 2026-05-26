import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Epargn+',
}

export default function PrivacyPage() {
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
            <h1 className="text-2xl font-black text-navy">Politique de confidentialité</h1>
            <p className="text-gray-400 text-sm">Dernière mise à jour : mai 2025</p>
          </div>
        </div>

        <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-6 text-gray-600">
          <section>
            <h2 className="text-navy font-bold text-lg mb-2">1. Introduction</h2>
            <p>Epargn+ (&quot;nous&quot;, &quot;notre&quot;) s&apos;engage à protéger la vie privée de ses utilisateurs. Cette politique décrit comment nous collectons, utilisons et protégeons vos données personnelles conformément aux lois applicables en République de Guinée.</p>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">2. Données collectées</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Numéro de téléphone</strong> : utilisé pour l&apos;identification et la réception des codes OTP</li>
              <li><strong>Nom complet</strong> : fourni volontairement lors de la configuration du profil</li>
              <li><strong>Données de transaction</strong> : montants, opérateurs, dates des dépôts et retraits</li>
              <li><strong>Documents KYC</strong> : pièce d&apos;identité et selfie pour la vérification d&apos;identité</li>
              <li><strong>Données d&apos;utilisation</strong> : interactions avec l&apos;application à des fins d&apos;amélioration du service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">3. Utilisation des données</h2>
            <p>Vos données sont utilisées exclusivement pour :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Fournir et améliorer nos services d&apos;épargne mobile</li>
              <li>Vérifier votre identité conformément aux réglementations financières</li>
              <li>Vous envoyer des notifications relatives à votre compte</li>
              <li>Prévenir la fraude et assurer la sécurité</li>
              <li>Respecter nos obligations légales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">4. Protection des données</h2>
            <p>Nous mettons en œuvre des mesures de sécurité adaptées, notamment :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Chiffrement de toutes les données en transit (HTTPS/TLS)</li>
              <li>Stockage sécurisé des mots de passe et codes PIN (hachage bcrypt)</li>
              <li>Accès restreint aux données personnelles par notre équipe</li>
              <li>Authentification à deux facteurs pour l&apos;accès au compte</li>
            </ul>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">5. Partage des données</h2>
            <p>Nous ne vendons jamais vos données personnelles. Nous partageons uniquement les informations nécessaires avec :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Opérateurs Mobile Money</strong> (Orange, MTN) : pour traiter vos transactions</li>
              <li><strong>Prestataires SMS</strong> (AfricasTalking) : pour l&apos;envoi des codes OTP</li>
              <li><strong>Autorités compétentes</strong> : uniquement sur demande légale formelle</li>
            </ul>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">6. Conservation des données</h2>
            <p>Vos données sont conservées pendant la durée de votre relation avec Epargn+, puis archivées pendant 5 ans conformément aux obligations légales financières guinéennes.</p>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">7. Vos droits</h2>
            <p>Vous disposez des droits suivants sur vos données :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Accès à vos données personnelles</li>
              <li>Rectification des informations inexactes</li>
              <li>Suppression de votre compte et de vos données</li>
              <li>Portabilité de vos données</li>
            </ul>
            <p className="mt-2">Pour exercer ces droits, contactez-nous à <a href="mailto:privacy@epargnplus.com" className="text-navy underline">privacy@epargnplus.com</a>.</p>
          </section>

          <section>
            <h2 className="text-navy font-bold text-lg mb-2">8. Contact</h2>
            <p>Pour toute question relative à cette politique, contactez notre délégué à la protection des données :<br />
            <a href="mailto:privacy@epargnplus.com" className="text-navy underline">privacy@epargnplus.com</a></p>
          </section>
        </div>
      </div>
    </div>
  )
}
