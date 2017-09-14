'use strict';

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
	const generatedCodes = new Map();

    return {
        'name': 'rollup-bulk-import',
        'load': function(id) {
			if (!generatedCodes.has(id)) {
			    return;
		    }
            const code = generatedCodes.get(id);
            generatedCodes.delete(id);
            return code;
        },
        'resolveId': function(importee, importer) {

            if (!filter(importee) || !importee.includes('*')) {
                return;
            }

            const hash = md5(importee + importer);

			const importeeIsAbsolute = path.isAbsolute(importee);

            const cwd = path.dirname(importer);
            const globPattern = importee;

            const files = glob.sync(globPattern, {
                'cwd': cwd
            });

            let code = [`const res = [];`];

            files.forEach((file, i) => {
                let from;
                if (importeeIsAbsolute) {
                    from = toURLString(file);
                    code.push(`import f${i} from '${from}';`);
                } else {
                    from = toURLString(path.resolve(cwd, file));
                    code.push(`import f${i} from '${from}';`);
                }
                code.push(`res.push({
                    'path': '${from}',
                    'value': f${i}
                })`);
            });

            code.push(`export default res;`);

            code = code.join('\n');

			const pseudoPath = path.join(cwd, getPseudoFileName(importee));
			generatedCodes.set(pseudoPath, code);
			return pseudoPath;

        }
    };

};
