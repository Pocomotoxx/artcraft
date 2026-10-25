; UTF-8. Compile with NSIS 3 on Windows or macOS.
Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!include "WinVer.nsh"
Name "PromptDirector Video"
OutFile "${Output}/PromptDirector-Video-Windows.exe"
InstallDir "$LOCALAPPDATA\PromptDirector\VideoComponent"
RequestExecutionLevel user
SetCompressor /SOLID lzma
VIProductVersion "${ComponentVersion}.0"
VIAddVersionKey "ProductName" "PromptDirector Video"
VIAddVersionKey "FileDescription" "PromptDirector Video Setup"
VIAddVersionKey "FileVersion" "${ComponentVersion}"
VIAddVersionKey "LegalCopyright" "PromptDirector contributors"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_TEXT "$(SetupFinished)"
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "SimpChinese"
LangString SetupFinished ${LANG_ENGLISH} "The video component is ready. Return to PromptDirector; your capture continues automatically."
LangString SetupFinished ${LANG_SIMPCHINESE} "The video component is installed. Return to PromptDirector and the capture you just made will continue automatically."
LangString SetupFailed ${LANG_ENGLISH} "Setup could not finish. Close any active video downloads and try installing again. Your library is preserved."
LangString SetupFailed ${LANG_SIMPCHINESE} "Installation did not finish. Stop any video download in progress and reinstall. The library is unchanged."
LangString NeedWindows ${LANG_ENGLISH} "This installer requires 64-bit Windows 10 or later."
LangString NeedWindows ${LANG_SIMPCHINESE} "This installer needs Windows 10 or later, 64-bit."

Function .onInit
  ${IfNot} ${AtLeastWin10}
    MessageBox MB_OK|MB_ICONSTOP "$(NeedWindows)" /SD IDOK
    Abort
  ${EndIf}
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "$(NeedWindows)" /SD IDOK
    Abort
  ${EndIf}
  SetRegView 64
FunctionEnd

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${PayloadFiles}"
  IfErrors failed
  ExecWait '"$INSTDIR\bin\node.exe" "$INSTDIR\connector\register-video.mjs"' $0
  ${If} $0 != 0
    Goto failed
  ${EndIf}
  WriteRegStr HKCU "Software\Google\Chrome\NativeMessagingHosts\com.promptdirector.video" "" "$INSTDIR\native-manifest.json"
  IfErrors failed
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PromptDirectorVideo" "DisplayName" "PromptDirector Video"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PromptDirectorVideo" "DisplayVersion" "${ComponentVersion}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PromptDirectorVideo" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PromptDirectorVideo" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PromptDirectorVideo" "NoRepair" 1
  Goto done
failed:
  MessageBox MB_OK|MB_ICONSTOP "$(SetupFailed)" /SD IDOK
  SetErrorLevel 1
  Abort
done:
SectionEnd

Section "Uninstall"
  SetRegView 64
  ReadRegStr $0 HKCU "Software\Google\Chrome\NativeMessagingHosts\com.promptdirector.video" ""
  ${If} $0 == "$INSTDIR\native-manifest.json"
    DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.promptdirector.video"
  ${EndIf}
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PromptDirectorVideo"
  RMDir /r "$INSTDIR"
SectionEnd
