const pkg = require('./package.json');
console.log('Available optional deps:', pkg.optionalDependencies ? Object.keys(pkg.optionalDependencies) : 'none');
console.log('Available deps:', Object.keys(pkg.dependencies).slice(0, 10));