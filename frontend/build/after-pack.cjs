/*
 * Fuses Electron — posés sur l'exécutable juste après l'empaquetage.
 *
 * Les verrous du processus principal (src/main/index.ts) ferment la console
 * du renderer. Ils ne peuvent rien contre ce qui se passe AVANT que notre code
 * ne s'exécute : ce sont des options lues par le binaire Electron lui-même.
 * Les fuses les désactivent en dur dans l'exe, sans qu'aucun argument ni
 * variable d'environnement ne puisse les réactiver.
 *
 * Ce fichier vit dans build/ (buildResources) : il n'est pas embarqué dans
 * l'application.
 */
const path = require('node:path')
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir, packager } = context
  const exe = {
    win32: `${packager.appInfo.productFilename}.exe`,
    linux: packager.executableName,
    darwin: `${packager.appInfo.productFilename}.app`,
  }[electronPlatformName]
  if (!exe) return

  await flipFuses(path.join(appOutDir, exe), {
    version: FuseVersion.V1,
    // ELECTRON_RUN_AS_NODE=1 transformerait l'exe en interpréteur Node
    // complet, avec accès au disque et au réseau sous l'identité de l'app.
    [FuseV1Options.RunAsNode]: false,
    // --inspect / --inspect-brk ouvriraient un débogueur sur le processus
    // principal, là où vivent l'IPC, les fichiers et la mise à jour.
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    // NODE_OPTIONS=--require=… injecterait du code au démarrage.
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    // L'app ne se charge que depuis app.asar : un dossier resources/app/
    // posé à côté ne peut pas la remplacer.
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  })
  console.log(`  • fuses posés sur ${exe} (${electronPlatformName})`)
}
