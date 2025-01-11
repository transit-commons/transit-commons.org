const fs = require('fs');

module.exports = async ({ github, context }) => {
  try {
    // Check if screenshots.json exists
    if (!fs.existsSync('screenshots.json')) {
      console.log('No screenshots.json found - the screenshot step may have failed');
      return;
    }

    // Read screenshot info
    let screenshots;
    try {
      screenshots = JSON.parse(fs.readFileSync('screenshots.json', 'utf8'));
    } catch (error) {
      console.error('Error reading screenshots.json:', error);
      return;
    }

    if (!Array.isArray(screenshots) || screenshots.length === 0) {
      console.log('No screenshots were captured');
      return;
    }

    // Get tree hash
    const treeHash = fs.readFileSync('tree-hash.txt', 'utf8').trim();
    if (!treeHash) {
      console.log('No tree hash found - the screenshot upload step may have failed');
      return;
    }

    // Build comment with Git URLs
    let comment = '## Visual Changes\n\n';

    for (const screenshot of screenshots) {
      comment += `### ${screenshot.pageName}\n`;
      comment += '<table><tr><td>Before</td><td>After</td></tr>\n';
      comment += '<tr>';
      comment += `<td><img src="../blob/${treeHash}/screenshots/${screenshot.baseScreenshot}?raw=true" width="600"></td>`;
      comment += `<td><img src="../blob/${treeHash}/screenshots/${screenshot.prScreenshot}?raw=true" width="600"></td>`;
      comment += '</tr></table>\n\n';
    }

    // Post comment
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: comment
    });
  } catch (error) {
    console.error('Error in post-screenshot process:', error);
    process.exit(1);
  }
};
