Unicode true
!ifndef APP_VERSION
  !error "APP_VERSION is required"
!endif
!ifdef SIGN_SCRIPT
  !uninstfinalize 'powershell.exe -NoProfile -File "${SIGN_SCRIPT}" -Path "%1"' = 0
!endif
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
Name "FIMI"
OutFile "${SETUP_OUT}"
InstallDir "$LOCALAPPDATA\Programs\WhoIsJSON"
InstallDirRegKey HKCU "Software\WhoIsJSON" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 32
VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey /LANG=1033 "ProductName" "FIMI"
VIAddVersionKey /LANG=1033 "FileDescription" "FIMI Offline Installer"
VIAddVersionKey /LANG=1033 "FileVersion" "${APP_VERSION}.0"
VIAddVersionKey /LANG=1033 "LegalCopyright" "FIMI contributors"
!define MUI_ICON "${PAYLOAD}\fimi.ico"
!define MUI_UNICON "${PAYLOAD}\fimi.ico"
!define MUI_WELCOMEPAGE_TITLE "Install FIMI"
!define MUI_WELCOMEPAGE_TEXT "Learn from source code, flow, and examples.$\r$\n$\r$\nNode.js and Python are included. No separate developer setup is needed.$\r$\n$\r$\nFor Windows 10 / 11 (64-bit). Opens in an Edge app window, or your default browser if Edge is unavailable."
!define MUI_FINISHPAGE_RUN "$INSTDIR\WhoIsJSON.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch FIMI"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${PAYLOAD}\LICENSE.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"
Var TestMode
Var MenuDir
Var DesktopDir
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK "This installer requires 64-bit Windows."
    Abort
  ${EndIf}
  SetShellVarContext current
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/TEST" $1
  ${IfNot} ${Errors}
    StrCpy $TestMode "yes"
  ${EndIf}
FunctionEnd
Section "Application and offline runtime (required)" SecMain
  SectionIn RO
  ${If} ${FileExists} "$INSTDIR\desktop-install.marker"
    ExecWait '$\"$INSTDIR\WhoIsJSON.exe$\" --stop'
    Sleep 3500
    Delete "$INSTDIR\使用说明.txt"
  ${EndIf}
  SetOutPath "$INSTDIR"
  File /r "${PAYLOAD}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  ${If} $TestMode == "yes"
    StrCpy $MenuDir "$INSTDIR\test-shortcuts\StartMenu"
    StrCpy $DesktopDir "$INSTDIR\test-shortcuts\Desktop"
    FileOpen $0 "$INSTDIR\test-install.marker" w
    FileWrite $0 "test"
    FileClose $0
  ${Else}
    StrCpy $MenuDir "$SMPROGRAMS\FIMI"
    StrCpy $DesktopDir "$DESKTOP"
    WriteRegStr HKCU "Software\WhoIsJSON" "InstallDir" "$INSTDIR"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "DisplayName" "FIMI"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "DisplayVersion" "${APP_VERSION}.0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "Publisher" "FIMI contributors"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "DisplayIcon" "$INSTDIR\WhoIsJSON.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "QuietUninstallString" '$\"$INSTDIR\Uninstall.exe$\" /S'
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "NoRepair" 1
  ${EndIf}
  ${If} $TestMode != "yes"
    Delete "$DESKTOP\Who Is JSON.lnk"
    Delete "$SMPROGRAMS\Who Is JSON\Who Is JSON.lnk"
    Delete "$SMPROGRAMS\Who Is JSON\卸载 Who Is JSON.lnk"
    RMDir "$SMPROGRAMS\Who Is JSON"
  ${EndIf}
  Delete "$MenuDir\Who Is JSON.lnk"
  Delete "$MenuDir\卸载 Who Is JSON.lnk"
  Delete "$DesktopDir\Who Is JSON.lnk"
  CreateDirectory "$MenuDir"
  CreateShortcut "$MenuDir\FIMI.lnk" "$INSTDIR\WhoIsJSON.exe" "" "$INSTDIR\fimi.ico"
  Delete "$MenuDir\卸载 FIMI.lnk"
  CreateShortcut "$MenuDir\Uninstall FIMI.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd
Section "Desktop shortcut" SecDesktop
  CreateDirectory "$DesktopDir"
  CreateShortcut "$DesktopDir\FIMI.lnk" "$INSTDIR\WhoIsJSON.exe" "" "$INSTDIR\fimi.ico"
SectionEnd
Function .onInstSuccess
  ; Refresh shortcut artwork after upgrading from the old J icon.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
FunctionEnd
Function un.onInit
  SetShellVarContext current
  IfFileExists "$INSTDIR\desktop-install.marker" +3 0
    MessageBox MB_OK "Installation marker not found. Uninstall stopped to protect other files."
    Abort
FunctionEnd
Section "Uninstall"
  ExecWait '$\"$INSTDIR\WhoIsJSON.exe$\" --stop'
  Sleep 3500
  IfFileExists "$INSTDIR\test-install.marker" 0 normal_uninstall
    Delete "$INSTDIR\test-shortcuts\Desktop\FIMI.lnk"
    Delete "$INSTDIR\test-shortcuts\StartMenu\FIMI.lnk"
    Delete "$INSTDIR\test-shortcuts\StartMenu\Uninstall FIMI.lnk"
    RMDir "$INSTDIR\test-shortcuts\Desktop"
    RMDir "$INSTDIR\test-shortcuts\StartMenu"
    RMDir "$INSTDIR\test-shortcuts"
    Delete "$INSTDIR\test-install.marker"
    Goto remove_payload
  normal_uninstall:
    Delete "$DESKTOP\FIMI.lnk"
    Delete "$SMPROGRAMS\FIMI\FIMI.lnk"
    Delete "$SMPROGRAMS\FIMI\Uninstall FIMI.lnk"
    RMDir "$SMPROGRAMS\FIMI"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON"
    DeleteRegKey HKCU "Software\WhoIsJSON"
  remove_payload:
    ; Generated exact file list: do not recursively erase a user-selected directory.
    !include "${REMOVE_LIST}"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir "$INSTDIR"
SectionEnd
