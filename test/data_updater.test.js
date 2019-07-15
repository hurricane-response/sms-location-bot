import DataUpdater from '../lib/data_updater';

import { expect } from 'chai';
// import fs from 'fs';
// import https from 'https';

// Fixtures
// const dataFixture = fs.readFileSync(`${__dirname}/fixtures/geo.json`);

describe('DataUpdater', () => {
  it('creates a DataUpdater object', () => {
    const d = new DataUpdater('some_url');
    expect(d instanceof DataUpdater).to.be.true;
  });
});
