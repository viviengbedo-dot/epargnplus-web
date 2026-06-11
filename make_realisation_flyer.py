#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère le flyer client « Vous épargnez, nous réalisons » (Accompagnement Koutouki).
Sortie : public/realisation-flyer.pdf  (A4 portrait, charte navy/lime Epargn+).
Sans emoji (non rendus par les polices PDF standard) : pictos vectoriels + pastilles.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

NAVY   = HexColor("#0B1566")
NAVY2  = HexColor("#1D2D8A")
LIME   = HexColor("#C8E600")
INK    = HexColor("#1A1A2E")
MUTE   = HexColor("#6B7280")
WHITE  = HexColor("#FFFFFF")
GREEN  = HexColor("#059669")
BLUE   = HexColor("#2563EB")
PURPLE = HexColor("#7C3AED")
LIGHT  = HexColor("#F2F2F7")

W, H = A4
M = 40  # marge

c = canvas.Canvas("public/realisation-flyer.pdf", pagesize=A4)
c.setTitle("Epargn+ — Vous épargnez, nous réalisons")


def wrap(text, font, size, max_w):
    return simpleSplit(text, font, size, max_w)


def para(x, y, text, font, size, color, max_w, leading):
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap(text, font, size, max_w):
        c.drawString(x, y, line)
        y -= leading
    return y


# ── EN-TÊTE (bandeau navy) ──
hdr_h = 92
c.setFillColor(NAVY)
c.rect(0, H - hdr_h, W, hdr_h, fill=1, stroke=0)
# logo : demi-cercle stylisé + nom
c.setFillColor(LIME)
c.circle(M + 12, H - hdr_h / 2 + 2, 11, fill=1, stroke=0)
c.setFillColor(NAVY)
c.rect(M, H - hdr_h / 2 - 11, 24, 13, fill=1, stroke=0)
c.setFont("Helvetica-Bold", 22)
c.setFillColor(WHITE)
c.drawString(M + 34, H - hdr_h / 2 - 4, "Epargn")
wname = c.stringWidth("Epargn", "Helvetica-Bold", 22)
c.setFillColor(LIME)
c.drawString(M + 34 + wname, H - hdr_h / 2 - 4, "+")
c.setFont("Helvetica", 9)
c.setFillColor(HexColor("#A5B4FC"))
c.drawRightString(W - M, H - hdr_h / 2 - 2, "une marque de Koutouki Express")

y = H - hdr_h - 40

# ── TITRE PRINCIPAL ──
c.setFont("Helvetica-Bold", 30)
c.setFillColor(NAVY)
c.drawString(M, y, "Vous épargnez.")
y -= 34
c.setFillColor(GREEN)
c.drawString(M, y, "Nous réalisons.")
y -= 30

# sous-titre
y = para(M, y,
         "Epargn+ ne s'arrête pas à l'épargne. Avec Koutouki Express, notre maison-mère, "
         "votre projet est concrètement réalisé pour vous — intelligemment et par anticipation, "
         "sans que vous ayez à chercher, comparer ou négocier vous-même.",
         "Helvetica", 11.5, MUTE, W - 2 * M, 16)
y -= 14

