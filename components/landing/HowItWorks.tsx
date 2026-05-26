const steps = [
  {
    num: '01',
    title: 'Créez votre compte',
    desc: 'Entrez votre numéro de téléphone guinéen. Recevez un code OTP par SMS. Configurez votre PIN sécurisé.',
  },
  {
    num: '02',
    title: 'Alimentez votre compte',
    desc: 'Sélectionnez Orange Money ou MTN, entrez le montant. La transaction s\'effectue en quelques secondes.',
  },
  {
    num: '03',
    title: 'Épargnez et atteignez vos objectifs',
    desc: 'Créez des objectifs d\'épargne, suivez votre progression et retirez quand vous le souhaitez.',
  },
]

export default function HowItWorks() {
  return (
    <section id="comment" className="py-24 bg-navy">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-lime font-bold text-sm uppercase tracking-widest">Processus</span>
          <h2 className="text-4xl font-black text-white mt-2 mb-4">
            Comment ça marche ?
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            En 3 étapes simples, commencez à épargner pour votre avenir.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-0.5 bg-lime/20" />

          {steps.map((step, i) => (
            <div key={step.num} className="relative text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-lime text-navy font-black text-xl mb-6">
                {step.num}
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-lime/10" />
              )}
              <h3 className="text-white font-bold text-xl mb-3">{step.title}</h3>
              <p className="text-white/50 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
