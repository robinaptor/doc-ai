import puppeteer from 'puppeteer';

async function test() {
  const url = 'https://helpx.adobe.com/after-effects/user-guide.html';
  console.log(`Testing URL: ${url}`);
  try {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    console.log("Navigating...");
    
    // Disable request interception temporarily to see if that's what's breaking it for this specific page
    // await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Use domcontentloaded for this test, and wait 3s
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log("Loaded initial DOM. Waiting 3s...");
    await new Promise(r => setTimeout(r, 3000));
    
    let textContent = await page.evaluate(() => {
        document.querySelectorAll('script, style, nav, footer, header, noscript, iframe, svg').forEach(el => el.remove());
        return document.body.innerText;
    });

    await browser.close();
    console.log("Success! Length:", textContent.length);
    console.log("Preview:", textContent.substring(0, 100).replace(/\n/g, ' '));
  } catch (e) {
    console.error("Test failed:", e.message);
  }
}
test();
