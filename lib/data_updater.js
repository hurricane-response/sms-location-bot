import https from 'https';
import { EventEmitter } from 'events';
import FeatureParser from 'feature-parser';
import zipcodes from 'zipcodes';
// const childProcess = require('child_process');

/**
 * Class that handles loading data from the external data source
 */
export default class DataUpdater extends EventEmitter {
  /**
   * Class constructor
   * @param {string} data_url - the URL from which to fetch the geo.json data
   * @returns {DataUpdater} - the created DataUpdater instance
   */
  constructor (data_url) {
    super();
    this.data_url = data_url
  }

  /**
   * Performs a data update, kicking off a child process that requests data, then emits an 'update' event when done.
   * @emits DataUpdater#update
   * @returns {void}
   */
  performUpdate () {
    // childProcess.spawn()
  }

  /**
   * Pulls geo.json data from the external source and emits an update event with the new data
   * @emits DataUpdater#update
   * @returns {void}
   */
  fetchLocationData () {
    return new Promise((resolve, reject) => {
      console.log(`[${new Date()}] Updating location data...`);
      https.get(process.env.DATA_URL, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];
      
        let error;
        if (statusCode !== 200) {
          error = new Error('Request Failed.\n' +
            `Status Code: ${statusCode}`);
        } else if (!/^application\/json/.test(contentType)) {
          error = new Error('Invalid content-type.\n' +
            `Expected application/json but received ${contentType}`);
        }
        if (error) {
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
          // TODO: Remove emit to spawner above once done.
          this.emit('update', locationData);
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
        if(!extractedData.has(zip)) {
          extractedData.set(zip, new Array());           
        }
        extractedData.get(zip).push({
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
