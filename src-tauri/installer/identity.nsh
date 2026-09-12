; Compatibility names are intentionally retained for existing installs and CLI clients.
!macro NSIS_HOOK_PREINSTALL
  !insertmacro CheckIfAppIsRunning "rinari-code.exe" "Rinari Code"
!macroend

!macro RinariMigrateShortcut OLDLINK NEWLINK
  !insertmacro IsShortcutTarget "${OLDLINK}" "$INSTDIR\rinari-code.exe"
  Pop $0
  ${If} $0 = 1
    Delete "${OLDLINK}"
    CreateShortcut "${NEWLINK}" "$INSTDIR\rinari-agent.exe"
    !insertmacro SetLnkAppUserModelId "${NEWLINK}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; A compatibility executable lets older Rinari CLI installations keep launching us.
  CopyFiles /SILENT "$INSTDIR\rinari-agent.exe" "$INSTDIR\rinari-code.exe"
  !insertmacro RinariMigrateShortcut "$DESKTOP\rinari-code.lnk" "$DESKTOP\Rinari Agent.lnk"
  !insertmacro RinariMigrateShortcut "$DESKTOP\Rinari Code.lnk" "$DESKTOP\Rinari Agent.lnk"
  !insertmacro RinariMigrateShortcut "$SMPROGRAMS\rinari-code.lnk" "$SMPROGRAMS\Rinari Agent.lnk"
  !insertmacro RinariMigrateShortcut "$SMPROGRAMS\rinari-code\rinari-code.lnk" "$SMPROGRAMS\Rinari Agent.lnk"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$INSTDIR\rinari-code.exe"
  RMDir "$INSTDIR"
!macroend
