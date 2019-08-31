import zipcodes from 'zipcodes';
import LatLon from 'geodesy/latlon-ellipsoidal-vincenty';

/**
 * Class that finds PODs for a given set of zipcodes
 */
export default class PODsFinder {
  /**
   * Constructor for class
   * @param {Map<string,Array<Object>>} locationData - the POD location geodata
   * @param {number} mileRadius - the mile radius to use when finding nearby PODs
   * @returns {PODsFinder} - the created PODsFinder instance
   */
  constructor (locationData, mileRadius) {
    this.locationData = locationData;
    this.mileRadius = mileRadius;
  }

  /**
   * Update POD location geodata used in lookups
   * @param {Map<string,Array<Object>>} locationData - the new POD location geodata
   * @returns {void}
   */
  updateLocationData (locationData) { this.locationData = locationData; }

  /**
   * Process an incoming message to extract zipcode information
   * @param {Array<string>} sentZipCodes - the zipcodes to find PODs for
   * @returns {Array<string>} - the array of POD messages
   */
  findPODs (sentZipCodes) {
    if(sentZipCodes.length == 0) {
      return ['Sorry, I couldn\'t find any ZIP codes in your text message. Please try again.',];
    }
    const knownZipCodes = this.zipCodesWithPODs();
    const lookupZipCodes = this.augmentLookupZipCodes(sentZipCodes);
    let foundPODs = this.computeFoundPODs(lookupZipCodes, knownZipCodes);
    if (foundPODs.length == 0) {
      return [`Sorry, I don't know about any food and water distribution points near ${sentZipCodes.join(' or ')}. Please try again later!`,];
    }
    let podsArray = this.collectPODs(foundPODs, lookupZipCodes);
    podsArray = _dedupeArray(podsArray, 'podIndex');

    const sorts = this.sortedPODListsByLookupZip(podsArray, lookupZipCodes.map((z) => z.zip), 3);
    const messages = this.buildMessages(sorts);
    return messages;
  }

  /**
   * Get all zip codes with known PODs in them
   * @returns {Array<string>} - the array of zip codes
   */
  zipCodesWithPODs () {
    return Array.from(this.locationData.keys());
  }
  
  /**
   * Augment the zipcodes with zip information and zips in radius
   * @param {Array<string>} zips - the array of zipcodes to augment
   * @returns {Array<Object>} - the array of augmented zipcodes
   */
  augmentLookupZipCodes (zips) {
    return zips.map((zip) => {
      const zipInfo = zipcodes.lookup(zip);
      return {
        zip: zipInfo.zip,
        info: zipInfo,
        latlon: new LatLon(zipInfo.latitude, zipInfo.longitude),
        zipsInMileRadius: zipcodes.radius(zipInfo.zip, this.mileRadius)
      };
    });
  }

  /**
   * Compute the PODs found in the known zip codes from the lookups
   * @param {Array<Object>} lookupZipCodes - the zipcodes to perform the lookup with
   * @param {Array<Object>} knownZipCodes - the known zipcodes among the PODs
   * @returns {Array<Object>} - the array of PODs found from the lookup
   */
  computeFoundPODs (lookupZipCodes, knownZipCodes) {
    let foundPODs = [];
    lookupZipCodes.forEach((z) => {
      knownZipCodes.forEach((known) => {
        if (z.zipsInMileRadius.indexOf(known.toString()) >= 0) {
          foundPODs.push(known.toString());
        }
      });
    });
    return foundPODs;
  }

  /**
   * Augment the POD record with distance from lookups, whether its
   * in the radius from the lookups, and with the message segment
   * @param {Object} podRecord - the POD record object
   * @param {Array<Object>} lookupZipCodes - the array of lookups
   * @returns {Array<Object>} - the augmented POD record
   */
  augmentPODRecord (podRecord, lookupZipCodes) {
    const { pod, address, phone } = podRecord;
    const podLatLon = new LatLon(podRecord.latitude, podRecord.longitude);
    const podDistancesFromLookupZips = Array.from(
      lookupZipCodes.map((zip) => {
        return zip.latlon.distanceTo(podLatLon);
      })
    );
    const zipInMileRadiusFromPOD = Array.from(
      lookupZipCodes.map((zip) => {
        return zip.zipsInMileRadius.includes(podRecord.zip);
      })
    );
    const distances = {};
    const inRadius = {};
    for (let idx in lookupZipCodes) {
      const zip = lookupZipCodes[idx].zip;
      distances[zip] = podDistancesFromLookupZips[idx]; 
      inRadius[zip] = zipInMileRadiusFromPOD[idx];
    }
    return {
      ...podRecord,
      distances: distances,
      inRadius: inRadius,
      message: `\n\n${pod}\n${address}${phone ? `\n${phone}` : ''}`
    };
  }

