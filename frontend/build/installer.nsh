; Sekoliko tourne sur Electron 28, qui ne supporte plus Windows 7 / 8 / 8.1.
; Sans ce garde-fou, l'installation réussit sur ces systèmes mais l'application
; ne démarre jamais (erreur de DLL au lancement, sans message clair).
; On refuse donc l'installation en amont avec une explication en français.

!include WinVer.nsh

!macro customInit
  ${IfNot} ${AtLeastWin10}
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONSTOP "Sekoliko nécessite Windows 10 ou Windows 11.$\r$\n$\r$\nVotre version de Windows n'est pas prise en charge et l'application ne pourrait pas démarrer. L'installation va être annulée."
    ${EndIf}
    SetErrorLevel 1
    Quit
  ${EndIf}
!macroend
