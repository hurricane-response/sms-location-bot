import https from 'https';
import { EventEmitter } from 'events';
import FeatureParser from 'feature-parser';
import zipcodes from 'zipcodes';
import { fork }  from 'child_process';
let cp = undefined; // used to hold child process when update run as child process
const pidString = `${process.ppid ? `${process.ppid} > ` : ''}PID ${process.pid}`;

/**
 * Class that handles loading data from the external data source
 */
export default class DataUpdater extends EventEmitter {
  /**
   * Class constructor
   * @param {string} apiRoot - the root URL from which to fetch the geo.json data
   * @param {Object} dataPaths - the paths from which to pull data with label as key
   * @returns {DataUpdater} - the created DataUpdater instance
   */
  constructor (apiRoot, dataPaths) {
    console.log('creating new DataUpdater with args:', 'apiRoot =', apiRoot, ', dataPaths =', dataPaths);
    super();
    this.apiRoot = apiRoot;
    this.dataPaths = {};
    for (let [dataLabel, apiPath] of Object.entries(dataPaths)) {
      this.dataPaths[dataLabel] = this.apiRoot + apiPath;
    }
    this.updateInProgress = false;
  }

  /**
   * Performs a data update, kicking off a child process that requests data, then emits an 'update' event when done.
   * @param {boolean} childProcess - flag to run the update process on child process (default: false)
   * @emits DataUpdater#update
   * @returns {void}
   */
  performUpdate (childProcess = false) {
    let promises;
    this.updateInProgress = true;
    if (childProcess) { // TODO: Not yet working
      promises = Object.entries(this.dataPaths).map((label_and_uri) => {
        const [dataLabel, uri] = label_and_uri;
        return new Promise((resolve, reject) => {
          console.log(`(${pidString}) executing update on child process...`);
          cp = fork(__filename, [], {
            stdio: [process.stdin, process.stdout, process.stderr, 'ipc'],
            env: { 'DATA_URL': uri, 'DATA_LABEL': dataLabel }
          });
          process.on('message', (data) => {
            if (data === 'fetchLocationData') {
              console.log(`(${pidString}) 'fetchLocationData': starting update.`);
              this.fetchLocationData(process.env.DATA_LABEL, process.env.DATA_URL)
                .then((cpResult) => {
                  console.log(`(${pidString}) 'fetchLocationData': update completed for ${process.env.DATA_LABEL} (${process.env.DATA_URL}).`);
                  process.send('message', cpResult);
                });
            } else {
              console.log(`(${pidString}) Unknown message value.`);
            }
          });
          process.on('error', (error) => {
            console.error(`(${pidString}) Error in child process execution: ${error.message}`, error.trace);
            reject(error);
          });
          cp.on('message', (data) => {
            resolve(data);
          });
          cp.on('exit', (code, signal) => {
            console.log(`(${pidString}) child process exited with code ${code}${signal ? `and signal ${signal}` : ''}.`);
          });
          cp.send('fetchLocationData');
        });
      });
    } else {
      console.log(`(${pidString}) starting update.`);
      promises = Object.entries(this.dataPaths)
        .map(([dataLabel, uri]) => { return this.fetchLocationData(dataLabel, uri); });
    }
    Promise.all(promises)
      .then((data) => {
        const updatedDataStore = {};
        console.log(updatedDataStore, data)
        for (let [label, geodata] of data) { updatedDataStore[label] = geodata; }
        console.log(`(${pidString}) updates complete, emitting update event...`);
        this.emit('update', updatedDataStore);
        this.updateInProgress = false;
      })
      .catch((e) => {
        console.error(`(${pidString}) error performing data update: ${e.message}`, e.trace);
        this.updateInProgress = false;
      });
  }

  /**
   * Pulls geo.json data from the external source and emits an update event with the new data
   * @param {string} label - the label to use when adding data to the store object
   * @param {string} uri - the URI from which to fetch location data
   * @returns {Promise} - a Promise object which resolves to an array of [label, dataset]
   */
  fetchLocationData (label, uri) {
    return new Promise((resolve, reject) => {
      console.log(`[${new Date()}] Updating ${label} location data from ${uri}...`);
      https.get(uri, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];
        const error = this.handleErrorResponse(statusCode, contentType);
        if (error !== null) {
          console.error(error.message);
          // Consume response data to free up memory
          res.resume();
          reject(error);
        }
        res.setEncoding('utf8');
        const features = [];
        res.pipe(FeatureParser.parse())
          .each((feature) => {
            try {
              features.push(JSON.parse(feature.toString()));
            } catch (error) {
              if (error instanceof SyntaxError && error.message === 'Unexpected token ] in JSON at position 0') {
                console.log(`Received empty response from API for ${label} (${uri})`);
              } else {
                console.error(`ERROR while processing ${label} (${uri}) feature: ${feature}`, error);
              }
            }
          });
        res.on('end', () => { resolve([label, this.extractGeoJsonData(features)]); });
        console.log(`[${new Date()}] Location update complete.`);
      }).on('error', (e) => {
        console.error(`Got error: ${e.message}`);
        reject(e);
      });
    });
  }

  /**
   * Handle non-200 response code or bad Content-Type header
   * @param {number} statusCode - the status code returned with the response
   * @param {string} contentType - the response Content-Type header
   * @returns {Error|null} - the status code
   */
  handleErrorResponse (statusCode, contentType) {
    let error;
    if (statusCode !== 200) {
      error = new Error('Request Failed.\n' +
        `Status Code: ${statusCode}`);
    } else if (!/^application\/json/.test(contentType)) {
      error = new Error('Invalid content-type.\n' +
        `Expected application/json but received ${contentType}`);
    }
    if (error) { return (error); }
    return null;
  }

  /**
   * Extract the location features from the parsed geo.json data
   * @param {Array<Object>} features - the geo.json data, segmented into features, each parsed into an object
   * @returns {Map<string,Array<Object>>} - the Map of location data indexed by zip code
   */
  extractGeoJsonData (features) {
    let extractedData = new Map();
    let featureCount = features.length;
    features.map((val, idx) => {
      const { zip } = val.properties;
      const zipData = zipcodes.lookup(zip);
      if (!!zipData && zipData.hasOwnProperty('zip')) {
        featureCount += 1;
        if(!extractedData.has(zipData.zip)) {
          extractedData.set(zipData.zip, new Array());           
        }
        extractedData.get(zipData.zip).push({
          ...val.properties,
          shelterIndex: idx+1
        });
      }
    });
    console.log(`Extracted ${featureCount} features in ${extractedData.size} distinct zip codes.`);
    return extractedData;
  }
}

// TODO: Setup child_process to run this...
