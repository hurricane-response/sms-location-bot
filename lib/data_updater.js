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
   * @param {string} dataUrl - the URL from which to fetch the geo.json data
   * @returns {DataUpdater} - the created DataUpdater instance
   */
  constructor (dataUrl) {
    super();
    this.dataUrl = dataUrl;
    this.updateInProgress = false;
  }

  /**
   * Performs a data update, kicking off a child process that requests data, then emits an 'update' event when done.
   * @param {boolean} childProcess - flag to run the update process on child process (default: false)
   * @emits DataUpdater#update
   * @returns {void}
   */
  performUpdate (childProcess = false) {
    let promise;
    this.updateInProgress = true;
    if (childProcess) { // TODO: Not yet working
      promise = new Promise((resolve, reject) => {
        console.log(`(${pidString}) executing update on child process...`);
        cp = fork(__filename, [], {
          stdio: [process.stdin, process.stdout, process.stderr, 'ipc'],
          env: { 'DATA_URL': this.dataUrl }
        });
        process.on('message', (data) => {
          if (data === 'fetchLocationData') {
            console.log(`(${pidString}) 'fetchLocationData': starting update.`);
            this.fetchLocationData()
              .then((cpResult) => {
                console.log(`(${pidString}) 'fetchLocationData': update completed.`);
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
    } else {
      console.log(`(${pidString}) starting update.`);
      promise = this.fetchLocationData();
    }
    promise
      .then((data) => {
        console.log(`(${pidString}) update complete, emitting update...`);
        this.emit('update', data);
        this.updateInProgress = false;
      })
      .catch((e) => {
        console.error(`(${pidString}) error performing data update: ${e.message}`, e.trace);
        this.updateInProgress = false;
      });
  }

  /**
   * Pulls geo.json data from the external source and emits an update event with the new data
   * @emits DataUpdater#update
   * @returns {void}
   */
  fetchLocationData () {
    return new Promise((resolve, reject) => {
      console.log(`[${new Date()}] Updating location data...`);
      https.get(this.dataUrl, (res) => {
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
            // console.log(`Processing feature: ${feature}`);
            features.push(JSON.parse(feature.toString()));
          });
        res.on('end', () => {
          const locationData = this.extractGeoJsonData(features);
          resolve(locationData);
        });
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