  /**
   * Collect the PODs for the array of zip codes into an Array
   * @param {Array<Object>} foundPODs - the PODs to be collected
   * @param {Array<Object>} lookupZipCodes - the augmented lookup zips
   * @returns {Array<Object>} - the collected arrray of all relevant PODs
   */
  collectPODs (foundPODs, lookupZipCodes) {
    let podsArray = [];
    for (let zip of foundPODs) {
      const loc = this.locationData.get(zip);
      if (loc) {
        const pods = Array.from(loc);
        podsArray = podsArray.concat(
          pods.map(
            (podRecord) => {
              return this.augmentPODRecord(podRecord, lookupZipCodes)
            }
          )
        );
      } else {
        console.warn(`Unexpected missing zip: ${zip}`);
      }
    }
    return podsArray;
  }

  /**
   * Return the array of PODs in radius, filtering out those not
   * @param {Array<Object>} pods - the array of PODs
   * @param {string} lookupZip - the lookup index for the radius value
   * @returns {Array<Object>} - the filtered array of PODs
   */
  getInRadiusPODs (pods, lookupZip) {
    return pods.filter((sh, _i, _a, k = lookupZip) => sh.inRadius[k]);
  }

  /**
   * Return the array of PODs sorted by distance ascending
   * @param {Array<Object>} pods - the array of PODs
   * @param {string} lookupZip - the lookup zipcode for the distance value
   * @returns {Array<Object>} - the sorted array of PODs
   */
  sortPODsByDistance (pods, lookupZip) {
    return pods.sort((a, b, k = lookupZip) =>
      a.distances[k] - b.distances[k]
    );
  }

  /**
   * Truncate the array of PODs to the amount specified
   * @param {Array<Object>} pods - the array of PODs
   * @param {number} amount - the number of PODs to return
   * @returns {Array<Object>} - the truncated array of PODs
   */
  truncatePODList (pods, amount) {
    return pods.slice(0, amount);
  }

  /**
   * Filter, sort and truncate the list of PODs per lookup zipcode
   * @param {Array<Object>} pods - the array of augmented POD records
   * @param {Array<Object>} lookups - the array of augmented lookup zipcodes
   * @param {number} podsPerLookup - the number of PODs to return per lookup zipcode
   * @returns {Array<Object>} - the filtered, sorted and truncated array
   */
  sortedPODListsByLookupZip (pods, lookups, podsPerLookup) {
    const results = {};
    const n = podsPerLookup;
    lookups.forEach((zip) => {
      const filtered = this.getInRadiusPODs(pods, zip);
      const sorted = this.sortPODsByDistance(filtered, zip);
      const truncated = this.truncatePODList(sorted, n);
      results[zip] = truncated;
    });
    return results;
  }

  /**
   * Construct messages from sorted POD lists by lookup zipcode
   * @param {Object} sorts - the object of sorted POD lists keyed by lookup zipcode
   * @returns {Array<string>} - the array of messages
   */
  buildMessages (sorts) {
    const messages = [];
    const milesToMeters = 1609.344, metersToMiles = 1.0 / milesToMeters;
    for (let key in sorts) {
      const podsSort = sorts[key];
      const zipcode = key;
      let resultString = `Found ${podsSort.length} food/water distribution points near ${zipcode}:`;
      for (let pod of podsSort) {
        let dist = metersToMiles * pod.distances[key];
        dist = (dist < 1.0 ? Math.ceil(dist * 10) / 10 : Math.ceil(dist));
        const msg = pod.message +
          `\n${dist < 1 ? 'Under 1' : `About ${dist}`}mi away`;
        if ((resultString + msg).length > 800) {
          messages.push(resultString);
          resultString = '';
        }
        resultString += msg;
      }
      if (resultString.length > 0) { messages.push(resultString) }
    }
    return messages;
  }
}

// Helper functions
export const _dedupeArray = function (arr, key) {
  let a = _deepCopyArray(arr).reverse();
  a = a.filter(function (e, i, a) {
    const testVal = e[key];
    return a.slice(i + 1).findIndex((o) => o[key] === testVal) === -1;
  });
  return a.reverse();
};

export const _deepCopyArray = function (o) {
  let output, v, key;
  output = Array.isArray(o) ? [] : (o == null ? null : {});
  for (key in o) {
    if (o.hasOwnProperty(key)) {
      v = o[key];
      output[key] = (typeof v === 'object') ? _deepCopyArray(v) : v;
    }
  }
  return output;
};