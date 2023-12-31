import puppeteer from "puppeteer";
import fs from "fs/promises";

/**
 * Display a loader in the console.
 * @returns {NodeJS.Timeout} The interval used for the loader animation.
 */
const showLoader = () => {
  const loader = ["|", "/", "-", "\\"];
  let i = 0;

  return setInterval(() => {
    process.stdout.write(`\r${loader[i]} Scraping data, this might take a moment...`);
    i = (i + 1) % loader.length;
  }, 250);
};

/**
 * Scrape job details from a job listing page.
 * @param {puppeteer.Page} page - The Puppeteer page instance.
 * @param {string} jobLink - The URL of the job listing page.
 * @returns {Promise<object>} An object containing job details.
 */
const scrapeJobDetails = async (page, jobLink) => {
  const selectors = {
    title: "h1.topcard__title",
    company: "[href^='https://www.linkedin.com/company/']",
    location: ".topcard__flavor.topcard__flavor--bullet",
    description: "section.show-more-less-html",
  };

  await page.goto(jobLink, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  const job = {};

  for (const [key, selector] of Object.entries(selectors)) {
    job[key] = await page.$eval(selector, (el) => el.textContent.trim());
  }

  job.description = job.description
    .replace(/\s+/g, " ") // Remove extra whitespace
    .replace(/\b(Show more|Show less)\b/g, "") // Remove "Show more" "Show less" from description
    .trim();

  return job;
};

/**
 * Convert the jobs array to a CSV string.
 * @param {object[]} data - An array of objects to be converted to CSV.
 * @returns {string} A CSV string.
 */
const convertToCsv = (data) => {
  const keys = Object.keys(data[0]);
  const csv = [keys.join(",")];

  data.forEach((row) => {
    const values = keys.map((key) => `"${row[key]}"`);
    csv.push(values.join(","));
  });

  return csv.join("\n");
};

/**
 * Main function to initiate the scraping process.
 */
const main = async () => {
  const loaderInterval = showLoader();

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const searchTerm = "Web Developer";

  await page.goto(`https://www.linkedin.com/jobs/search/?keywords=${searchTerm}`);

  const jobLinks = await page.$$eval("a.base-card__full-link", (links) => links.map((a) => a.href));
  const jobDetails = [];

  for (const jobLink of jobLinks) {
    const details = await scrapeJobDetails(page, jobLink);
    jobDetails.push(details);
  }

  await browser.close();

  clearInterval(loaderInterval);

  try {
    // Convert jobDetails to a CSV string
    const csvData = convertToCsv(jobDetails);

    // Write the CSV data to a file
    await fs.writeFile("jobsData.csv", csvData, "utf-8");
    console.log("\n \x1b[32mData scraped and saved to jobsData.csv\x1b[0m");
  } catch (error) {
    console.error(`\n Error writing to jobsData.csv: ${error}`);
  }
};

// Call the main function to start the scraping process
main();
