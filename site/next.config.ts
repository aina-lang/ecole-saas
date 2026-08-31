import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /*
   * Export statique : les cinq pages sont entièrement pré-rendues, aucune ne
   * demande de rendu serveur, de route d'API ni de revalidation. Le site sort
   * donc en HTML/CSS/JS purs, hébergeables n'importe où, sans fonction
   * serverless ni démarrage à froid.
   */
  output: 'export',

  /*
   * L'optimiseur d'images de Next a besoin d'un serveur : il ne peut pas
   * exister dans un export statique. Les captures sont donc servies telles
   * quelles — elles ont été converties en WebP en amont (1 942 Ko → 591 Ko),
   * ce qui rend l'optimisation à la volée superflue pour ce site.
   */
  images: { unoptimized: true },

  /*
   * Chaque page devient un dossier avec son index.html (/licence/index.html
   * plutôt que /licence.html). C'est ce que servent correctement tous les
   * hébergeurs statiques, avec ou sans barre oblique finale dans l'URL.
   */
  trailingSlash: true,
}

export default nextConfig
