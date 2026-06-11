# -*- coding: utf-8 -*-
"""Epargn+ — Génération des affiches de rappel (PNG + PDF).
Usage : python3 generate_affiches.py
Sortie : marketing/affiches/*.png + affiches-epargnplus.pdf
"""
import os, io
import cairosvg
from pypdf import PdfWriter, PdfReader

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, "affiches")
os.makedirs(OUT, exist_ok=True)

W, H = 1080, 1350
NAVY, NAVY2, ACCENT = "#0B1566", "#060D45", "#C8E000"

POSTERS = [
    dict(slug="01-premier-depot", chip="DÉMARRAGE", emoji="🚀", pct=4,
         title=["Le premier pas", "est le plus", "important."],
         sub=["Un objectif sans premier dépôt reste un rêve.",
              "Avec un premier dépôt, il devient un plan.",
              "Peu importe le montant — commencez aujourd'hui."],
         cta="Faites votre premier dépôt"),
    dict(slug="02-plus-a-zero", chip="ÉLAN · 1–25 %", emoji="💪", pct=18,
         title=["Vous n'êtes", "plus à zéro."],
         sub=["Regardez votre jauge : elle n'est plus vide.",
              "Le plus dur est fait — vous avez commencé.",
              "Un dépôt cette semaine garde l'élan."],
         cta="Continuez sur votre lancée"),
    dict(slug="03-methode-fonctionne", chip="MI-PARCOURS · 25–50 %", emoji="📈", pct=38,
         title=["La méthode", "fonctionne.", "Répétez-la."],
         sub=["Vous avez épargné sans que votre vie ne change.",
              "La preuve est dans votre jauge.",
              "Refaites cette semaine ce qui a déjà marché."],
         cta="Faites le dépôt de la semaine"),
    dict(slug="04-plus-dur-derriere", chip="CAP FRANCHI · 50 %+", emoji="⛰️", pct=62,
         title=["Le plus dur est", "derrière vous."],
         sub=["Il reste moins à épargner que ce que",
              "vous avez déjà épargné.",
              "La descente est toujours plus facile."],
         cta="Accélérez vos dépôts"),
    dict(slug="05-derniere-ligne-droite", chip="DERNIÈRE LIGNE DROITE · 75 %+", emoji="🔥", pct=85,
         title=["Si proche que", "ce serait dommage", "de s'arrêter."],
         sub=["Abandonner maintenant, c'est perdre la victoire",
              "qui est déjà presque à vous.",
              "Finissez en beauté."],
         cta="Terminez votre objectif"),
    dict(slug="06-reprendre-aujourdhui", chip="ON REPREND ?", emoji="🌱", pct=45,
         title=["Le meilleur jour", "pour reprendre,", "c'est aujourd'hui."],
         sub=["Votre projet vous attend patiemment,",
              "exactement là où vous l'avez laissé.",
              "Pas de culpabilité — juste un dépôt, même petit."],
         cta="Reprenez en 2 minutes"),
    dict(slug="07-epargne-collective", chip="ÉPARGNE COLLECTIVE", emoji="👥", pct=57,
         title=["On épargne", "mieux ensemble."],
         sub=["Chaque dépôt encourage les autres membres.",
              "Soyez celui qui donne l'exemple cette semaine —",
              "l'équipe finit ensemble."],
         cta="Faites avancer l'équipe"),
    dict(slug="08-mise-du-mois", chip="RENDEZ-VOUS MENSUEL", emoji="📌", pct=70,
         title=["Votre mise", "du mois", "vous attend."],
         sub=["Vous avez un plan. Les plans qui réussissent",
              "sont ceux qu'on respecte mois après mois.",
              "2 minutes suffisent."],
         cta="Déposez votre mise"),
]

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def svg_poster(p):
    title_y0 = 470
    title = "".join(
        f'<text x="90" y="{title_y0 + i*96}" font-family="DejaVu Sans" font-size="84" font-weight="bold" fill="#FFFFFF">{esc(l)}</text>'
        for i, l in enumerate(p["title"]))
    sub_y0 = title_y0 + len(p["title"]) * 96 + 40
    sub = "".join(
        f'<text x="90" y="{sub_y0 + i*46}" font-family="DejaVu Sans" font-size="31" fill="#C9D2FF">{esc(l)}</text>'
        for i, l in enumerate(p["sub"]))
    bar_y = sub_y0 + len(p["sub"]) * 46 + 70
    bar_w = 900
    fill_w = int(bar_w * p["pct"] / 100)
    cta_y = bar_y + 90
    cta_w = 60 + len(p["cta"]) * 19
    return f'''<svg width="{W}" height="{H}" viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{NAVY}"/><stop offset="1" stop-color="{NAVY2}"/>
    </linearGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#bg)"/>
  <circle cx="1010" cy="80" r="230" fill="{ACCENT}" opacity="0.08"/>
  <circle cx="60" cy="1290" r="190" fill="{ACCENT}" opacity="0.06"/>
  <circle cx="950" cy="1180" r="120" fill="#FFFFFF" opacity="0.04"/>

  <!-- Logotype -->
  <text x="90" y="150" font-family="DejaVu Sans" font-size="56" font-weight="bold" fill="#FFFFFF">Epargn<tspan fill="{ACCENT}">+</tspan></text>
  <text x="90" y="192" font-family="DejaVu Sans" font-size="24" fill="#8A93C9">Épargnez à votre rythme, atteignez vos objectifs</text>

  <!-- Chip biais/palier -->
  <rect x="90" y="280" rx="26" ry="26" width="{56 + len(p["chip"]) * 19}" height="52" fill="{ACCENT}" opacity="0.16"/>
  <text x="{90 + (56 + len(p["chip"]) * 19) / 2}" y="314" text-anchor="middle" font-family="DejaVu Sans" font-size="26" font-weight="bold" fill="{ACCENT}" letter-spacing="2">{esc(p["chip"])}</text>
  <circle cx="940" cy="300" r="34" fill="none" stroke="{ACCENT}" stroke-width="5" opacity="0.85"/>
  <circle cx="940" cy="300" r="12" fill="{ACCENT}"/>

  {title}
  {sub}

  <!-- Jauge de progression -->
  <rect x="90" y="{bar_y}" rx="14" ry="14" width="{bar_w}" height="28" fill="#FFFFFF" opacity="0.12"/>
  <rect x="90" y="{bar_y}" rx="14" ry="14" width="{fill_w}" height="28" fill="{ACCENT}"/>
  <text x="{90 + fill_w + 18}" y="{bar_y + 23}" font-family="DejaVu Sans" font-size="28" font-weight="bold" fill="{ACCENT}">{p["pct"]} %</text>

  <!-- CTA -->
  <rect x="90" y="{cta_y}" rx="36" ry="36" width="{cta_w}" height="84" fill="{ACCENT}"/>
  <text x="{90 + cta_w / 2}" y="{cta_y + 54}" text-anchor="middle" font-family="DejaVu Sans" font-size="32" font-weight="bold" fill="{NAVY}">{esc(p["cta"])}</text>

  <!-- Footer -->
  <rect x="0" y="{H - 110}" width="{W}" height="110" fill="#000000" opacity="0.18"/>
  <text x="90" y="{H - 44}" font-family="DejaVu Sans" font-size="30" font-weight="bold" fill="#FFFFFF">epargnplus.com</text>
  <text x="{W - 90}" y="{H - 44}" text-anchor="end" font-family="DejaVu Sans" font-size="26" fill="#8A93C9">Dépôt sécurisé par Mobile Money</text>
</svg>'''

pdf_pages = []
for p in POSTERS:
    svg = svg_poster(p)
    png_path = os.path.join(OUT, p["slug"] + ".png")
    cairosvg.svg2png(bytestring=svg.encode(), write_to=png_path, output_width=W, output_height=H)
    pdf_pages.append(cairosvg.svg2pdf(bytestring=svg.encode()))
    print("OK", png_path)

writer = PdfWriter()
for data in pdf_pages:
    writer.add_page(PdfReader(io.BytesIO(data)).pages[0])
pdf_path = os.path.join(OUT, "affiches-epargnplus.pdf")
with open(pdf_path, "wb") as f:
    writer.write(f)
print("OK", pdf_path)
