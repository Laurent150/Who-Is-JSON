using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Reflection;
[assembly: AssemblyTitle("Who Is JSON")]
[assembly: AssemblyProduct("Who Is JSON Desktop")]
[assembly: AssemblyVersion("1.1.0.0")]
static class DesktopHost {
 public static readonly string Root=AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
 public static readonly string Data=Path.Combine(Root,"data");
 public static readonly string Id=BitConverter.ToString(SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(Root.ToLowerInvariant()))).Replace("-","").Substring(0,24);
 public static int Port=43127;
 static bool selfTesting;static Process server;static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
 public static string Url {get{return "http://127.0.0.1:"+Port;}}
 static string Request(string route,string body,string token) {
  var req=(HttpWebRequest)WebRequest.Create(Url+route);req.Proxy=null;req.Timeout=15000;req.ReadWriteTimeout=15000;
  if(token!=null)req.Headers["X-CodeLingo-Token"]=token;
  if(body!=null){req.Method="POST";req.ContentType="application/json";byte[] bytes=Encoding.UTF8.GetBytes(body);req.ContentLength=bytes.Length;using(var s=req.GetRequestStream())s.Write(bytes,0,bytes.Length);}
  using(var res=req.GetResponse())using(var r=new StreamReader(res.GetResponseStream()))return r.ReadToEnd();
 }
 public static Dictionary<string,object> Health(){try{return Json.Deserialize<Dictionary<string,object>>(Request("/health",null,null));}catch{return null;}}
 static bool IsProduct(Dictionary<string,object> h){return h!=null&&h.ContainsKey("app")&&Convert.ToString(h["app"])=="CodeLingo"&&h.ContainsKey("product")&&Convert.ToString(h["product"])=="Who Is JSON";}
 public static bool IsOurs(Dictionary<string,object> h){return IsProduct(h)&&h.ContainsKey("desktopId")&&Convert.ToString(h["desktopId"])==Id;}
 static string Token(){var c=Request("/config.js",null,null);var m=System.Text.RegularExpressions.Regex.Match(c,"window.APP_TOKEN=\"([a-f0-9]{48})\"");if(!m.Success)throw new Exception("无法连接本地程序，请重新启动。");return m.Groups[1].Value;}
 public static void Stop(){try{if(IsOurs(Health()))Request("/api/quit","{}",Token());}catch{}if(server!=null){try{if(!server.WaitForExit(3000))server.Kill();}catch{}}}
 public static void Start(){
  Directory.CreateDirectory(Data);var h=Health();if(IsOurs(h))return;
  // Keep the same origin when moving from the development launch to the installed edition.
  if(selfTesting&&h!=null)throw new Exception("Self-test port became occupied; retry.");
  if(IsProduct(h)){Request("/api/quit","{}",Token());Thread.Sleep(800);}else if(h!=null)throw new Exception("启动位置已被其他程序使用，请关闭占用本地 43127 端口的程序后再试。");
  var node=Path.Combine(Root,"runtime","node","node.exe");var py=Path.Combine(Root,"runtime","python","python.exe");var app=Path.Combine(Root,"app");
  if(!File.Exists(node)||!File.Exists(py)||!File.Exists(Path.Combine(app,"server.js")))throw new Exception("安装文件不完整，请重新安装 Who Is JSON。");
  var info=new ProcessStartInfo(node,"\""+Path.Combine(app,"server.js")+"\"");info.WorkingDirectory=app;info.UseShellExecute=false;info.CreateNoWindow=true;info.RedirectStandardOutput=true;info.RedirectStandardError=true;
  info.EnvironmentVariables["CODELINGO_PORT"]=Port.ToString();info.EnvironmentVariables["CODELINGO_PYTHON"]=py;info.EnvironmentVariables["WHO_DESKTOP_ID"]=Id;info.EnvironmentVariables["PYTHONNOUSERSITE"]="1";info.EnvironmentVariables.Remove("PYTHONHOME");info.EnvironmentVariables.Remove("PYTHONPATH");
  server=new Process();server.StartInfo=info;server.OutputDataReceived+=(s,e)=>Log(e.Data);server.ErrorDataReceived+=(s,e)=>Log(e.Data);server.Start();server.BeginOutputReadLine();server.BeginErrorReadLine();
  for(int i=0;i<50;i++){if(IsOurs(Health()))return;if(server.HasExited)throw new Exception("本地服务未能启动。请查看安装目录 data\\desktop.log。");Thread.Sleep(250);}
  Stop();throw new Exception("启动超时。请重试，或查看安装目录 data\\desktop.log。");
 }
 static readonly object LogLock=new object();static void Log(string line){if(line==null)return;try{lock(LogLock){var file=Path.Combine(Data,"desktop.log");if(File.Exists(file)&&new FileInfo(file).Length>2000000)File.WriteAllText(file,"");File.AppendAllText(file,DateTime.Now.ToString("s")+" "+line+Environment.NewLine);}}catch{}}
 public static void Open(){
  var edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe");if(!File.Exists(edge))edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"Microsoft","Edge","Application","msedge.exe");
  if(File.Exists(edge)){var info=new ProcessStartInfo(edge,"--app="+Url+"/?v=1.1.0-desktop --no-first-run");info.UseShellExecute=false;Process.Start(info);}else Process.Start(new ProcessStartInfo(Url+"/?v=1.1.0-desktop"){UseShellExecute=true});
 }
 public static void SelfTest(){try{Start();var payload=new Dictionary<string,object>{{"name","desktop-check.py"},{"code","def total(values):\n    result = 0\n    for value in values:\n        result += value\n    return result"}};var r=Json.Deserialize<Dictionary<string,object>>(Request("/api/analyze",Json.Serialize(payload),Token()));if(Convert.ToString(r["language"])!="Python"||Convert.ToString(r["status"])!="ready")throw new Exception("Bundled Python analysis failed");var account=Json.Deserialize<Dictionary<string,object>>(Request("/api/account/status","{}",Token()));if(!Convert.ToBoolean(account["enabled"]))throw new Exception("Bundled cloud configuration missing");File.WriteAllText(Path.Combine(Data,"self-test.json"),Json.Serialize(new {pass=true,version="1.1.0",language=r["language"],cloud=account,health=Health()}));}finally{Stop();}}
 [STAThread] public static int Main(string[] args){
  // Some launch hosts supply both Path and PATH. .NET Framework rejects that
  // when constructing a child environment; normalize only this process's copies.
  var env=Environment.GetEnvironmentVariables();var names=new Dictionary<string,List<string>>(StringComparer.OrdinalIgnoreCase);
  foreach(System.Collections.DictionaryEntry entry in env){var key=(string)entry.Key;if(!names.ContainsKey(key))names[key]=new List<string>();names[key].Add(key);}
  foreach(var group in names.Values)if(group.Count>1){string value=Convert.ToString(env[group[0]]);foreach(var key in group)Environment.SetEnvironmentVariable(key,null);Environment.SetEnvironmentVariable(group[0],value);}
  bool test=Array.IndexOf(args,"--self-test")>=0;selfTesting=test;if(test){var listener=new System.Net.Sockets.TcpListener(IPAddress.Loopback,0);listener.Start();Port=((IPEndPoint)listener.LocalEndpoint).Port;listener.Stop();}
  Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);
  try{if(Array.IndexOf(args,"--stop")>=0){Stop();return 0;}if(test){SelfTest();return 0;}
   bool created;using(var mutex=new Mutex(true,"Local\\WhoIsJSON-"+Id,out created)){if(!created){for(int i=0;i<40&&!IsOurs(Health());i++)Thread.Sleep(250);if(IsOurs(Health()))Open();return 0;}Application.Run(new DesktopContext());}
   return 0;
  }catch(Exception e){if(test){Directory.CreateDirectory(Data);File.WriteAllText(Path.Combine(Data,"self-test-error.txt"),e.ToString());}else MessageBox.Show(e.Message,"Who Is JSON",MessageBoxButtons.OK,MessageBoxIcon.Error);return 1;}
 }
}
sealed class DesktopContext:ApplicationContext {
 NotifyIcon tray;Form splash;System.Windows.Forms.Timer timer;
 public DesktopContext(){
  tray=new NotifyIcon();tray.Text="Who Is JSON";tray.Icon=Icon.ExtractAssociatedIcon(Application.ExecutablePath);tray.Visible=true;
  var menu=new ContextMenuStrip();menu.Items.Add("打开 Who Is JSON",null,(s,e)=>DesktopHost.Open());menu.Items.Add("查看安装目录",null,(s,e)=>Process.Start(new ProcessStartInfo(DesktopHost.Root){UseShellExecute=true}));menu.Items.Add("退出 Who Is JSON",null,(s,e)=>ExitThread());tray.ContextMenuStrip=menu;tray.DoubleClick+=(s,e)=>DesktopHost.Open();
  splash=new Form{Text="Who Is JSON",Width=390,Height=155,StartPosition=FormStartPosition.CenterScreen,FormBorderStyle=FormBorderStyle.FixedDialog,MaximizeBox=false,MinimizeBox=false,ControlBox=false};splash.Controls.Add(new Label{Text="正在启动本地代码讲解工具…",Dock=DockStyle.Fill,TextAlign=ContentAlignment.MiddleCenter,Font=new Font("Microsoft YaHei UI",11)});splash.Show();
  Task.Run(()=>DesktopHost.Start()).ContinueWith(t=>splash.BeginInvoke((Action)(()=>{splash.Hide();if(t.IsFaulted){MessageBox.Show(t.Exception.GetBaseException().Message,"Who Is JSON");ExitThread();return;}DesktopHost.Open();timer=new System.Windows.Forms.Timer{Interval=3000};timer.Tick+=(s,e)=>{if(!DesktopHost.IsOurs(DesktopHost.Health()))ExitThread();};timer.Start();})));
 }
 protected override void ExitThreadCore(){if(timer!=null)timer.Dispose();DesktopHost.Stop();tray.Visible=false;tray.Dispose();splash.Dispose();base.ExitThreadCore();}
}
