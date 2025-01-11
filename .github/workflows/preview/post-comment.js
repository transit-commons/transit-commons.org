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

    // Get artifact URL
    const { data: { artifacts } } = await github.rest.actions.listWorkflowRunArtifacts({
      owner: context.repo.owner,
      repo: context.repo.repo,
      run_id: context.runId
    });

    const previewArtifact = artifacts.find(a => a.name === 'preview-screenshots');
    if (!previewArtifact) {
      console.log('No preview screenshots artifact found');
      return;
    }

    // Build comment with artifact URLs
    let comment = '## Visual Changes\n\n';
    const artifactUrl = `${process.env.GITHUB_SERVER_URL}/${context.repo.owner}/${context.repo.repo}/suites/${context.runId}/artifacts/${previewArtifact.id}`;

    for (const screenshot of screenshots) {
      comment += `### ${screenshot.pageName}\n`;
      comment += '<table><tr><td>Before</td><td>After</td></tr>\n';
      comment += '<tr>';
      comment += `<td><img src="${artifactUrl}/screenshots/${screenshot.baseScreenshot}" width="600"></td>`;
      comment += `<td><img src="${artifactUrl}/screenshots/${screenshot.prScreenshot}" width="600"></td>`;
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
