const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async ({ github, context, workingDir }) => {
  try {
    // Change to the working directory
    process.chdir(workingDir || '.');

    // Create a temporary index file
    const tmpIndex = path.resolve('.git', 'tmp-index');

    // Use git commands with custom index file
    const git = (cmd) => {
      const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };
      try {
        return execSync(cmd, { encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'] });
      } catch (error) {
        console.error(`Command failed: ${cmd}`);
        console.error(error.stderr?.toString() || error.message);
        throw error;
      }
    };

    // Initialize empty temporary index
    git('git update-index --split-index');

    // Add screenshots to temporary index
    const screenshots = fs.readdirSync('../screenshots', { recursive: true })
      .filter(file => file.endsWith('.png'))
      .map(file => path.join('screenshots', file));

    // Copy screenshots to PR directory
    fs.mkdirSync('screenshots', { recursive: true });
    for (const file of screenshots) {
      const destFile = path.join('.', file);
      fs.copyFileSync(path.join('..', file), destFile);
      const hash = git(`git hash-object -w ${destFile}`).trim();
      git(`git update-index --add --cacheinfo 100644,${hash},${file}`);
    }

    // Write tree object and get its hash
    const treeHash = git('git write-tree').trim();
    console.log(`Created tree object: ${treeHash}`);

    // Create ref pointing to the tree
    const commitHash = git(`git commit-tree ${treeHash} -m "Preview screenshots"`).trim();
    git(`git update-ref refs/preview-screenshots/${treeHash} ${commitHash}`);

    // Push the ref to GitHub
    git(`git push origin refs/preview-screenshots/${treeHash}`);

    // Save the tree hash for the comment step (in parent directory)
    fs.writeFileSync('../tree-hash.txt', treeHash);

    return treeHash;
  } catch (error) {
    console.error('Error pushing screenshots:', error);
    process.exit(1);
  }
};
