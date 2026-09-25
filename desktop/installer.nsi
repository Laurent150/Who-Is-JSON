Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
Name "Who Is JSON"
OutFile "${SETUP_OUT}"
InstallDir "$LOCALAPPDATA\Programs\WhoIsJSON"
InstallDirRegKey HKCU "Software\WhoIsJSON" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 32
VIProductVersion "1.1.0.0"
VIAddVersionKey /LANG=2052 "ProductName" "Who Is JSON"
VIAddVersionKey /LANG=2052 "FileDescription" "Who Is JSON 离线安装包"
VIAddVersionKey /LANG=2052 "FileVersion" "1.1.0.0"
VIAddVersionKey /LANG=2052 "LegalCopyright" "Who Is JSON contributors"
!define MUI_ICON "${PAYLOAD}\who.ico"
!define MUI_UNICON "${PAYLOAD}\who.ico"
!define MUI_WELCOMEPAGE_TITLE "安装 Who Is JSON"
!define MUI_WELCOMEPAGE_TEXT "从源码、流程和例子学习编程。$\r$\n$\r$\n安装包自带本地解析环境，无须另装 Node.js 或 Python。$\r$\n$\r$\n适用于 Windows 10 / 11 64 位。使用 Edge 打开独立窗口；未安装 Edge 时使用默认浏览器。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\WhoIsJSON.exe"
!define MUI_FINISHPAGE_RUN_TEXT "启动 Who Is JSON"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${PAYLOAD}\LICENSE.txt"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "SimpChinese"
Var TestMode
Var MenuDir
Var DesktopDir
Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK "此安装包需要 64 位 Windows。"
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
Section "程序与离线运行环境（必选）" SecMain
  SectionIn RO
  IfFileExists "$INSTDIR\desktop-install.marker" 0 +3
    ExecWait '$\"$INSTDIR\WhoIsJSON.exe$\" --stop'
    Sleep 3500
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
    StrCpy $MenuDir "$SMPROGRAMS\Who Is JSON"
    StrCpy $DesktopDir "$DESKTOP"
    WriteRegStr HKCU "Software\WhoIsJSON" "InstallDir" "$INSTDIR"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "DisplayName" "Who Is JSON"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "DisplayVersion" "1.1.0.0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "Publisher" "Who Is JSON contributors"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "DisplayIcon" "$INSTDIR\WhoIsJSON.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "QuietUninstallString" '$\"$INSTDIR\Uninstall.exe$\" /S'
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON" "NoRepair" 1
  ${EndIf}
  CreateDirectory "$MenuDir"
  CreateShortcut "$MenuDir\Who Is JSON.lnk" "$INSTDIR\WhoIsJSON.exe" "" "$INSTDIR\who.ico"
  CreateShortcut "$MenuDir\卸载 Who Is JSON.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd
Section "桌面快捷方式" SecDesktop
  CreateDirectory "$DesktopDir"
  CreateShortcut "$DesktopDir\Who Is JSON.lnk" "$INSTDIR\WhoIsJSON.exe" "" "$INSTDIR\who.ico"
SectionEnd
Function un.onInit
  SetShellVarContext current
  IfFileExists "$INSTDIR\desktop-install.marker" +3 0
    MessageBox MB_OK "未找到安装标记，已停止卸载以保护其他文件。"
    Abort
FunctionEnd
Section "Uninstall"
  ExecWait '$\"$INSTDIR\WhoIsJSON.exe$\" --stop'
  Sleep 3500
  IfFileExists "$INSTDIR\test-install.marker" 0 normal_uninstall
    Delete "$INSTDIR\test-shortcuts\Desktop\Who Is JSON.lnk"
    Delete "$INSTDIR\test-shortcuts\StartMenu\Who Is JSON.lnk"
    Delete "$INSTDIR\test-shortcuts\StartMenu\卸载 Who Is JSON.lnk"
    RMDir "$INSTDIR\test-shortcuts\Desktop"
    RMDir "$INSTDIR\test-shortcuts\StartMenu"
    RMDir "$INSTDIR\test-shortcuts"
    Delete "$INSTDIR\test-install.marker"
    Goto remove_payload
  normal_uninstall:
    Delete "$DESKTOP\Who Is JSON.lnk"
    Delete "$SMPROGRAMS\Who Is JSON\Who Is JSON.lnk"
    Delete "$SMPROGRAMS\Who Is JSON\卸载 Who Is JSON.lnk"
    RMDir "$SMPROGRAMS\Who Is JSON"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\WhoIsJSON"
    DeleteRegKey HKCU "Software\WhoIsJSON"
  remove_payload:
    ; Generated exact file list: do not recursively erase a user-selected directory.
    !include "${REMOVE_LIST}"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir "$INSTDIR"
SectionEnd
