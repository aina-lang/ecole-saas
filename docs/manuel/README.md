# Manuel d'utilisation du logiciel

Source du PDF publié sur le site : `site/public/manuels/Sekoliko-manuel-logiciel.pdf`.

## Régénérer le PDF

```bash
cd docs/manuel
python3 build.py desktop Sekoliko-manuel-logiciel.pdf
cp Sekoliko-manuel-logiciel.pdf ../../site/public/manuels/
```

Prérequis : Google Chrome, poppler (`pdftotext`, `pdfinfo`), Python 3 avec Pillow.

`build.py` imprime `desktop.html` avec Chrome en deux passes : la première
repère la page de chaque « Chapitre n », la seconde écrit ces numéros dans le
sommaire. Une capture absente devient un encadré « Capture à venir » : le PDF
se génère quand même, et la liste des manquantes s'affiche.

## Mettre à jour une capture

- Format : capture de la fenêtre à 1366 × 768 (×2), **thème clair**.
- **Masquer avant d'ajouter** : logo et nom de l'établissement (en haut du
  menu), toute adresse e-mail réelle, tout code de licence. Le manuel est
  public.
- Déposer le fichier dans `assets/desktop/` sous le nom attendu par
  `desktop.html`.

`outils/capture-demo.mjs` automatise les captures : il pilote l'application
(lancée non empaquetée avec `--remote-debugging-port`) via le protocole
DevTools, se connecte, attend la synchronisation, passe en thème clair et
relève pour chaque écran les zones à flouter (`*.rects.json`).

Ne **jamais** utiliser `server/prisma/seed.ts` pour produire des données de
démonstration : il vide des tables entières sans filtre d'établissement.

## Polices

`fonts/` contient Inter en fichiers statiques. La version variable (Google
Fonts) est intégrée par Chrome en Type 3 : texte moins net, recherche
dégradée.
