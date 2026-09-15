param([int]$Port=43127,[string]$Token,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase,System.Windows.Forms
$url="http://127.0.0.1:$Port"
$headers=@{'X-CodeLingo-Token'=$Token}
[xml]$xaml=@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" Width="260" Height="92" WindowStyle="None" AllowsTransparency="True" Background="Transparent" Topmost="True" ShowInTaskbar="False" ResizeMode="NoResize" AllowDrop="True" Title="Who Is JSON 悬浮入口">
 <Border Background="#29472F" CornerRadius="15" Padding="12" BorderBrush="#749554" BorderThickness="1">
  <StackPanel><DockPanel><TextBlock Foreground="#D8EDB9" FontSize="13" FontWeight="Bold" Text="Who Is JSON · 拖入代码"/><Button Name="CloseButton" Content="×" Width="24" Margin="9,0,0,0" Background="Transparent" Foreground="#BED39F" BorderThickness="0"/></DockPanel><StackPanel Orientation="Horizontal" Margin="0,12,0,0"><Button Name="CaptureButton" Content="⌗ 截图" Width="91" Padding="4" Background="#E2EDCE" BorderThickness="0"/><Button Name="OpenButton" Content="打开讲解 ↗" Width="103" Padding="4" Margin="8,0,0,0" Background="#E2EDCE" BorderThickness="0"/></StackPanel></StackPanel>
 </Border>
</Window>
'@
$reader=[System.Xml.XmlNodeReader]::new($xaml);$win=[Windows.Markup.XamlReader]::Load($reader)
$win.Left=[System.Windows.SystemParameters]::WorkArea.Right-256;$win.Top=[System.Windows.SystemParameters]::WorkArea.Bottom-120
$win.Add_MouseLeftButtonDown({if($_.OriginalSource -isnot [System.Windows.Controls.Button]){$win.DragMove()}})
$win.FindName('CloseButton').Add_Click({$win.Close()})
$win.FindName('OpenButton').Add_Click({Start-Process $url})
$win.Add_DragOver({if($_.Data.GetDataPresent([System.Windows.DataFormats]::FileDrop)){$_.Effects=[System.Windows.DragDropEffects]::Copy}else{$_.Effects=[System.Windows.DragDropEffects]::None};$_.Handled=$true})
$win.Add_Drop({try{$files=$_.Data.GetData([System.Windows.DataFormats]::FileDrop);if($files.Count -gt 0){$payload=@{path=$files[0]}|ConvertTo-Json -Compress;$null=Invoke-RestMethod -Uri "$url/api/inbox" -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload));Start-Process $url}}catch{[System.Windows.MessageBox]::Show('导入失败，请在讲解面板中拖入文件。','Who Is JSON')}})
$win.FindName('CaptureButton').Add_Click({
 $win.Hide()
 try{
  Start-Sleep -Milliseconds 250
  $image=& powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'capture.ps1')
  if($image){$payload=@{image=('data:image/png;base64,'+($image -join ''))}|ConvertTo-Json -Compress;$null=Invoke-RestMethod -Uri "$url/api/inbox" -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload));Start-Process $url}
 }catch{[System.Windows.MessageBox]::Show('截图未完成，可以在面板中重试。','Who Is JSON')}finally{$win.Show()}
})
if($CheckOnly){Write-Output 'widget XAML OK';exit}
$null=$win.ShowDialog()
