const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async ({ github, context, workingDir }) => {
  try {
    // Change to the working directory
    process.chdir(workingDir || '.');

    // Create a temporary index file
    const tmpIndex = path.join('.git', 'tmp-index');

    // Use git commands with custom index file
    const git = (cmd) => execSync(`git --git-index-file=${tmpIndex} ${cmd}`, { encoding: 'utf8' });

    // Initialize empty temporary index
    git('update-index --split-index');

    // Add screenshots to temporary index
    const screenshots = fs.readdirSync('../screenshots', { recursive: true })
      .filter(file => file.endsWith('.png'))
      .map(file => path.join('screenshots', file));

    // Copy screenshots to PR directory
    fs.mkdirSync('screenshots', { recursive: true });
    for (const file of screenshots) {
      const destFile = path.join('.', file);
      fs.copyFileSync(path.join('..', file), destFile);
      git(`update-index --add --cacheinfo 100644,$(git hash-object -w ${destFile}),${file}`);
    }

    // Write tree object and get its hash
    const treeHash = git('write-tree').trim();
    console.log(`Created tree object: ${treeHash}`);

    // Create ref pointing to the tree
    execSync(`git update-ref refs/preview-screenshots/${treeHash} $(git commit-tree ${treeHash} -m "Preview screenshots")`);

    // Push the ref to GitHub
    execSync(`git push origin refs/preview-screenshots/${treeHash}`);

    // Save the tree hash for the comment step (in parent directory)
    fs.writeFileSync('../tree-hash.txt', treeHash);

    return treeHash;
  } catch (error) {
    console.error('Error pushing screenshots:', error);
    process.exit(1);
  }
};
