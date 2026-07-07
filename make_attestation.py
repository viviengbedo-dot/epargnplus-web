#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère l'attestation d'affiliation Koutouki Express -> Epargn+ (pour Google Play).
Sortie : legal/attestation-koutouki-epargnplus.pdf (A4, bilingue FR/EN, à signer).
Placeholders à compléter : numéro D-U-N-S, date, fonction, signature.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

INK   = HexColor("#111111")
GREY  = HexColor("#555555")
LINE  = HexColor("#CCCCCC")
NAVY  = HexColor("#0B1566")

W, H = A4
M = 56

os.makedirs("legal", exist_ok=True)
c = canvas.Canvas("legal/attestation-koutouki-epargnplus.pdf", pagesize=A4)
c.setTitle("Attestation d'affiliation - Koutouki Express / Epargn+")

y = H - M

# ── En-tête société ──
c.setFillColor(INK)
c.setFont("Helvetica-Bold", 20)
c.drawString(M, y, "KOUTOUKI EXPRESS")
y -= 16
c.setFont("Helvetica", 9.5)
c.setFillColor(GREY)
c.drawString(M, y, "Personal Shopping & Transit International")
y -= 12
c.drawString(M, y, "Conakry, République de Guinée")
y -= 12
c.drawString(M, y, "koutoukiexpress.com  ·  ceo@epargnplus.com  ·  +224 623 76 96 34")
y -= 14
c.setStrokeColor(LINE)
c.setLineWidth(1)
c.line(M, y, W - M, y)
y -= 26

# ── Titre ──
c.setFillColor(NAVY)
c.setFont("Helvetica-Bold", 14)
c.drawCentredString(W / 2, y, "ATTESTATION D'AFFILIATION")
y -= 15
c.setFont("Helvetica", 10)
c.setFillColor(GREY)
c.drawCentredString(W / 2, y, "Certificate of Affiliation")
y -= 24


def para(text, font="Helvetica", size=10.5, color=INK, lead=15, gap=8, indent=0):
    global y
    c.setFont(font, size)
    c.setFillColor(color)
    for line in simpleSplit(text, font, size, W - 2 * M - indent):
        c.drawString(M + indent, y, line)
        y -= lead
    y -= gap


# ── Corps FR ──
c.setFont("Helvetica-Bold", 10.5); c.setFillColor(INK)
c.drawString(M, y, "Français"); y -= 16
para("Nous soussignés, KOUTOUKI EXPRESS, société enregistrée à Conakry, République de Guinée, "
     "certifions par la présente que :")
para("EPARGN+ (site web : www.epargnplus.com) est une marque et un service numérique détenus et "
     "exploités par KOUTOUKI EXPRESS. Epargn+ est une filiale et un produit de notre société, et ne "
     "constitue pas une entité juridique distincte.")
para("Le numéro D-U-N-S :  [ ______________________ ]  est celui de KOUTOUKI EXPRESS, entité "
     "juridique responsable et titulaire du produit Epargn+.")
para("En conséquence, nous demandons que les informations d'entreprise et le numéro D-U-N-S de "
     "KOUTOUKI EXPRESS soient acceptés pour la vérification du compte développeur et la publication "
     "de l'application Epargn+ sur Google Play.")

y -= 4
c.setStrokeColor(LINE); c.line(M, y, W - M, y); y -= 20

# ── Corps EN ──
c.setFont("Helvetica-Bold", 10.5); c.setFillColor(INK)
c.drawString(M, y, "English"); y -= 16
para("We, the undersigned, KOUTOUKI EXPRESS, a company registered in Conakry, Republic of Guinea, "
     "hereby certify that:")
para("EPARGN+ (website: www.epargnplus.com) is a brand and digital service owned and operated by "
     "KOUTOUKI EXPRESS. Epargn+ is a subsidiary and product of our company and is not a separate "
     "legal entity.")
para("The D-U-N-S number:  [ ______________________ ]  belongs to KOUTOUKI EXPRESS, the legal entity "
     "responsible for and owner of the Epargn+ product.")
para("We therefore request that the company information and D-U-N-S number of KOUTOUKI EXPRESS be "
     "accepted for developer account verification and publication of the Epargn+ application on Google Play.")

# ── Bloc signature ──
y -= 6
c.setFillColor(INK); c.setFont("Helvetica", 10.5)
c.drawString(M, y, "Fait à Conakry, le  ______________________         /  Done in Conakry, on  ______________________")
y -= 30
c.drawString(M, y, "Nom du représentant légal / Legal representative :  Ulrich-Diel GBEDO")
y -= 20
c.drawString(M, y, "Fonction / Title :  ______________________")
y -= 34
c.drawString(M, y, "Signature et cachet / Signature and stamp :")
c.setStrokeColor(INK); c.line(M + 240, y, W - M, y)

c.showPage()
c.save()
print("OK -> legal/attestation-koutouki-epargnplus.pdf")
