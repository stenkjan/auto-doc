import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export async function generatePDF(html: string): Promise<Buffer> {
  const isLocal = process.env.NODE_ENV === "development";

  const browser = await puppeteer.launch({
    args: isLocal ? [] : chromium.args,
    executablePath: isLocal
      ? getLocalChromePath()
      : await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function getLocalChromePath(): string {
  const platform = process.platform;
  if (platform === "win32") {
    return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
  if (platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return "/usr/bin/google-chrome";
}
