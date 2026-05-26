import { Mail, MessageCircle, MapPin } from 'lucide-react'

export default function Contact() {
  return (
    <section id="contact" className="py-24 bg-[#F5F5F7]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="text-lime font-bold text-sm uppercase tracking-widest">Support</span>
          <h2 className="text-4xl font-black text-navy mt-2">Contactez-nous</h2>
          <p className="text-gray-500 mt-3">Notre équipe est disponible du lundi au vendredi, 8h–18h (heure de Conakry)</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: Mail,
              title: 'Email',
              desc: 'Réponse sous 24h',
              value: 'contact@epargnplus.com',
              href: 'mailto:contact@epargnplus.com',
              color: 'bg-blue-50 text-blue-500',
            },
            {
              icon: MessageCircle,
              title: 'WhatsApp',
              desc: 'Réponse rapide',
              value: '+224 620 000 000',
              href: 'https://wa.me/224620000000',
              color: 'bg-green-50 text-green-600',
            },
            {
              icon: MapPin,
              title: 'Adresse',
              desc: 'Siège social',
              value: 'Conakry, Guinée',
              href: '#',
              color: 'bg-lime/10 text-navy',
            },
          ].map((c) => (
            <a
              key={c.title}
              href={c.href}
              className="bg-white rounded-2xl p-6 hover:shadow-lg transition-shadow group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${c.color}`}>
                <c.icon size={22} />
              </div>
              <h3 className="font-bold text-navy mb-0.5">{c.title}</h3>
              <p className="text-gray-400 text-xs mb-2">{c.desc}</p>
              <p className="text-navy text-sm font-medium group-hover:underline">{c.value}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
