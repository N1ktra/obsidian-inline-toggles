const { readFileSync, writeFileSync } = require('fs');

// read minAppVersion from manifest.json
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
manifest.version = version;
writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t') + '\n');

// update versions.json with the new version and minAppVersion
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[version] = manifest.minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, '\t') + '\n');
