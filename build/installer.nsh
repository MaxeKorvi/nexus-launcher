; ═══════════════════════════════════════════════════════════════
; Nexus Launcher — NSIS custom installer theme
; Dark AMOLED theme matching the launcher design
; ═══════════════════════════════════════════════════════════════

!include LogicLib.nsh
!include WinMessages.nsh
!include nsDialogs.nsh

BrandingText "Nexus Launcher v1.1.26"

Var hasExistingInstallation
Var existingInstallDir
Var NexusUninstallRadio
Var NexusInstallRadio
Var NexusDialog

; ── Custom header (compile-time) ─────────────────────────────
!macro customHeader
  !ifndef MUI_BGCOLOR
    !define MUI_BGCOLOR 0x0A0A0F
  !endif
  !ifndef MUI_TEXTCOLOR
    !define MUI_TEXTCOLOR 0xCCCCCC
  !endif
!macroend

; ── Custom .onInit ───────────────────────────────────────────
!macro customInit
  SetCtlColors $HWNDPARENT 0xCCCCCC 0x0A0A0F

  StrCpy $hasExistingInstallation "0"
  ReadRegStr $existingInstallDir HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${if} $existingInstallDir == ""
    ReadRegStr $existingInstallDir HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${endif}
  ${if} $existingInstallDir != ""
    StrCpy $hasExistingInstallation "1"
  ${endif}
!macroend

; ── Welcome page ──────────────────────────────────────────────
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

; ── Custom page: Install or Uninstall if detected ───────────
!macro customPageAfterChangeDir
  Page custom NexusActionCreate NexusActionLeave
!macroend

Function NexusActionCreate
  ${if} $hasExistingInstallation == "0"
    Abort
  ${endif}

  GetDlgItem $0 $HWNDPARENT 1037
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Nexus Launcher"
  GetDlgItem $0 $HWNDPARENT 1038
  SendMessage $0 ${WM_SETTEXT} 0 "STR:Выберите действие"

  nsDialogs::Create 1018
  Pop $NexusDialog
  ${If} $NexusDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 20u \
    "Nexus Launcher уже установлен в:$\\r$\\n$existingInstallDir$\\r$\\n$\\r$\\nЧто вы хотите сделать?"

  ${NSD_CreateRadioButton} 15u 50u 100% 12u "Обновить (переустановить)"
  Pop $NexusInstallRadio
  ${NSD_Check} $NexusInstallRadio

  ${NSD_CreateRadioButton} 15u 70u 100% 12u "Удалить Nexus Launcher"
  Pop $NexusUninstallRadio

  ${NSD_CreateLabel} 30u 90u 100% 20u \
    "При удалении файлы лаунчера будут удалены,$\\r$\\nно установленные версии Minecraft и настройки останутся."

  nsDialogs::Show
FunctionEnd

Function NexusActionLeave
  ${NSD_GetState} $NexusUninstallRadio $R0
  ${If} $R0 == ${BST_CHECKED}
    ReadRegStr $R1 HKLM "${UNINSTALL_REGISTRY_KEY}" UninstallString
    ${if} $R1 == ""
      ReadRegStr $R1 HKCU "${UNINSTALL_REGISTRY_KEY}" UninstallString
    ${endif}
    ${if} $R1 != ""
      ExecWait "$R1 /S _?=$existingInstallDir"
    ${endif}
    Quit
  ${EndIf}
FunctionEnd

; ── Finish page ───────────────────────────────────────────────
!macro customFinishPage
  !define MUI_FINISHPAGE_RUN "$INSTDIR\Nexus Launcher.exe"
  !define MUI_FINISHPAGE_RUN_TEXT "Запустить Nexus Launcher"
  !insertmacro MUI_PAGE_FINISH
!macroend

; ── Uninstall pages ───────────────────────────────────────────
!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Удаление Nexus Launcher"
  !define MUI_WELCOMEPAGE_TEXT "Будут удалены все файлы лаунчера.$\r$\nУстановленные версии Minecraft и настройки останутся."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

!macro customUninstallPage
  !insertmacro MUI_UNPAGE_FINISH
!macroend

; ── Uninstall .onInit ────────────────────────────────────────
!macro customUnInit
  SetCtlColors $HWNDPARENT 0xCCCCCC 0x0A0A0F
  !define MUI_UNCONFIRMPAGE_TEXT_TOP "Будут удалены все файлы Nexus Launcher."
  !define MUI_UNCONFIRMPAGE_TEXT_LOCATION "Расположение: $INSTDIR"
!macroend

; ── Post-uninstall cleanup ──────────────────────────────────
!macro customUnInstall
  ; keep user data (mods, versions, configs) intact
!macroend
