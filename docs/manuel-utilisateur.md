+6# Manuel d'utilisation — École SaaS

Guide pratique pour le personnel de l'établissement (administrateurs, secrétaires, enseignants). Il couvre l'usage courant de l'application, écran par écran.

## Sommaire

1. [Premiers pas](#1-premiers-pas)
2. [Verrouillage et connexion hors ligne](#2-verrouillage-et-connexion-hors-ligne)
3. [Tableau de bord](#3-tableau-de-bord)
4. [Élèves](#4-élèves)
5. [Parents](#5-parents)
6. [Classes et Niveaux](#6-classes-et-niveaux)
7. [Enseignants](#7-enseignants)
8. [Promotions (fin d'année)](#8-promotions-fin-dannée)
9. [Notes et bulletins](#9-notes-et-bulletins)
10. [Présences](#10-présences)
11. [Matières](#11-matières)
12. [Emploi du temps](#12-emploi-du-temps)
13. [Finances](#13-finances)
14. [Messagerie](#14-messagerie)
15. [Administration](#15-administration)
16. [Synchronisation et mode hors ligne](#16-synchronisation-et-mode-hors-ligne)
17. [Licence](#17-licence)
18. [Questions fréquentes](#18-questions-fréquentes)

---

## 1. Premiers pas

### Créer le compte de l'établissement

Sur l'écran d'accueil, cliquez sur **Créer un compte**. Renseignez :
- le nom de l'école,
- le prénom, nom et email de l'administrateur principal,
- un mot de passe (8 caractères minimum).

Un essai gratuit de 14 jours démarre automatiquement — aucun paiement n'est demandé à l'inscription (voir [Licence](#17-licence)).

### Se connecter

Retournez à l'écran de connexion, saisissez l'email et le mot de passe de l'administrateur.

### Configuration initiale (assistant)

Après la première connexion, un assistant en 3 étapes s'affiche :

1. **Bienvenue** — présentation des modules disponibles.
2. **Année scolaire** — nom de l'année (ex : *2026-2027*), dates de début/fin, et système de périodes (Trimestre, Semestre ou Bimestre). Un aperçu des périodes générées s'affiche selon le choix.
3. **Terminé** — l'application est prête.

Cet assistant ne se déclenche qu'une seule fois par établissement.

---

## 2. Verrouillage et connexion hors ligne

L'application se comporte comme un poste verrouillable, utile si plusieurs personnes partagent le même ordinateur :

- **Déconnexion** (bouton en bas de la barre latérale) **verrouille** l'application : l'écran de connexion réapparaît, avec l'email pré-rempli.
- Pour **redéverrouiller**, retapez votre mot de passe — cela fonctionne **même sans connexion internet**, à condition de vous être déjà connecté au moins une fois en ligne sur ce poste.
- Fermer et rouvrir l'application redemande aussi le mot de passe (sécurité en cas de vol/perte de l'appareil).
- Si vous êtes hors ligne et que le mot de passe saisi est incorrect, l'accès est refusé — il n'y a pas de contournement.

> Un autre compte (autre email) ne peut se connecter hors ligne que s'il s'est déjà connecté au moins une fois en ligne sur ce même poste.

---

## 3. Tableau de bord

Premier écran après connexion. Vue d'ensemble : effectifs, montants collectés/en attente/en retard (en Ariary), paiements récents, échéances proches.

---

## 4. Élèves

**École → Élèves**

- **Liste** : recherche, tri par colonne, pagination, suppression groupée.
- **Ajouter un élève** : identité, date/lieu de naissance, classe, informations médicales (groupe sanguin, allergies, contact d'urgence), photo.
- **Fiche élève** : onglets Informations, Notes, Présences, **Paiements** (encaissement direct avec mode de paiement : Espèces, Virement, Mobile money, Chèque), Documents.
- Un matricule (**numéro d'inscription**) unique est requis pour chaque élève.

---

## 5. Parents

**École → Parents**

Gestion des comptes parents et de leur lien avec un ou plusieurs élèves. Fiche détaillée par parent, formulaire de création/édition dédié.

---

## 6. Classes et Niveaux

**École → Classes** : création des classes (ex : *6ème A*), affectation à un niveau, effectif.

**École → Niveaux** : les niveaux scolaires (ex : *6ème*, *Terminale*) sont gérés ici — c'est la référence utilisée partout ailleurs (matières, frais, classes).

> Sur un établissement neuf, un bouton **« Créer les niveaux standards (Madagascar) »** apparaît tant qu'aucun niveau n'existe : il pré-remplit en un clic la nomenclature complète (T1 à T5 / CP à CM2, 6ème à Terminale), avec le passage automatique d'un niveau au suivant. Vous pouvez ensuite les modifier ou en ajouter.

---

## 7. Enseignants

**École → Enseignants**, avec 4 onglets :

- **Liste** : profils enseignants (spécialité, classes, matières affectées).
- **Présences** : suivi de présence des enseignants.
- **Paie** : contrats de rémunération (horaire, mensuel ou forfait), y compris les numéros **CNaPS** et **OSTIE** (obligatoires pour tout contrat de travail légal à Madagascar).
- **Contrats** : détail des contrats en cours.

---

## 8. Promotions (fin d'année)

**École → Promotions**, 4 onglets :

- **Délibération** : décision de passage par élève, selon les règles définies dans Notes (voir [§9](#9-notes-et-bulletins)) : Admis (moyenne ≥ 10), À délibérer (9,50 à 9,99), Redoublant (< 9,50).
- **Rentrée** (rollover) : prépare l'année scolaire suivante — fait passer les élèves admis au niveau supérieur.
- **Réinscription** : confirme l'inscription des élèves pour la nouvelle année (bloque les dossiers avec solde impayé).
- **Répartition** (dispatch) : affecte les élèves promus aux nouvelles classes.

---

## 9. Notes et bulletins

**Pédagogie → Notes**, 2 onglets :

### Onglet Notes
Saisie et consultation des notes (bouton **Saisie de notes**), filtrage par classe/matière/période, modification et suppression.

### Onglet Configuration
- **Types d'évaluation inclus** dans le calcul de la moyenne générale (interrogation, devoir, oral, projet, contrôle...) — chaque type peut être activé/désactivé. Les **Examens Blancs** peuvent être isolés (rapport séparé, hors moyenne générale).
- **Règles de promotion** : seuils de décision (rappelés ci-dessus).

> Le **coefficient** d'une matière se règle uniquement dans **Matières** (§11) — il n'y a plus de doublon ici.

### Bulletins
Générés en PDF (par classe ou par élève) depuis la fiche élève/classe. Ils incluent la moyenne générale pondérée par coefficient **et le rang de l'élève dans sa classe** (ex : *5/32*). Un élève sans aucune note n'est pas classé.

---

## 10. Présences

**Pédagogie → Présences**

Enregistrement des présences/absences par classe et par date, avec statistiques associées.

---

## 11. Matières

**Pédagogie → Matières**

Création des matières, **coefficient** (utilisé pour le calcul des moyennes), et niveau associé (liste des vrais niveaux définis en §6 — aucune saisie libre).

---

## 12. Emploi du temps

**Pédagogie → Emploi du temps**

Planification des créneaux horaires par classe/matière/enseignant.

---

## 13. Finances

### Paiements
**Finance → Paiements** : liste de tous les paiements, création, détail, modes de paiement incluant **Mvola, Orange Money, Airtel Money**, Espèces, Virement, Chèque.

### Frais par niveau
**Finance → Frais par niveau** : grilles tarifaires (écolage, frais annuels, autres) par niveau scolaire, montants en Ariary.

---

## 14. Messagerie

**École → Messagerie**

Messagerie interne entre membres du personnel (administrateurs, secrétaires, enseignants).

- **Boîte de réception** : liste des messages reçus, avec indicateur de non-lu.
- **Composer** : choisissez un ou plusieurs **destinataires** (recherche par nom), un **sujet**, une **priorité** (Normale, Haute, Urgente) et le contenu du message. Des **pièces jointes** peuvent être ajoutées.
- **Détail d'un message** : affiche l'expéditeur, la priorité, les pièces jointes, et permet de **répondre** directement.

> La priorité **Urgente** est purement indicative (mise en valeur visuelle du message) — elle ne déclenche pas de notification en dehors de l'application.

---

## 15. Administration

Regroupe la gestion technique et administrative de l'établissement (**Paramètres** dans le menu) :

- **Utilisateurs** : création de comptes **Administrateur** ou **Secrétaire** uniquement (les comptes Enseignant et Parent se créent depuis leurs modules dédiés, §7 et §5).
- **Configuration** : nom de l'établissement, logo, année scolaire, système de périodes, configuration des paiements (montant écolage/frais annuel, jour d'échéance), sécurité (changement de mot de passe).
- **Journaux d'audit** : historique des actions effectuées dans l'application (création, modification, suppression), par utilisateur et par date — utile pour retracer une modification.
- **Licence** : voir [§17](#17-licence).
- **Synchronisation** : voir [§16](#16-synchronisation-et-mode-hors-ligne).

---

## 16. Synchronisation et mode hors ligne

L'application fonctionne **sans connexion internet** : toutes les données sont d'abord enregistrées localement sur l'appareil, puis synchronisées automatiquement avec le serveur dès que la connexion revient — aucune action manuelle n'est nécessaire au quotidien.

**Administration → Synchronisation** permet de :
- voir l'état de connexion (en ligne / hors ligne) et la date de dernière synchronisation,
- voir le nombre de changements en attente d'envoi et de conflits détectés,
- forcer une synchronisation immédiate (bouton **Synchroniser maintenant**).

En cas de modification du même élève/note/paiement sur deux appareils différents pendant une coupure réseau, l'application retient automatiquement la version la plus récente lors de la reconnexion.

---

## 17. Licence

**Paramètres → Licence**

- À la création du compte, un **essai gratuit de 14 jours** démarre. Passé ce délai sans licence, l'application passe en **lecture seule** (consultation possible, plus de création ni de modification) et un bandeau rouge l'indique.
- Pour obtenir une licence, indiquez à votre fournisseur l'**adresse e-mail de l'administrateur** de l'établissement. Après règlement (mobile money, virement…), il vous transmet un **code de licence** de 16 caractères (format `XXXX-XXXX-XXXX-XXXX`), dictable par téléphone ou envoyé par SMS.
- Saisissez le code dans le champ prévu et cliquez **Activer la licence**. L'activation demande une connexion internet (une seule fois) ; l'application fonctionne ensuite hors ligne toute l'année.
- La licence est **annuelle** et **sans limite** d'élèves ni d'enseignants ; sa **date d'expiration** est affichée sur la page. Avant l'échéance, demandez une nouvelle clé et activez-la de la même façon.
- Un code n'est valable que pour l'établissement pour lequel il a été émis ; un code inconnu, expiré ou révoqué est refusé avec un message explicite.

---

## 18. Questions fréquentes

**Je change de mot de passe, dois-je le refaire sur chaque appareil ?**
Oui — chaque appareil garde en mémoire le dernier mot de passe utilisé pour le déverrouillage hors ligne ; après un changement, reconnectez-vous en ligne une fois sur chaque appareil pour le mettre à jour.

**Un collègue peut-il utiliser mon poste avec son propre compte hors ligne ?**
Seulement s'il s'est déjà connecté au moins une fois en ligne sur ce même poste auparavant.

**Pourquoi je ne peux plus rien modifier ?**
Vérifiez la page Licence (§17) — l'essai gratuit ou la licence a probablement expiré (mode lecture seule).

**Les niveaux que j'ai créés n'apparaissent pas dans le filtre des matières.**
Vérifiez qu'ils sont bien enregistrés dans Niveaux (§6) — c'est la seule liste de référence utilisée partout dans l'application.
