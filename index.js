'use strict';

const path = require('path');
const { createApp } = require('./src/server');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const dataFile = process.env.DATA_FILE || path.join(__dirname, 'data', 'db.json');

const { server } = createApp({ dataFile });
server.listen(PORT, HOST, () => {
  console.log(`Community Link running on http://${HOST}:${PORT}`);
});
