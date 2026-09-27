import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildOpenApiDocument } from './document.js';

import '../routes/health.js';
import '../routes/me.js';
import '../routes/tags.js';
import { streamsRouter } from '../routes/streams.js';
import '../routes/checkins.js';
import '../routes/forecast.js';
import '../routes/push.js';
import '../routes/coming-up.js';

streamsRouter('income');
streamsRouter('expense');

const document = buildOpenApiDocument();

const output = resolve(dirname(fileURLToPath(import.meta.url)), '../../openapi.json');
writeFileSync(output, JSON.stringify(document, null, 2) + '\n');
console.log(`OpenAPI spec written to ${output}`);