# ── 3 BRANCHES (cartes) ──
card_w = (W - 2 * M - 2 * 12) / 3
card_h = 92
cx = M
branches = [
    (GREEN,  "I", "Koutouki Immo",    "Terrain, parcelle, logement identifié et sécurisé selon votre budget."),
    (BLUE,   "V", "Koutouki Travel",  "Billet, visa, séjour : meilleures offres trouvées et réservées au bon moment."),
    (PURPLE, "C", "Koutouki Express", "Achat et import : prix, transport et douane vérifiés avant commande."),
]
for col, letter, title, desc in branches:
    c.setFillColor(LIGHT)
    c.roundRect(cx, y - card_h, card_w, card_h, 10, fill=1, stroke=0)
    c.setFillColor(col)
    c.circle(cx + 20, y - 22, 12, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(cx + 20, y - 26, letter)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(cx + 38, y - 26, title)
    c.setFont("Helvetica", 8.3)
    c.setFillColor(MUTE)
    ty = y - 44
    for line in wrap(desc, "Helvetica", 8.3, card_w - 24):
        c.drawString(cx + 12, ty, line)
        ty -= 11
    cx += card_w + 12
y -= card_h + 26

# ── PARCOURS EN 4 ÉTAPES ──
c.setFont("Helvetica-Bold", 13)
c.setFillColor(NAVY)
c.drawString(M, y, "Comment ça marche")
y -= 22
steps = [
    ("1", "Vous épargnez", "Vous fixez votre objectif et l'alimentez via Mobile Money, à votre rythme."),
    ("2", "Dès 60 %, on vous propose", "Votre projet devient éligible : notre équipe vient vers vous, de manière anticipée."),
    ("3", "On vérifie les vrais prix", "Prix réels du marché, frais inclus — confirmés avant toute action. Rien sans votre accord."),
    ("4", "À 100 %, c'est réalisé", "Vous validez, nous réalisons. Le bien, le voyage ou l'article vous revient."),
]
for num, title, desc in steps:
    c.setFillColor(NAVY)
    c.circle(M + 12, y - 6, 12, fill=1, stroke=0)
    c.setFillColor(LIME)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(M + 12, y - 10, num)
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(M + 34, y - 4, title)
    c.setFillColor(MUTE)
    c.setFont("Helvetica", 9.5)
    ty = y - 18
    for line in wrap(desc, "Helvetica", 9.5, W - 2 * M - 34):
        c.drawString(M + 34, ty, line)
        ty -= 12
    y = ty - 8

y -= 4

# ── EXEMPLES CHIFFRÉS (encadré) ──
ex_h = 116
c.setFillColor(HexColor("#ECFDF5"))
c.roundRect(M, y - ex_h, W - 2 * M, ex_h, 12, fill=1, stroke=0)
c.setFillColor(GREEN)
c.setFont("Helvetica-Bold", 11)
c.drawString(M + 16, y - 22, "Concrètement, ça donne quoi ?")
examples = [
    ("Terrain à Dubréka", "objectif 60 000 000 GNF", "dès 36 000 000 GNF (60 %) : parcelles présentées, titres vérifiés."),
    ("Voyage Conakry - Paris", "objectif 12 000 000 GNF", "dès 7 200 000 GNF (60 %) : vols + hébergement comparés au meilleur prix."),
    ("Moto neuve importée", "objectif 15 000 000 GNF", "dès 9 000 000 GNF (60 %) : prix réel (+ transport + douane) confirmé."),
]
ey = y - 40
for title, obj, desc in examples:
    c.setFillColor(NAVY)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(M + 16, ey, title + "  ")
    tw = c.stringWidth(title + "  ", "Helvetica-Bold", 9.5)
    c.setFillColor(MUTE)
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(M + 16 + tw, ey, "(" + obj + ")")
    c.setFillColor(HexColor("#166534"))
    c.setFont("Helvetica", 9)
    c.drawString(M + 16, ey - 12, desc)
    ey -= 25
y -= ex_h + 6
c.setFillColor(MUTE)
c.setFont("Helvetica-Oblique", 7.5)
c.drawString(M, y, "Montants donnés à titre d'exemple : vous fixez votre objectif ; les prix réels sont toujours vérifiés avant toute action.")

# ── PIED DE PAGE (CTA navy) ──
ft_h = 78
c.setFillColor(NAVY)
c.rect(0, 0, W, ft_h, fill=1, stroke=0)
c.setFillColor(WHITE)
c.setFont("Helvetica-Bold", 14)
c.drawCentredString(W / 2, ft_h - 26, "Ouvrez votre compte gratuitement")
c.setFillColor(LIME)
c.setFont("Helvetica-Bold", 13)
c.drawCentredString(W / 2, ft_h - 44, "www.epargnplus.com")
c.setFillColor(HexColor("#A5B4FC"))
c.setFont("Helvetica", 9)
c.drawCentredString(W / 2, ft_h - 60,
                    "WhatsApp +224 623 76 96 34  -  Service optionnel, rien d'engagé sans votre accord (CGU §6)")

c.showPage()
c.save()
print("OK -> public/realisation-flyer.pdf")
