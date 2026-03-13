import puppeteer from 'puppeteer';

async function test() {
  const url = 'https://docs.coronalabs.com/';
  console.log(`Testing URL: ${url}`);
  try {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    console.log("Navigating...");
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log("Loaded initial DOM. Waiting 4s...");
    await new Promise(r => setTimeout(r, 4000));
    
    let textContent = await page.evaluate(() => document.body.innerText);

    await browser.close();
    console.log("Success! Length:", textContent.length);
  } catch (e) {
    console.error("Test failed:", e.message);
  }
}
test();
