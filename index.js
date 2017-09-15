'use strict';

const fs = require('fs');
const os = require('os');
const glob = require('glob');
const path = require('path');
const md5 = require('md5');
const { createFilter } = require('rollup-pluginutils');
const toURLString = require('./to-url-string');

function getPseudoFileName(importee) {
	return `${
		importee
		.replace(/\*/g, '-star-')
		.replace(/[^\w-]/g, '_')
	}.js`;
}

module.exports = ({ include, exclude } = {}) => {

	const filter = createFilter(include, exclude);

    return {
        'name': 'rollup-bulk-import',
        'load': function(id) {

            const srcFile = path.join(os.tmpdir(), id);

            let options;
            try {
                options = JSON.parse(fs.readFileSync(srcFile));
            } catch(err) {
                return;
            }

            const { importee, importer } = options;

			const importeeIsAbsolute = path.isAbsolute(importee);
            const cwd = path.dirname(importer);
            const globPattern = importee;

            const files = glob.sync(globPattern, {
                'cwd': cwd
            });

            let code = [`const res = [];`];
            let importArray = [];

            files.forEach((file, i) => {
                let from;
                if (importeeIsAbsolute) {
                    from = toURLString(file);
                } else {
                    from = toURLString(path.resolve(cwd, file));
                }
                code.push(`import f${i} from '${from}';`);
                code.push(`res.push({
                    'path': '${from}',
                    'value': f${i}
                })`);
                importArray.push(from);
            });

            code.push(`export default res;`);

            code = code.join('\n');

            return code;

        },
        'resolveId': function(importee, importer) {

            if (!filter(importee) || !importee.includes('*')) {
                return;
            }

            const hash = md5(importee + importer);

            fs.writeFileSync(path.join(os.tmpdir(), hash), JSON.stringify({
                'importee': importee,
                'importer': importer
            }));

            return hash;

        }
    };

};
