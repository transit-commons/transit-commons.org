const fs = require('fs');

module.exports = async ({ github, context, commitHash }) => {
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

    // Build comment with Git URLs
    let comment = '## Visual Changes\n\n';

    // Add compare link
    const compareUrl = `${process.env.GITHUB_SERVER_URL}/${context.repo.owner}/${context.repo.repo}/compare/${context.payload.pull_request.base.sha}...${context.payload.pull_request.head.sha}`;
    comment += `Changes: [${context.payload.pull_request.base.sha.slice(0,7)}...${context.payload.pull_request.head.sha.slice(0,7)}](${compareUrl})\n\n`;

    for (const screenshot of screenshots) {
      comment += `### ${screenshot.pageName}\n`;
      comment += '<table><tr><td>Before</td><td>After</td></tr>\n';
      comment += '<tr>';
      comment += `<td><img src="../blob/${commitHash}/screenshots/${screenshot.baseScreenshot}?raw=true" width="600"></td>`;
      comment += `<td><img src="../blob/${commitHash}/screenshots/${screenshot.prScreenshot}?raw=true" width="600"></td>`;
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
