const { exec } = require('child_process');
const path = require('path');

const jsonFilePath = process.argv[2] || './mocks/cluster-pupetteer-jeanette-2.json';
const outputDir = process.argv[3] || 'static-site';
const port = process.argv[4] || 8080;

const runScript = `node ${path.join(__dirname, 'run-static.js')} "${jsonFilePath}" "${outputDir}" ${port}`;

console.log(`Running command: ${runScript}`);
exec(runScript, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(stdout);
}); 