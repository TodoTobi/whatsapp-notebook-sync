const { exec } = require("child_process");

/**
 * Muestra una notificación nativa de Windows usando PowerShell.
 * No requiere dependencias extra — usa la API de notificaciones de Windows 10/11.
 *
 * @param {string} title   - Título de la notificación
 * @param {string} message - Cuerpo del mensaje
 * @param {string} type    - 'info' | 'warning' | 'error'  (afecta el ícono)
 */
function notify(title, message, type = "info") {
  if (process.platform !== "win32") return;

  // Truncar el mensaje para que entre en la notificación
  const msg = message.length > 120 ? message.slice(0, 117) + "..." : message;

  // Escapar comillas simples para PowerShell
  const safeTitle = title.replace(/'/g, "`'");
  const safeMsg   = msg.replace(/'/g, "`'");

  const iconMap = { info: "Info", warning: "Warning", error: "Error" };
  const icon = iconMap[type] || "Info";

  // PowerShell: BalloonTipIcon + ShowBalloonTip para notificación en la bandeja
  const ps = `
Add-Type -AssemblyName System.Windows.Forms;
$notify = New-Object System.Windows.Forms.NotifyIcon;
$notify.Icon = [System.Drawing.SystemIcons]::${icon};
$notify.Visible = $true;
$notify.ShowBalloonTip(4000, '${safeTitle}', '${safeMsg}', [System.Windows.Forms.ToolTipIcon]::${icon});
Start-Sleep -Milliseconds 4500;
$notify.Dispose();
`.trim();

  exec(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/\n/g, " ")}"`,
    { windowsHide: true },
    (err) => { if (err) console.warn("[Notifier] Error:", err.message); }
  );
}

module.exports = { notify };