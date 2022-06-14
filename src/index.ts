import * as child from "child_process";
import puppeteer from "puppeteer-core";
import { Browser } from "puppeteer-core";
import registrationJson from "../config/registration.json";

async function launchBrowser(): Promise<Browser> {
  const homeDir = process.env.HOME;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/google-chrome-stable",
    userDataDir: `${homeDir}/.config/google-chrome-automation`,
    args: [
      "--no-sandbox",
      "--no-zygote",
      "--no-first-run",
      "--disable-setuid-sandbox",
    ],
  });

  console.log(`WS: ${JSON.stringify(browser.wsEndpoint())}`);

  return browser;
}

function getJustDate(dateText: string): Date {
  const result = new Date(dateText);
  result.setHours(0, 0, 0, 0);

  return result;
}

async function run(): Promise<void> {
  const browser = await launchBrowser();

  const page = await browser.newPage();
  await page.goto("http://www.seattlebadmintonclub.com/Login.aspx", {
    waitUntil: "networkidle0",
  });
  await page.focus("input#ctl00_bodyContentPlaceHolder_Login1_UserName");
  await page.keyboard.type(registrationJson.username);
  await page.focus("input#ctl00_bodyContentPlaceHolder_Login1_Password");
  await page.keyboard.type(registrationJson.password);
  await page.click("input#ctl00_bodyContentPlaceHolder_Login1_LoginButton");
  await page.waitForNavigation();
  console.log("Logged In!");
  const fixedPartner = await page.$('input[value="7"]');
  if (fixedPartner) {
    await page.click('input[value="7"]');
    await page.click("input[value=Enter]");
    await page.waitForNavigation();
  }
  const nextTuesday = new Date();
  nextTuesday.setHours(0, 0, 0, 0);
  nextTuesday.setDate(
    nextTuesday.getDate() + (2 + 7 - (nextTuesday.getDay() % 7) || 7)
  );
  const selectDate = await page.$(
    "select#ctl00_bodyContentPlaceHolder_ddlistPlayDate"
  );
  const dateOptions = await selectDate?.$$eval("option", (nodes) =>
    nodes.map((n) => [
      (n as HTMLOptionElement).innerText,
      n.getAttribute("value"),
    ])
  );

  const matchingDateOption = dateOptions?.find(
    (dateOption) =>
      dateOption[0] &&
      getJustDate(dateOption[0]).getTime() == nextTuesday.getTime()
  );
  if (matchingDateOption && selectDate) {
    console.log(
      `Next tuesday found: ${matchingDateOption[0]} and clicking now!`
    );
    const dateOptionValue = matchingDateOption[1];
    if (dateOptionValue) {
      await selectDate.select(dateOptionValue);
      await page.waitForTimeout(4000);
    }
  } else {
    console.error(
      `Next tuesday not found: ${nextTuesday}. Maybe not ready yet?`
    );
    await browser.close();
    return;
  }

  const selectRegistered = await page.$(
    "select#ctl00_bodyContentPlaceHolder_listSelected"
  );

  const registeredUsers = await selectRegistered?.$$eval("option", (nodes) =>
    nodes.map((n) => (n as HTMLOptionElement).innerText)
  );
  const meRegistered = registeredUsers?.find((registeredText) =>
    registeredText.toLowerCase().includes(registrationJson.myName.toLowerCase())
  );
  if (meRegistered) {
    console.log(
      `You're already registered: "${meRegistered}", nothing left to do!`
    );
    await browser.close();
    return;
  }

  const selectUnregistered = await page.$(
    "select#ctl00_bodyContentPlaceHolder_listUnselected"
  );

  const partnerOptions = await selectUnregistered?.$$eval("option", (nodes) =>
    nodes.map((n) => [
      (n as HTMLOptionElement).innerText,
      n.getAttribute("value"),
    ])
  );

  const matchingPartnerOption = partnerOptions?.find(
    (dateOption) =>
      dateOption[0] &&
      dateOption[0]
        .toLowerCase()
        .includes(registrationJson.partner.toLowerCase())
  );

  if (matchingPartnerOption && selectUnregistered) {
    console.log(
      `${registrationJson.partner} unregistered found: '${matchingPartnerOption[0]}' with value "${matchingPartnerOption[1]}".`
    );
    const partnerOptionValue = matchingPartnerOption[1];
    if (partnerOptionValue) {
      await selectUnregistered.select(partnerOptionValue);
      await page.waitForTimeout(10000);
      await page.click("input#ctl00_bodyContentPlaceHolder_registerTB");
      await page.waitForTimeout(10000);
      console.log("Clicked on Register, hopefully a registration occurred!");
      child.exec("notify-send 'Clicked on Register!'");
    }
  }

  await browser.close();
}

run();
