const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

module.exports = async ({ github, context, io }) => {
  // Parse changed files
  const changedFiles = JSON.parse(process.env.CHANGED_FILES || '[]');
  console.log('Changed files:', changedFiles);

  if (changedFiles.length === 0) {
    console.log('No relevant file changes detected');
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: '## Visual Changes\n\nNo changes to content pages, templates, or styles were detected in this PR.'
    });
    return;
  }

  // Get pages to screenshot
  const pagesToCapture = new Set();

  // Check for template/style changes that affect all pages
  const shouldCaptureHomepage = changedFiles.some(file =>
    file.includes('base.njk') || file.includes('styles.css')
  );
  if (shouldCaptureHomepage) {
    console.log('Template or style changes detected - will capture homepage');
    pagesToCapture.add('/');
  }

  // Add changed content pages
  changedFiles.forEach(file => {
    if (file.endsWith('.md')) {
      const route = file.replace(/^src/, '').replace(/\.md$/, '/');
      console.log(`Content change detected - will capture ${route}`);
      pagesToCapture.add(route);
    }
  });

  if (pagesToCapture.size === 0) {
    console.log('No pages need to be captured');
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: '## Visual Changes\n\nThe changes in this PR do not affect the visual appearance of any pages.'
    });
    return;
  }

  // Start servers with output logging
  console.log('Starting development servers...');
  const { spawn } = require('child_process');

  const baseServer = spawn('npm', ['start'], { cwd: 'base', detached: true });
  const prServer = spawn('npm', ['start'], { cwd: 'pr', detached: true });

  const servers = [baseServer, prServer];
  servers.forEach((server, i) => {
    const prefix = i === 0 ? 'Base' : 'PR';
    server.stdout.on('data', (data) => console.log(`${prefix} server: ${data}`));
    server.stderr.on('data', (data) => console.error(`${prefix} server error: ${data}`));
    server.on('exit', (code) => console.log(`${prefix} server exited with code ${code}`));
  });

  // Function to kill servers
  const cleanup = () => {
    console.log('Cleaning up servers...');
    servers.forEach(server => {
      try {
        if (!server.killed) {
          process.kill(-server.pid); // Kill entire process group
          console.log(`Killed process group ${server.pid}`);
        }
      } catch (err) {
        console.error(`Error killing server: ${err}`);
      }
    });
  };

  // Wait for servers to start
  console.log('Waiting for servers to initialize...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('Servers should be ready');

  // Create screenshots directory
  fs.mkdirSync('screenshots', { recursive: true });

  // Ensure screenshot paths exist
  const getScreenshotPath = (type, route) => {
    const dir = path.join('screenshots', type);
    fs.mkdirSync(dir, { recursive: true });

    // Convert root path to 'home'
    const filename = route === '/' ? `home.png` : `${route.replace(/\/$/, '')}.png`;
    // Store the path relative to the screenshots directory for artifact upload
    return {
      fullPath: path.join(dir, filename),
      relativePath: path.join(type, filename)
    };
  };

  // Take screenshots
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: await io.which('chrome'),
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  console.log('Creating new page...');
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  console.log('Browser ready for screenshots');

  try {
    const screenshots = [];
    console.log('Pages to capture:', Array.from(pagesToCapture));

    try {
      for (const route of pagesToCapture) {
        try {
          // Capture base version
          console.log(`Navigating to base version of ${route}...`);
          await page.goto(`http://localhost:8080${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
          console.log('Taking base screenshot...');
          const { fullPath: baseFullPath, relativePath: baseRelPath } = getScreenshotPath('base', route);
          await page.screenshot({ path: baseFullPath });
          console.log(`Saved base screenshot to ${baseFullPath}`);

          // Capture PR version
          console.log(`Navigating to PR version of ${route}...`);
          await page.goto(`http://localhost:8081${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
          console.log('Taking PR screenshot...');
          const { fullPath: prFullPath, relativePath: prRelPath } = getScreenshotPath('pr', route);
          await page.screenshot({ path: prFullPath });
          console.log(`Saved PR screenshot to ${prFullPath}`);

          // Record screenshot info
          screenshots.push({
            route,
            pageName: route === '/' ? 'Homepage' : route.replace(/\//g, ' ').trim(),
            baseScreenshot: baseRelPath,
            prScreenshot: prRelPath
          });
        } catch (pageError) {
          console.error(`Error capturing screenshots for ${route}:`, pageError);
        }
      }

      console.log('Closing browser...');
      await browser.close();
      console.log('Browser closed');

      // Save screenshot info
      fs.writeFileSync('screenshots.json', JSON.stringify(screenshots, null, 2));
    } catch (err) {
      console.error('Error in screenshot process:', err);
      process.exit(1);
    }
  } finally {
    cleanup();
  }
};
