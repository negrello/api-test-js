import logger from '../setup/logger';
import SwaggerParser from 'swagger-parser';
import * as json2yml from 'json2yaml';
import jsf from 'json-schema-faker';
import fs from 'fs';
import os from 'os';
import path from 'path';

const argv = require('minimist')(process.argv.slice(2));
const BLOCK_SEPARATOR = '###############################################################';

jsf.option({
    'alwaysFakeOptionals': true,
    'useExamplesValue': true,
    'useDefaultValue': true
});

function normalizeRefs(s) {
    return JSON.parse(JSON.stringify(s).replace(/#\/definitions\//g, ''));
}

function findVal(obj, key) {
    var seen = new Set, active = [obj], found = [];
    while (active.length) {
        var new_active = [];
        for (var i = 0; i < active.length; i++) {
            if (active[i]) {
                Object.keys(active[i]).forEach(function (k) {
                    var x = active[i][k];
                    if (k === key) {
                        found.push(x);
                    }
                    if (x && typeof x === "object" &&
                        !seen.has(x)) {
                        seen.add(x);
                        new_active.push(x);
                    }
                });
            }
        }
        active = new_active;
    }
    if (found.length) return found;
    return null;
}

function addUnique(array, item) {
    if (!array.includes(item)) {
        array.push(item);
    }
}

function addResponseSchema(schemas, responseSchemas, schema) {
    if (typeof schema === 'string') {
        addUnique(responseSchemas, schema);
    } else {
        let refs = findVal(schema, '$ref');
        if (refs) {
            refs.forEach((ref) => {
                addUnique(responseSchemas, ref);
            });
            refs.forEach(ref => {
                if (responseSchemas.indexOf(ref) === -1) {
                    addResponseSchema(schemas, responseSchemas, schemas[ref]);
                }
            });
        }
    }
}

async function gen(file) {
    const schemas = {};
    const refs = [];
    let api = await SwaggerParser.parse(file);

    Object.entries(api.definitions)
        .forEach(([schemaName, s]) => {
            let normalized = normalizeRefs(s);
            schemas[`${schemaName}`] = normalized;
            refs.push({ id: `${schemaName}`, ...normalized });
        });

    let configBlock = {
        config: {
            SERVICE_URL: `${(api.schemes && api.schemes[0]) || 'http'}://${api.host}${api.basePath.replace(/\/$/, '')}`
        }
    }

    api.tags.forEach((tag, tagIndex) => {
        let blocks = [];
        blocks.push(configBlock);
        const responseSchemas = [];

        Object.keys(api.paths)
            .forEach((path, pathIndex) => {
                Object.keys(api.paths[path]).forEach((method, methodIndex) => {
                    const spec = api.paths[path][method];
                    if (!spec.tags.includes(tag.name)) {
                        return
                    }
                    let contentType = 'application/json';

                    if (spec.consumes && !spec.consumes.map(c => c.toLowerCase()).includes('application/json')) {
                        contentType = spec.consumes[0];
                    }
                    const apiTest = {
                        'test': spec.summary || spec.description || spec.operationId || `${path}: ${method}`,
                        'data': {
                            'url': `\${SERVICE_URL}${path}`,
                            'method': `${method.toUpperCase()}`,
                            'options': {
                                'headers': {
                                    'Content-Type': contentType,
                                    'Accept': spec.produces ? spec.produces.join(',') : 'application/json'
                                }
                            }
                        },
                        'asserts': {
                            'responsetime': 10000
                        }
                    };

                    Object.entries(spec.responses).find(([status, statusDesc]) => {
                        if (["200", "201"].includes(status) && statusDesc.schema) {
                            apiTest.asserts.status = parseInt(status);
                            apiTest.asserts.schema = normalizeRefs(statusDesc.schema);
                            addResponseSchema(schemas, responseSchemas, apiTest.asserts.schema);
                            return true;
                        }
                    });

                    if (!apiTest.asserts.status) {
                        let statuses = spec.responses ? Object.keys(spec.responses).map(r => parseInt(r)) : [];
                        if (statuses.includes("204")) {
                            apiTest.asserts.status = 204;
                        } else {
                            if (method.toUpperCase() == 'GET') {
                                apiTest.asserts.status = [200];
                            } else {
                                apiTest.asserts.status = [200, 201, 202, 204];
                            }
                        }
                    }

                    if (spec.parameters) {
                        spec.parameters.forEach((parameter) => {
                            if (parameter.in === 'body' || !parameter.in) {
                                if (parameter.schema) {
                                    let ref = parameter.schema['$ref'];
                                    let schema = {};

                                    if (ref) {
                                        let schemaName = parameter.schema['$ref'].replace('#/definitions/', '');
                                        schema = schemas[schemaName];
                                    } else {
                                        schema = parameter.schema;
                                        schema = normalizeRefs(schema);
                                    }

                                    const sampleBody = jsf.generate(schema, refs);
                                    apiTest.data.options.json = true;
                                    apiTest.data.options.body = sampleBody;
                                }
                            } else if (parameter.in === 'path') {
                                const sampleBody = jsf.generate({ type: parameter.type });
                                apiTest.data.parameters = apiTest.data.options.parameters || {};
                                apiTest.data.parameters[parameter.name] = sampleBody;
                                const re = new RegExp('\{' + parameter.name + '\}', "g");
                                apiTest.data.url = apiTest.data.url.replace(re, '${test.data.parameters.' + parameter.name + '}');
                            } else if (parameter.in === 'formData' || parameter.in === 'formdata') {
                                if (parameter.type === 'file') {
                                    apiTest.data.options.formData = apiTest.data.options.formData || {};
                                    apiTest.data.options.formData[parameter.name] = [`fs.createReadStream(\'\${fileDir}/${parameter.name.replace(/[/\\?%*:|"<>\\]\\[]/g, ' - ')}.json\')`];
                                }
                            }
                        });
                    }

                    blocks.push(apiTest);

                })
            });

        responseSchemas.forEach((s) => {
            const schema = {
                schema: s,
                ...schemas[s]
            };

            blocks.push(schema);
        })

        if (argv.tag) {
            let tagFilter = argv.tag;
            if (!tagFilter.forEach) {
                tagFilter = [tagFilter];
            }
            if (!tagFilter.includes(tag.name)) {
                return;
            }
        }

        let dir = argv.outDir || path.join('./', api.info.title);
        dir = dir.replace("~", os.homedir);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }

        const filePath = path.join(dir, tag.name + '.yaml');
        console.log(`Generating test descriptors generated at ${filePath}`);
        let stream = fs.createWriteStream(filePath);

        stream.once('open', function (fd) {
            stream.write(BLOCK_SEPARATOR + '\n');
            stream.write(`### API name: ${api.info.title}, Version: ${api.info.version}\n`);
            stream.write(`### Tag: ${tag.name}\n`);
            stream.write(BLOCK_SEPARATOR + '\n');
            let output = json2yml.stringify(blocks);
            output = output.replace(/^  - $/gm, BLOCK_SEPARATOR + '\n -');
            output = output.replace(/---\n.*?\n/gm, '---\n');
            output = output.replace(/- "fs.createReadStream\((.*)\)"/g, '- fs.createReadStream($1)');
            stream.write(output + '\n');
            stream.end();
        });

    });
}



if (argv.file) {
    gen(argv.file.replace("~", os.homedir)).catch(err => {
        console.error(err.message || err);
        process.exit(1);
    });
} else {
    logger.error('parameter \'file\' is required.');
    process.exit(1);
}
