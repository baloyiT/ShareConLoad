export function buildEmailHtml(title: string, body: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(8,16,58,0.10);">
      <tr>
        <td style="background-color:#0f2044;padding:28px 40px;text-align:center;">
          <span style="font-size:22px;font-weight:800;color:#ffffff;">Share</span><span style="font-size:22px;font-weight:800;color:#f97316;">Con</span><span style="font-size:22px;font-weight:800;color:#ffffff;">Load</span>
        </td>
      </tr>
      <tr><td style="height:4px;background:linear-gradient(90deg,#f97316 0%,#FFB37B 100%);"></td></tr>
      <tr>
        <td style="background-color:#ffffff;padding:36px 40px 32px;">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#0f2044;">${title}</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">${body}</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center">
                <a href="https://www.shareconload.com" style="display:inline-block;background-color:#f97316;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:12px 32px;border-radius:10px;">
                  Go to ShareConLoad
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="background-color:#0f2044;padding:20px 40px;text-align:center;">
          <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">
            Need help? <a href="mailto:support@shareconload.com" style="color:#f97316;text-decoration:none;">support@shareconload.com</a>
          </p>
          <p style="margin:0;font-size:11px;color:#475569;">© ${year} ShareConLoad · Global Shared Container Logistics</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
