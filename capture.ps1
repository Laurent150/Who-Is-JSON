param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Windows.Forms;
using System.IO;
using System.Runtime.InteropServices;
public class CodeLingoCapture : Form {
 [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
 Bitmap desktop; Point anchor; Rectangle selection; bool dragging=false;
 public string Result="";
 public CodeLingoCapture() {
  SetProcessDPIAware();
  var bounds=SystemInformation.VirtualScreen;
  desktop=new Bitmap(bounds.Width,bounds.Height);
  using(var g=Graphics.FromImage(desktop)){g.CopyFromScreen(bounds.Left,bounds.Top,0,0,bounds.Size);}
  FormBorderStyle=FormBorderStyle.None;StartPosition=FormStartPosition.Manual;Bounds=bounds;
  TopMost=true;DoubleBuffered=true;Cursor=Cursors.Cross;KeyPreview=true;ShowInTaskbar=false;
  KeyDown+=(s,e)=>{if(e.KeyCode==Keys.Escape)Close();};
  MouseDown+=(s,e)=>{if(e.Button==MouseButtons.Left){anchor=e.Location;dragging=true;}};
  MouseMove+=(s,e)=>{if(dragging){selection=Rectangle.FromLTRB(Math.Min(anchor.X,e.X),Math.Min(anchor.Y,e.Y),Math.Max(anchor.X,e.X),Math.Max(anchor.Y,e.Y));Invalidate();}};
  MouseUp+=(s,e)=>{if(!dragging)return;dragging=false;selection.Intersect(new Rectangle(Point.Empty,desktop.Size));if(selection.Width>4&&selection.Height>4){using(var cropped=desktop.Clone(selection,desktop.PixelFormat))using(var ms=new MemoryStream()){cropped.Save(ms,System.Drawing.Imaging.ImageFormat.Png);Result=Convert.ToBase64String(ms.ToArray());}}Close();};
 }
 protected override void OnPaint(PaintEventArgs e){
  e.Graphics.DrawImageUnscaled(desktop,0,0);
  using(var shade=new SolidBrush(Color.FromArgb(95,0,0,0)))e.Graphics.FillRectangle(shade,ClientRectangle);
  if(selection.Width>0&&selection.Height>0){e.Graphics.DrawImage(desktop,selection,selection,GraphicsUnit.Pixel);using(var pen=new Pen(Color.FromArgb(175,225,95),2))e.Graphics.DrawRectangle(pen,selection);}
  using(var font=new Font("Segoe UI",13))using(var back=new SolidBrush(Color.FromArgb(220,28,44,29))){e.Graphics.FillRectangle(back,20,20,410,43);e.Graphics.DrawString("CodeLingo  |  Drag to select  |  Esc to cancel",font,Brushes.White,30,30);}
 }
 protected override void Dispose(bool disposing){if(disposing&&desktop!=null)desktop.Dispose();base.Dispose(disposing);}
 public static string Run(){using(var f=new CodeLingoCapture()){f.ShowDialog();return f.Result;}}
}
'@
if($CheckOnly){Write-Output 'capture compilation OK';exit}
[CodeLingoCapture]::Run()
