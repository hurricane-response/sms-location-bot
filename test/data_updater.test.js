import DataUpdater from '../lib/data_updater';

import { expect } from 'chai';
import nock from 'nock';
import fs from 'fs';
import url from 'url';

// Fixtures
const dataFixture = fs.readFileSync(`${__dirname}/fixtures/geo.json`);

// Mock https.get
const default_url = 'https://localhost:3000/api/v2/shelters/geo.json';
const data_url = url.parse(process.env.DATA_URL ? process.env.DATA_URL : default_url);
const data_url_origin = `${data_url.protocol}//${data_url.hostname}:${data_url.port}`;
const data_url_path = data_url.pathname;
let data_api_mock;

console.log(`TEST PROCESS PID ${process.pid}`);

describe('DataUpdater', () => {
  before(() => {
    data_api_mock = nock(data_url_origin).log(console.log);
  });
  after(() => {
    nock.cleanAll();
    nock.restore();
  });

  describe('constructor', () => {
    it('creates a DataUpdater object', () => {
      const d = new DataUpdater('some_url');
      expect(d instanceof DataUpdater).to.be.true;
    });
  });

  describe('performUpdate()', () => {
    beforeEach(() => {
      data_api_mock.get(data_url_path)
        .reply(200, dataFixture, { 'Content-Type': 'application/json' });
    });

    afterEach(() => {
      if (!data_api_mock.isDone()) {
        console.log('data_api_mock pending:', data_api_mock.pendingMocks());
        console.log('data_api_mocks active:', data_api_mock.activeMocks());
      }
    });
    
    it.skip('launches a child process for the update', (done) => {
      const d = new DataUpdater(data_url);
      d.on('update', (data) => {
        console.log(`CHILD PROCESS VERSION - test process received 'update' event with data Map of size ${data.size}`);
        expect(data).to.be.instanceOf(Map);
        done();
      });
      d.performUpdate(true);
    });
    it('does an update on the main loop when specified', (done) => {
      const d = new DataUpdater(data_url);
      d.on('update', (data) => {
        console.log(`MAIN LOOP VERSION - test process received 'update' event with data Map of size ${data.size}`);
        expect(data).to.be.instanceOf(Map);
        done();
      });
      d.performUpdate(false);
    });
  });
});
