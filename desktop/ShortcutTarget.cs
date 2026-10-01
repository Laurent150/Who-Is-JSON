using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

// Read the same Unicode target Windows Explorer uses. WScript.Shell can
// convert a shortcut's filename through the machine's legacy code page.
public static class FimiShortcutTarget {
    [ComImport, Guid("00021401-0000-0000-C000-000000000046")]
    private class ShellLink { }

    [ComImport, Guid("000214F9-0000-0000-C000-000000000046"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellLinkW {
        [PreserveSig]
        int GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder path,
                    int capacity, IntPtr findData, uint flags);
    }

    public static string Read(string filename) {
        object link = new ShellLink();
        try {
            ((IPersistFile)link).Load(filename, 0);
            var target = new StringBuilder(32768);
            Marshal.ThrowExceptionForHR(((IShellLinkW)link).GetPath(target, target.Capacity, IntPtr.Zero, 0));
            return target.ToString();
        } finally {
            Marshal.FinalReleaseComObject(link);
        }
    }
}
