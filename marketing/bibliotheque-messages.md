# Epargn+ — Bibliothèque de messages de rappel

Messages d'incitation au dépôt, classés par **biais psychologique** et **palier de progression** du projet.
Variables : `{prenom}` `{projet}` `{pct}` `{actuel}` `{cible}` `{restant}` `{mise}` `{jours}` `{membres}` — montants en GNF.

Canaux : **Push** ≤ 90 caractères · **SMS** ≤ 160 caractères · **Broadcast** (in-app, plus long).

> **Règle d'or** : tous les chiffres affichés (progression, membres, jours) sont réels, tirés des données du client. Jamais de fausse urgence ni de fausse preuve sociale — la confiance est l'actif n°1 d'une app d'épargne.

---

## 1. Palier 0 % — Projet créé, aucun dépôt

**Biais : effet de simple démarrage + coût d'opportunité**

| Canal | Message |
|---|---|
| Push | 🚀 {projet} attend son premier dépôt. Le 1er pas est le plus important ! |
| SMS | {prenom}, votre projet « {projet} » est prêt. Même 5 000 GNF aujourd'hui valent mieux que 50 000 « un jour ». Déposez maintenant sur Epargn+. |
| Broadcast | Un objectif sans premier dépôt reste un rêve. Un objectif avec un premier dépôt devient un plan. Lancez « {projet} » aujourd'hui — peu importe le montant. |

**Biais : intention d'implémentation**

| Canal | Message |
|---|---|
| Push | 📅 Choisissez VOTRE jour de dépôt pour {projet}. Lundi ? Jour de paie ? |
| SMS | Les épargnants qui fixent un jour précis de dépôt atteignent leur objectif bien plus souvent. Quel sera votre jour pour « {projet} » ? |

---

## 2. Palier 1–25 % — Élan à protéger

**Biais : progrès doté (endowed progress)**

| Canal | Message |
|---|---|
| Push | 💪 Vous avez déjà {pct}% de {projet}. Vous n'êtes plus à zéro ! |
| SMS | {prenom}, {actuel} GNF déjà épargnés sur « {projet} ». Le plus dur est fait : vous avez commencé. Un dépôt cette semaine garde l'élan. |
| Broadcast | Regardez votre jauge : elle n'est plus vide. Ces {actuel} GNF sont la preuve que vous en êtes capable. Le prochain dépôt rendra la jauge encore plus belle. |

**Biais : cohérence avec l'engagement**

| Canal | Message |
|---|---|
| Push | 🤝 Vous vous étiez promis {cible} GNF pour {projet}. On continue ? |
| SMS | Le {prenom} qui a créé « {projet} » avait une bonne raison. Restez fidèle à cette version de vous-même : un dépôt aujourd'hui. |

---

## 3. Palier 25–50 % — Milieu de parcours

**Biais : ancrage sur le chemin parcouru**

| Canal | Message |
|---|---|
| Push | 📈 {pct}% de {projet} déjà épargnés. Vous avez prouvé que ça marche. |
| SMS | {actuel} GNF épargnés sans que votre vie ne change. La méthode fonctionne — répétez-la cette semaine sur « {projet} ». |

**Biais : effet « fresh start »** (à envoyer en début de mois/semaine)

| Canal | Message |
|---|---|
| Push | 🌅 Nouveau mois, nouvelle page. Premier dépôt du mois pour {projet} ? |
| SMS | Un nouveau mois commence : le moment parfait pour reprendre de bonnes habitudes. Ouvrez Epargn+ et faites le premier dépôt du mois sur « {projet} ». |

---

## 4. Palier 50–75 % — Plus près de la fin que du début

**Biais : effet de gradient d'objectif** (l'effort augmente près du but)

| Canal | Message |
|---|---|
| Push | ⛰️ Plus que {restant} GNF pour {projet}. La descente est plus facile ! |
| SMS | {prenom}, vous avez dépassé la moitié de « {projet} » ({pct}%). Il reste moins à épargner que ce que vous avez déjà épargné. Accélérez ! |
| Broadcast | Mathématiquement, le plus dur est derrière vous : {actuel} GNF épargnés, {restant} GNF restants. Chaque dépôt compte désormais double dans votre tête — profitez-en. |

---

## 5. Palier 75–99 % — Dernière ligne droite

**Biais : aversion à la perte** (perdre un progrès acquis pèse plus que gagner)

| Canal | Message |
|---|---|
| Push | 🔥 {pct}% de {projet} ! Ne laissez pas ces {actuel} GNF d'efforts inachevés. |
| SMS | Abandonner à {pct}%, c'est perdre la victoire qui est déjà presque à vous. Plus que {restant} GNF sur « {projet} ». Finissez en beauté. |

**Biais : gradient d'objectif + projection**

| Canal | Message |
|---|---|
| Push | 🏁 {restant} GNF et {projet} est à vous. Vous y êtes presque ! |
| SMS | À votre rythme actuel, « {projet} » peut être terminé ce mois-ci. Imaginez la notification « Objectif atteint 🏆 ». Un dépôt vous en rapproche. |

---

## 6. 100 % — Objectif atteint (fidélisation)

**Biais : pic-fin + élan du succès**

| Canal | Message |
|---|---|
| Push | 🏆 {projet} : objectif atteint ! Quel sera votre prochain défi ? |
| SMS | Félicitations {prenom} ! {cible} GNF épargnés sur « {projet} ». Vous savez maintenant que vous en êtes capable. Créez votre prochain projet pendant que l'élan est là. |

---

## 7. Inactivité / retard de mise

**7–13 jours — Biais : saillance de l'habitude**

| Canal | Message |
|---|---|
| Push | 👋 {projet} ne vous a pas vu depuis {jours} jours. Un petit dépôt ? |
| SMS | {prenom}, cela fait {jours} jours sans dépôt sur « {projet} ». Une habitude se garde en la pratiquant — même 5 000 GNF suffisent à la maintenir. |

**14–29 jours — Biais : aversion à la perte (l'élan)**

| Canal | Message |
|---|---|
| Push | ⏳ {jours} jours sans dépôt. Votre élan sur {projet} mérite mieux ! |
| SMS | Vos {actuel} GNF sur « {projet} » sont en sécurité, mais votre élan s'évapore. Reprenez avant que reprendre devienne difficile. |

**30 jours et + — Biais : fresh start + reformulation positive**

| Canal | Message |
|---|---|
| Push | 🌱 On repart de bon pied ? {projet} est toujours là, à {pct}%. |
| SMS | {prenom}, « {projet} » vous attend patiemment à {pct}%. Pas de culpabilité : le meilleur jour pour reprendre, c'est aujourd'hui. Un dépôt, même symbolique. |

**Retard de mise mensuelle — Biais : intention d'implémentation**

| Canal | Message |
|---|---|
| Push | 📌 Votre mise de {mise} GNF pour {projet} attend ce mois-ci. |
| SMS | Votre plan « {projet} » prévoit {mise} GNF/mois. La mise de ce mois n'est pas encore passée — 2 minutes suffisent sur Epargn+. |

---

## 8. Épargne collective

**Biais : preuve sociale** (uniquement si l'activité est réelle)

| Canal | Message |
|---|---|
| Push | 👥 Un membre vient de déposer sur {projet}. À votre tour ? |
| SMS | Ça bouge sur « {projet} » : vos coéquipiers ont déposé cette semaine. L'équipe est à {pct}% — votre dépôt fait avancer tout le monde. |

**Biais : responsabilité sociale / engagement public**

| Canal | Message |
|---|---|
| Push | 🤝 {membres} personnes comptent sur vous pour {projet}. |
| SMS | Dans une épargne collective, chaque dépôt encourage les autres. Soyez celui qui donne l'exemple cette semaine sur « {projet} ». |

**Biais : identité de groupe**

| Canal | Message |
|---|---|
| Push | 🏅 Votre équipe {projet} est à {pct}%. Les grandes équipes finissent ensemble. |

---

## 9. Calendrier d'envoi recommandé

| Déclencheur | Moment | Canal |
|---|---|---|
| Projet créé sans dépôt | J+1, J+3, J+7 | Push puis SMS |
| Palier franchi (25/50/75 %) | Immédiat | Push |
| Inactivité | J+7, J+14, J+30 | Push, Push, SMS |
| Retard de mise mensuelle | 5 jours après la date habituelle | Push |
| Fresh start | 1er du mois, lundi matin | Broadcast |
| Dépôt d'un membre (collectif) | Immédiat (max 1/jour) | Push |

**Plafond anti-lassitude : maximum 1 rappel par jour et 3 par semaine par utilisateur.**
